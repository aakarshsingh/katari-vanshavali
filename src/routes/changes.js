const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireAdmin } = require('../middleware/auth');
const { requireUUID } = require('../middleware/validate');
const { applyChange, withTransaction } = require('../services/mutations');
const { recordPending, recordApplied, summarize } = require('../services/changelog');

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
    const tree = await pool.query('SELECT id FROM tree LIMIT 1');
    const tree_id = tree.rows[0] ? tree.rows[0].id : null;
    const row = await recordPending(null, {
      tree_id, op_type, entity, target_id, payload, client_token, submitter_note,
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

// Public: anonymized history (applied + reverted), with a compact diff summary.
router.get('/applied', async (req, res) => {
  try {
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
      summary: summarize(r.before_snapshot, r.after_snapshot),
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
