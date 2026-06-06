const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { applyChange, withTransaction } = require('../services/mutations');
const { recordPending, recordApplied } = require('../services/changelog');
const { serializePersons } = require('../serializers/person');

async function moderationOn() {
  const { rows } = await pool.query('SELECT moderation_enabled FROM tree LIMIT 1');
  return rows[0] ? rows[0].moderation_enabled === true : false;
}

router.get('/', async (req, res) => {
  try {
    let treeResult = await pool.query('SELECT * FROM tree LIMIT 1');
    let tree = treeResult.rows[0];
    if (!tree) {
      const created = await pool.query(
        "INSERT INTO tree (title_en, title_hi) VALUES ('Katari Lineage', 'वंशावली') RETURNING *"
      );
      tree = created.rows[0];
    }
    const personsResult = await pool.query(
      'SELECT * FROM person WHERE tree_id = $1',
      [tree.id]
    );
    const relResult = await pool.query(
      'SELECT * FROM relationship WHERE tree_id = $1',
      [tree.id]
    );
    const persons = serializePersons(personsResult.rows, {
      isAdmin: !!req.admin,
      showBirthYear: tree.show_birth_year === true,
    });
    res.json({ tree, persons, relationships: relResult.rows });
  } catch (err) {
    console.error('GET /api/tree error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/', async (req, res) => {
  const { title_en, title_hi } = req.body;
  if (title_en !== undefined && (!title_en || !title_en.trim())) {
    return res.status(400).json({ error: 'title_en must be a non-empty string' });
  }
  const payload = {};
  if (title_en !== undefined) payload.title_en = title_en;
  if (title_hi !== undefined) payload.title_hi = title_hi;
  try {
    if ((await moderationOn()) && !req.admin) {
      const cr = await recordPending(null, {
        op_type: 'update', entity: 'tree', payload,
        client_token: req.body.client_token, submitter_note: req.body.submitter_note,
      });
      return res.status(202).json({ status: 'pending', id: cr.id });
    }
    const result = await withTransaction(async (client) => {
      const r = await applyChange(client, { op_type: 'update', entity: 'tree', payload });
      await recordApplied(client, {
        tree_id: r.after.id, op_type: 'update', entity: 'tree', target_id: r.after.id,
        payload, before_snapshot: r.before, after_snapshot: r.after,
        resolved_by: req.admin ? req.admin.id : null,
      });
      return r;
    });
    res.json({ tree: result.after });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'No tree found' });
    console.error('PATCH /api/tree error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
