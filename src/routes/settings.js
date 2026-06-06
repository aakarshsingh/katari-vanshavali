const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireAdmin } = require('../middleware/auth');

// Settings that live on the single tree row and are read/written here.
const BOOLEAN_SETTINGS = ['moderation_enabled', 'show_birth_year'];

// Public: read the visibility/behaviour flags. `moderation_enabled` drives the
// client's queue-vs-direct path; `show_birth_year` is the global birth-year reveal.
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT moderation_enabled, show_birth_year FROM tree LIMIT 1');
    const row = rows[0] || {};
    res.json({
      moderation_enabled: row.moderation_enabled === true,
      show_birth_year: row.show_birth_year === true,
    });
  } catch (err) {
    console.error('GET /api/settings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: toggle moderation and/or the birth-year reveal on the single tree row.
// Accepts either/both flags; each must be a real boolean when present.
router.patch('/', requireAdmin, async (req, res) => {
  const updates = {};
  for (const field of BOOLEAN_SETTINGS) {
    const val = req.body[field];
    if (val !== undefined) {
      if (typeof val !== 'boolean') return res.status(400).json({ error: `${field} must be a boolean` });
      updates[field] = val;
    }
  }
  const cols = Object.keys(updates); // fixed whitelist — safe to interpolate
  if (cols.length === 0) return res.status(400).json({ error: 'no settings to update' });
  try {
    const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
    const { rows } = await pool.query(
      `UPDATE tree SET ${sets}, updated_at = now()
       WHERE id = (SELECT id FROM tree LIMIT 1)
       RETURNING moderation_enabled, show_birth_year`,
      cols.map((c) => updates[c])
    );
    if (!rows[0]) return res.status(404).json({ error: 'No tree found' });
    res.json({
      moderation_enabled: rows[0].moderation_enabled === true,
      show_birth_year: rows[0].show_birth_year === true,
    });
  } catch (err) {
    console.error('PATCH /api/settings error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
