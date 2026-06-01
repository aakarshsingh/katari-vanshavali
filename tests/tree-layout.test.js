const { computeLayout, computeGroupedLayout } = require('../public/js/tree-layout');

describe('computeLayout', () => {
  test('single node returns position at x:0, y:0', () => {
    const persons = [{ id: 'a' }];
    const relationships = [];
    const layout = computeLayout(persons, relationships);
    expect(layout).toHaveLength(1);
    expect(layout[0].id).toBe('a');
    expect(layout[0].y).toBe(0);
    expect(layout[0].x).toBeDefined();
  });

  test('linear chain A->B->C has strictly increasing y values', () => {
    const persons = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const relationships = [
      { parent_id: 'a', child_id: 'b' },
      { parent_id: 'b', child_id: 'c' },
    ];
    const layout = computeLayout(persons, relationships);
    expect(layout).toHaveLength(3);
    const byId = Object.fromEntries(layout.map(n => [n.id, n]));
    expect(byId['b'].y).toBeGreaterThan(byId['a'].y);
    expect(byId['c'].y).toBeGreaterThan(byId['b'].y);
  });

  test('parent with 4 children has no x bounding-box overlap between siblings', () => {
    const persons = [
      { id: 'p' },
      { id: 'c1' },
      { id: 'c2' },
      { id: 'c3' },
      { id: 'c4' },
    ];
    const relationships = [
      { parent_id: 'p', child_id: 'c1' },
      { parent_id: 'p', child_id: 'c2' },
      { parent_id: 'p', child_id: 'c3' },
      { parent_id: 'p', child_id: 'c4' },
    ];
    const layout = computeLayout(persons, relationships);
    const children = layout.filter(n => n.id !== 'p');
    expect(children).toHaveLength(4);
    // Sort by x and verify no two siblings' bounding boxes overlap
    children.sort((a, b) => a.x - b.x);
    for (let i = 0; i < children.length - 1; i++) {
      const rightEdge = children[i].x + children[i].width;
      const leftEdge = children[i + 1].x;
      expect(leftEdge).toBeGreaterThanOrEqual(rightEdge);
    }
  });
});

describe('computeGroupedLayout (variable width + couples)', () => {
  // Focal F with 3 children; child "a" is a couple with two children.
  const persons = [
    { id: 'F' }, { id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'a1' }, { id: 'a2' },
  ];
  const rels = [
    ['F', 'a'], ['F', 'b'], ['F', 'c'], ['a', 'a1'], ['a', 'a2'],
  ].map(([p, c]) => ({ parent_id: p, child_id: c }));
  // Wide widths simulate couple units / long names.
  const widthOf = { F: 280, a: 330, b: 350, c: 168, a1: 294, a2: 294 };

  test('per-node widths from widthOf are reflected in output', () => {
    const layout = computeGroupedLayout(persons, rels, 'F', widthOf);
    const by = Object.fromEntries(layout.map(n => [n.id, n]));
    expect(by.a.width).toBe(330);
    expect(by.F.width).toBe(280);
  });

  test('no horizontal overlap among top-level groups with varying widths', () => {
    const layout = computeGroupedLayout(persons, rels, 'F', widthOf);
    const by = Object.fromEntries(layout.map(n => [n.id, n]));
    const sibs = ['a', 'b', 'c'].map(id => by[id]).sort((x, y) => x.x - y.x);
    for (let i = 0; i < sibs.length - 1; i++) {
      expect(sibs[i].x + sibs[i].width).toBeLessThanOrEqual(sibs[i + 1].x + 0.001);
    }
  });

  test('no overlap among wrapped grandchildren', () => {
    const layout = computeGroupedLayout(persons, rels, 'F', widthOf);
    const by = Object.fromEntries(layout.map(n => [n.id, n]));
    const kids = ['a1', 'a2'].map(id => by[id]).sort((x, y) => x.x - y.x);
    expect(kids[0].x + kids[0].width).toBeLessThanOrEqual(kids[1].x + 0.001);
  });

  test('children sit below their parent generation', () => {
    const layout = computeGroupedLayout(persons, rels, 'F', widthOf);
    const by = Object.fromEntries(layout.map(n => [n.id, n]));
    expect(by.a.y).toBeGreaterThan(by.F.y);
    expect(by.a1.y).toBeGreaterThan(by.a.y);
  });

  test('all nodes share a uniform height (clean generation rows)', () => {
    const layout = computeGroupedLayout(persons, rels, 'F', widthOf);
    const heights = new Set(layout.map(n => n.height));
    expect(heights.size).toBe(1);
  });
});

describe('2-row child packing (T6)', () => {
  function family(childCount) {
    const persons = [{ id: 'F' }, { id: 'P' }];
    const rels = [{ parent_id: 'F', child_id: 'P' }];
    for (let i = 0; i < childCount; i++) {
      persons.push({ id: 'k' + i });
      rels.push({ parent_id: 'P', child_id: 'k' + i });
    }
    return { persons, rels };
  }

  test('a family with >3 children packs into exactly two rows', () => {
    const { persons, rels } = family(6);
    const layout = computeGroupedLayout(persons, rels, 'F');
    const kidYs = new Set(layout.filter(n => n.id.startsWith('k')).map(n => n.y));
    expect(kidYs.size).toBe(2);
  });

  test('a small family (<=3) stays on one row', () => {
    const { persons, rels } = family(3);
    const layout = computeGroupedLayout(persons, rels, 'F');
    const kidYs = new Set(layout.filter(n => n.id.startsWith('k')).map(n => n.y));
    expect(kidYs.size).toBe(1);
  });
});
