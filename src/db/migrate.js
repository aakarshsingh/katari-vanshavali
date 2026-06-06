const pool = require('./client');

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tree (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title_en TEXT NOT NULL DEFAULT 'Family Tree',
        title_hi TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS person (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tree_id UUID NOT NULL REFERENCES tree(id) ON DELETE CASCADE,
        name_en TEXT NOT NULL,
        name_hi TEXT,
        birth_year INTEGER,
        death_year INTEGER,
        spouse_en TEXT,
        spouse_hi TEXT,
        gender TEXT CHECK (gender IN ('M','F','other')) DEFAULT 'M',
        notes TEXT,
        x_pos FLOAT DEFAULT 0,
        y_pos FLOAT DEFAULT 0
      )
    `);

    // Pivot R2: spouse gets its own birth/death/gender (paired couple boxes).
    // Idempotent — safe to re-run on an already-seeded DB.
    await client.query(`ALTER TABLE person ADD COLUMN IF NOT EXISTS spouse_birth_year INTEGER`);
    await client.query(`ALTER TABLE person ADD COLUMN IF NOT EXISTS spouse_death_year INTEGER`);
    await client.query(`ALTER TABLE person ADD COLUMN IF NOT EXISTS spouse_gender TEXT`);
    await client.query(`ALTER TABLE person ADD COLUMN IF NOT EXISTS deceased BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE person ADD COLUMN IF NOT EXISTS spouse_deceased BOOLEAN DEFAULT FALSE`);

    // Pivot R4: sibling ordering — manual sequence number (1, 2, 3…), nullable.
    await client.query(`ALTER TABLE person ADD COLUMN IF NOT EXISTS sequence INTEGER`);

    // Normalise the tree title to "Katari Lineage" (EN) / "वंशावली" (HI).
    // Only touches placeholder/broken states (empty, old default, or Devanagari
    // mistakenly stored in title_en) — won't clobber a real English title.
    await client.query(
      `UPDATE tree SET title_en = 'Katari Lineage'
        WHERE title_en IS NULL OR btrim(title_en) = ''
           OR title_en = 'Family Tree' OR title_en = 'वंशावली'`
    );
    await client.query(
      `UPDATE tree SET title_hi = 'वंशावली'
        WHERE title_hi IS NULL OR btrim(title_hi) = ''`
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS relationship (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tree_id UUID NOT NULL REFERENCES tree(id) ON DELETE CASCADE,
        parent_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        child_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        UNIQUE(parent_id, child_id)
      )
    `);

    // Phase 2: admin accounts + edit-moderation queue/history. All additive +
    // idempotent. Moderation defaults OFF so behaviour is unchanged until enabled.
    await client.query(`ALTER TABLE tree ADD COLUMN IF NOT EXISTS moderation_enabled BOOLEAN NOT NULL DEFAULT FALSE`);

    // Phase 2.14: field-visibility flags. Birth-year reveal is OFF by default
    // (global, on the tree); per-person death-year force-hide is OFF by default.
    // Soft-hide only — these gate the public serializer, never delete data.
    await client.query(`ALTER TABLE tree ADD COLUMN IF NOT EXISTS show_birth_year BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE person ADD COLUMN IF NOT EXISTS death_year_hidden BOOLEAN NOT NULL DEFAULT FALSE`);
    await client.query(`ALTER TABLE person ADD COLUMN IF NOT EXISTS spouse_death_year_hidden BOOLEAN NOT NULL DEFAULT FALSE`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_user (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS change_request (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tree_id UUID REFERENCES tree(id) ON DELETE CASCADE,
        op_type TEXT NOT NULL CHECK (op_type IN ('create','update','delete')),
        entity  TEXT NOT NULL CHECK (entity IN ('person','relationship','tree')),
        target_id UUID,
        payload JSONB,
        before_snapshot JSONB,
        after_snapshot  JSONB,
        status TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected','applied','reverted')),
        submitter_note TEXT,
        client_token TEXT,
        resolved_by UUID REFERENCES admin_user(id),
        submitted_at TIMESTAMPTZ DEFAULT now(),
        resolved_at  TIMESTAMPTZ
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_change_request_status ON change_request(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_change_request_token  ON change_request(client_token)`);

    console.log('Migrations complete.');
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migration failed:', err.message);
      pool.end();
      process.exit(1);
    });
}
