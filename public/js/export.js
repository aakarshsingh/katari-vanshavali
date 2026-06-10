// Export the tree to PNG / PDF.
// Uses canvg to rasterize the live SVG — canvg renders via Canvas2D using the
// page's already-loaded Noto Sans Devanagari font, which fixes the long-standing
// problem of @font-face fonts not loading when an SVG is drawn through <img>.
// jsPDF and canvg are self-hosted under /vendor so export never depends on a CDN.

const PARCHMENT = '#FDFBF7';
const INK_COLOR = '#1a1008';
const EXPORT_FONT = "'Tiro Devanagari Hindi', Georgia, serif";
const MAX_CANVAS_DIM = 12000; // stay well under browser canvas limits
const EXPORT_DPR = 3;         // supersample for crisp text/lines (scaled down if it would exceed the cap)
// PDF paper long-side in mm (ISO A-series). The page is sized to the tree's
// own aspect ratio at this long side, so a large tree fills the page edge to
// edge instead of being letterboxed inside a fixed sheet.
const PAPER_LONG_MM = { a1: 841, a2: 594, a3: 420 };

// Clone the current #tree-svg for export: drop hint + hover affordances, reset
// any zoom transform so we capture the full tree at natural resolution.
function _buildExportClone() {
  const svg = document.getElementById('tree-svg');
  if (!svg) return null;
  const clone = svg.cloneNode(true);

  clone.style.transform = '';
  clone.style.transformOrigin = '';
  clone.style.width = '';
  clone.style.height = '';

  const hint = clone.querySelector('#empty-hint');
  if (hint) hint.remove();
  clone.querySelectorAll('.affordance, .collapse-toggle').forEach((el) => el.remove());

  return clone;
}

// Return a new canvas with the source rotated 90° clockwise (dimensions swapped).
function _rotateCanvas(src) {
  const rc = document.createElement('canvas');
  rc.width = src.height;
  rc.height = src.width;
  const ctx = rc.getContext('2d');
  ctx.translate(rc.width / 2, rc.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return rc;
}

async function _rasterize(clone, title) {
  const w = parseInt(clone.getAttribute('width'), 10) || 800;
  const h = parseInt(clone.getAttribute('height'), 10) || 600;

  let dpr = EXPORT_DPR;
  while (dpr > 1 && (w * dpr > MAX_CANVAS_DIM || h * dpr > MAX_CANVAS_DIM)) dpr -= 0.25;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  const ctx = canvas.getContext('2d');

  // Make sure the Devanagari font is loaded before canvg / fillText draw text.
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (e) { /* non-fatal */ }
  }

  if (!window.canvg || !window.canvg.Canvg) {
    throw new Error('Renderer (canvg) not loaded');
  }

  // Parchment background (identity transform, full device pixels).
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PARCHMENT;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render with canvg using resize + 'meet' so the ENTIRE tree fits the canvas
  // (no clipping). ignoreDimensions makes canvg use our resize, not the SVG's
  // own width/height; ignoreClear preserves the parchment fill.
  const svgStr = new XMLSerializer().serializeToString(clone);
  const v = await window.canvg.Canvg.fromString(ctx, svgStr, {
    ignoreDimensions: true,
    ignoreClear: true,
  });
  v.resize(canvas.width, canvas.height, 'xMidYMid meet');
  await v.render();

  // The title is part of the SVG header (rendered by canvg above), so no extra
  // baking is needed here — it renders correctly in any script.

  return { canvas, w, h };
}

// Re-render the tree in the requested language without disturbing app state,
// capture, then restore the on-screen language.
async function _withExportLang(lang, fn) {
  const state = window.__state;
  const needSwap = state && lang !== state.lang && typeof renderTree === 'function';
  if (needSwap) renderTree({ ...state, lang });
  try {
    return await fn();
  } finally {
    if (needSwap) renderTree(state);
  }
}

// Tree overview page: fit the WHOLE tree onto a single A4 landscape page so it
// always fits and no card is ever split. It's a shape/overview reference — the
// flattened-card section that follows carries the legible per-person detail.
function _appendTreeOverview(doc, canvas, w, h) {
  const M = 10;        // page margin (mm)
  const A4W = 297;     // landscape A4
  const A4H = 210;
  const usableW = A4W - M * 2;
  const usableH = A4H - M * 2;

  const ratio = Math.min(usableW / w, usableH / h);
  const imgW = w * ratio;
  const imgH = h * ratio;
  const imgX = (A4W - imgW) / 2;
  const imgY = M + (usableH - imgH) / 2;

  // The doc's first page already exists (landscape A4) — draw onto it.
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');
}

