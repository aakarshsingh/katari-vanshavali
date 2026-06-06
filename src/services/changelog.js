const pool = require('../db/client');

// JSONB columns must be serialized explicitly so node-pg stores JSON (not a
// Postgres array literal or "[object Object]").
function toJson(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

// Insert a pending change_request (anonymous/queued edit). Accepts a pg client
// or falls back to the pool.
async function recordPending(db, { tree_id, op_type, entity, target_id, payload, client_token, submitter_note }) {
  const conn = db || pool;
  const { rows } = await conn.query(
    `INSERT INTO change_request
       (tree_id, op_type, entity, target_id, payload, client_token, submitter_note, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING *`,
    [tree_id || null, op_type, entity, target_id || null, toJson(payload), client_token || null, submitter_note || null]
  );
  return rows[0];
}

// Insert an applied change_request (the audit log entry). before/after are the
// snapshots returned by applyChange.
async function recordApplied(db, { tree_id, op_type, entity, target_id, payload, before_snapshot, after_snapshot, resolved_by, status }) {
  const conn = db || pool;
  const { rows } = await conn.query(
    `INSERT INTO change_request
       (tree_id, op_type, entity, target_id, payload, before_snapshot, after_snapshot, status, resolved_by, resolved_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     RETURNING *`,
    [
      tree_id || null,
      op_type,
      entity,
      target_id || null,
      toJson(payload),
      toJson(before_snapshot),
      toJson(after_snapshot),
      status || 'applied',
      resolved_by || null,
    ]
  );
  return rows[0];
}

// Compact before→after diff for the public history panel.
function summarize(before, after) {
  if (!before && after) return { type: 'create', after };
  if (before && !after) return { type: 'delete', before };
  const changed = {};
  for (const key of Object.keys(after || {})) {
    if (before[key] !== after[key]) changed[key] = { from: before[key], to: after[key] };
  }
  return { type: 'update', changed };
}

module.exports = { recordPending, recordApplied, summarize };
