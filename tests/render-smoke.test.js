// Render smoke test: exercises the real browser render path (node-metrics +
// tree-layout + tree-render) against a minimal DOM stub, in plain Node.
// Catches runtime errors (e.g. undefined identifiers) that node --check and the
// mocked API tests miss because they never execute renderTree/renderNodes.

const fs = require('fs');
const path = require('path');

function matchSel(el, sel) {
  if (sel.startsWith('.')) return (el.attributes['class'] || '').split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith('#')) return el.attributes['id'] === sel.slice(1);
  return el.tag === sel;
}
function walk(el, sel, out) {
  for (const c of el.children) { if (matchSel(c, sel)) out.push(c); walk(c, sel, out); }
  return out;
}
function mk(tag) {
  return {
    tag, children: [], attributes: {}, style: {}, textContent: '',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
    get firstChild() { return this.children[0] || null; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener() {},
    querySelector(s) { const o = []; walk(this, s, o); return o[0] || null; },
    querySelectorAll(s) { const o = []; walk(this, s, o); return o; },
  };
}

function setupDomAndLoad() {
  const svg = mk('svg'); svg.attributes.id = 'tree-svg';
  const hint = mk('text'); hint.attributes.id = 'empty-hint'; svg.appendChild(hint);
  const byId = { 'tree-svg': svg, 'empty-hint': hint };
  global.window = global;
  global.document = {
    getElementById: (id) => byId[id] || null,
    createElementNS: (ns, tag) => mk(tag),
    createElement: () => ({ getContext: () => null }),
    fonts: { ready: Promise.resolve() },
  };
  const code = ['node-metrics.js', 'tree-layout.js', 'tree-render.js']
    .map((f) => fs.readFileSync(path.join(__dirname, '..', 'public', 'js', f), 'utf8'))
    .join('\n');
  // eslint-disable-next-line no-eval
  eval(code); // shared scope so the three "scripts" see each other (like the browser)
  return svg;
}

const STATE = {
  lang: 'en',
  tree: { title_en: 'Katari Lineage', title_hi: 'वंशावली' },
  persons: [
    { id: 'F', name_en: 'Bade Lal Singh', spouse_en: 'Chandrika Devi' },
    { id: 'a', name_en: 'Dr. Vijay Kumar Singh', spouse_en: 'Draupadi Devi' },
    { id: 'b', name_en: 'Ram Naresh Prasad Singh' },
    { id: 'c', name_en: 'Suresh Prasad Singh' },
    { id: 'a1', name_en: 'Rudrani Singh', spouse_en: 'Arun Kumar Singh' },
    { id: 'a2', name_en: 'Runni Singh' },
    { id: 'a3', name_en: 'Dr. Harishankar Kumar Pankaj' },
  ],
  relationships: [
    { parent_id: 'F', child_id: 'a' }, { parent_id: 'F', child_id: 'b' }, { parent_id: 'F', child_id: 'c' },
    { parent_id: 'a', child_id: 'a1' }, { parent_id: 'a', child_id: 'a2' }, { parent_id: 'a', child_id: 'a3' },
  ],
};

describe('renderTree (smoke)', () => {
  test('renders one node group per person without throwing', () => {
    const svg = setupDomAndLoad();
    expect(() => window.renderTree(STATE)).not.toThrow();
    expect(svg.querySelectorAll('.node').length).toBe(STATE.persons.length);
  });

  test('couples get a group container; bands render', () => {
    const svg = setupDomAndLoad();
    window.renderTree(STATE);
    // F, a, a1 are couples
    expect(svg.querySelectorAll('.couple-bg').length).toBe(3);
    expect(svg.querySelectorAll('.gen-bands').length).toBe(1);
  });

  test('edit icon per box; collapse toggle per parent', () => {
    const svg = setupDomAndLoad();
    window.renderTree(STATE);
    // one edit icon per box: 7 people + 3 spouses (F, a, a1 are couples) = 10
    expect(svg.querySelectorAll('.aff-edit').length).toBe(10);
    // collapse toggles on parents: F and a have children = 2
    expect(svg.querySelectorAll('.collapse-toggle').length).toBe(2);
  });

  test('empty tree shows the hint, no node groups', () => {
    const svg = setupDomAndLoad();
    window.renderTree({ lang: 'en', tree: null, persons: [], relationships: [] });
    expect(svg.querySelectorAll('.node').length).toBe(0);
  });
});