// "Review (A4)" export: tiled card tree (landscape) + indented outline + lineage
// lines (portrait), in one PDF. Reuses the already-rasterized tree canvas.
async function _exportReview(canvas, w, h, tree) {
  const jsPDF = window.jspdf && window.jspdf.jsPDF;
  if (!jsPDF) throw new Error('PDF library not loaded');
  if (!window.ReviewSections) throw new Error('Review sections not loaded');

  const state = window.__state || {};
  const persons = state.persons || [];
  const relationships = state.relationships || [];
  const titleEn = tree.title_en || tree.title_hi || 'Vanshavali';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  _appendTreeOverview(doc, canvas, w, h);

  const lang = (window.__state && window.__state.lang) || 'en';
  await window.ReviewSections.appendFlattenedCards(doc, persons, relationships, lang, `${titleEn} — Flattened`);

  doc.save('vanshavali-review.pdf');
}

async function doExport(opts) {
  const format = (opts && opts.format) || 'png';
  const lang = (opts && opts.lang) || 'en';

  const tree = (window.__state && window.__state.tree) || {};
  const title = (lang === 'hi'
    ? (tree.title_hi || tree.title_en)
    : (tree.title_en || tree.title_hi)) || 'Vanshavali';

  try {
    const { canvas, w, h } = await _withExportLang(lang, async () => {
      const clone = _buildExportClone();
      if (!clone) throw new Error('Nothing to export');
      return _rasterize(clone, title);
    });

    if (format === 'review') {
      await _exportReview(canvas, w, h, tree);
      return;
    }

    if (format === 'pdf') {
      const jsPDF = window.jspdf && window.jspdf.jsPDF;
      if (!jsPDF) throw new Error('PDF library not loaded');

      const longMM = PAPER_LONG_MM[(opts && opts.paper)] || PAPER_LONG_MM.a2;
      const margin = 8;   // uniform border around the tree
      const footerH = 8;  // bottom band for the exported-date line

      // Portrait option: turn the tree 90° so a wide tree runs down a tall page —
      // prints large on a standard portrait sheet and reads when the page is
      // turned. The rotated raster becomes (h × w); landscape keeps (w × h).
      const rotate = (opts && opts.orient) === 'portrait';
      const drawCanvas = rotate ? _rotateCanvas(canvas) : canvas;
      const ew = rotate ? h : w; // effective (displayed) raster dimensions
      const eh = rotate ? w : h;

      // The chosen paper dimension is the page's LONG side; the tree fills that
      // long axis (minus margins) for maximum zoom, and the page's SHORT side is
      // sized to wrap the tree exactly. The draw area then matches the displayed
      // aspect ratio, so the image fills it with no wasted whitespace on any side.
      const effLandscape = ew >= eh;
      let pageW;
      let pageH;
      if (effLandscape) {
        pageW = longMM;
        pageH = (pageW - margin * 2) * (eh / ew) + margin + footerH;
      } else {
        pageH = longMM;
        pageW = (pageH - margin - footerH) * (ew / eh) + margin * 2;
      }

      const doc = new jsPDF({
        orientation: effLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageW, pageH],
      });
      // Re-read the realized page (jsPDF may normalize) and fit the image into the
      // margin box; aspect matches, so this fills edge-to-edge with no slack.
      pageW = doc.internal.pageSize.getWidth();
      pageH = doc.internal.pageSize.getHeight();
      const ratio = Math.min((pageW - margin * 2) / ew, (pageH - margin - footerH) / eh);
      const imgW = ew * ratio;
      const imgH = eh * ratio;
      const imgX = (pageW - imgW) / 2;
      const imgY = margin;

      // Lossless PNG keeps text and hairlines crisp (JPEG fuzzed them); 'FAST'
      // deflate compression shrinks the stream (the parchment field compresses
      // away) so the file stays small despite the high-resolution raster.
      doc.addImage(drawCanvas.toDataURL('image/png'), 'PNG', imgX, imgY, imgW, imgH, undefined, 'FAST');

      doc.save('vanshavali.pdf');
    } else {
      await new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(); return; }
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'vanshavali.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => { URL.revokeObjectURL(a.href); resolve(); }, 1000);
        }, 'image/png');
      });
    }
  } catch (err) {
    console.error('Export failed:', err);
    alert('Export failed: ' + (err && err.message ? err.message : 'Unknown error'));
  }
}

window.doExport = doExport;
