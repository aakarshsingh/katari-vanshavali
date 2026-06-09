// Auth-aware person serializer — the single control point for what the PUBLIC
// (unauthenticated) API exposes. Admins receive the full row; the public view
// soft-hides year fields based on TWO global, life-status-keyed tree toggles
// (Pivot R5, 2.21A):
//   showYearsDeceased    → deceased people show BOTH birth + death years.
//   showBirthYearLiving  → living people show their birth year only (a living
//                          person never exposes a death year publicly).
// Spouse fields mirror the person rule, keyed off `spouse_deceased`.
// Pure + immutable: the input row is never mutated.

// Never sent to the public, regardless of any toggle. The two `*_death_year_hidden`
// flags are the retired R2.14 per-card model — left dormant in the schema but kept
// out of the public payload here.
const ALWAYS_PRIVATE = ['notes', 'death_year_hidden', 'spouse_death_year_hidden'];

function serializePerson(row, { isAdmin = false, showYearsDeceased = false, showBirthYearLiving = false } = {}) {
  if (!row) return row;
  if (isAdmin) return row; // admins see everything

  const out = { ...row };
  for (const f of ALWAYS_PRIVATE) delete out[f];

  // Person years, keyed off life-status.
  if (row.deceased) {
    if (!showYearsDeceased) {
      delete out.birth_year;
      delete out.death_year;
    }
  } else {
    if (!showBirthYearLiving) delete out.birth_year;
    delete out.death_year; // living: never expose a death year publicly
  }

  // Spouse years mirror the rule on the spouse's life-status.
  if (row.spouse_deceased) {
    if (!showYearsDeceased) {
      delete out.spouse_birth_year;
      delete out.spouse_death_year;
    }
  } else {
    if (!showBirthYearLiving) delete out.spouse_birth_year;
    delete out.spouse_death_year;
  }

  return out;
}

function serializePersons(rows, opts) {
  return (rows || []).map((r) => serializePerson(r, opts));
}

module.exports = { serializePerson, serializePersons, ALWAYS_PRIVATE };
