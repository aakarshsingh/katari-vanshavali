// Flattened bilingual-card section for the "Review (A4)" export. Rendered through
// canvg (like the tree) so Devanagari names stay crisp; jsPDF's built-in fonts
// cannot draw Devanagari. Years are already visibility-filtered by the server
// serializer, so we render whatever fields are present.
//
// Card:  English Name (bold) / हिन्दी Name / 1865–1930
//
// Wrapped in an IIFE so internal helpers don't collide with the global-scope
// names in export.js; only window.ReviewSections leaks out.
(() => {
const LIST_INK = '#1a1008';
const LIST_PARCHMENT = '#FDFBF7';
const LIST_MAX_DIM = 12000;

async function _rasterize(svgStr, wpx, hpx) {
  let dpr = 3;
  while (dpr > 1 && (wpx * dpr > LIST_MAX_DIM || hpx * dpr > LIST_MAX_DIM)) dpr -= 0.25;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(wpx * dpr);
  canvas.height = Math.round(hpx * dpr);
  const ctx = canvas.getContext('2d');
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) { /* non-fatal */ }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = LIST_PARCHMENT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!window.canvg || !window.canvg.Canvg) throw new Error('Renderer (canvg) not loaded');
  const v = await window.canvg.Canvg.fromString(ctx, svgStr, { ignoreDimensions: true, ignoreClear: true });
  v.resize(canvas.width, canvas.height, 'none');
  await v.render();
  return canvas;
}

// ----- Flattened CARD view: bilingual cards (English + Hindi + years) stacked in
// a single vertical list, indented by generation. Reuses the tree's palette
// (GEN_FILL / GEN_BORDER / SPOUSE_* / ACCENT_* / _genIdx / INK / FONT) so the
// look & feel matches the on-screen tree, with a taller card for both scripts.

const FC = {
  rowGap: 16,
  indent: 26,
  maxIndent: 8,   // cap indentation depth so deep trees don't run off the page
  numW: 58,
  lpad: 10,
  rpad: 16,
  topPad: 8,
  titleH: 48,
  marginMM: 14,
  footerMM: 12,
  cardW: 172,     // single box width (wider than the tree's 130 to fit both scripts)
  cardGap: 10,    // gap between a couple's two boxes
  cardH: 88,      // taller: English (up to 2 lines) + Hindi + years
  padX: 11,
};

let _fcCtx = null;
function _fcMeasure(text, font) {
  if (!_fcCtx) _fcCtx = document.createElement('canvas').getContext('2d');
  _fcCtx.font = font;
  return _fcCtx.measureText(text || '').width;
}

function _fcWrapEn(text, maxW) {
  const font = "600 14px " + FONT;
  if (!text) return [''];
  if (_fcMeasure(text, font) <= maxW) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (cur && _fcMeasure(cand, font) > maxW) { lines.push(cur); cur = w; } else { cur = cand; }
  }
  if (cur) lines.push(cur);
  if (lines.length <= 2) return lines;
  // collapse the tail into line 2 with an ellipsis so a card is at most 2 lines.
  let second = lines.slice(1).join(' ');
  while (second && _fcMeasure(second + '…', font) > maxW) second = second.slice(0, -1);
  return [lines[0], second + '…'];
}

function _fcClip(text, maxW, font) {
  if (!text || _fcMeasure(text, font) <= maxW) return text || '';
  let s = text;
  while (s && _fcMeasure(s + '…', font) > maxW) s = s.slice(0, -1);
  return s + '…';
}

function _flattenRows(persons, relationships) {
  const byId = {};
  for (const p of persons) byId[p.id] = p;
  const childrenOf = buildAdjacency(persons, relationships);
  const roots = findRoots(persons, relationships);
  const rows = [];
  const walk = (id, prefix, depth, seen) => {
    if (!byId[id] || seen.has(id)) return;
    seen.add(id);
    rows.push({ id, depth, num: prefix });
    (childrenOf[id] || []).forEach((kid, i) => walk(kid, `${prefix}.${i + 1}`, depth + 1, seen));
  };
  const seen = new Set();
  (roots.length ? roots : persons.map((p) => p.id)).forEach((r, i) => walk(r, `${i + 1}`, 0, seen));
  return { rows, byId };
}

function _rowX(depth) {
  return FC.lpad + FC.numW + Math.min(depth, FC.maxIndent) * FC.indent;
}

function _isCouple(p) {
  return !!(p.spouse_en || p.spouse_hi);
}

function _oppGender(g) {
  return g === 'M' ? 'F' : (g === 'F' ? 'M' : 'other');
}

