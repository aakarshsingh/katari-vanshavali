// Public, read-only version history. Lists applied + reverted changes
// (anonymized — no admin identity, no revert controls) from
// /api/changes/applied in a toggleable side panel. Panel styling lives in
// css/main.css (#history-panel). Exposed as window.historyPanel — never
// `window.history` (browser built-in).

const HISTORY_FIELD_LABELS = {
  name_en: 'Name', name_hi: 'Name (Hindi)', birth_year: 'Birth year',
  death_year: 'Death year', deceased: 'Deceased',
  spouse_en: 'Spouse', spouse_hi: 'Spouse (Hindi)',
  spouse_birth_year: 'Spouse birth year', spouse_death_year: 'Spouse death year',
  spouse_deceased: 'Spouse deceased', spouse_gender: 'Spouse gender',
  gender: 'Gender', notes: 'Notes', sequence: 'Sequence',
  title_en: 'Title', title_hi: 'Title (Hindi)',
};

// Fields that are noise in a public diff (positions, ids, timestamps).
const HISTORY_SKIP_FIELDS = new Set([
  'x_pos', 'y_pos', 'id', 'tree_id', 'updated_at', 'created_at',
]);

function _hEsc(s) {
  return String(s == null ? '' : s).replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

function _hLang() {
  return (window.__state && window.__state.lang) === 'hi' ? 'hi' : 'en';
}

function _hPersonName(person) {
  if (!person) return '(unnamed)';
  const name = _hLang() === 'hi'
    ? (person.name_hi || person.name_en)
    : (person.name_en || person.name_hi);
  return name || '(unnamed)';
}

function _hDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function _hVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return String(v);
}

// Render the field-level diff of an update (changed = { field: { from, to } }).
function _hChangedHtml(changed) {
  if (!changed) return '';
  const rows = Object.keys(changed)
    .filter((k) => !HISTORY_SKIP_FIELDS.has(k))
    .map((k) => {
      const label = HISTORY_FIELD_LABELS[k] || k;
      const { from, to } = changed[k] || {};
      return `<div class="h-diff"><span class="h-field">${_hEsc(label)}</span> ` +
        `<span class="h-from">${_hEsc(_hVal(from))}</span> → ` +
        `<span class="h-to">${_hEsc(_hVal(to))}</span></div>`;
    });
  return rows.join('');
}

// Turn one applied/reverted change into { action, detail(HTML) }.
function _hDescribe(entry) {
  const { op_type, entity } = entry;
  const s = entry.summary || {};
  if (entity === 'person') {
    if (s.type === 'create') {
      const p = (s.after && s.after.person) || s.after || {};
      return { action: 'Added person', detail: _hEsc(_hPersonName(p)) };
    }
    if (s.type === 'delete') {
      const p = (s.before && s.before.person) || s.before || {};
      return { action: 'Removed person', detail: _hEsc(_hPersonName(p)) };
    }
    // Always name WHO changed (identity is sent by the server alongside the diff).
    const who = s.identity ? _hPersonName(s.identity) : '';
    return { action: who ? 'Edited person: ' + who : 'Edited person', detail: _hChangedHtml(s.changed) };
  }
  if (entity === 'relationship') {
    if (s.type === 'delete') return { action: 'Removed a family link', detail: '' };
    return { action: 'Added a family link', detail: '' };
  }
  if (entity === 'tree') {
    return { action: 'Updated the title', detail: _hChangedHtml(s.changed) };
  }
  return { action: `${_hEsc(op_type)} ${_hEsc(entity)}`, detail: '' };
}

function _hRender(listEl, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    listEl.innerHTML = '<div class="h-empty">No changes recorded yet.</div>';
    return;
  }
  listEl.innerHTML = entries.map((e) => {
    const { action, detail } = _hDescribe(e);
    const reverted = e.status === 'reverted';
    return '<div class="h-item' + (reverted ? ' h-reverted' : '') + '">' +
      '<div class="h-row">' +
        '<span class="h-action">' + _hEsc(action) + '</span>' +
        (reverted ? '<span class="h-badge">reverted</span>' : '') +
      '</div>' +
      (detail ? '<div class="h-detail">' + detail + '</div>' : '') +
      '<div class="h-when">' + _hEsc(_hDate(e.resolved_at)) + '</div>' +
    '</div>';
  }).join('');
}

function _hBuildPanel() {
  let panel = document.getElementById('history-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'history-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML =
    '<div class="h-head">' +
      '<h2>Version History</h2>' +
      '<button type="button" id="h-close" class="icon-btn" title="Close" aria-label="Close">×</button>' +
    '</div>' +
    '<div id="h-list" class="h-list" aria-live="polite"></div>';
  const closeBtn = panel.querySelector('#h-close');
  if (closeBtn) closeBtn.addEventListener('click', closeHistory);
  return panel;
}

async function openHistory() {
  const panel = _hBuildPanel();
  panel.hidden = false;
  const listEl = panel.querySelector('#h-list');
  listEl.innerHTML = '<div class="h-empty">Loading…</div>';
  try {
    const entries = await api.appliedChanges();
    _hRender(listEl, entries);
  } catch (err) {
    console.warn('History load failed:', err.message);
    listEl.innerHTML = '<div class="h-empty">Could not load history.</div>';
  }
}

function closeHistory() {
  const panel = document.getElementById('history-panel');
  if (panel) panel.hidden = true;
}

function toggleHistory() {
  const panel = document.getElementById('history-panel');
  if (panel && !panel.hidden) closeHistory();
  else openHistory();
}

function _hInit() {
  const btn = document.getElementById('btn-history');
  if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); toggleHistory(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHistory(); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _hInit);
} else {
  _hInit();
}

window.historyPanel = { open: openHistory, close: closeHistory, toggle: toggleHistory };
