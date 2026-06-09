const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireAdmin } = require('../middleware/auth');
const { requireUUID } = require('../middleware/validate');
const { applyChange, withTransaction } = require('../services/mutations');
const { recordPending, recordApplied, summarize } = require('../services/changelog');
const { pickPublicFields } = require('../lib/public-fields');
const { serializePerson } = require('../serializers/person');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_OPS = ['create', 'update', 'delete'];
const VALID_ENTITIES = ['person', 'relationship', 'tree'];
const YEAR_FIELDS = ['birth_year', 'death_year', 'spouse_birth_year', 'spouse_death_year'];

function validateChange({ op_type, entity, target_id, payload }) {
  if (!VALID_OPS.includes(op_type)) return 'op_type must be one of create, update, delete';
  if (!VALID_ENTITIES.includes(entity)) return 'entity must be one of person, relationship, tree';
  if ((op_type === 'update' || op_type === 'delete') && (!target_id || !UUID_RE.test(target_id))) {
    return 'target_id must be a valid UUID for update/delete';
  }
  const p = payload || {};
  if (entity === 'person' && op_type === 'create') {
    if (!p.name_en || typeof p.name_en !== 'string' || !p.name_en.trim()) {
      return 'name_en is required';
    }
  }
  if (entity === 'person') {
    for (const f of YEAR_FIELDS) {
      const v = p[f];
      if (v !== undefined && v !== null && v !== '') {
        const y = parseInt(v, 10);
        if (isNaN(y) || y < 1000 || y > 2100) return `${f} must be between 1000 and 2100`;
      }
    }
  }
  if (entity === 'relationship' && op_type === 'create') {
    if (!p.parent_id || !UUID_RE.test(p.parent_id)) return 'parent_id must be a valid UUID';
    if (!p.child_id || !UUID_RE.test(p.child_id)) return 'child_id must be a valid UUID';
  }
  return null;
}

async function getChange(id) {
  const { rows } = await pool.query('SELECT * FROM change_request WHERE id = $1', [id]);
  return rows[0] || null;
}

// No-op guard (Phase 2.24): return only the payload keys that differ from the
// current record. Mirrors persons.js — '' normalises to null and values compare
// as strings. An empty result means a no-op edit that must not enter the queue.
function changedKeys(current, payload) {
  const norm = (v) => (v === '' || v === null || v === undefined ? null : v);
  const out = {};
  for (const k of Object.keys(payload || {})) {
    let incoming = payload[k];
    if (k === 'name_en' && typeof incoming === 'string') incoming = incoming.trim();
    const a = norm(incoming);
    const b = norm(current[k]);
    if (a === null && b === null) continue;
    if (a === null || b === null || String(a) !== String(b)) out[k] = payload[k];
  }
  return out;
}

// Inverse of an applied change, used by revert. Writes via applyChange.
async function revertChange(client, cr) {
  const before = cr.before_snapshot || {};
  const after = cr.after_snapshot || {};
  if (cr.op_type === 'create') {
    if (cr.entity === 'person' && after.person) {
      await applyChange(client, { op_type: 'delete', entity: 'person', target_id: after.person.id });
    } else if (cr.entity === 'relationship' && after.relationship) {
      await applyChange(client, { op_type: 'delete', entity: 'relationship', target_id: after.relationship.id });
    }
  } else if (cr.op_type === 'update') {
    await applyChange(client, { op_type: 'update', entity: cr.entity, target_id: cr.target_id, payload: before });
  } else if (cr.op_type === 'delete') {
    if (cr.entity === 'person' && before.person) {
      await applyChange(client, { op_type: 'create', entity: 'person', payload: { ...before.person } });
      for (const rel of before.relationships || []) {
        await applyChange(client, { op_type: 'create', entity: 'relationship', payload: { ...rel } });
      }
    } else if (cr.entity === 'relationship' && before.relationship) {
      await applyChange(client, { op_type: 'create', entity: 'relationship', payload: { ...before.relationship } });
    }
  }
}

const INVERSE_OP = { create: 'delete', delete: 'create', update: 'update' };

