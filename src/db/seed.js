const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const pool = require('./client');

const SEED_PATH = path.join(__dirname, '../../docs/seed.json');

async function runSeed() {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`seed.json not found at ${SEED_PATH}. Run npm run seed:pdf first.`);
  }

  const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

  let tree_id;
  const existing = await pool.query('SELECT id FROM tree LIMIT 1');
  if (existing.rows.length === 0) {
    const result = await pool.query(
      'INSERT INTO tree (title_en, title_hi) VALUES ($1, $2) RETURNING id',
      [data.title_en || 'Family Tree', data.title_hi || null]
    );
    tree_id = result.rows[0].id;
  } else {
    tree_id = existing.rows[0].id;
    await pool.query(
      'UPDATE tree SET title_en = $1, title_hi = $2 WHERE id = $3',
      [data.title_en || 'Family Tree', data.title_hi || null, tree_id]
    );
  }

  const idMap = {};
  for (const p of data.persons) {
    idMap[p.id] = uuidv4();
  }

  let personCount = 0;
  for (const p of data.persons) {
    await pool.query(
      `INSERT INTO person
         (id, tree_id, name_en, name_hi, birth_year, death_year, spouse_en, spouse_hi, gender)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [
        idMap[p.id], tree_id,
        p.name_en, p.name_hi || null,
        p.birth_year || null, p.death_year || null,
        p.spouse_en || null, p.spouse_hi || null,
        p.gender || 'M',
      ]
    );
    personCount++;
  }

  let relCount = 0;
  for (const r of data.relationships) {
    const parent_uuid = idMap[r.parent_id];
    const child_uuid = idMap[r.child_id];
    if (!parent_uuid || !child_uuid) {
      console.warn(`Skipping relationship: unknown ID ${r.parent_id} → ${r.child_id}`);
      continue;
    }
    await pool.query(
      `INSERT INTO relationship (tree_id, parent_id, child_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (parent_id, child_id) DO NOTHING`,
      [tree_id, parent_uuid, child_uuid]
    );
    relCount++;
  }

  console.log(`Seed complete: ${personCount} persons, ${relCount} relationships inserted`);
}

// CLI entrypoint: npm run seed
if (require.main === module) {
  runSeed()
    .then(() => pool.end())
    .catch(err => {
      console.error('seed.js failed:', err.message);
      pool.end();
      process.exit(1);
    });
}

module.exports = { runSeed };
