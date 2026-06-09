const SVG_NS = 'http://www.w3.org/2000/svg';
const PADDING = 80;
const STRIP_BOX_W = 140;
const STRIP_BOX_H = 48;
const STRIP_H_GAP = 20;
const STRIP_V_PAD = 20;
// Traditional Vamshavali palette (muted Indian natural-dye tones).
const INK = '#302B27';        // dark sepia ink — lines + text
// Node names use Noto (regular) — more legible at small sizes than Tiro's fine
// serif; the decorative title keeps Tiro.
const FONT = "'Noto Sans Devanagari', Georgia, serif";
const HEADING_FONT = "'Tiro Devanagari Hindi', Georgia, serif";

// Bloodline by generation (0 = root): fill + colored 2px border so it pops.
const GEN_FILL = ['#F6E3E3', '#F7ECD5', '#E4E7D9', '#E0E5EA', '#EFE5DF'];
const GEN_BORDER = ['#9E3A46', '#B57E22', '#5F6B4C', '#415B76', '#8B6A56'];
// Spouses: constant, muted taupe that recedes.
const SPOUSE_FILL = '#E8E2D9';
const SPOUSE_BORDER = '#C4BCAF';
const FILL_BLOODLINE = GEN_FILL[0]; // no-metrics fallback

const FILL_ANCESTOR = '#EFE7DA';
const TEXT_MUTED = '#6b5a44';
// Gender accent glyph colours.
const ACCENT_M = '#415B76';   // faded indigo
const ACCENT_F = '#9E3A46';   // kumkum red
// Generation bands: alternating transparent / #F3EFE6.
const BAND_FILL = '#F3EFE6';
const BAND_OPACITY = 1;
const _genIdx = (d) => Math.max(0, Math.min(GEN_FILL.length - 1, d));
const BUS_DROP = 16;   // distance from parent bottom to the shared sibling bus
// Max chars before truncating with ellipsis (ancestor strip only)
const NAME_MAX = 22;
// Era caption shown above the ancestor strip (the lineage's approximate span).
const ANCESTOR_ERA_CAPTION = '1840 – 1940';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function clip(text, max) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function renderTree(state) {
  const svg = document.getElementById('tree-svg');
  if (!svg) return;

  const { persons, relationships, lang, tree } = state;
  const headerTitle = tree
    ? (lang === 'hi' ? (tree.title_hi || tree.title_en) : (tree.title_en || tree.title_hi))
    : '';

  const hint = document.getElementById('empty-hint');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (hint) svg.appendChild(hint);

  if (!persons || persons.length === 0) {
    if (hint) hint.style.display = '';
    return;
  }
  if (hint) hint.style.display = 'none';

  const split = (typeof splitTree === 'function')
    ? splitTree(persons, relationships, 'Bade Lal Singh')
    : { ancestorChain: [], focalId: null, descendantPersons: persons, descendantRelationships: relationships };

  const { ancestorChain, focalId } = split;
  let { descendantPersons, descendantRelationships } = split;
  const personMap = Object.fromEntries(persons.map(p => [p.id, p]));

  // Which nodes have children (pre-collapse) → drives the collapse toggle.
  const hasChildren = new Set(descendantRelationships.map(r => r.parent_id));

  // Collapse: hide descendants of any collapsed node before layout.
  if (collapsed.size) {
    const pruned = pruneCollapsed(descendantPersons, descendantRelationships, collapsed);
    descendantPersons = pruned.persons;
    descendantRelationships = pruned.relationships;
  }

  // Per-node widths (couple units are wider) drive the layout spacing.
  const widthOf = (typeof NodeMetrics !== 'undefined') ? NodeMetrics.widthMap(persons, lang) : null;

  // Reingold–Tilford tidy layout (per-depth contours, variable widths) rooted at
  // the focal person — tighter packing than the old grouped layout.
  const layout = computeLayout(descendantPersons, descendantRelationships, widthOf);
  if (!layout || layout.length === 0) return;

  const nodeH = layout[0].height; // uniform across the tree
  const layoutMap = Object.fromEntries(layout.map(n => [n.id, n]));

  // True genealogical depth from the focal person (parent_depth + 1) — drives
  // both the generation colour and the generation bands (NOT the rendered row).
  const depthById = computeDepths(focalId, descendantRelationships);

  const maxX = Math.max(...layout.map(n => n.x + n.width));
  const maxY = Math.max(...layout.map(n => n.y + nodeH));

  // Ancestor strip dimensions
  const hasStrip = ancestorChain.length > 0;
  const stripTotalW = ancestorChain.length * STRIP_BOX_W
    + Math.max(0, ancestorChain.length - 1) * STRIP_H_GAP;
  const stripHeight = hasStrip ? STRIP_BOX_H + STRIP_V_PAD * 2 : 0;

  // Center ancestor strip above the focal person, aligned to the focal couple's
  // marriage-connector centre so the dotted drop meets the node cleanly.
  const focalPos = focalId ? layoutMap[focalId] : null;
  let focalCenterX = PADDING + (focalPos ? focalPos.x + focalPos.width / 2 : maxX / 2);
  if (focalPos && typeof NodeMetrics !== 'undefined' && personMap[focalId]) {
    const fs = NodeMetrics.cardSpec(personMap[focalId], lang);
    if (fs.isCouple) {
      focalCenterX = PADDING + focalPos.x + fs.person.box.width + NodeMetrics.M.COUPLE_GAP / 2;
    }
  }
  const stripStartX = Math.max(PADDING, focalCenterX - stripTotalW / 2);

  const svgW = Math.max(maxX + PADDING * 2, stripStartX + stripTotalW + PADDING);
  const svgH = maxY + PADDING * 2 + stripHeight;

  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

  renderBorder(svg, svgW, svgH);
  renderTitleHeader(svg, svgW, headerTitle);
  renderBands(svg, layout, nodeH, stripHeight, svgW, depthById);

  if (hasStrip) {
    renderAncestorStrip(
      svg, ancestorChain, personMap, lang,
      stripStartX, PADDING + STRIP_V_PAD,
      focalCenterX, PADDING + stripHeight
    );
  }

  // Edge anchors: descend from the marriage-connector centre (couples) and
  // attach to each child's own (bloodline) box centre.
  const anchors = {};
  const metricsAvail = (typeof NodeMetrics !== 'undefined');
  for (const pos of layout) {
    const person = personMap[pos.id];
    const baseX = PADDING + pos.x;
    if (metricsAvail && person) {
      const spec = NodeMetrics.cardSpec(person, lang);
      const personCenter = baseX + spec.person.box.width / 2;
      anchors[pos.id] = {
        attachX: personCenter,
        descendX: spec.isCouple
          ? baseX + spec.person.box.width + NodeMetrics.M.COUPLE_GAP / 2
          : personCenter,
      };
    } else {
      const c = baseX + pos.width / 2;
      anchors[pos.id] = { attachX: c, descendX: c };
    }
  }

  const parentOf = {};
  for (const r of descendantRelationships) parentOf[r.child_id] = r.parent_id;

  renderEdges(svg, layoutMap, descendantRelationships, nodeH, stripHeight, anchors);
  renderNodes(svg, layout, personMap, lang, nodeH, stripHeight, focalId, depthById, hasChildren, parentOf);
}

