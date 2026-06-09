const express = require('express');
const router = express.Router();
const pool = require('../db/client');
const { requireName, requireValidYear, requireUUID, requireGender, requireValidSequence, requireBoolean } = require('../middleware/validate');
const { applyChange, withTransaction, PERSON_FIELDS } = require('../services/mutations');
const { recordPending, recordApplied } = require('../services/changelog');
const { serializePerson } = require('../serializers/person');
const { pickPublicFields } = require('../lib/public-fields');

// Single read of the (single) tree's gate flags: moderation + the two life-status
// year-visibility toggles. One query keeps the moderation check and the response
// serializer in sync. `yearOpts` is spread straight into serializePerson.
async function treeFlags() {
  const { rows } = await pool.query(
    'SELECT moderation_enabled, show_years_deceased, show_birth_year_living FROM tree LIMIT 1'
  );
  const row = rows[0] || {};
  return {
    moderation: row.moderation_enabled === true,
    yearOpts: {
      showYearsDeceased: row.show_years_deceased === true,
      showBirthYearLiving: row.show_birth_year_living === true,
    },
  };
}

// Build the writable payload for a person request. Non-admins are reduced to the
// public whitelist; parent_id is structural (not a protected detail field) so it
// survives for add-child. Admins keep the full field set (incl. the hide flags).
function personPayload(req, { withParent }) {
  const incoming = req.admin ? req.body : pickPublicFields(req.body);
  if (!req.admin && withParent && req.body.parent_id !== undefined) {
    incoming.parent_id = req.body.parent_id;
  }
  const fields = withParent ? [...PERSON_FIELDS, 'parent_id'] : PERSON_FIELDS;
  const payload = {};
  for (const f of fields) {
    if (incoming[f] !== undefined) payload[f] = incoming[f];
  }
  return payload;
}

// No-op guard (Phase 2.24): return only the payload keys whose value actually
// differs from the current record. '' is normalised to null (matches
// coercePersonValue's write behaviour) and values compare as strings so a DB
// integer (1950) equals form text ("1950"). An empty result means "nothing
// changed" — the caller skips the UPDATE, the queue insert, and the history row.
function changedKeys(current, payload) {
  const norm = (v) => (v === '' || v === null || v === undefined ? null : v);
  const out = {};
  for (const k of Object.keys(payload)) {
    let incoming = payload[k];
    if (k === 'name_en' && typeof incoming === 'string') incoming = incoming.trim();
    const a = norm(incoming);
    const b = norm(current[k]);
    if (a === null && b === null) continue;
    if (a === null || b === null || String(a) !== String(b)) out[k] = payload[k];
  }
  return out;
}

router.post(
  '/',
  requireName,
  requireValidYear('birth_year'),
  requireValidYear('death_year'),
  requireValidYear('spouse_birth_year'),
  requireValidYear('spouse_death_year'),
  requireGender('spouse_gender'),
  requireValidSequence('sequence'),
  requireBoolean('death_year_hidden'),
  requireBoolean('spouse_death_year_hidden'),
  async (req, res) => {
    const payload = personPayload(req, { withParent: true });
    try {
      const { moderation, yearOpts } = await treeFlags();
      if (moderation && !req.admin) {
        const tree = await pool.query('SELECT id FROM tree LIMIT 1');
        const cr = await recordPending(null, {
          tree_id: tree.rows[0] ? tree.rows[0].id : null,
          op_type: 'create', entity: 'person', payload,
          client_token: req.body.client_token, submitter_note: req.body.submitter_note,
        });
        return res.status(202).json({ status: 'pending', id: cr.id });
      }
      const result = await withTransaction(async (client) => {
        const r = await applyChange(client, { op_type: 'create', entity: 'person', payload });
        await recordApplied(client, {
          tree_id: r.after.person.tree_id, op_type: 'create', entity: 'person',
          target_id: r.after.person.id, payload, after_snapshot: r.after,
          resolved_by: req.admin ? req.admin.id : null,
        });
        return r;
      });
      res.status(201).json(serializePerson(result.after.person, { isAdmin: !!req.admin, ...yearOpts }));
    } catch (err) {
      if (err.message === 'No tree exists') return res.status(400).json({ error: 'No tree exists yet' });
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
  requireValidSequence('sequence'),
  requireBoolean('death_year_hidden'),
  requireBoolean('spouse_death_year_hidden'),
  async (req, res) => {
    const { id } = req.params;
    const payload = personPayload(req, { withParent: false });
    if (Object.keys(payload).length === 0) return res.status(400).json({ error: 'No fields to update' });
    try {
      const { moderation, yearOpts } = await treeFlags();
      // No-op guard: fetch the current record and drop unchanged keys. An empty
      // diff is returned unchanged with no queue insert, UPDATE, or history row.
      const cur = await pool.query('SELECT * FROM person WHERE id = $1', [id]);
      const current = cur.rows[0];
      if (!current) return res.status(404).json({ error: 'Person not found' });
      const changed = changedKeys(current, payload);
      if (Object.keys(changed).length === 0) {
        return res.json(serializePerson(current, { isAdmin: !!req.admin, ...yearOpts }));
      }
      if (moderation && !req.admin) {
        const cr = await recordPending(null, {
          op_type: 'update', entity: 'person', target_id: id, payload: changed,
          client_token: req.body.client_token, submitter_note: req.body.submitter_note,
        });
        return res.status(202).json({ status: 'pending', id: cr.id });
      }
      const result = await withTransaction(async (client) => {
        const r = await applyChange(client, { op_type: 'update', entity: 'person', target_id: id, payload: changed });
        await recordApplied(client, {
          tree_id: r.after.tree_id, op_type: 'update', entity: 'person', target_id: id,
          payload: changed, before_snapshot: r.before, after_snapshot: r.after,
          resolved_by: req.admin ? req.admin.id : null,
        });
        return r;
      });
      res.json(serializePerson(result.after, { isAdmin: !!req.admin, ...yearOpts }));
    } catch (err) {
      if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'Person not found' });
      console.error('PATCH /api/persons/:id error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/:id', requireUUID('id'), async (req, res) => {
  const { id } = req.params;
  try {
    const { moderation } = await treeFlags();
    if (moderation && !req.admin) {
      const cr = await recordPending(null, {
        op_type: 'delete', entity: 'person', target_id: id,
        client_token: req.body.client_token, submitter_note: req.body.submitter_note,
      });
      return res.status(202).json({ status: 'pending', id: cr.id });
    }
    await withTransaction(async (client) => {
      const r = await applyChange(client, { op_type: 'delete', entity: 'person', target_id: id });
      await recordApplied(client, {
        tree_id: r.before.person.tree_id, op_type: 'delete', entity: 'person', target_id: id,
        before_snapshot: r.before, resolved_by: req.admin ? req.admin.id : null,
      });
      return r;
    });
    res.json({ deleted: id });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: 'Person not found' });
    console.error('DELETE /api/persons/:id error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
