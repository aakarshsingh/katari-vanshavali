const { computeLayout, computeGroupedLayout, compareSiblings } = require('../public/js/tree-layout');

// Returns child ids ordered left-to-right (ascending x) under parent `pid`.
function siblingOrder(persons, rels, pid) {
  const layout = computeLayout(persons, rels);
  const childIds = new Set(rels.filter(r => r.parent_id === pid).map(r => r.child_id));
  return layout.filter(n => childIds.has(n.id)).sort((a, b) => a.x - b.x).map(n => n.id);
}

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

  test('variable widths (couples): no overlap; parent centered over children', () => {
    const persons = [{ id: 'p' }, { id: 'a' }, { id: 'b' }, { id: 'c' }];
    const widthOf = { p: 158, a: 330, b: 158, c: 330 }; // a, c are couples
    const rels = [['p', 'a'], ['p', 'b'], ['p', 'c']].map(([x, y]) => ({ parent_id: x, child_id: y }));
    const layout = computeLayout(persons, rels, widthOf);
    const by = Object.fromEntries(layout.map(n => [n.id, n]));
    expect(by.a.width).toBe(330);
    const kids = ['a', 'b', 'c'].map(id => by[id]).sort((m, n) => m.x - n.x);
    for (let i = 0; i < kids.length - 1; i++) {
      expect(kids[i].x + kids[i].width).toBeLessThanOrEqual(kids[i + 1].x + 0.001);
    }
    const spanCenter = ((by.a.x + by.a.width / 2) + (by.c.x + by.c.width / 2)) / 2;
    expect(Math.abs((by.p.x + by.p.width / 2) - spanCenter)).toBeLessThan(0.5);
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

describe('sibling ordering (Pivot R4)', () => {
  test('compareSiblings: sequence ascending', () => {
    expect(compareSiblings({ sequence: 1 }, { sequence: 2 })).toBeLessThan(0);
    expect(compareSiblings({ sequence: 3 }, { sequence: 2 })).toBeGreaterThan(0);
  });

  test('compareSiblings: numbered sorts before unnumbered', () => {
    expect(compareSiblings({ sequence: 9 }, {})).toBeLessThan(0);
    expect(compareSiblings({}, { sequence: 1 })).toBeGreaterThan(0);
  });

  test('compareSiblings: equal/absent sequence falls back to birth_year', () => {
    expect(compareSiblings({ birth_year: 1950 }, { birth_year: 1960 })).toBeLessThan(0);
    expect(compareSiblings({ sequence: 2, birth_year: 1980 }, { sequence: 2, birth_year: 1970 }))
      .toBeGreaterThan(0);
    expect(compareSiblings({}, {})).toBe(0);
  });

  test('all-numbered siblings render in sequence order regardless of DB order', () => {
    const persons = [
      { id: 'p' },
      { id: 'c1', sequence: 3 },
      { id: 'c2', sequence: 1 },
      { id: 'c3', sequence: 2 },
    ];
    const rels = ['c1', 'c2', 'c3'].map(c => ({ parent_id: 'p', child_id: c }));
    expect(siblingOrder(persons, rels, 'p')).toEqual(['c2', 'c3', 'c1']);
  });

  test('numbered siblings come before unnumbered ones', () => {
    const persons = [
      { id: 'p' },
      { id: 'u1' },
      { id: 'n2', sequence: 2 },
      { id: 'n1', sequence: 1 },
      { id: 'u2' },
    ];
    const rels = ['u1', 'n2', 'n1', 'u2'].map(c => ({ parent_id: 'p', child_id: c }));
    const order = siblingOrder(persons, rels, 'p');
    expect(order.slice(0, 2)).toEqual(['n1', 'n2']);
    expect(new Set(order.slice(2))).toEqual(new Set(['u1', 'u2']));
  });

  test('birth_year breaks ties when no sequence', () => {
    const persons = [
      { id: 'p' },
      { id: 'b', birth_year: 1975 },
      { id: 'a', birth_year: 1950 },
      { id: 'c', birth_year: 1990 },
    ];
    const rels = ['b', 'a', 'c'].map(c => ({ parent_id: 'p', child_id: c }));
    expect(siblingOrder(persons, rels, 'p')).toEqual(['a', 'b', 'c']);
  });
});

describe('one row per generation', () => {
  function family(childCount) {
    const persons = [{ id: 'F' }, { id: 'P' }];
    const rels = [{ parent_id: 'F', child_id: 'P' }];
    for (let i = 0; i < childCount; i++) {
      persons.push({ id: 'k' + i });
      rels.push({ parent_id: 'P', child_id: 'k' + i });
    }
    return { persons, rels };
  }

  test('all children of a parent share one row (single line per generation)', () => {
    for (const n of [2, 3, 5, 8]) {
      const { persons, rels } = family(n);
      const layout = computeGroupedLayout(persons, rels, 'F');
      const kidYs = new Set(layout.filter((p) => p.id.startsWith('k')).map((p) => p.y));
      expect(kidYs.size).toBe(1);
    }
  });
});
