// Whitelist of person fields a NON-ADMIN contributor is allowed to write.
// Everything else (birth/death years, notes, hide flags, positions, sequence)
// is admin-only. Applied before any DB write on the public path so contributors
// can never set or overwrite detail fields.
const PUBLIC_FIELDS = ['name_en', 'name_hi', 'spouse_en', 'spouse_hi', 'spouse_gender', 'gender'];

// Returns a NEW object containing only the present whitelisted keys.
function pickPublicFields(body) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const f of PUBLIC_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

module.exports = { PUBLIC_FIELDS, pickPublicFields };
