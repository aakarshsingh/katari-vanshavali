process.env.JWT_SECRET = 'test-secret';
process.env.ANTHROPIC_API_KEY = 'test-key';

jest.mock('../src/db/client', () => require('./helpers/db-mock').createDbMock());

const { walkChain } = require('../src/routes/lineage');

// Helper: build persons + a linear chain of relationships from an ordered list.
function chainOf(names) {
  const persons = names.map((n, i) => ({ id: 'p' + i, name_en: n }));
  const relationships = [];
  for (let i = 0; i < persons.length - 1; i++) {
    relationships.push({ parent_id: persons[i].id, child_id: persons[i + 1].id });
  }
  return { persons, relationships };
}

describe('lineage walkChain', () => {
  test('peels the single-child chain above the focal', () => {
    const { persons, relationships } = chainOf(['Titay', 'Jeevlal', 'Bade Lal Singh', 'Son']);
    const { chain, focalId } = walkChain(persons, relationships, 'Bade Lal Singh');
    expect(chain).toEqual(['p0', 'p1']); // ancestors above focal
    expect(focalId).toBe('p2'); // Bade Lal Singh
  });

  test('matches the focal by substring (case-insensitive)', () => {
    const { persons, relationships } = chainOf(['Titay', 'bade lal singh ji']);
    const { chain, focalId } = walkChain(persons, relationships, 'Bade Lal Singh');
    expect(chain).toEqual(['p0']);
    expect(focalId).toBe('p1');
  });

  test('stops at a branch point when the focal name is absent', () => {
    // p0 → p1, then p1 has two children (branch) → p1 is the focal.
    const persons = ['A', 'B', 'C', 'D'].map((n, i) => ({ id: 'p' + i, name_en: n }));
    const relationships = [
      { parent_id: 'p0', child_id: 'p1' },
      { parent_id: 'p1', child_id: 'p2' },
      { parent_id: 'p1', child_id: 'p3' },
    ];
    const { chain, focalId } = walkChain(persons, relationships, 'Nobody');
    expect(chain).toEqual(['p0']);
    expect(focalId).toBe('p1');
  });

  test('empty graph yields no chain', () => {
    const { chain, focalId } = walkChain([], [], 'Bade Lal Singh');
    expect(chain).toEqual([]);
    expect(focalId).toBeNull();
  });
});
