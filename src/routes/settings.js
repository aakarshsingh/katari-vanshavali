const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireAdmin } = require('../middleware/auth');

// Public: read the moderation flag (drives the client's queue-vs-direct behaviour).
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT moderation_enabled FROM tree LIMIT 1');
    const moderation_enabled = rows[0] ? rows[0].moderation_enabled : false;
    res.json({ moderation_enabled });
  } catch (err) {
    console.error('GET /api/settings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: toggle moderation on the single tree row.
router.patch('/', requireAdmin, async (req, res) => {
  const { moderation_enabled } = req.body;
  if (typeof moderation_enabled !== 'boolean') {
    return res.status(400).json({ error: 'moderation_enabled must be a boolean' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE tree SET moderation_enabled = $1, updated_at = now()
       WHERE id = (SELECT id FROM tree LIMIT 1)
       RETURNING moderation_enabled`,
      [moderation_enabled]
    );
    if (!rows[0]) return res.status(404).json({ error: 'No tree found' });
    res.json({ moderation_enabled: rows[0].moderation_enabled });
  } catch (err) {
    console.error('PATCH /api/settings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
