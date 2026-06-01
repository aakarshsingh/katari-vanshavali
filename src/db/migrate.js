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

    await client.query(`
      CREATE TABLE IF NOT EXISTS relationship (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tree_id UUID NOT NULL REFERENCES tree(id) ON DELETE CASCADE,
        parent_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        child_id UUID NOT NULL REFERENCES person(id) ON DELETE CASCADE,
        UNIQUE(parent_id, child_id)
      )
    `);

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
