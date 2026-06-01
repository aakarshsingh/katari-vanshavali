// Export the tree to PNG / PDF.
// Uses canvg to rasterize the live SVG — canvg renders via Canvas2D using the
// page's already-loaded Noto Sans Devanagari font, which fixes the long-standing
// problem of @font-face fonts not loading when an SVG is drawn through <img>.
// jsPDF and canvg are self-hosted under /vendor so export never depends on a CDN.

const PARCHMENT = '#FDFBF7';
const INK_COLOR = '#1a1008';
const EXPORT_FONT = "'Tiro Devanagari Hindi', Georgia, serif";
const MAX_CANVAS_DIM = 8000; // stay well under browser canvas limits

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

async function _rasterize(clone, title) {
  const w = parseInt(clone.getAttribute('width'), 10) || 800;
  const h = parseInt(clone.getAttribute('height'), 10) || 600;

  let dpr = 2;
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

    const today = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    if (format === 'pdf') {
      const jsPDF = window.jspdf && window.jspdf.jsPDF;
      if (!jsPDF) throw new Error('PDF library not loaded');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const footerH = 10;

      // Title is baked into the image (Devanagari-safe); place the image full-width.
      const availW = pageW - margin * 2;
      const availH = pageH - margin - footerH;
      const ratio = Math.min(availW / w, availH / h);
      const imgW = w * ratio;
      const imgH = h * ratio;
      const imgX = (pageW - imgW) / 2;
      const imgY = margin;

      // JPEG keeps the PDF small; parchment background compresses cleanly.
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', imgX, imgY, imgW, imgH);

      // ASCII-only footer (jsPDF Helvetica cannot render Devanagari).
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Exported ' + today, margin, pageH - 5);

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
