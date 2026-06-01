const SVG_NS = 'http://www.w3.org/2000/svg';
const PADDING = 80;
const STRIP_BOX_W = 140;
const STRIP_BOX_H = 48;
const STRIP_H_GAP = 20;
const STRIP_V_PAD = 20;
const INK = '#1a1008';
const FONT = "'Tiro Devanagari Hindi', Georgia, serif";
// Role-based fill (T1): bloodline = cream, married-in spouse = soft blue-grey.
const FILL_BLOODLINE = '#fff8f0';
const FILL_SPOUSE = '#e6ecf0';
const FILL_ANCESTOR = '#f5ede0';
const TEXT_MUTED = '#6b5a44';
// Gender accent glyph colours (dark text stays on the box; gender shown by accent).
const ACCENT_M = '#3a5f7d';   // slate blue
const ACCENT_F = '#9c4a6a';   // muted plum/rose
// Soft generation banding (T8): low-alpha watermark, not a hard stripe.
const BAND_FILL = '#b8986a';
const BAND_OPACITY = 0.10;
// Max chars before truncating with ellipsis (ancestor strip only)
const NAME_MAX = 22;

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

  const { persons, relationships, lang } = state;

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

  const { ancestorChain, focalId, descendantPersons, descendantRelationships } = split;
  const personMap = Object.fromEntries(persons.map(p => [p.id, p]));

  // Per-node widths (couple units are wider) drive the layout spacing.
  const widthOf = (typeof NodeMetrics !== 'undefined') ? NodeMetrics.widthMap(persons, lang) : null;

  // Compute descendant layout first — needed to know focal person's x position
  // Grouped layout: each top-level branch is a compact group, children wrap in rows
  const layout = (typeof computeGroupedLayout === 'function' && split.focalId)
    ? computeGroupedLayout(descendantPersons, descendantRelationships, split.focalId, widthOf)
    : computeLayout(descendantPersons, descendantRelationships, widthOf);
  if (!layout || layout.length === 0) return;

  const nodeH = layout[0].height; // uniform across the tree
  const layoutMap = Object.fromEntries(layout.map(n => [n.id, n]));

  const maxX = Math.max(...layout.map(n => n.x + n.width));
  const maxY = Math.max(...layout.map(n => n.y + nodeH));

  // Ancestor strip dimensions
  const hasStrip = ancestorChain.length > 0;
  const stripTotalW = ancestorChain.length * STRIP_BOX_W
    + Math.max(0, ancestorChain.length - 1) * STRIP_H_GAP;
  const stripHeight = hasStrip ? STRIP_BOX_H + STRIP_V_PAD * 2 : 0;

  // Center ancestor strip above the focal person (Bade Lal Singh)
  const focalPos = focalId ? layoutMap[focalId] : null;
  const focalCenterX = PADDING + (focalPos ? focalPos.x + focalPos.width / 2 : maxX / 2);
  const stripStartX = Math.max(PADDING, focalCenterX - stripTotalW / 2);

  const svgW = Math.max(maxX + PADDING * 2, stripStartX + stripTotalW + PADDING);
  const svgH = maxY + PADDING * 2 + stripHeight;

  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

  renderBorder(svg, svgW, svgH);
  renderBands(svg, layout, nodeH, stripHeight, svgW);

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

  renderEdges(svg, layoutMap, descendantRelationships, nodeH, stripHeight, anchors);
  renderNodes(svg, layout, personMap, lang, nodeH, stripHeight, focalId);
}

// Subtle alternating banding per generation row → easier to read generations.
function renderBands(svg, layout, nodeH, yOffset, svgW) {
  const rowsY = [...new Set(layout.map(n => n.y))].sort((a, b) => a - b);
  const g = svgEl('g', { class: 'gen-bands' });
  rowsY.forEach((ry, i) => {
    if (i % 2 === 1) {
      g.appendChild(svgEl('rect', {
        x: 16, y: PADDING + yOffset + ry - 6,
        width: svgW - 32, height: nodeH + 12,
        fill: BAND_FILL, 'fill-opacity': BAND_OPACITY, stroke: 'none', rx: 6,
      }));
    }
  });
  svg.appendChild(g);
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
    const midY = (py + cy) / 2;

    edgeGroup.appendChild(svgEl('path', {
      d: `M ${px} ${py} V ${midY} H ${cx} V ${cy}`,
      fill: 'none', stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round',
    }));
  }
  svg.appendChild(edgeGroup);
}

