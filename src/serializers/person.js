// Auth-aware person serializer — the single control point for what the PUBLIC
// (unauthenticated) API exposes. Admins receive the full row (including the
// hide flags); the public view soft-hides sensitive fields based on the
// tree-level birth-year toggle and the per-person death-year force-hide flags.
// Pure + immutable: the input row is never mutated.

// Never sent to the public, regardless of any toggle.
const ALWAYS_PRIVATE = ['notes', 'death_year_hidden', 'spouse_death_year_hidden'];

function serializePerson(row, { isAdmin = false, showBirthYear = false } = {}) {
  if (!row) return row;
  if (isAdmin) return row; // admins see everything, incl. the hide flags

  const out = { ...row };
  for (const f of ALWAYS_PRIVATE) delete out[f];
  if (!showBirthYear) {
    delete out.birth_year;
    delete out.spouse_birth_year;
  }
  if (row.death_year_hidden) delete out.death_year;
  if (row.spouse_death_year_hidden) delete out.spouse_death_year;
  return out;
}

function serializePersons(rows, opts) {
  return (rows || []).map((r) => serializePerson(r, opts));
}

module.exports = { serializePerson, serializePersons, ALWAYS_PRIVATE };
