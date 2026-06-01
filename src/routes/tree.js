const express = require('express');
const router = express.Router();
const pool = require('../db/client');

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
    res.json({ tree, persons: personsResult.rows, relationships: relResult.rows });
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
  try {
    const result = await pool.query(
      `UPDATE tree SET
        title_en = COALESCE($1, title_en),
        title_hi = COALESCE($2, title_hi),
        updated_at = now()
       WHERE id = (SELECT id FROM tree LIMIT 1)
       RETURNING *`,
      [title_en || null, title_hi !== undefined ? title_hi : null]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'No tree found' });
    res.json({ tree: result.rows[0] });
  } catch (err) {
    console.error('PATCH /api/tree error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