// One bilingual box. Coloring mirrors the tree: ancestors (above the focal) use
// the ancestor fill; the focal + descendants use the generation palette keyed off
// true depth-from-focal; a non-emphasized spouse stays taupe.
function _drawReviewBox(g, x, y, fields, role, emphasis, depth, isAncestor) {
  const isSpouse = role === 'spouse';
  const useSpousePalette = isSpouse && !emphasis;
  const gi = _genIdx(depth || 0);
  let fill;
  let stroke;
  let strokeWidth;
  if (isAncestor) {
    fill = FILL_ANCESTOR;
    stroke = INK;
    strokeWidth = 0.75;
  } else {
    fill = useSpousePalette ? SPOUSE_FILL : GEN_FILL[gi];
    stroke = useSpousePalette ? SPOUSE_BORDER : GEN_BORDER[gi];
    strokeWidth = useSpousePalette ? 1 : (emphasis ? 2.75 : 2);
  }
  g.appendChild(svgEl('rect', { x, y, width: FC.cardW, height: FC.cardH, rx: 3, fill, stroke, 'stroke-width': strokeWidth }));

  const accent = fields.gender === 'M' ? ACCENT_M : (fields.gender === 'F' ? ACCENT_F : null);
  if (accent) {
    const ga = svgEl('text', { x: x + 8, y: y + 12, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 11, fill: accent });
    ga.textContent = fields.gender === 'M' ? '♂' : '♀';
    g.appendChild(ga);
  }

  const cx = x + FC.cardW / 2;
  const innerW = FC.cardW - FC.padX * 2;
  const enLines = _fcWrapEn(fields.en, innerW);
  // Fixed slots so baselines line up across cards regardless of EN line count.
  enLines.slice(0, 2).forEach((ln, i) => {
    const t = svgEl('text', { x: cx, y: y + 20 + i * 17, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: INK, 'font-family': FONT });
    t.textContent = ln;
    g.appendChild(t);
  });
  if (fields.hi) {
    const t = svgEl('text', { x: cx, y: y + 58, 'text-anchor': 'middle', 'font-size': 14, fill: INK, 'font-family': FONT });
    t.textContent = _fcClip(fields.hi, innerW, "14px " + FONT);
    g.appendChild(t);
  }
  if (fields.years) {
    const t = svgEl('text', { x: cx, y: y + 76, 'text-anchor': 'middle', 'font-size': 10, 'font-style': 'italic', fill: TEXT_MUTED, 'font-family': FONT });
    t.textContent = fields.years;
    g.appendChild(t);
  }
}

function _personFields(p) {
  return { en: (p.name_en || '').trim(), hi: p.name_hi || '', years: NodeMetrics.formatYears(p.birth_year, p.death_year), gender: p.gender || 'M' };
}

function _spouseFields(p) {
  return {
    en: (p.spouse_en || '').trim(), hi: p.spouse_hi || '',
    years: NodeMetrics.formatYears(p.spouse_birth_year, p.spouse_death_year),
    gender: p.spouse_gender || _oppGender(p.gender),
  };
}

// Build the SVG (as a string) for one page of flattened bilingual-card rows.
// depthFromFocal maps id→generation depth (focal=0); ids absent from it are
// ancestors (above the focal) and get the ancestor fill.
function _flattenedPageSvg(pageRows, byId, lang, focalId, depthFromFocal, contentW, contentH, sectionTitle) {
  const svg = svgEl('svg', {
    xmlns: 'http://www.w3.org/2000/svg', width: contentW, height: contentH,
    viewBox: `0 0 ${contentW} ${contentH}`,
  });
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: contentW, height: contentH, fill: LIST_PARCHMENT }));

  let y = FC.topPad;
  if (sectionTitle) {
    const t = svgEl('text', { x: FC.lpad, y: 30, 'font-family': FONT, 'font-size': 22, 'font-weight': 600, fill: LIST_INK });
    t.textContent = sectionTitle;
    svg.appendChild(t);
    svg.appendChild(svgEl('line', { x1: FC.lpad, y1: 42, x2: contentW - FC.rpad, y2: 42, stroke: LIST_INK, 'stroke-opacity': 0.25 }));
    y = FC.titleH + FC.topPad;
  }

  for (const r of pageRows) {
    const person = byId[r.id];
    const couple = _isCouple(person);
    const x = _rowX(r.depth);
    const isFocal = !!(focalId && r.id === focalId);
    const df = depthFromFocal ? depthFromFocal[r.id] : null;
    const isAncestor = !isFocal && (df == null); // above the focal → ancestor fill
    const colorDepth = df != null ? df : 0;      // focal=0 red, descendants cycle from focal
    const g = svgEl('g', {});

    const nlbl = svgEl('text', { x: FC.lpad, y: y + FC.cardH / 2, 'font-family': FONT, 'font-size': 11, fill: '#9a8a70', 'dominant-baseline': 'middle' });
    nlbl.textContent = r.num;
    g.appendChild(nlbl);

    if (couple) {
      g.appendChild(svgEl('rect', {
        x: x - 5, y: y - 5, width: FC.cardW * 2 + FC.cardGap + 10, height: FC.cardH + 10, rx: 9,
        fill: '#7a6a48', 'fill-opacity': 0.06, stroke: '#7a6a48', 'stroke-opacity': 0.18,
      }));
    }
    _drawReviewBox(g, x, y, _personFields(person), 'person', isFocal, colorDepth, isAncestor);
    if (couple) {
      const sx = x + FC.cardW + FC.cardGap;
      _drawReviewBox(g, sx, y, _spouseFields(person), 'spouse', isFocal, colorDepth, isAncestor);
      const midY = y + FC.cardH / 2;
      g.appendChild(svgEl('line', { x1: x + FC.cardW, y1: midY - 2, x2: sx, y2: midY - 2, stroke: '#302B27', 'stroke-width': 1 }));
      g.appendChild(svgEl('line', { x1: x + FC.cardW, y1: midY + 2, x2: sx, y2: midY + 2, stroke: '#302B27', 'stroke-width': 1 }));
    }
    svg.appendChild(g);
    y += FC.cardH + FC.rowGap;
  }
  return new XMLSerializer().serializeToString(svg);
}

