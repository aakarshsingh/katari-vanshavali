const pool = require('../db/client');

// Person columns that callers may set. `id`/`x_pos`/`y_pos` are accepted too
// (used when restoring a deleted person from a before-snapshot during revert).
const PERSON_FIELDS = [
  'name_en', 'name_hi', 'birth_year', 'death_year', 'spouse_en', 'spouse_hi',
  'spouse_birth_year', 'spouse_death_year', 'spouse_gender', 'gender', 'notes',
  'deceased', 'spouse_deceased', 'sequence',
];
const PERSON_CREATE_COLS = ['id', ...PERSON_FIELDS, 'x_pos', 'y_pos'];

function notFound(entity, id) {
  const err = new Error(`${entity}${id ? ' ' + id : ''} not found`);
  err.code = 'NOT_FOUND';
  return err;
}

async function fetchOne(client, sql, params) {
  const { rows } = await client.query(sql, params);
  return rows[0] || null;
}

function coercePersonValue(field, value) {
  if (value === '') return null;
  if (field === 'name_en' && typeof value === 'string') return value.trim();
  return value;
}

// Runs `fn(client)` inside a BEGIN/COMMIT, rolling back on any error.
// The caller's fn owns all writes; the pooled client is released here.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback failure */ }
    throw err;
  } finally {
    client.release();
  }
}

async function resolveTreeId(client, payload) {
  if (payload && payload.tree_id) return payload.tree_id;
  const tree = await fetchOne(client, 'SELECT id FROM tree LIMIT 1', []);
  if (!tree) throw new Error('No tree exists');
  return tree.id;
}

async function createPerson(client, payload) {
  const tree_id = await resolveTreeId(client, payload);
  if (!payload.name_en) throw new Error('name_en is required');

  const cols = ['tree_id'];
  const vals = [tree_id];
  for (const f of PERSON_CREATE_COLS) {
    if (payload[f] !== undefined) {
      cols.push(f);
      vals.push(coercePersonValue(f, payload[f]));
    }
  }
  if (!cols.includes('gender')) { cols.push('gender'); vals.push('M'); }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await client.query(
    `INSERT INTO person (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  const person = rows[0];

  let relationship = null;
  if (payload.parent_id) {
    const relCols = ['tree_id', 'parent_id', 'child_id'];
    const relVals = [tree_id, payload.parent_id, person.id];
    if (payload.relationship_id) { relCols.unshift('id'); relVals.unshift(payload.relationship_id); }
    const relPlaceholders = relVals.map((_, i) => `$${i + 1}`).join(', ');
    const relResult = await client.query(
      `INSERT INTO relationship (${relCols.join(', ')}) VALUES (${relPlaceholders}) RETURNING *`,
      relVals
    );
    relationship = relResult.rows[0];
  }
  return { before: null, after: { person, relationship } };
}

async function updatePerson(client, target_id, payload) {
  const before = await fetchOne(client, 'SELECT * FROM person WHERE id = $1', [target_id]);
  if (!before) throw notFound('person', target_id);

  const sets = [];
  const vals = [];
  let i = 1;
  for (const f of PERSON_FIELDS) {
    if (payload[f] !== undefined) {
      sets.push(`${f} = $${i++}`);
      vals.push(coercePersonValue(f, payload[f]));
    }
  }
  if (sets.length === 0) return { before, after: before };
  vals.push(target_id);
  const { rows } = await client.query(
    `UPDATE person SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return { before, after: rows[0] };
}

async function deletePerson(client, target_id) {
  const person = await fetchOne(client, 'SELECT * FROM person WHERE id = $1', [target_id]);
  if (!person) throw notFound('person', target_id);
  const rels = await client.query(
    'SELECT * FROM relationship WHERE parent_id = $1 OR child_id = $1',
    [target_id]
  );
  await client.query('DELETE FROM person WHERE id = $1', [target_id]);
  return { before: { person, relationships: rels.rows }, after: null };
}

async function createRelationship(client, payload) {
  let tree_id = payload.tree_id;
  if (!tree_id) {
    const parent = await fetchOne(client, 'SELECT tree_id FROM person WHERE id = $1', [payload.parent_id]);
    if (!parent) throw notFound('parent person', payload.parent_id);
    tree_id = parent.tree_id;
  }
  const cols = ['tree_id', 'parent_id', 'child_id'];
  const vals = [tree_id, payload.parent_id, payload.child_id];
  if (payload.id) { cols.unshift('id'); vals.unshift(payload.id); }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const { rows } = await client.query(
    `INSERT INTO relationship (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  return { before: null, after: { relationship: rows[0] } };
}

async function deleteRelationship(client, target_id) {
  const rel = await fetchOne(client, 'SELECT * FROM relationship WHERE id = $1', [target_id]);
  if (!rel) throw notFound('relationship', target_id);
  await client.query('DELETE FROM relationship WHERE id = $1', [target_id]);
  return { before: { relationship: rel }, after: null };
}

async function updateTree(client, payload) {
  const before = await fetchOne(client, 'SELECT * FROM tree LIMIT 1', []);
  if (!before) throw notFound('tree');
  const { rows } = await client.query(
    `UPDATE tree SET
       title_en = COALESCE($1, title_en),
       title_hi = COALESCE($2, title_hi),
       updated_at = now()
     WHERE id = $3 RETURNING *`,
    [payload.title_en ?? null, payload.title_hi ?? null, before.id]
  );
  return { before, after: rows[0] };
}

// The single live writer. `client` owns the transaction (see withTransaction).
// Returns `{ before, after }` snapshots for the changelog / revert source.
async function applyChange(client, { op_type, entity, target_id, payload = {} }) {
  if (entity === 'person') {
    if (op_type === 'create') return createPerson(client, payload);
    if (op_type === 'update') return updatePerson(client, target_id, payload);
    if (op_type === 'delete') return deletePerson(client, target_id);
  } else if (entity === 'relationship') {
    if (op_type === 'create') return createRelationship(client, payload);
    if (op_type === 'delete') return deleteRelationship(client, target_id);
  } else if (entity === 'tree') {
    if (op_type === 'update') return updateTree(client, payload);
  }
  throw new Error(`Unsupported change: ${entity}/${op_type}`);
}

module.exports = { applyChange, withTransaction, PERSON_FIELDS };
