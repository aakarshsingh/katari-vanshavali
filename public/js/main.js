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
  if (typeof window.__reapplyScale === 'function') window.__reapplyScale();
  if (typeof updateMinimap === 'function') updateMinimap();
  return state;
}

// Last server-loaded tree (the base the optimistic overlay is merged over).
let serverBase = { tree: null, persons: [], relationships: [] };

// Re-render the tree as server data + any pending local overlay edits.
function refreshWithOverlay() {
  const merged = window.overlay ? window.overlay.applyOverlay(serverBase) : serverBase;
  setState({ tree: merged.tree, persons: merged.persons, relationships: merged.relationships });
}
window.refreshWithOverlay = refreshWithOverlay;

// Edit the integrated canvas title (only when unlocked). Writes the
// active-language field.
function editTitle() {
  if (window.__locked || !state.tree) return;
  const hi = state.lang === 'hi';
  const field = hi ? 'title_hi' : 'title_en';
  const cur = state.tree[field] || '';
  const v = window.prompt('Tree title (' + (hi ? 'Hindi' : 'English') + '):', cur);
  if (v === null) return;
  const nv = v.trim();
  if (field === 'title_en' && !nv) return; // title_en must be non-empty
  mutate.updateTitle(field, nv)
    .then((r) => { if (!r.pending) setState({ tree: r.tree }); })
    .catch((e) => console.error('Title update failed:', e.message));
}
window.editTitle = editTitle;

// Header title follows the current language (falls back to the other language).
function renderTitle() {
  const el = document.getElementById('tree-title');
  if (!el) return;
  if (!state.tree) return;
  el.textContent = state.lang === 'hi'
    ? (state.tree.title_hi || state.tree.title_en || 'वंशावली')
    : (state.tree.title_en || state.tree.title_hi || 'Vanshavali');
}

// Load moderation + admin state into a global the mutation chokepoint reads.
// Any failure degrades to OFF / not-admin and never blocks the tree load.
async function loadModerationState() {
  const moderation = { enabled: false, admin: false, showYearsDeceased: false };
  try {
    const settings = await api.getSettings();
    moderation.enabled = settings.moderation_enabled === true;
    moderation.showYearsDeceased = settings.show_years_deceased === true;
  } catch (err) {
    console.warn('Settings load failed; moderation defaults OFF:', err.message);
  }
  try {
    await api.me(); // 401 throws when not authenticated
    moderation.admin = true;
  } catch {
    moderation.admin = false;
  }
  window.__moderation = moderation;
  return moderation;
}

async function init() {
  await loadModerationState();
  try {
    const data = await api.getTree();
    serverBase = { tree: data.tree, persons: data.persons, relationships: data.relationships };
    refreshWithOverlay(); // server data + any pending local edits
    if (data.persons.length === 0) {
      showEmptyHint();
    } else {
      hideEmptyHint();
      console.log(`Tree loaded: ${data.persons.length} persons`);
      focusPerson('Bade Lal Singh');
    }
    // Drop overlay entries the server has resolved, then re-render if changed.
    if (window.overlay) {
      const changed = await window.overlay.reconcile();
      if (changed) refreshWithOverlay();
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
  wireSearch();
}

function _escHtml(s) {
  return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

// Bilingual search over name_en / name_hi (and spouse names) → dropdown → focus.
function wireSearch() {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  function close() { results.hidden = true; results.innerHTML = ''; }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { close(); return; }
    const matches = (state.persons || []).filter((p) =>
      (p.name_en || '').toLowerCase().includes(q) ||
      (p.name_hi || '').toLowerCase().includes(q) ||
      (p.spouse_en || '').toLowerCase().includes(q) ||
      (p.spouse_hi || '').toLowerCase().includes(q)
    ).slice(0, 8);

    if (!matches.length) {
      results.innerHTML = '<div class="search-empty">No matches</div>';
    } else {
      results.innerHTML = matches.map((p) =>
        `<div class="search-item" data-id="${p.id}">` +
        `<span>${_escHtml(p.name_en || '(unnamed)')}</span>` +
        (p.name_hi ? `<span class="hi">${_escHtml(p.name_hi)}</span>` : '') +
        '</div>'
      ).join('');
    }
    results.hidden = false;
  });

  results.addEventListener('click', (e) => {
    const item = e.target.closest('.search-item');
    if (!item) return;
    focusOnPerson(item.getAttribute('data-id'));
    close();
    input.blur();
  });

  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); input.blur(); } });
  document.addEventListener('click', (e) => {
    if (!results.hidden && !e.target.closest('#search-wrap')) close();
  });
}