// Client-side collapse state (in-memory) + toggle.
const collapsed = new Set();
function toggleCollapse(id) {
  if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  if (window.__state && typeof renderTree === 'function') renderTree(window.__state);
}
window.toggleCollapse = toggleCollapse;

// Remove all descendants (not the node itself) of any collapsed node.
function pruneCollapsed(persons, relationships, collapsedSet) {
  const childrenOf = {};
  for (const r of relationships) (childrenOf[r.parent_id] = childrenOf[r.parent_id] || []).push(r.child_id);
  const remove = new Set();
  for (const cid of collapsedSet) {
    const stack = [...(childrenOf[cid] || [])];
    while (stack.length) {
      const n = stack.pop();
      if (!remove.has(n)) { remove.add(n); for (const c of (childrenOf[n] || [])) stack.push(c); }
    }
  }
  return {
    persons: persons.filter(p => !remove.has(p.id)),
    relationships: relationships.filter(r => !remove.has(r.parent_id) && !remove.has(r.child_id)),
  };
}

// BFS from the focal person over parent→child edges → { id: depth } (focal = 0).
function computeDepths(focalId, relationships) {
  const childrenOf = {};
  for (const r of relationships) {
    (childrenOf[r.parent_id] = childrenOf[r.parent_id] || []).push(r.child_id);
  }
  const depth = {};
  if (focalId == null) return depth;
  depth[focalId] = 0;
  const queue = [focalId];
  while (queue.length) {
    const id = queue.shift();
    for (const c of (childrenOf[id] || [])) {
      if (depth[c] === undefined) { depth[c] = depth[id] + 1; queue.push(c); }
    }
  }
  return depth;
}

