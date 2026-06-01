const { computeLayout } = require('../public/js/tree-layout');

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