// Smoothly center the viewport on a person's node and pulse it.
function focusOnPerson(id) {
  const viewport = document.getElementById('tree-viewport');
  const node = document.querySelector(`.node[data-id="${id}"]`);
  if (!viewport || !node) return;
  const rect = node.querySelector('rect');
  if (!rect) return;
  const s = window.__canvasScale || 1;
  const nx = parseFloat(rect.getAttribute('x'));
  const ny = parseFloat(rect.getAttribute('y'));
  const nw = parseFloat(rect.getAttribute('width'));
  const nh = parseFloat(rect.getAttribute('height'));
  viewport.scrollTo({
    left: nx * s - viewport.clientWidth / 2 + (nw * s) / 2,
    top: ny * s - viewport.clientHeight / 2 + (nh * s) / 2,
    behavior: 'smooth',
  });
  node.classList.add('search-hit');
  setTimeout(() => node.classList.remove('search-hit'), 2500);
}
window.focusOnPerson = focusOnPerson;

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

const DEFAULT_ZOOM = 1.4; // higher default zoom on load (comfortable reading)

function focusPerson(nameEn) {
  setTimeout(() => {
    const viewport = document.getElementById('tree-viewport');
    if (!viewport) return;
    if (typeof window.__setScale === 'function') window.__setScale(DEFAULT_ZOOM);
    const s = window.__canvasScale || 1;
    const node = document.querySelector(`.node[data-name-en="${nameEn}"]`);
    if (!node) {
      // Fallback: center horizontally near the top
      viewport.scrollLeft = (viewport.scrollWidth - viewport.clientWidth) / 2;
      viewport.scrollTop = 0;
      return;
    }
    const rect = node.querySelector('rect');
    if (!rect) return;
    const nodeX = parseFloat(rect.getAttribute('x'));
    const nodeY = parseFloat(rect.getAttribute('y'));
    const nodeW = parseFloat(rect.getAttribute('width'));
    const nodeH = parseFloat(rect.getAttribute('height'));
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
      const result = await mutate.updateTitle(field, newTitle);
      if (!result.pending) setState({ tree: result.tree });
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

  // Grey out controls that don't apply to the chosen format: page size +
  // orientation are PDF-only; language is moot for the bilingual Review.
  function syncExportControls() {
    const form = document.getElementById('export-form');
    if (!form) return;
    const format = form.querySelector('[name="format"]:checked')?.value || 'png';
    const fsPaper = document.getElementById('fs-paper');
    const fsOrient = document.getElementById('fs-orient');
    const fsLang = document.getElementById('fs-lang');
    if (fsPaper) fsPaper.disabled = format !== 'pdf';
    if (fsOrient) fsOrient.disabled = format !== 'pdf';
    if (fsLang) fsLang.disabled = format === 'review';
  }
  document.getElementById('export-form')
    ?.querySelectorAll('[name="format"]')
    .forEach((el) => el.addEventListener('change', syncExportControls));

  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dialog.open) { dialog.close(); return; }
    syncExportControls();
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
    const paper = form.querySelector('[name="paper"]:checked')?.value || 'a2';
    const orient = form.querySelector('[name="orient"]:checked')?.value || 'landscape';
    dialog.close();
    if (typeof doExport === 'function') doExport({ format, lang, paper, orient });
  });
}

window.__state = state;
window.__moderation = { enabled: false, admin: false, showYearsDeceased: false };
document.addEventListener('DOMContentLoaded', init);