// Alternating band per GENERATION (true depth), spanning all of that
// generation's rows — so a 2-row generation shares one band.
function renderBands(svg, layout, nodeH, yOffset, svgW, depthById) {
  const byGen = {};
  for (const n of layout) {
    const d = (depthById && depthById[n.id] != null) ? depthById[n.id] : 0;
    if (!byGen[d]) byGen[d] = { min: n.y, max: n.y };
    if (n.y < byGen[d].min) byGen[d].min = n.y;
    if (n.y > byGen[d].max) byGen[d].max = n.y;
  }
  const g = svgEl('g', { class: 'gen-bands' });
  Object.keys(byGen).map(Number).sort((a, b) => a - b).forEach((d) => {
    if (d % 2 === 1) {
      const b = byGen[d];
      g.appendChild(svgEl('rect', {
        x: 16, y: PADDING + yOffset + b.min - 6,
        width: svgW - 32, height: (b.max - b.min) + nodeH + 12,
        fill: BAND_FILL, 'fill-opacity': BAND_OPACITY, stroke: 'none', rx: 6,
      }));
    }
  });
  svg.appendChild(g);
}

// Title as an integrated header inside the decorative border (top-centre),
// with a small divider flourish — replaces the "floating" toolbar-only title
// and is captured automatically on export.
function renderTitleHeader(svg, svgW, title) {
  if (!title) return;
  const cx = svgW / 2;
  const t = svgEl('text', {
    class: 'tree-heading',
    x: cx, y: 42,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
    'font-size': 26, fill: INK,
  });
  t.textContent = title;
  t.setAttribute('font-family', HEADING_FONT);
  t.style.cursor = 'pointer';
  t.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.__locked && typeof window.editTitle === 'function') window.editTitle();
  });
  svg.appendChild(t);

  const half = Math.min(160, Math.max(70, title.length * 7));
  svg.appendChild(svgEl('line', {
    x1: cx - half, y1: 62, x2: cx + half, y2: 62,
    stroke: INK, 'stroke-width': 0.75,
  }));
}

function renderBorder(svg, w, h) {
  svg.appendChild(svgEl('rect', {
    x: 8, y: 8, width: w - 16, height: h - 16,
    fill: 'none', stroke: INK, 'stroke-width': 1.5, rx: 4,
  }));
  svg.appendChild(svgEl('rect', {
    x: 14, y: 14, width: w - 28, height: h - 28,
    fill: 'none', stroke: INK, 'stroke-width': 0.75, rx: 4,
  }));
}

