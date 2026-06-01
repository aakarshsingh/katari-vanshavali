const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireUUID } = require('../middleware/validate');

router.post('/', requireUUID('parentId'), requireUUID('childId'), async (req, res) => {
  const { parentId, childId } = req.body;
  try {
    const personResult = await pool.query('SELECT tree_id FROM person WHERE id = $1', [parentId]);
    if (!personResult.rows[0]) return res.status(404).json({ error: 'Parent person not found' });
    const tree_id = personResult.rows[0].tree_id;
    const result = await pool.query(
      'INSERT INTO relationship (tree_id, parent_id, child_id) VALUES ($1, $2, $3) RETURNING *',
      [tree_id, parentId, childId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Relationship already exists' });
    console.error('POST /api/relationships error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireUUID('id'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM relationship WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Relationship not found' });
    res.json({ deleted: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /api/relationships/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
