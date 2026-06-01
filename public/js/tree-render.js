const SVG_NS = 'http://www.w3.org/2000/svg';
const PADDING = 80;
const STRIP_BOX_W = 150;
const STRIP_BOX_H = 50;
const STRIP_H_GAP = 16;
const STRIP_V_PAD = 24;
const INK = '#1a1008';
const FILL_MALE = '#fff8f0';
const FILL_FEMALE = '#8b1a1a';
const FILL_ANCESTOR = '#f5ede0';
const TEXT_MUTED = '#6b5a44';
const TEXT_SPOUSE = '#cc2200';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
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

  const { ancestorChain, descendantPersons, descendantRelationships } = split;
  const personMap = Object.fromEntries(persons.map(p => [p.id, p]));

  const stripHeight = ancestorChain.length > 0 ? STRIP_BOX_H + STRIP_V_PAD * 2 : 0;

  const layout = computeLayout(descendantPersons, descendantRelationships);
  if (!layout || layout.length === 0) return;

  const { width: nodeW, height: nodeH } = layout[0];
  const layoutMap = Object.fromEntries(layout.map(n => [n.id, n]));

  const maxX = Math.max(...layout.map(n => n.x + nodeW));
  const maxY = Math.max(...layout.map(n => n.y + nodeH));

  const stripTotalW = ancestorChain.length * STRIP_BOX_W + Math.max(0, ancestorChain.length - 1) * STRIP_H_GAP;
  const svgW = Math.max(maxX + PADDING * 2, stripTotalW + PADDING * 2);
  const svgH = maxY + PADDING * 2 + stripHeight;

  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

  renderBorder(svg, svgW, svgH);

  if (ancestorChain.length > 0) {
    renderAncestorStrip(svg, ancestorChain, personMap, lang, PADDING, PADDING + STRIP_V_PAD);
  }

  renderEdges(svg, layout, layoutMap, descendantRelationships, nodeW, nodeH, stripHeight);
  renderNodes(svg, layout, personMap, lang, nodeW, nodeH, stripHeight);
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

function renderAncestorStrip(svg, ancestorChain, personMap, lang, startX, startY) {
  const group = svgEl('g', { class: 'ancestor-strip' });

  for (let i = 0; i < ancestorChain.length; i++) {
    const person = personMap[ancestorChain[i]];
    if (!person) continue;

    const x = startX + i * (STRIP_BOX_W + STRIP_H_GAP);

    group.appendChild(svgEl('rect', {
      x, y: startY, width: STRIP_BOX_W, height: STRIP_BOX_H,
      fill: FILL_ANCESTOR, stroke: INK, 'stroke-width': 0.75, rx: 3,
    }));

    const name = lang === 'hi' ? (person.name_hi || person.name_en) : person.name_en;
    const nameEl = svgEl('text', {
      x: x + STRIP_BOX_W / 2,
      y: startY + STRIP_BOX_H / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 11, fill: INK,
    });
    nameEl.textContent = name;
    group.appendChild(nameEl);

    if (i < ancestorChain.length - 1) {
      group.appendChild(svgEl('line', {
        x1: x + STRIP_BOX_W, y1: startY + STRIP_BOX_H / 2,
        x2: x + STRIP_BOX_W + STRIP_H_GAP, y2: startY + STRIP_BOX_H / 2,
        stroke: INK, 'stroke-width': 1,
      }));
    }
  }

  svg.appendChild(group);
}

function renderEdges(svg, layout, layoutMap, relationships, nodeW, nodeH, yOffset) {
  const edgeGroup = svgEl('g', { class: 'edges' });
  for (const rel of relationships) {
    const parent = layoutMap[rel.parent_id];
    const child = layoutMap[rel.child_id];
    if (!parent || !child) continue;

    const px = PADDING + parent.x + nodeW / 2;
    const py = PADDING + yOffset + parent.y + nodeH;
    const cx = PADDING + child.x + nodeW / 2;
    const cy = PADDING + yOffset + child.y;
    const midY = (py + cy) / 2;

    edgeGroup.appendChild(svgEl('path', {
      d: `M ${px} ${py} V ${midY} H ${cx} V ${cy}`,
      fill: 'none', stroke: INK, 'stroke-width': 1.5, 'stroke-linejoin': 'round',
    }));
  }
  svg.appendChild(edgeGroup);
}

function renderNodes(svg, layout, personMap, lang, nodeW, nodeH, yOffset) {
  const nodeGroup = svgEl('g', { class: 'nodes' });

  for (const pos of layout) {
    const person = personMap[pos.id];
    if (!person) continue;

    const x = PADDING + pos.x;
    const y = PADDING + yOffset + pos.y;
    const isFemale = person.gender === 'F';
    const fill = isFemale ? FILL_FEMALE : FILL_MALE;
    const textColor = isFemale ? '#fdf6e3' : INK;

    const name = lang === 'hi' ? (person.name_hi || person.name_en) : person.name_en;
    const spouse = lang === 'hi' ? person.spouse_hi : person.spouse_en;
    const hasSpouse = !!spouse;
    const hasYears = !!(person.birth_year || person.death_year);

    const g = svgEl('g', {
      class: 'node',
      'data-id': person.id,
      'data-name-en': person.name_en || '',
      'data-name-hi': person.name_hi || '',
    });

    g.appendChild(svgEl('rect', {
      x, y, width: nodeW, height: nodeH,
      fill, stroke: INK, 'stroke-width': 1, rx: 3,
    }));

    const cx = x + nodeW / 2;
    const lineCount = 1 + (hasSpouse ? 1 : 0) + (hasYears ? 1 : 0);
    let nameY, spouseY, yearsY;

    if (lineCount === 3) {
      nameY   = y + nodeH * 0.28;
      spouseY = y + nodeH * 0.52;
      yearsY  = y + nodeH * 0.76;
    } else if (lineCount === 2) {
      nameY   = y + nodeH * 0.35;
      spouseY = y + nodeH * 0.68;
      yearsY  = y + nodeH * 0.68;
    } else {
      nameY = y + nodeH * 0.50;
    }

    const nameEl = svgEl('text', {
      class: 'name-primary',
      x: cx, y: nameY,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': 13, 'font-weight': 'bold', fill: textColor,
    });
    nameEl.textContent = name;
    g.appendChild(nameEl);

    if (hasSpouse) {
      const label = lang === 'hi' ? 'पत्नी: ' : 'w. ';
      const spouseEl = svgEl('text', {
        class: 'name-spouse',
        x: cx, y: spouseY,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': 12,
        fill: isFemale ? '#e8a090' : TEXT_SPOUSE,
      });
      spouseEl.textContent = label + spouse;
      g.appendChild(spouseEl);
    }

    if (hasYears) {
      const yearsEl = svgEl('text', {
        class: 'years',
        x: cx, y: yearsY,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-size': 9,
        fill: isFemale ? '#c9b08a' : TEXT_MUTED,
      });
      yearsEl.textContent = formatYears(person.birth_year, person.death_year);
      g.appendChild(yearsEl);
    }

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
