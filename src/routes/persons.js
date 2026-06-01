const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireName, requireValidYear, requireUUID, requireGender } = require('../middleware/validate');

router.post(
  '/',
  requireName,
  requireValidYear('birth_year'),
  requireValidYear('death_year'),
  requireValidYear('spouse_birth_year'),
  requireValidYear('spouse_death_year'),
  requireGender('spouse_gender'),
  async (req, res) => {
    const {
      name_en, name_hi, birth_year, death_year, spouse_en, spouse_hi,
      spouse_birth_year, spouse_death_year, spouse_gender, gender, notes,
      deceased, spouse_deceased,
    } = req.body;
    try {
      const treeResult = await pool.query('SELECT id FROM tree LIMIT 1');
      if (!treeResult.rows[0]) return res.status(400).json({ error: 'No tree exists yet' });
      const tree_id = treeResult.rows[0].id;
      const result = await pool.query(
        `INSERT INTO person
          (tree_id, name_en, name_hi, birth_year, death_year, spouse_en, spouse_hi,
           spouse_birth_year, spouse_death_year, spouse_gender, gender, notes,
           deceased, spouse_deceased)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [
          tree_id,
          name_en.trim(),
          name_hi || null,
          birth_year || null,
          death_year || null,
          spouse_en || null,
          spouse_hi || null,
          spouse_birth_year || null,
          spouse_death_year || null,
          spouse_gender || null,
          gender || 'M',
          notes || null,
          deceased === true,
          spouse_deceased === true,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('POST /api/persons error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.patch(
  '/:id',
  requireUUID('id'),
  requireValidYear('birth_year'),
  requireValidYear('death_year'),
  requireValidYear('spouse_birth_year'),
  requireValidYear('spouse_death_year'),
  requireGender('spouse_gender'),
  async (req, res) => {
    const { id } = req.params;
    const allowed = [
      'name_en', 'name_hi', 'birth_year', 'death_year', 'spouse_en', 'spouse_hi',
      'spouse_birth_year', 'spouse_death_year', 'spouse_gender', 'gender', 'notes',
      'deceased', 'spouse_deceased',
    ];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    try {
      const result = await pool.query(
        `UPDATE person SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Person not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error('PATCH /api/persons/:id error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/:id', requireUUID('id'), async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM person WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Person not found' });
    res.json({ deleted: result.rows[0].id });
  } catch (err) {
    console.error('DELETE /api/persons/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
