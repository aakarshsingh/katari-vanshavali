const { serializePerson, serializePersons } = require('../src/serializers/person');

// A fully-populated row, as the DB returns it.
function fullRow(overrides = {}) {
  return {
    id: 'p1',
    name_en: 'Ram',
    name_hi: 'राम',
    birth_year: 1950,
    death_year: 2010,
    spouse_en: 'Sita',
    spouse_hi: 'सीता',
    spouse_birth_year: 1952,
    spouse_death_year: 2012,
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

describe('serializePerson', () => {
  test('admin gets the full row, including notes and hide flags', () => {
    const row = fullRow();
    const out = serializePerson(row, { isAdmin: true, showBirthYear: false });
    expect(out).toBe(row); // unchanged passthrough
    expect(out.notes).toBe('private note');
    expect(out.death_year_hidden).toBe(false);
    expect(out.birth_year).toBe(1950);
  });

  test('public always strips notes + both hide flags', () => {
    const out = serializePerson(fullRow(), { isAdmin: false, showBirthYear: true });
    expect(out).not.toHaveProperty('notes');
    expect(out).not.toHaveProperty('death_year_hidden');
    expect(out).not.toHaveProperty('spouse_death_year_hidden');
  });

  test('public with showBirthYear=false strips both birth-year fields', () => {
    const out = serializePerson(fullRow(), { isAdmin: false, showBirthYear: false });
    expect(out).not.toHaveProperty('birth_year');
    expect(out).not.toHaveProperty('spouse_birth_year');
  });

  test('public with showBirthYear=true keeps birth-year fields', () => {
    const out = serializePerson(fullRow(), { isAdmin: false, showBirthYear: true });
    expect(out.birth_year).toBe(1950);
    expect(out.spouse_birth_year).toBe(1952);
  });

  test('death_year_hidden strips death_year only', () => {
    const out = serializePerson(fullRow({ death_year_hidden: true }), { isAdmin: false, showBirthYear: true });
    expect(out).not.toHaveProperty('death_year');
    expect(out.spouse_death_year).toBe(2012);
  });

  test('spouse_death_year_hidden strips spouse_death_year only', () => {
    const out = serializePerson(fullRow({ spouse_death_year_hidden: true }), { isAdmin: false, showBirthYear: true });
    expect(out).not.toHaveProperty('spouse_death_year');
    expect(out.death_year).toBe(2010);
  });

  test('death years are shown to the public when not force-hidden', () => {
    const out = serializePerson(fullRow(), { isAdmin: false, showBirthYear: false });
    expect(out.death_year).toBe(2010);
    expect(out.spouse_death_year).toBe(2012);
  });

  test('does not mutate the input row', () => {
    const row = fullRow({ death_year_hidden: true });
    serializePerson(row, { isAdmin: false, showBirthYear: false });
    expect(row.notes).toBe('private note');
    expect(row.birth_year).toBe(1950);
    expect(row.death_year).toBe(2010);
    expect(row.death_year_hidden).toBe(true);
  });

  test('defaults (no opts) behave as public, birth-year hidden', () => {
    const out = serializePerson(fullRow());
    expect(out).not.toHaveProperty('birth_year');
    expect(out).not.toHaveProperty('notes');
  });

  test('null row passes through untouched', () => {
    expect(serializePerson(null, { isAdmin: false })).toBeNull();
  });
});

describe('serializePersons', () => {
  test('maps a list with the same options', () => {
    const rows = [fullRow({ id: 'a' }), fullRow({ id: 'b' })];
    const out = serializePersons(rows, { isAdmin: false, showBirthYear: false });
    expect(out).toHaveLength(2);
    expect(out[0]).not.toHaveProperty('notes');
    expect(out[1]).not.toHaveProperty('birth_year');
  });

  test('empty / nullish input → empty array', () => {
    expect(serializePersons(null, {})).toEqual([]);
    expect(serializePersons([], {})).toEqual([]);
  });
});
