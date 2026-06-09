// Local dev launcher: runs the full app on an in-memory pg-mem database.
//   npm run dev:mock
// No Postgres install required. Data is ephemeral (resets every restart).
// USE_MOCK_DB must be set before any module that requires the db client.
require('dotenv').config({ quiet: true }); // load .env (JWT_SECRET etc.) first
process.env.USE_MOCK_DB = '1';

const path = require('path');
const fs = require('fs');
const pool = require('../src/db/client');
const { runMigrations } = require('../src/db/migrate');
const app = require('../server');

const PORT = process.env.PORT || 3000;
const SEED_PATH = path.join(__dirname, '..', 'docs', 'seed.json');

// Self-contained seeder (the production seeder was removed in Phase 2.8).
// Maps the seed file's short ids (p1, p2, …) to generated UUIDs.
async function seedFromJson() {
  if (!fs.existsSync(SEED_PATH)) {
    console.warn('[dev:mock] docs/seed.json not found — starting with an empty tree');
    return;
  }
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

  const existing = await pool.query('SELECT id FROM tree LIMIT 1');
  let treeId;
  if (existing.rows[0]) {
    treeId = existing.rows[0].id;
  } else {
    const t = await pool.query(
      'INSERT INTO tree (title_en, title_hi) VALUES ($1, $2) RETURNING id',
      [seed.title_en || 'Katari Lineage', seed.title_hi || 'वंशावली']
    );
    treeId = t.rows[0].id;
  }

  const idMap = {};
  for (const p of seed.persons || []) {
    // Preserve the seed's id when present (real export ids) so relationships
    // referencing them resolve; fall back to a generated id otherwise.
    const cols = ['tree_id', 'name_en', 'name_hi', 'birth_year', 'death_year',
      'spouse_en', 'spouse_hi', 'spouse_birth_year', 'spouse_death_year', 'spouse_gender',
      'gender', 'notes', 'deceased', 'spouse_deceased', 'sequence', 'x_pos', 'y_pos'];
    const vals = [treeId, p.name_en, p.name_hi || null, p.birth_year ?? null, p.death_year ?? null,
      p.spouse_en || null, p.spouse_hi || null, p.spouse_birth_year ?? null, p.spouse_death_year ?? null,
      p.spouse_gender || null, p.gender || 'M', p.notes || null, p.deceased === true,
      p.spouse_deceased === true, p.sequence ?? null, p.x_pos ?? 0, p.y_pos ?? 0];
    if (p.id) { cols.unshift('id'); vals.unshift(p.id); }
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const r = await pool.query(
      `INSERT INTO person (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      vals
    );
    idMap[p.id || r.rows[0].id] = r.rows[0].id;
  }

  let relCount = 0;
  for (const rel of seed.relationships || []) {
    const parent = idMap[rel.parent_id];
    const child = idMap[rel.child_id];
    if (!parent || !child) continue;
    await pool.query(
      'INSERT INTO relationship (tree_id, parent_id, child_id) VALUES ($1, $2, $3)',
      [treeId, parent, child]
    );
    relCount++;
  }
  console.log(`[dev:mock] seeded ${Object.keys(idMap).length} persons, ${relCount} relationships`);
}

(async () => {
  console.log('==========================================================');
  console.log('  MOCK DB — in-memory (pg-mem). Data resets on restart.');
  console.log('==========================================================');
  await runMigrations();
  await seedFromJson();
  app.listen(PORT, () => console.log(`[dev:mock] running on http://localhost:${PORT}`));
})().catch((err) => {
  console.error('[dev:mock] failed to start:', err.message);
  process.exit(1);
});