function _flattenGeometry(persons, relationships, lang) {
  const { rows, byId } = _flattenRows(persons, relationships);
  let maxW = 360;
  for (const r of rows) {
    const cardSpan = _isCouple(byId[r.id]) ? (FC.cardW * 2 + FC.cardGap) : FC.cardW;
    maxW = Math.max(maxW, _rowX(r.depth) + cardSpan + FC.rpad);
  }
  const contentW = Math.ceil(maxW);
  const imgW = 210 - FC.marginMM * 2;
  const imgH = 297 - FC.marginMM - FC.footerMM;
  const pageContentH = contentW * (imgH / imgW);
  return { rows, byId, contentW, pageContentH };
}

// Append the flattened-card section (A4 portrait, multi-page) to a jsPDF doc.
async function appendFlattenedCards(doc, persons, relationships, lang, sectionTitle, today) {
  if (!persons || !persons.length) return;
  const focalId = (typeof splitTree === 'function')
    ? splitTree(persons, relationships, 'Bade Lal Singh').focalId : null;
  const depthFromFocal = (typeof computeDepths === 'function') ? computeDepths(focalId, relationships) : {};
  const { rows, byId, contentW, pageContentH } = _flattenGeometry(persons, relationships, lang);

  const rowH = FC.cardH + FC.rowGap;
  // Every page renders the section title, so reserve titleH on all pages.
  const cap = Math.max(1, Math.floor((pageContentH - FC.titleH - FC.topPad) / rowH));

  const pages = [];
  for (let i = 0; i < rows.length; i += cap) pages.push(rows.slice(i, i + cap));

  const M = FC.marginMM;
  const F = FC.footerMM;
  for (let pi = 0; pi < pages.length; pi++) {
    doc.addPage('a4', 'portrait');
    const svgStr = _flattenedPageSvg(pages[pi], byId, lang, focalId, depthFromFocal, contentW, pageContentH,
      pi === 0 ? sectionTitle : `${sectionTitle} (cont.)`);
    const canvas = await _rasterize(svgStr, contentW, pageContentH);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const drawW = pw - M * 2;
    const drawH = Math.min(drawW * (pageContentH / contentW), ph - M - F);
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', M, M, drawW, drawH, undefined, 'FAST');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Exported ${today} - ${sectionTitle} - Page ${pi + 1}/${pages.length}`, M, ph - 5);
  }
}

// Test/preview helper: render a given page of the flattened cards to a PNG data
// URL. Returns { dataUrl, pages } so a test can verify pagination + overflow.
async function previewFlattenedPng(persons, relationships, lang, pageIndex = 0) {
  const focalId = (typeof splitTree === 'function')
    ? splitTree(persons, relationships, 'Bade Lal Singh').focalId : null;
  const depthFromFocal = (typeof computeDepths === 'function') ? computeDepths(focalId, relationships) : {};
  const { rows, byId, contentW, pageContentH } = _flattenGeometry(persons, relationships, lang);
  const rowH = FC.cardH + FC.rowGap;
  const cap = Math.max(1, Math.floor((pageContentH - FC.titleH - FC.topPad) / rowH));
  const pages = Math.ceil(rows.length / cap);
  const pi = Math.min(pageIndex, pages - 1);
  const slice = rows.slice(pi * cap, pi * cap + cap);
  const svgStr = _flattenedPageSvg(slice, byId, lang, focalId, depthFromFocal, contentW, pageContentH,
    pi === 0 ? 'Flattened cards' : 'Flattened cards (cont.)');
  const canvas = await _rasterize(svgStr, contentW, pageContentH);
  return { dataUrl: canvas.toDataURL('image/png'), pages };
}

window.ReviewSections = { appendFlattenedCards, previewFlattenedPng };
})();
