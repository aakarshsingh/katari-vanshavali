const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireAdmin } = require('../middleware/auth');
const { applyChange, withTransaction } = require('../services/mutations');

// The ancestor lineage is the single-child chain ABOVE the focal person
// ("Bade Lal Singh"). It is admin-managed as one ordered list: editing this
// endpoint reconciles the whole chain in a single transaction, which is what
// keeps the single parent→child invariant intact through insert/remove/reorder
// (a multi-call client orchestration could corrupt the chain on partial failure).

const FOCAL_NAME = 'Bade Lal Singh';
const ANCESTOR_FIELDS = ['name_en', 'name_hi', 'birth_year', 'death_year', 'deceased'];
const MAX_CHAIN = 25;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function badRequest(msg) {
  const err = new Error(msg);
  err.code = 'BAD_REQUEST';
  return err;
}

// Walk the single-child chain from the root until the focal (name match) or a
// branch point. Returns the ordered ancestor ids (above focal) + the focalId.
// Mirrors splitTree() on the client — the server can't import client JS.
function walkChain(persons, relationships, focalNameEn) {
  const childrenOf = {};
  const byId = {};
  for (const p of persons) { childrenOf[p.id] = []; byId[p.id] = p; }
  for (const r of relationships) {
    if (childrenOf[r.parent_id] !== undefined) childrenOf[r.parent_id].push(r.child_id);
  }
  const hasParent = new Set(relationships.map((r) => r.child_id));
  const roots = persons.filter((p) => !hasParent.has(p.id)).map((p) => p.id);
  const root = roots.length > 0 ? roots[0] : (persons[0] && persons[0].id) || null;

  const chain = [];
  const target = (focalNameEn || '').toLowerCase();
  let current = root;
  let focalId = null;
  while (current) {
    const p = byId[current];
    if (!p) break;
    if (target && (p.name_en || '').toLowerCase().includes(target)) { focalId = current; break; }
    const ch = childrenOf[current] || [];
    if (ch.length !== 1) { focalId = current; break; }
    chain.push(current);
    current = ch[0];
  }
  if (!focalId) focalId = current || root;
  return { chain, focalId, byId };
}

async function loadGraph(conn) {
  const tree = (await conn.query('SELECT id FROM tree LIMIT 1')).rows[0];
  if (!tree) throw badRequest('No tree exists yet');
  const persons = (await conn.query('SELECT * FROM person WHERE tree_id = $1', [tree.id])).rows;
  const relationships = (await conn.query('SELECT * FROM relationship WHERE tree_id = $1', [tree.id])).rows;
  return { treeId: tree.id, persons, relationships };
}

function validateAncestors(input) {
  if (!Array.isArray(input)) return 'ancestors must be an array';
  if (input.length > MAX_CHAIN) return `ancestors cannot exceed ${MAX_CHAIN} generations`;
  for (const a of input) {
    if (!a || typeof a !== 'object') return 'each ancestor must be an object';
    if (!a.name_en || typeof a.name_en !== 'string' || !a.name_en.trim()) return 'each ancestor needs a name_en';
    if (a.id !== undefined && a.id !== null && !UUID_RE.test(a.id)) return 'ancestor id must be a UUID';
    for (const f of ['birth_year', 'death_year']) {
      const v = a[f];
      if (v !== undefined && v !== null && v !== '') {
        const y = parseInt(v, 10);
        if (isNaN(y) || y < 1000 || y > 2100) return `${f} must be between 1000 and 2100`;
      }
    }
  }
  return null;
}

function pickFields(a) {
  const out = {};
  for (const f of ANCESTOR_FIELDS) if (a[f] !== undefined) out[f] = a[f];
  return out;
}

// Reconcile the whole ancestor chain to `inputAncestors` (ordered root→youngest)
// inside the caller's transaction. Returns { focalId, ancestorIds }.
async function reconcileLineage(client, inputAncestors) {
  const { treeId, persons, relationships } = await loadGraph(client);
  const { chain: currentChain, focalId } = walkChain(persons, relationships, FOCAL_NAME);
  if (!focalId) throw badRequest('No focal person to anchor the lineage');

  // 1. Update existing ancestors (partial/no-op merge) or create new ones.
  const desiredIds = [];
  for (const a of inputAncestors) {
    const fields = pickFields(a);
    if (a.id) {
      await applyChange(client, { op_type: 'update', entity: 'person', target_id: a.id, payload: fields });
      desiredIds.push(a.id);
    } else {
      const r = await applyChange(client, { op_type: 'create', entity: 'person', payload: { ...fields, tree_id: treeId } });
      desiredIds.push(r.after.person.id);
    }
  }

  // 2. Delete ancestors that were dropped from the chain (cascade clears their edges).
  const desiredSet = new Set(desiredIds);
  for (const id of currentChain) {
    if (!desiredSet.has(id)) {
      await applyChange(client, { op_type: 'delete', entity: 'person', target_id: id });
    }
  }

  // 3. Clear the incoming edge of every surviving lineage node + the focal, so we
  //    can rebuild a clean linear chain. Descendant edges (child_id outside scope)
  //    are never touched.
  const scope = new Set([...desiredIds, focalId]);
  const fresh = (await client.query('SELECT id, child_id FROM relationship WHERE tree_id = $1', [treeId])).rows;
  for (const r of fresh) {
    if (scope.has(r.child_id)) await client.query('DELETE FROM relationship WHERE id = $1', [r.id]);
  }

  // 4. Re-link: ancestor[0] → ancestor[1] → … → ancestor[n] → focal. ancestor[0]
  //    is left parentless (the new root). Empty list = focal has no ancestors.
  const order = [...desiredIds, focalId];
  for (let i = 0; i < order.length - 1; i++) {
    await client.query(
      'INSERT INTO relationship (tree_id, parent_id, child_id) VALUES ($1, $2, $3)',
      [treeId, order[i], order[i + 1]]
    );
  }
  return { focalId, ancestorIds: desiredIds };
}

// GET /api/lineage — the current ordered ancestor chain + focal (admin: full rows).
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { persons, relationships } = await loadGraph(pool);
    const { chain, focalId, byId } = walkChain(persons, relationships, FOCAL_NAME);
    const ancestors = chain.map((id) => byId[id]);
    const focal = focalId ? byId[focalId] : null;
    res.json({
      ancestors,
      focal: focal ? { id: focal.id, name_en: focal.name_en, name_hi: focal.name_hi } : null,
    });
  } catch (err) {
    if (err.code === 'BAD_REQUEST') return res.status(400).json({ error: err.message });
    console.error('GET /api/lineage error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/lineage — replace the whole ancestor chain (admin only).
router.put('/', requireAdmin, async (req, res) => {
  const input = req.body && req.body.ancestors;
  const invalid = validateAncestors(input);
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    await withTransaction((client) => reconcileLineage(client, input));
    // Re-read so the client gets canonical ordered rows (post-reconcile).
    const { persons, relationships } = await loadGraph(pool);
    const { chain, focalId, byId } = walkChain(persons, relationships, FOCAL_NAME);
    res.json({
      ancestors: chain.map((id) => byId[id]),
      focal: focalId ? { id: byId[focalId].id, name_en: byId[focalId].name_en, name_hi: byId[focalId].name_hi } : null,
    });
  } catch (err) {
    if (err.code === 'BAD_REQUEST') return res.status(400).json({ error: err.message });
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    console.error('PUT /api/lineage error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.walkChain = walkChain;