function renderAncestorStrip(svg, ancestorChain, personMap, lang, startX, startY, focalCenterX, focalTopY) {
  const group = svgEl('g', { class: 'ancestor-strip' });

  // Era caption centred above the strip (styled via .ancestor-era in main.css).
  const stripW = ancestorChain.length * STRIP_BOX_W
    + Math.max(0, ancestorChain.length - 1) * STRIP_H_GAP;
  const caption = svgEl('text', {
    class: 'ancestor-era',
    x: startX + stripW / 2, y: startY - 7,
    'text-anchor': 'middle', 'dominant-baseline': 'middle',
  });
  caption.textContent = ANCESTOR_ERA_CAPTION;
  group.appendChild(caption);

  for (let i = 0; i < ancestorChain.length; i++) {
    const person = personMap[ancestorChain[i]];
    if (!person) continue;

    const x = startX + i * (STRIP_BOX_W + STRIP_H_GAP);

    group.appendChild(svgEl('rect', {
      x, y: startY, width: STRIP_BOX_W, height: STRIP_BOX_H,
      fill: FILL_ANCESTOR, stroke: INK, 'stroke-width': 0.75, rx: 3,
    }));

    const name = clip(lang === 'hi' ? (person.name_hi || person.name_en) : person.name_en, NAME_MAX);
    const nameEl = svgEl('text', {
      x: x + STRIP_BOX_W / 2, y: startY + STRIP_BOX_H / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 11, fill: INK,
    });
    nameEl.textContent = name;
    nameEl.setAttribute('font-family', FONT);
    group.appendChild(nameEl);

    // Horizontal connector to next ancestor box
    if (i < ancestorChain.length - 1) {
      group.appendChild(svgEl('line', {
        x1: x + STRIP_BOX_W, y1: startY + STRIP_BOX_H / 2,
        x2: x + STRIP_BOX_W + STRIP_H_GAP, y2: startY + STRIP_BOX_H / 2,
        stroke: INK, 'stroke-width': 1,
      }));
    }
  }

  // Orthogonal dotted connector from last ancestor down to the focal person
  // (down -> across -> down), consistent with the tree's edge style. Dotted
  // signals "collapsed ancestor line" without the awkward diagonal.
  if (ancestorChain.length > 0) {
    const lastBoxLeft = startX + (ancestorChain.length - 1) * (STRIP_BOX_W + STRIP_H_GAP);
    const lastCenterX = lastBoxLeft + STRIP_BOX_W / 2;
    const lastBottomY = startY + STRIP_BOX_H;
    const midY = (lastBottomY + focalTopY) / 2;

    group.appendChild(svgEl('path', {
      d: `M ${lastCenterX} ${lastBottomY} V ${midY} H ${focalCenterX} V ${focalTopY}`,
      fill: 'none', stroke: INK, 'stroke-width': 1.5,
      'stroke-dasharray': '4,3', 'stroke-linejoin': 'round',
    }));
  }

  svg.appendChild(group);
}

function renderEdges(svg, layoutMap, relationships, nodeH, yOffset, anchors) {
  const edgeGroup = svgEl('g', { class: 'edges' });
  for (const rel of relationships) {
    const parent = layoutMap[rel.parent_id];
    const child = layoutMap[rel.child_id];
    if (!parent || !child) continue;

    // Descend from the centre of the parents' marriage connector (T5);
    // attach to the child's own (bloodline) box centre.
    const pa = anchors[rel.parent_id];
    const ca = anchors[rel.child_id];
    const px = pa ? pa.descendX : PADDING + parent.x + parent.width / 2;
    const py = PADDING + yOffset + parent.y + nodeH;
    const cx = ca ? ca.attachX : PADDING + child.x + child.width / 2;
    const cy = PADDING + yOffset + child.y;
    // Shared horizontal "bus" just below the parent → clean comb; all children
    // of a parent share it. Second-row children drop further from the same bus
    // (their x is brick-offset into the gaps, so they don't cross row-1 boxes).
    const busY = py + Math.min(BUS_DROP, (cy - py) * 0.5);

    edgeGroup.appendChild(svgEl('path', {
      d: `M ${px} ${py} V ${busY} H ${cx} V ${cy}`,
      fill: 'none', stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round',
    }));
  }
  svg.appendChild(edgeGroup);
}

