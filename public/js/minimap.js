// minimap.js — toggleable overview of the whole tree with a draggable viewport
// rectangle. Uses scroll fractions (scrollLeft/scrollWidth) so it stays correct
// regardless of the canvas zoom transform. Hidden by default; toggle in toolbar.

const MM_MAX_W = 220;
const MM_MAX_H = 170;

let _mmVisible = false;

function _els() {
  return {
    wrap: document.getElementById('minimap'),
    holder: document.getElementById('minimap-holder'),
    rect: document.getElementById('minimap-rect'),
    viewport: document.getElementById('tree-viewport'),
    svg: document.getElementById('tree-svg'),
    toggle: document.getElementById('btn-minimap'),
  };
}

// Rebuild the thumbnail from the current tree SVG. Cheap enough at this app's scale.
function updateMinimap() {
  const e = _els();
  if (!e.wrap || e.wrap.hidden || !e.svg || !e.holder) return;

  const naturalW = parseFloat(e.svg.getAttribute('width')) || 1;
  const naturalH = parseFloat(e.svg.getAttribute('height')) || 1;
  const ratio = Math.min(MM_MAX_W / naturalW, MM_MAX_H / naturalH);
  const w = Math.max(40, Math.round(naturalW * ratio));
  const h = Math.max(30, Math.round(naturalH * ratio));

  e.holder.style.width = w + 'px';
  e.holder.style.height = h + 'px';

  const clone = e.svg.cloneNode(true);
  clone.style.transform = '';
  clone.style.width = '100%';
  clone.style.height = '100%';
  clone.removeAttribute('width');
  clone.removeAttribute('height');
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const hint = clone.querySelector('#empty-hint');
  if (hint) hint.remove();
  clone.querySelectorAll('.affordance, .collapse-toggle').forEach((el) => el.remove());

  e.holder.innerHTML = '';
  e.holder.appendChild(clone);

  updateMinimapRect();
}

// Position the viewport rectangle from scroll fractions.
function updateMinimapRect() {
  const e = _els();
  if (!e.wrap || e.wrap.hidden || !e.rect || !e.viewport || !e.holder) return;

  const sw = e.viewport.scrollWidth || 1;
  const sh = e.viewport.scrollHeight || 1;
  const mw = e.holder.clientWidth;
  const mh = e.holder.clientHeight;

  const left = (e.viewport.scrollLeft / sw) * mw;
  const top = (e.viewport.scrollTop / sh) * mh;
  const width = Math.min(mw, (e.viewport.clientWidth / sw) * mw);
  const height = Math.min(mh, (e.viewport.clientHeight / sh) * mh);

  e.rect.style.left = left + 'px';
  e.rect.style.top = top + 'px';
  e.rect.style.width = width + 'px';
  e.rect.style.height = height + 'px';
}

// Center the main viewport on a clicked/dragged point in the minimap.
function _panToMinimapPoint(clientX, clientY) {
  const e = _els();
  if (!e.holder || !e.viewport) return;
  const box = e.holder.getBoundingClientRect();
  const fx = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
  const fy = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
  e.viewport.scrollLeft = fx * e.viewport.scrollWidth - e.viewport.clientWidth / 2;
  e.viewport.scrollTop = fy * e.viewport.scrollHeight - e.viewport.clientHeight / 2;
}

function _setMinimapVisible(visible) {
  const e = _els();
  if (!e.wrap) return;
  _mmVisible = visible;
  e.wrap.hidden = !visible;
  if (visible) updateMinimap();
}

function initMinimap() {
  const e = _els();
  if (!e.wrap) return;

  e.toggle && e.toggle.addEventListener('click', () => _setMinimapVisible(!_mmVisible));

  // Minimap is a critical nav tool for a wide tree — on by default.
  _setMinimapVisible(true);

  // Keep the rectangle synced with scrolling/zooming.
  e.viewport && e.viewport.addEventListener('scroll', updateMinimapRect, { passive: true });
  window.addEventListener('resize', () => { if (_mmVisible) updateMinimap(); });

  // Click / drag on the minimap to pan.
  let dragging = false;
  const down = (ev) => { dragging = true; _panToMinimapPoint(ev.clientX, ev.clientY); ev.preventDefault(); };
  const move = (ev) => { if (dragging) _panToMinimapPoint(ev.clientX, ev.clientY); };
  const up = () => { dragging = false; };
  e.holder && e.holder.addEventListener('mousedown', down);
  e.rect && e.rect.addEventListener('mousedown', down);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

window.updateMinimap = updateMinimap;
window.updateMinimapRect = updateMinimapRect;
document.addEventListener('DOMContentLoaded', initMinimap);
