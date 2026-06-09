// Whitelist of person fields a NON-ADMIN contributor is allowed to write.
// Everything else (birth/death years, notes, hide flags, positions, sequence)
// is admin-only. Applied before any DB write on the public path so contributors
// can never set or overwrite detail fields.
const PUBLIC_FIELDS = ['name_en', 'name_hi', 'spouse_en', 'spouse_hi', 'spouse_gender', 'gender'];

// Year + life-status fields a non-admin may write ONLY while the "show years for
// deceased" tree toggle is ON. When those years are already public, letting
// contributors propose them (through the normal approval path) is consistent.
// Person and spouse are independent — only one half may be deceased.
const DECEASED_YEAR_FIELDS = [
  'birth_year', 'death_year', 'deceased',
  'spouse_birth_year', 'spouse_death_year', 'spouse_deceased',
];

// Returns a NEW object containing only the present whitelisted keys. With
// `allowDeceasedYears`, the year/life-status fields above are also permitted.
function pickPublicFields(body, { allowDeceasedYears = false } = {}) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  const allowed = allowDeceasedYears ? PUBLIC_FIELDS.concat(DECEASED_YEAR_FIELDS) : PUBLIC_FIELDS;
  for (const f of allowed) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

module.exports = { PUBLIC_FIELDS, DECEASED_YEAR_FIELDS, pickPublicFields };
