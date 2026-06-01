const SCALE_MIN = 0.3;
const SCALE_MAX = 2.0;
const SCALE_STEP = 0.15;

let scale = 1.0;
let isDragging = false;
let dragStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

function clampScale(value) {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, value));
}

function applyScale(viewport, svg) {
  // Size the SVG element itself (its viewBox scales to fit) rather than using a
  // CSS transform — a transform does NOT grow the scroll area, which clipped the
  // content when zoomed in. Sizing the element keeps the scroll area correct.
  const naturalW = parseFloat(svg.getAttribute('width')) || 2000;
  const naturalH = parseFloat(svg.getAttribute('height')) || 1500;
  svg.style.transform = '';
  svg.style.transformOrigin = '0 0';
  svg.style.width = (naturalW * scale) + 'px';
  svg.style.height = (naturalH * scale) + 'px';
  viewport.style.overflow = 'auto';
  window.__canvasScale = scale;
}

function zoomBy(delta, viewport, svg) {
  scale = clampScale(scale + delta);
  applyScale(viewport, svg);
}

function fitToViewport(viewport, svg) {
  const naturalW = parseFloat(svg.getAttribute('width')) || 2000;
  const naturalH = parseFloat(svg.getAttribute('height')) || 1500;
  const vpW = viewport.clientWidth;
  const vpH = viewport.clientHeight;
  if (naturalW === 0 || naturalH === 0) return;
  scale = clampScale(Math.min(vpW / naturalW, vpH / naturalH));
  applyScale(viewport, svg);
  viewport.scrollLeft = 0;
  viewport.scrollTop = 0;
}

function isNodeTarget(el) {
  // Returns true if the event target is a node element (not the bare SVG background)
  return el.closest && el.closest('.node') !== null;
}

// Set an absolute zoom level (used for the higher default zoom on load).
function setScale(value) {
  scale = clampScale(value);
  const viewport = document.getElementById('tree-viewport');
  const svg = document.getElementById('tree-svg');
  if (viewport && svg) applyScale(viewport, svg);
}
// Re-apply current zoom after a re-render (the SVG's natural size may have changed).
function reapplyScale() {
  const viewport = document.getElementById('tree-viewport');
  const svg = document.getElementById('tree-svg');
  if (viewport && svg) applyScale(viewport, svg);
}
window.__setScale = setScale;
window.__reapplyScale = reapplyScale;

function initCanvas() {
  const viewport = document.getElementById('tree-viewport');
  const svg = document.getElementById('tree-svg');
  if (!viewport || !svg) return;

  applyScale(viewport, svg); // establish correct scroll area from the start

  // Zoom buttons
  const btnIn = document.getElementById('btn-zoom-in');
  const btnOut = document.getElementById('btn-zoom-out');
  const btnFit = document.getElementById('btn-fit');

  btnIn && btnIn.addEventListener('click', () => zoomBy(SCALE_STEP, viewport, svg));
  btnOut && btnOut.addEventListener('click', () => zoomBy(-SCALE_STEP, viewport, svg));
  btnFit && btnFit.addEventListener('click', () => fitToViewport(viewport, svg));

  // Ctrl+wheel zooms; plain wheel scrolls natively
  viewport.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
    zoomBy(delta, viewport, svg);
  }, { passive: false });

  // Pan via drag on SVG background
  svg.addEventListener('mousedown', (e) => {
    if (isNodeTarget(e.target)) return;
    isDragging = true;
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
    viewport.classList.add('panning'); // → grabbing cursor (CSS)
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    viewport.scrollLeft = dragStart.scrollLeft - dx;
    viewport.scrollTop = dragStart.scrollTop - dy;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    viewport.classList.remove('panning');
  });
}

window.initCanvas = initCanvas;
document.addEventListener('DOMContentLoaded', initCanvas);
