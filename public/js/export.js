const SVG_NS = 'http://www.w3.org/2000/svg';
let _fontB64 = null;

async function _getFontB64() {
  if (_fontB64) return _fontB64;
  const res = await fetch('/fonts/NotoSansDevanagari-Regular.woff2');
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  _fontB64 = btoa(binary);
  return _fontB64;
}

function _buildSvgClone(lang) {
  const svg = document.getElementById('tree-svg');
  if (!svg) return null;
  const clone = svg.cloneNode(true);

  // Strip canvas zoom transform so export renders at natural resolution
  clone.style.transform = '';
  clone.style.transformOrigin = '';
  clone.style.width = '';
  clone.style.height = '';

  // Remove hint text
  const hint = clone.querySelector('#empty-hint');
  if (hint) hint.remove();

  // Rebuild name text for export lang; remove secondary name for a clean single-lang view
  clone.querySelectorAll('g.node').forEach(function(g) {
    const nameEn = g.getAttribute('data-name-en') || '';
    const nameHi = g.getAttribute('data-name-hi') || '';
    const targetName = lang === 'hi' ? (nameHi || nameEn) : nameEn;

    const primary = g.querySelector('text.name-primary');
    if (primary) primary.textContent = targetName;

    const secondary = g.querySelector('text.name-secondary');
    if (secondary) secondary.remove();
  });

  return clone;
}

function _injectFont(clone, fontB64) {
  let defs = clone.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    clone.insertBefore(defs, clone.firstChild);
  }
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = [
    "@font-face {",
    "  font-family: 'Noto Sans Devanagari';",
    "  src: url('data:font/woff2;base64," + fontB64 + "') format('woff2');",
    "}",
  ].join('\n');
  defs.appendChild(style);
}

function _svgToCanvas(clone) {
  const w = parseInt(clone.getAttribute('width'), 10) || 800;
  const h = parseInt(clone.getAttribute('height'), 10) || 600;
  const dpr = 2;

  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise(function(resolve, reject) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = w * dpr;
      canvas.height = h * dpr;

      function draw() {
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      draw();
      // Second draw after brief delay ensures custom font has rendered
      setTimeout(function() {
        draw();
        URL.revokeObjectURL(url);
        resolve({ canvas: canvas, w: w, h: h, dpr: dpr });
      }, 250);
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      reject(new Error('SVG image render failed'));
    };
    img.src = url;
  });
}

async function doExport(opts) {
  const format = opts.format || 'png';
  const lang = opts.lang || 'en';

  try {
    const fontB64 = await _getFontB64();
    const clone = _buildSvgClone(lang);
    if (!clone) return;

    _injectFont(clone, fontB64);
    const { canvas, w, h, dpr } = await _svgToCanvas(clone);

    const title = (window.__state && window.__state.tree && window.__state.tree.title_en)
      || 'Vanshavali';
    const today = new Date().toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    if (format === 'pdf') {
      const jsPDF = window.jspdf && window.jspdf.jsPDF;
      if (!jsPDF) {
        alert('PDF library not loaded. Please check your internet connection and try again.');
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const headerH = 20;
      const footerH = 12;

      // Title block
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(title, pageW / 2, 14, { align: 'center' });

      // Tree image centred in available space
      const availW = pageW - margin * 2;
      const availH = pageH - headerH - footerH;
      const ratio = Math.min(availW / w, availH / h);
      const imgW = w * ratio;
      const imgH = h * ratio;
      const imgX = (pageW - imgW) / 2;
      const imgY = headerH;

      doc.addImage(canvas.toDataURL('image/png'), 'PNG', imgX, imgY, imgW, imgH);

      // Info box bottom-left
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(title + '  \xB7  Exported ' + today, margin, pageH - 6);

      doc.save('vanshavali.pdf');
    } else {
      canvas.toBlob(function(blob) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'vanshavali.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
      }, 'image/png');
    }
  } catch (err) {
    console.error('Export failed:', err.message);
    alert('Export failed: ' + err.message);
  }
}

window.doExport = doExport;
