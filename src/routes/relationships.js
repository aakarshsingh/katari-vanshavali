const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireUUID } = require('../middleware/validate');
const { applyChange, withTransaction } = require('../services/mutations');
const { recordPending, recordApplied } = require('../services/changelog');

async function moderationOn() {
  const { rows } = await pool.query('SELECT moderation_enabled FROM tree LIMIT 1');
  return rows[0] ? rows[0].moderation_enabled === true : false;
}

router.post('/', requireUUID('parentId'), requireUUID('childId'), async (req, res) => {
  const { parentId, childId } = req.body;
  const payload = { parent_id: parentId, child_id: childId };
  try {
    if ((await moderationOn()) && !req.admin) {
      const cr = await recordPending(null, {
        op_type: 'create', entity: 'relationship', payload,
        client_token: req.body.client_token, submitter_note: req.body.submitter_note,
      });
      return res.status(202).json({ status: 'pending', id: cr.id });
    }
    const result = await withTransaction(async (client) => {
      const r = await applyChange(client, { op_type: 'create', entity: 'relationship', payload });
      await recordApplied(client, {
        tree_id: r.after.relationship.tree_id, op_type: 'create', entity: 'relationship',
        target_id: r.after.relationship.id, payload, after_snapshot: r.after,
        resolved_by: req.admin ? req.admin.id : null,
      });
      return r;
    });
    res.status(201).json(result.after.relationship);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Relationship already exists' });
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'Parent person not found' });
    console.error('POST /api/relationships error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireUUID('id'), async (req, res) => {
  const { id } = req.params;
  try {
    if ((await moderationOn()) && !req.admin) {
      const cr = await recordPending(null, {
        op_type: 'delete', entity: 'relationship', target_id: id,
        client_token: req.body.client_token, submitter_note: req.body.submitter_note,
      });
      return res.status(202).json({ status: 'pending', id: cr.id });
    }
    await withTransaction(async (client) => {
      const r = await applyChange(client, { op_type: 'delete', entity: 'relationship', target_id: id });
      await recordApplied(client, {
        op_type: 'delete', entity: 'relationship', target_id: id,
        before_snapshot: r.before, resolved_by: req.admin ? req.admin.id : null,
      });
      return r;
    });
    res.json({ deleted: id });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'Relationship not found' });
    console.error('DELETE /api/relationships/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