// Draws one labeled box. Fill by ROLE (bloodline cream / married-in spouse
// blue-grey); gender shown by a small ♂/♀ accent; text is always dark for
// readability. role: 'person' (bloodline) | 'spouse' (married-in).
function drawBox(group, boxX, y, h, box, gender, role, emphasis) {
  const M = NodeMetrics.M;
  const fill = role === 'spouse' ? FILL_SPOUSE : FILL_BLOODLINE;

  group.appendChild(svgEl('rect', {
    x: boxX, y, width: box.width, height: h,
    fill, stroke: INK, 'stroke-width': emphasis ? 2.5 : 1, rx: 3,
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
      'font-size': 13, fill: INK,
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

// Hover affordances: edit (pencil) top-right of the unit, add-child (+) below it.
// Class "affordance" so export can strip them. They stop propagation so they
// don't trigger the card's click-to-edit.
function addAffordances(g, person, unitX, unitW, y, nodeH) {
  const aff = svgEl('g', { class: 'affordance' });

  // Edit (pencil)
  const ex = unitX + unitW - 11, ey = y + 11;
  const edit = svgEl('g', { class: 'aff-btn aff-edit' });
  edit.appendChild(svgEl('circle', { cx: ex, cy: ey, r: 9, fill: '#fff8f0', stroke: INK, 'stroke-width': 1 }));
  const eg = svgEl('text', { x: ex, y: ey, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 10, fill: INK });
  eg.textContent = '✎';
  edit.appendChild(eg);
  edit.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof openEdit === 'function') openEdit(person.id);
  });
  aff.appendChild(edit);

  // Add child (+)
  const ax = unitX + unitW / 2, ay = y + nodeH + 12;
  const add = svgEl('g', { class: 'aff-btn aff-add' });
  add.appendChild(svgEl('circle', { cx: ax, cy: ay, r: 10, fill: '#e8dcc0', stroke: INK, 'stroke-width': 1 }));
  const ag = svgEl('text', { x: ax, y: ay, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 15, 'font-weight': 'bold', fill: INK });
  ag.textContent = '+';
  add.appendChild(ag);
  add.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof openNew === 'function') openNew(person.id);
  });
  aff.appendChild(add);

  g.appendChild(aff);
}

function renderNodes(svg, layout, personMap, lang, nodeH, yOffset, focalId) {
  const nodeGroup = svgEl('g', { class: 'nodes' });
  const metrics = (typeof NodeMetrics !== 'undefined') ? NodeMetrics : null;

  for (const pos of layout) {
    const person = personMap[pos.id];
    if (!person) continue;

    const x = PADDING + pos.x;
    const y = PADDING + yOffset + pos.y;
    const isPatriarch = focalId && person.id === focalId;

    const g = svgEl('g', {
      class: 'node',
      'data-id': person.id,
      'data-name-en': person.name_en || '',
      'data-name-hi': person.name_hi || '',
    });

    if (metrics) {
      const spec = metrics.cardSpec(person, lang);
      drawBox(g, x + spec.person.offsetX, y, nodeH, spec.person.box, spec.person.gender, 'person', isPatriarch);

      if (spec.isCouple) {
        drawBox(g, x + spec.spouse.offsetX, y, nodeH, spec.spouse.box, spec.spouse.gender, 'spouse');
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
    }

    addAffordances(g, person, x, pos.width, y, nodeH);

    g.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof openEdit === 'function') openEdit(person.id);
    });

    g.addEventListener('contextmenu', (e) => {
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