// Public: submit a pending change (anonymous contributor under moderation).
router.post('/', async (req, res) => {
  const { op_type, entity, target_id, payload, client_token, submitter_note } = req.body;
  const invalid = validateChange({ op_type, entity, target_id, payload });
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    // Defence in depth: a non-admin person submission can only queue whitelisted
    // fields — a crafted payload can't smuggle detail fields (notes, hide flags)
    // into the review queue. Deceased year/life-status fields are permitted only
    // while the tree's show-years-deceased toggle is ON (same single tree read
    // also yields tree_id). parent_id is structural, kept for add-child.
    const treeRow = (await pool.query('SELECT id, show_years_deceased FROM tree LIMIT 1')).rows[0] || {};
    let safePayload = payload;
    if (!req.admin && entity === 'person') {
      safePayload = pickPublicFields(payload, { allowDeceasedYears: treeRow.show_years_deceased === true });
      if (payload && payload.parent_id !== undefined) safePayload.parent_id = payload.parent_id;
    }
    // No-op guard: a person edit that matches the current record never enters the
    // queue. Diff against the live row and bail out before inserting.
    if (entity === 'person' && op_type === 'update' && target_id) {
      const { rows } = await pool.query('SELECT * FROM person WHERE id = $1', [target_id]);
      if (rows[0]) {
        safePayload = changedKeys(rows[0], safePayload);
        if (Object.keys(safePayload).length === 0) {
          return res.status(200).json({ status: 'noop' });
        }
      }
    }
    const row = await recordPending(null, {
      tree_id: treeRow.id || null, op_type, entity, target_id, payload: safePayload, client_token, submitter_note,
    });
    res.status(201).json({ id: row.id, status: row.status });
  } catch (err) {
    console.error('POST /api/changes error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: the review queue (default pending), newest first.
router.get('/', requireAdmin, async (req, res) => {
  const status = req.query.status || 'pending';
  try {
    const { rows } = await pool.query(
      'SELECT * FROM change_request WHERE status = $1 ORDER BY submitted_at DESC',
      [status]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/changes error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// A public identifier so the history panel can always label WHO changed —
// names are public regardless of any year toggle.
function identityOf(p) {
  return { name_en: (p && p.name_en) || null, name_hi: (p && p.name_hi) || null };
}

// Which year keys in a person diff must be withheld from the PUBLIC history,
// mirroring the serializer's life-status rule (person + spouse judged
// separately, since only one half may be deceased). A living person never
// exposes a death year; a deceased person's years need showYearsDeceased.
function hiddenYearKeys(flat, { showYearsDeceased, showBirthYearLiving }) {
  const hidden = [];
  if (flat.deceased) { if (!showYearsDeceased) hidden.push('birth_year', 'death_year'); }
  else { if (!showBirthYearLiving) hidden.push('birth_year'); hidden.push('death_year'); }
  if (flat.spouse_deceased) { if (!showYearsDeceased) hidden.push('spouse_birth_year', 'spouse_death_year'); }
  else { if (!showBirthYearLiving) hidden.push('spouse_birth_year'); hidden.push('spouse_death_year'); }
  return hidden;
}

// Build the PUBLIC summary for one resolved row: always carries a name identity,
// and never leaks a hidden year (create/delete run through the serializer; an
// update's diff has hidden year keys stripped by life-status).
function publicSummary(r, yearOpts) {
  const before = r.before_snapshot;
  const after = r.after_snapshot;
  const summary = summarize(before, after);
  if (r.entity !== 'person') return summary;
  if (summary.type === 'create') {
    const person = (after && after.person) || after || {};
    const pub = serializePerson(person, yearOpts);
    return { type: 'create', after: { person: pub }, identity: identityOf(pub) };
  }
  if (summary.type === 'delete') {
    const person = (before && before.person) || before || {};
    const pub = serializePerson(person, yearOpts);
    return { type: 'delete', before: { person: pub }, identity: identityOf(pub) };
  }
  // update: before/after are flat person rows; gate the changed-field diff.
  const flat = after || before || {};
  const changed = { ...(summary.changed || {}) };
  for (const k of hiddenYearKeys(flat, yearOpts)) delete changed[k];
  return { type: 'update', changed, identity: identityOf(flat) };
}

// Public: anonymized history (applied + reverted), with a compact diff summary.
router.get('/applied', async (req, res) => {
  try {
    const t = await pool.query('SELECT show_years_deceased, show_birth_year_living FROM tree LIMIT 1');
    const yearOpts = {
      showYearsDeceased: !!(t.rows[0] && t.rows[0].show_years_deceased === true),
      showBirthYearLiving: !!(t.rows[0] && t.rows[0].show_birth_year_living === true),
    };
    const { rows } = await pool.query(
      `SELECT id, op_type, entity, target_id, before_snapshot, after_snapshot, status, submitted_at, resolved_at
         FROM change_request
        WHERE status IN ('applied', 'reverted')
        ORDER BY resolved_at DESC NULLS LAST`
    );
    const history = rows.map((r) => ({
      id: r.id,
      op_type: r.op_type,
      entity: r.entity,
      status: r.status,
      resolved_at: r.resolved_at,
      summary: publicSummary(r, yearOpts),
    }));
    res.json(history);
  } catch (err) {
    console.error('GET /api/changes/applied error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public: a contributor's own submissions, by client_token.
router.get('/mine', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(400).json({ error: 'token is required' });
  try {
    const { rows } = await pool.query(
      `SELECT id, op_type, entity, target_id, status, submitted_at, resolved_at
         FROM change_request WHERE client_token = $1 ORDER BY submitted_at DESC`,
      [token]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/changes/mine error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: approve a pending change (optionally with an edited payload) and apply it.
router.post('/:id/approve', requireAdmin, requireUUID('id'), async (req, res) => {
  const { id } = req.params;
  try {
    const cr = await getChange(id);
    if (!cr) return res.status(404).json({ error: 'change not found' });
    if (cr.status !== 'pending') return res.status(409).json({ error: 'change is not pending' });

    const payload = req.body.payload !== undefined ? req.body.payload : cr.payload;
    const change = { op_type: cr.op_type, entity: cr.entity, target_id: cr.target_id, payload };

    await withTransaction(async (client) => {
      const result = await applyChange(client, change);
      await client.query(
        `UPDATE change_request
            SET status='applied', payload=$1, before_snapshot=$2, after_snapshot=$3,
                resolved_by=$4, resolved_at=now()
          WHERE id=$5`,
        [
          JSON.stringify(payload ?? null),
          JSON.stringify(result.before ?? null),
          JSON.stringify(result.after ?? null),
          req.admin.id,
          id,
        ]
      );
    });
    res.json({ id, status: 'applied' });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(409).json({ error: err.message });
    console.error('POST /api/changes/:id/approve error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: reject a pending change.
router.post('/:id/reject', requireAdmin, requireUUID('id'), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE change_request SET status='rejected', resolved_by=$1, resolved_at=now()
        WHERE id=$2 AND status='pending' RETURNING id`,
      [req.admin.id, id]
    );
    if (!rows[0]) return res.status(409).json({ error: 'change is not pending' });
    res.json({ id, status: 'rejected' });
  } catch (err) {
    console.error('POST /api/changes/:id/reject error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: revert an applied change; logs the inverse as a new applied audit row.
router.post('/:id/revert', requireAdmin, requireUUID('id'), async (req, res) => {
  const { id } = req.params;
  try {
    const cr = await getChange(id);
    if (!cr) return res.status(404).json({ error: 'change not found' });
    if (cr.status !== 'applied') return res.status(409).json({ error: 'only applied changes can be reverted' });

    await withTransaction(async (client) => {
      await revertChange(client, cr);
      await client.query(
        `UPDATE change_request SET status='reverted', resolved_by=$1, resolved_at=now() WHERE id=$2`,
        [req.admin.id, id]
      );
      await recordApplied(client, {
        tree_id: cr.tree_id,
        op_type: INVERSE_OP[cr.op_type],
        entity: cr.entity,
        target_id: cr.target_id,
        before_snapshot: cr.after_snapshot,
        after_snapshot: cr.before_snapshot,
        resolved_by: req.admin.id,
      });
    });
    res.json({ id, status: 'reverted' });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(409).json({ error: err.message });
    console.error('POST /api/changes/:id/revert error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
