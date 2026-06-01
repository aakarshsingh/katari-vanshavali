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
  // Scale the SVG element itself; preserve natural SVG width/height for scrollbar accuracy
  const naturalW = parseFloat(svg.getAttribute('width')) || 2000;
  const naturalH = parseFloat(svg.getAttribute('height')) || 1500;
  svg.style.transform = `scale(${scale})`;
  svg.style.transformOrigin = '0 0';
  // Expand the container so scrollbars track the scaled size
  svg.style.width = naturalW + 'px';
  svg.style.height = naturalH + 'px';
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

function initCanvas() {
  const viewport = document.getElementById('tree-viewport');
  const svg = document.getElementById('tree-svg');
  if (!viewport || !svg) return;

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
    svg.style.cursor = 'grabbing';
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
    svg.style.cursor = '';
  });

  // Default cursor on SVG background
  svg.addEventListener('mouseover', (e) => {
    if (!isDragging && !isNodeTarget(e.target)) {
      svg.style.cursor = 'grab';
    }
  });

  svg.addEventListener('mouseout', (e) => {
    if (!isDragging && !isNodeTarget(e.target)) {
      svg.style.cursor = '';
    }
  });
}

window.initCanvas = initCanvas;
document.addEventListener('DOMContentLoaded', initCanvas);
