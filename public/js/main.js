let state = Object.freeze({
  tree: null,
  persons: [],
  relationships: [],
  lang: 'en',
});

function setState(partial) {
  state = Object.freeze({ ...state, ...partial });
  window.__state = state;
  if (typeof renderTree === 'function') renderTree(state);
  renderTitle();
  if (typeof updateMinimap === 'function') updateMinimap();
  return state;
}

// Header title follows the current language (falls back to the other language).
function renderTitle() {
  const el = document.getElementById('tree-title');
  if (!el) return;
  if (!state.tree) return;
  el.textContent = state.lang === 'hi'
    ? (state.tree.title_hi || state.tree.title_en || 'वंशावली')
    : (state.tree.title_en || state.tree.title_hi || 'Vanshavali');
}

async function init() {
  try {
    const data = await api.getTree();
    setState({
      tree: data.tree,
      persons: data.persons,
      relationships: data.relationships,
    });
    if (data.persons.length === 0) {
      showEmptyHint();
    } else {
      hideEmptyHint();
      console.log(`Tree loaded: ${data.persons.length} persons`);
      focusPerson('Bade Lal Singh');
    }
  } catch (err) {
    console.error('Failed to load tree:', err.message);
    showEmptyHint();
  }

  wireLangToggle();
  wireTitleEdit();
  wireExportDialog();
  wireHelp();
  wireLock();
  wireCanvasDismiss();
}

// Clicking empty canvas closes the sidebar. Node/affordance clicks call
// stopPropagation, so they don't bubble here.
function wireCanvasDismiss() {
  const vp = document.getElementById('tree-viewport');
  if (!vp) return;
  vp.addEventListener('click', () => {
    if (typeof closeSidebar === 'function') closeSidebar();
  });
}

// Edit lock: ON by default → tree is read-only (safe for viewing). Unlock to edit.
let locked = true;
window.__locked = true;

function applyLock() {
  window.__locked = locked;
  document.body.classList.toggle('locked', locked);

  const titleEl = document.getElementById('tree-title');
  if (titleEl) titleEl.setAttribute('contenteditable', locked ? 'false' : 'true');

  const btn = document.getElementById('btn-lock');
  if (btn) {
    btn.setAttribute('aria-pressed', String(locked));
    btn.title = locked ? 'Locked — click to enable editing' : 'Editing — click to lock';
    btn.innerHTML =
      `<i data-lucide="${locked ? 'lock' : 'lock-open'}"></i>` +
      `<span id="lock-label">${locked ? 'Locked' : 'Editing'}</span>`;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
  }
}

function wireLock() {
  const btn = document.getElementById('btn-lock');
  if (!btn) return;
  btn.addEventListener('click', () => { locked = !locked; applyLock(); });
  applyLock(); // establish the default locked state
}

function wireHelp() {
  const btn = document.getElementById('btn-help');
  const pop = document.getElementById('help-popover');
  if (!btn || !pop) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pop.hidden) { pop.hidden = true; return; }
    const r = btn.getBoundingClientRect();
    pop.hidden = false;
    pop.style.left = `${Math.max(8, r.left)}px`;
    pop.style.top = `${r.bottom + 6}px`;
  });
  document.addEventListener('click', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) pop.hidden = true;
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.hidden = true; });
}

function focusPerson(nameEn) {
  setTimeout(() => {
    const viewport = document.getElementById('tree-viewport');
    const node = document.querySelector(`.node[data-name-en="${nameEn}"]`);
    if (!viewport) return;
    if (!node) {
      // Fallback: fit full tree
      const svg = document.getElementById('tree-svg');
      if (svg && typeof fitToViewport === 'function') fitToViewport(viewport, svg);
      return;
    }
    const rect = node.querySelector('rect');
    if (!rect) return;
    const nodeX = parseFloat(rect.getAttribute('x'));
    const nodeY = parseFloat(rect.getAttribute('y'));
    const nodeW = parseFloat(rect.getAttribute('width'));
    const nodeH = parseFloat(rect.getAttribute('height'));
    const s = window.__canvasScale || 1;
    viewport.scrollLeft = nodeX * s - viewport.clientWidth / 2 + (nodeW * s) / 2;
    viewport.scrollTop  = nodeY * s - viewport.clientHeight / 2 + (nodeH * s) / 2;
  }, 150);
}

function showEmptyHint() {
  const hint = document.getElementById('empty-hint');
  if (hint) hint.style.display = '';
}

function hideEmptyHint() {
  const hint = document.getElementById('empty-hint');
  if (hint) hint.style.display = 'none';
}

function wireLangToggle() {
  const btn = document.getElementById('btn-lang');
  const label = document.getElementById('lang-label');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const newLang = state.lang === 'en' ? 'hi' : 'en';
    setState({ lang: newLang });
    if (label) label.textContent = newLang.toUpperCase();
  });
}

function wireTitleEdit() {
  const titleEl = document.getElementById('tree-title');
  if (!titleEl) return;
  titleEl.addEventListener('blur', async () => {
    if (!state.tree) return;
    const newTitle = titleEl.textContent.trim();
    const field = state.lang === 'hi' ? 'title_hi' : 'title_en';
    const current = state.tree[field] || '';
    if (newTitle === current) return;
    // Server requires title_en non-empty; revert an attempt to clear it.
    if (field === 'title_en' && !newTitle) { renderTitle(); return; }
    try {
      const { tree } = await api.patchTree({ [field]: newTitle });
      setState({ tree });
    } catch (err) {
      console.error('Failed to update title:', err.message);
      renderTitle();
    }
  });
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
    if (e.key === 'Escape') { renderTitle(); titleEl.blur(); }
  });
}

function wireExportDialog() {
  const exportBtn = document.getElementById('btn-export');
  const dialog = document.getElementById('export-dialog');
  const cancelBtn = document.getElementById('btn-export-cancel');
  const confirmBtn = document.getElementById('btn-export-confirm');
  if (!exportBtn || !dialog) return;

  function positionNearButton() {
    const r = exportBtn.getBoundingClientRect();
    dialog.style.visibility = 'hidden';
    dialog.show(); // non-modal so we can position it
    const dw = dialog.offsetWidth;
    let left = r.right - dw;            // right-align to the button
    if (left < 8) left = 8;
    dialog.style.left = `${left}px`;
    dialog.style.top = `${r.bottom + 6}px`;
    dialog.style.visibility = '';
  }

  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dialog.open) { dialog.close(); return; }
    positionNearButton();
  });
  // Close when clicking outside the popover
  document.addEventListener('click', (e) => {
    if (dialog.open && !dialog.contains(e.target) && e.target !== exportBtn && !exportBtn.contains(e.target)) {
      dialog.close();
    }
  });
  cancelBtn && cancelBtn.addEventListener('click', () => dialog.close());
  confirmBtn && confirmBtn.addEventListener('click', () => {
    const form = document.getElementById('export-form');
    const format = form.querySelector('[name="format"]:checked')?.value || 'png';
    const lang = form.querySelector('[name="lang"]:checked')?.value || 'en';
    dialog.close();
    if (typeof doExport === 'function') doExport({ format, lang });
  });
}

window.__state = state;
document.addEventListener('DOMContentLoaded', init);
