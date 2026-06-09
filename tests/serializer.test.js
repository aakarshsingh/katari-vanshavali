const { serializePerson, serializePersons } = require('../src/serializers/person');

// A fully-populated row, as the DB returns it. Defaults: both person and spouse
// are DECEASED (so year fields are present to strip/keep); override `deceased` /
// `spouse_deceased` to exercise the living branch.
function fullRow(overrides = {}) {
  return {
    id: 'p1',
    name_en: 'Ram',
    name_hi: 'राम',
    birth_year: 1950,
    death_year: 2010,
    deceased: true,
    spouse_en: 'Sita',
    spouse_hi: 'सीता',
    spouse_birth_year: 1952,
    spouse_death_year: 2012,
    spouse_deceased: true,
    spouse_gender: 'F',
    gender: 'M',
    notes: 'private note',
    sequence: 1,
    death_year_hidden: false,
    spouse_death_year_hidden: false,
    x_pos: 0,
    y_pos: 0,
    ...overrides,
  };
}

const BOTH_ON = { isAdmin: false, showYearsDeceased: true, showBirthYearLiving: true };
const BOTH_OFF = { isAdmin: false, showYearsDeceased: false, showBirthYearLiving: false };

describe('serializePerson — admin + always-private', () => {
  test('admin gets the full row, including notes and legacy flags', () => {
    const row = fullRow();
    const out = serializePerson(row, { isAdmin: true });
    expect(out).toBe(row); // unchanged passthrough
    expect(out.notes).toBe('private note');
    expect(out.death_year_hidden).toBe(false);
    expect(out.birth_year).toBe(1950);
  });

  test('public always strips notes + both legacy hide flags', () => {
    const out = serializePerson(fullRow(), BOTH_ON);
    expect(out).not.toHaveProperty('notes');
    expect(out).not.toHaveProperty('death_year_hidden');
    expect(out).not.toHaveProperty('spouse_death_year_hidden');
  });

  test('null row passes through untouched', () => {
    expect(serializePerson(null, { isAdmin: false })).toBeNull();
  });

  test('does not mutate the input row', () => {
    const row = fullRow();
    serializePerson(row, BOTH_OFF);
    expect(row.notes).toBe('private note');
    expect(row.birth_year).toBe(1950);
    expect(row.death_year).toBe(2010);
    expect(row.spouse_birth_year).toBe(1952);
  });
});

describe('serializePerson — deceased person (showYearsDeceased)', () => {
  test('ON → both birth and death years shown', () => {
    const out = serializePerson(fullRow({ deceased: true }), { ...BOTH_OFF, showYearsDeceased: true });
    expect(out.birth_year).toBe(1950);
    expect(out.death_year).toBe(2010);
  });

  test('OFF → both birth and death years stripped', () => {
    const out = serializePerson(fullRow({ deceased: true }), BOTH_OFF);
    expect(out).not.toHaveProperty('birth_year');
    expect(out).not.toHaveProperty('death_year');
  });

  test('showBirthYearLiving has no effect on a deceased person', () => {
    const out = serializePerson(fullRow({ deceased: true }), { ...BOTH_OFF, showBirthYearLiving: true });
    expect(out).not.toHaveProperty('birth_year');
    expect(out).not.toHaveProperty('death_year');
  });
});

describe('serializePerson — living person (showBirthYearLiving)', () => {
  test('ON → birth year shown, death year never shown', () => {
    const out = serializePerson(
      fullRow({ deceased: false, death_year: null }),
      { ...BOTH_OFF, showBirthYearLiving: true }
    );
    expect(out.birth_year).toBe(1950);
    expect(out).not.toHaveProperty('death_year');
  });

  test('OFF → birth year stripped, death year never shown', () => {
    const out = serializePerson(fullRow({ deceased: false }), BOTH_OFF);
    expect(out).not.toHaveProperty('birth_year');
    expect(out).not.toHaveProperty('death_year');
  });

  test('showYearsDeceased does NOT reveal a living person’s death year', () => {
    // Even with a stray death_year value, a living person never exposes it.
    const out = serializePerson(fullRow({ deceased: false }), { ...BOTH_ON });
    expect(out.birth_year).toBe(1950); // birth shown via living toggle
    expect(out).not.toHaveProperty('death_year');
  });
});

describe('serializePerson — spouse mirrors life-status', () => {
  test('deceased spouse: showYearsDeceased ON → both spouse years shown', () => {
    const out = serializePerson(fullRow({ spouse_deceased: true }), { ...BOTH_OFF, showYearsDeceased: true });
    expect(out.spouse_birth_year).toBe(1952);
    expect(out.spouse_death_year).toBe(2012);
  });

  test('deceased spouse: OFF → both spouse years stripped', () => {
    const out = serializePerson(fullRow({ spouse_deceased: true }), BOTH_OFF);
    expect(out).not.toHaveProperty('spouse_birth_year');
    expect(out).not.toHaveProperty('spouse_death_year');
  });

  test('living spouse: showBirthYearLiving ON → spouse birth shown, no spouse death', () => {
    const out = serializePerson(
      fullRow({ spouse_deceased: false, spouse_death_year: null }),
      { ...BOTH_OFF, showBirthYearLiving: true }
    );
    expect(out.spouse_birth_year).toBe(1952);
    expect(out).not.toHaveProperty('spouse_death_year');
  });

  test('mixed: deceased person + living spouse, only deceased toggle ON', () => {
    const out = serializePerson(
      fullRow({ deceased: true, spouse_deceased: false }),
      { ...BOTH_OFF, showYearsDeceased: true }
    );
    // Person (deceased) → both shown
    expect(out.birth_year).toBe(1950);
    expect(out.death_year).toBe(2010);
    // Spouse (living, living toggle OFF) → birth stripped, death never shown
    expect(out).not.toHaveProperty('spouse_birth_year');
    expect(out).not.toHaveProperty('spouse_death_year');
  });
});

describe('serializePerson — defaults', () => {
  test('no opts → public with all years hidden', () => {
    const out = serializePerson(fullRow());
    expect(out).not.toHaveProperty('birth_year');
    expect(out).not.toHaveProperty('death_year');
    expect(out).not.toHaveProperty('notes');
  });
});

describe('serializePersons', () => {
  test('maps a list with the same options', () => {
    const rows = [fullRow({ id: 'a' }), fullRow({ id: 'b' })];
    const out = serializePersons(rows, BOTH_OFF);
    expect(out).toHaveLength(2);
    expect(out[0]).not.toHaveProperty('notes');
    expect(out[1]).not.toHaveProperty('birth_year');
  });

  test('empty / nullish input → empty array', () => {
    expect(serializePersons(null, {})).toEqual([]);
    expect(serializePersons([], {})).toEqual([]);
  });
});
