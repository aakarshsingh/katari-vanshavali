const SVG_NS = 'http://www.w3.org/2000/svg';
const PADDING = 80;
const INK = '#1a1008';
const FILL_MALE = '#fff8f0';
const FILL_FEMALE = '#8b1a1a';
const TEXT_MUTED = '#6b5a44';

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function renderTree(state) {
  const svg = document.getElementById('tree-svg');
  if (!svg) return;

  const { persons, relationships, lang } = state;

  // Clear previous content, preserve empty-hint
  const hint = document.getElementById('empty-hint');
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (hint) svg.appendChild(hint);

  if (!persons || persons.length === 0) {
    if (hint) hint.style.display = '';
    return;
  }
  if (hint) hint.style.display = 'none';

  const layout = computeLayout(persons, relationships);
  if (!layout || layout.length === 0) return;

  const personMap = Object.fromEntries(persons.map(p => [p.id, p]));
  const layoutMap = Object.fromEntries(layout.map(n => [n.id, n]));
  const { width: nodeW, height: nodeH } = layout[0];

  const maxX = Math.max(...layout.map(n => n.x + nodeW));
  const maxY = Math.max(...layout.map(n => n.y + nodeH));
  const svgW = maxX + PADDING * 2;
  const svgH = maxY + PADDING * 2;

  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

  renderBorder(svg, svgW, svgH);
  renderEdges(svg, layout, layoutMap, relationships, nodeW, nodeH);
  renderNodes(svg, layout, personMap, lang, nodeW, nodeH);
}

function renderBorder(svg, w, h) {
  // Double border: outer rect inset 8px, inner rect inset 14px
  svg.appendChild(svgEl('rect', {
    x: 8, y: 8,
    width: w - 16, height: h - 16,
    fill: 'none', stroke: INK, 'stroke-width': 1.5, rx: 4,
  }));
  svg.appendChild(svgEl('rect', {
    x: 14, y: 14,
    width: w - 28, height: h - 28,
    fill: 'none', stroke: INK, 'stroke-width': 0.75, rx: 4,
  }));
}

function renderEdges(svg, layout, layoutMap, relationships, nodeW, nodeH) {
  const edgeGroup = svgEl('g', { class: 'edges' });
  for (const rel of relationships) {
    const parent = layoutMap[rel.parent_id];
    const child = layoutMap[rel.child_id];
    if (!parent || !child) continue;

    const px = PADDING + parent.x + nodeW / 2;
    const py = PADDING + parent.y + nodeH;
    const cx = PADDING + child.x + nodeW / 2;
    const cy = PADDING + child.y;
    const midY = (py + cy) / 2;

    const path = svgEl('path', {
      d: `M ${px} ${py} V ${midY} H ${cx} V ${cy}`,
      fill: 'none',
      stroke: INK,
      'stroke-width': 1.5,
      'stroke-linejoin': 'round',
    });
    edgeGroup.appendChild(path);
  }
  svg.appendChild(edgeGroup);
}

function renderNodes(svg, layout, personMap, lang, nodeW, nodeH) {
  const nodeGroup = svgEl('g', { class: 'nodes' });

  for (const pos of layout) {
    const person = personMap[pos.id];
    if (!person) continue;

    const x = PADDING + pos.x;
    const y = PADDING + pos.y;
    const isFemale = person.gender === 'F';
    const fill = isFemale ? FILL_FEMALE : FILL_MALE;
    const textColor = isFemale ? '#fdf6e3' : INK;

    const [primaryName, secondaryName] = resolveName(person, lang);

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
    const hasYears = person.birth_year || person.death_year;
    const nameY = y + (hasYears ? nodeH * 0.32 : nodeH * 0.38);
    const secondaryY = y + (hasYears ? nodeH * 0.54 : nodeH * 0.62);
    const yearsY = y + nodeH * 0.76;

    const primaryEl = svgEl('text', {
      class: 'name-primary',
      x: cx, y: nameY,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-size': 13,
      'font-weight': 'bold',
      fill: textColor,
    });
    primaryEl.textContent = primaryName;
    g.appendChild(primaryEl);

    if (secondaryName) {
      const secondaryEl = svgEl('text', {
        class: 'name-secondary',
        x: cx, y: secondaryY,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-size': 10,
        fill: isFemale ? '#e8d5b7' : TEXT_MUTED,
      });
      secondaryEl.textContent = secondaryName;
      g.appendChild(secondaryEl);
    }

    if (hasYears) {
      const yearsEl = svgEl('text', {
        class: 'years',
        x: cx, y: yearsY,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
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

function resolveName(person, lang) {
  if (lang === 'hi') {
    return [person.name_hi || person.name_en, person.name_en];
  }
  return [person.name_en, person.name_hi || null];
}

function formatYears(birth, death) {
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return '';
}

window.renderTree = renderTree;