// Draws one labeled box. Fill by ROLE + generation depth (lightens each
// generation); gender shown by a small ♂/♀ accent; text always dark.
// role: 'person' (bloodline) | 'spouse' (married-in).
function drawBox(group, boxX, y, h, box, gender, role, emphasis, depth) {
  const M = NodeMetrics.M;
  const isSpouse = role === 'spouse';
  const gi = _genIdx(depth || 0);
  const fill = isSpouse ? SPOUSE_FILL : GEN_FILL[gi];
  const stroke = isSpouse ? SPOUSE_BORDER : GEN_BORDER[gi];
  // Bloodline gets a thicker 2px border to pop against spouses; patriarch 2.5px.
  const strokeWidth = isSpouse ? 1 : (emphasis ? 2.75 : 2);

  group.appendChild(svgEl('rect', {
    x: boxX, y, width: box.width, height: h,
    fill, stroke, 'stroke-width': strokeWidth, rx: 3,
  }));

  // Gender accent glyph, top-left corner
  const accent = gender === 'M' ? ACCENT_M : (gender === 'F' ? ACCENT_F : null);
  if (accent) {
    const ga = svgEl('text', {
      class: 'gender-accent',
      x: boxX + 8, y: y + 11,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-size': 11, fill: accent,
    });
    ga.textContent = gender === 'M' ? '♂' : '♀';
    group.appendChild(ga);
  }

  const cx = boxX + box.width / 2;
  const meta = box.metaLine;
  const contentH = box.nameLines.length * M.LINE_NAME + (meta ? M.LINE_META + 2 : 0);
  const top = y + (h - contentH) / 2;

  box.nameLines.forEach((line, i) => {
    const cls = role === 'person' && i === 0 ? 'name-primary' : 'name-line';
    const t = svgEl('text', {
      class: cls,
      x: cx, y: top + i * M.LINE_NAME + M.LINE_NAME / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 15, 'font-weight': 500, fill: INK,
    });
    t.textContent = line;
    t.setAttribute('font-family', FONT);
    group.appendChild(t);
  });

  if (meta) {
    const m = svgEl('text', {
      class: 'years',
      x: cx, y: top + box.nameLines.length * M.LINE_NAME + (M.LINE_META + 2) / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 10, 'font-style': 'italic', fill: TEXT_MUTED,
    });
    m.textContent = meta;
    m.setAttribute('font-family', FONT);
    group.appendChild(m);
  }
}

// Edit (pencil) icon at the top-right of a box. One per box so a couple has an
// edit handle on BOTH the person and the spouse (both edit the same record).
// Class "affordance" → shown on hover (unlocked), stripped on export.
function addEditIcon(g, personId, cx, cy) {
  const ed = svgEl('g', { class: 'affordance aff-btn aff-edit' });
  ed.appendChild(svgEl('circle', { cx, cy, r: 9, fill: '#fff8f0', stroke: INK, 'stroke-width': 1 }));
  const t = svgEl('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 10, fill: INK });
  t.textContent = '✎';
  ed.appendChild(t);
  ed.addEventListener('click', (e) => { e.stopPropagation(); if (typeof openEdit === 'function') openEdit(personId); });
  g.appendChild(ed);
}

// Add-child (+) icon. One per unit (bottom-right).
function addAddChildIcon(g, personId, cx, cy) {
  const ad = svgEl('g', { class: 'affordance aff-btn aff-add' });
  ad.appendChild(svgEl('circle', { cx, cy, r: 10, fill: '#e8dcc0', stroke: INK, 'stroke-width': 1 }));
  const t = svgEl('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 15, 'font-weight': 'bold', fill: INK });
  t.textContent = '+';
  ad.appendChild(t);
  ad.addEventListener('click', (e) => { e.stopPropagation(); if (typeof openNew === 'function') openNew(personId); });
  g.appendChild(ad);
}

// Small −/+ toggle at a parent's bottom edge to collapse / expand its branch.
function addCollapseToggle(g, id, cx, cy, isCollapsed) {
  const t = svgEl('g', { class: 'collapse-toggle' });
  t.appendChild(svgEl('circle', { cx, cy, r: 9, fill: '#FDFBF7', stroke: INK, 'stroke-width': 1.5 }));
  const sign = svgEl('text', {
    x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central',
    'font-size': 15, 'font-weight': 'bold', fill: INK,
  });
  sign.textContent = isCollapsed ? '+' : '−';
  t.appendChild(sign);
  t.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof toggleCollapse === 'function') toggleCollapse(id);
  });
  g.appendChild(t);
}

function renderNodes(svg, layout, personMap, lang, nodeH, yOffset, focalId, depthById, hasChildren, parentOf) {
  const nodeGroup = svgEl('g', { class: 'nodes' });
  const metrics = (typeof NodeMetrics !== 'undefined') ? NodeMetrics : null;
  depthById = depthById || {};
  hasChildren = hasChildren || new Set();
  parentOf = parentOf || {};

  for (const pos of layout) {
    const person = personMap[pos.id];
    if (!person) continue;

    const x = PADDING + pos.x;
    const y = PADDING + yOffset + pos.y;
    const depth = depthById[pos.id] || 0;
    const isPatriarch = focalId && person.id === focalId;

    const g = svgEl('g', {
      class: 'node',
      'data-id': person.id,
      'data-name-en': person.name_en || '',
      'data-name-hi': person.name_hi || '',
    });

    if (metrics) {
      const spec = metrics.cardSpec(person, lang);

      // Couple group container: a subtle pill behind both boxes so the pair
      // reads as one family unit (drawn first, sits behind the boxes).
      if (spec.isCouple) {
        g.appendChild(svgEl('rect', {
          class: 'couple-bg',
          x: x - 5, y: y - 5, width: spec.width + 10, height: nodeH + 10, rx: 9,
          fill: '#7a6a48', 'fill-opacity': 0.06, stroke: '#7a6a48', 'stroke-opacity': 0.18,
        }));
      }

      drawBox(g, x + spec.person.offsetX, y, nodeH, spec.person.box, spec.person.gender, 'person', isPatriarch, depth);
      addEditIcon(g, person.id, x + spec.person.box.width - 11, y + 11);

      if (spec.isCouple) {
        drawBox(g, x + spec.spouse.offsetX, y, nodeH, spec.spouse.box, spec.spouse.gender, 'spouse', false, depth);
        addEditIcon(g, person.id, x + spec.spouse.offsetX + spec.spouse.box.width - 11, y + 11);
        // Marriage connector (double line) between the two boxes
        const x1 = x + spec.person.box.width;
        const x2 = x + spec.spouse.offsetX;
        const midY = y + nodeH / 2;
        g.appendChild(svgEl('line', { class: 'marriage', x1, y1: midY - 2, x2, y2: midY - 2, stroke: INK, 'stroke-width': 1 }));
        g.appendChild(svgEl('line', { class: 'marriage', x1, y1: midY + 2, x2, y2: midY + 2, stroke: INK, 'stroke-width': 1 }));
      }
    } else {
      g.appendChild(svgEl('rect', {
        x, y, width: pos.width, height: nodeH,
        fill: FILL_BLOODLINE, stroke: INK, 'stroke-width': 1, rx: 3,
      }));
      addEditIcon(g, person.id, x + pos.width - 11, y + 11);
    }

    addAddChildIcon(g, person.id, x + pos.width - 11, y + nodeH + 12);
    if (hasChildren.has(pos.id)) {
      addCollapseToggle(g, pos.id, x + pos.width / 2, y + nodeH, collapsed.has(pos.id));
    }

    // Chain highlight on hover (locked/view mode): light up the lineage up to
    // the root. In unlocked mode we keep hover focused on the edit affordances.
    g.addEventListener('mouseenter', () => {
      if (!window.__locked) return;
      let cur = pos.id;
      const seen = {};
      while (cur && !seen[cur]) {
        seen[cur] = true;
        const el = nodeGroup.querySelector(`.node[data-id="${cur}"]`);
        if (el) el.classList.add('chain');
        cur = parentOf[cur];
      }
    });
    g.addEventListener('mouseleave', () => {
      nodeGroup.querySelectorAll('.node.chain').forEach((el) => el.classList.remove('chain'));
    });

    g.addEventListener('click', (e) => {
      if (window.__locked) return;
      e.stopPropagation();
      if (typeof openEdit === 'function') openEdit(person.id);
    });

    g.addEventListener('contextmenu', (e) => {
      if (window.__locked) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof showCtxMenu === 'function') showCtxMenu(e, person.id);
    });

    nodeGroup.appendChild(g);
  }

  svg.appendChild(nodeGroup);
}

function formatYears(birth, death) {
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return '';
}

window.renderTree = renderTree;
