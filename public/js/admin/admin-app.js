// Admin single-page app for the unlinked /admin page. Routes on auth status:
// first-run signup → login → dashboard. The dashboard drives the whole
// moderation workflow against the existing API (settings toggle, pending queue
// with approve / edit-then-approve / reject, applied history with revert, and
// add-admin). All server guards are enforced server-side; this is the operator UI.

const FIELD_LABELS = {
  name_en: 'Name', name_hi: 'Name (Hindi)', birth_year: 'Birth year',
  death_year: 'Death year', deceased: 'Deceased', spouse_en: 'Spouse',
  spouse_hi: 'Spouse (Hindi)', spouse_birth_year: 'Spouse birth year',
  spouse_death_year: 'Spouse death year', spouse_deceased: 'Spouse deceased',
  spouse_gender: 'Spouse gender', gender: 'Gender', notes: 'Notes',
  sequence: 'Sequence', title_en: 'Title', title_hi: 'Title (Hindi)',
};
const SKIP_FIELDS = new Set(['x_pos', 'y_pos', 'id', 'tree_id', 'updated_at', 'created_at']);

function root() { return document.getElementById('admin-root'); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[<>&"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (v === true) return 'yes';
  if (v === false) return 'no';
  return String(v);
}

function personName(p) {
  if (!p) return '(unnamed)';
  return p.name_en || p.name_hi || '(unnamed)';
}

// --- Change description helpers (shared by queue + history) ---

function describePending(row, personMap) {
  const { op_type, entity } = row;
  const p = row.payload || {};
  const current = personMap && personMap[row.target_id];
  if (entity === 'person') {
    if (op_type === 'create') return 'Add person: ' + (p.name_en || '(unnamed)');
    // Always label WHO is being edited — read the live record by target_id, then
    // fall back to the payload name (an admin-edited payload may rename) or '…'.
    if (op_type === 'update') return 'Edit person: ' + (current ? personName(current) : (p.name_en || '…'));
    if (op_type === 'delete') return 'Remove person' + (current ? ': ' + personName(current) : '');
  }
  if (entity === 'relationship') {
    return op_type === 'delete' ? 'Remove family link' : 'Add family link';
  }
  if (entity === 'tree') return 'Update title';
  return op_type + ' ' + entity;
}

function diffHtml(before, after) {
  if (!before || !after) return '';
  const rows = Object.keys(after)
    .filter((k) => !SKIP_FIELDS.has(k) && before[k] !== after[k])
    .map((k) => {
      const label = FIELD_LABELS[k] || k;
      return `<div class="diff"><span class="diff-field">${esc(label)}</span> ` +
        `<span class="diff-from">${esc(fmtVal(before[k]))}</span> → ` +
        `<span class="diff-to">${esc(fmtVal(after[k]))}</span></div>`;
    });
  return rows.join('');
}

// Render a plain field list (label: value) for a payload — used when there is no
// `before` to diff against (e.g. a create, or an edit whose target isn't loaded).
function fieldListHtml(obj) {
  if (!obj) return '';
  return Object.keys(obj)
    .filter((k) => !SKIP_FIELDS.has(k))
    .map((k) => {
      const label = FIELD_LABELS[k] || k;
      return `<div class="diff"><span class="diff-field">${esc(label)}</span> ` +
        `<span class="diff-to">${esc(fmtVal(obj[k]))}</span></div>`;
    })
    .join('');
}

// Human-readable detail for a PENDING change. For a person edit we diff the
// proposed payload against the current record (`personMap[target_id]`) so the
// reviewer sees exactly what changed — not raw JSON. Falls back to a field list
// when there's no record to compare (create, or unknown target).
function pendingDetailHtml(row, personMap) {
  const payload = row.payload || {};
  if (row.entity === 'person') {
    if (row.op_type === 'update') {
      const before = personMap[row.target_id];
      if (before) {
        const diff = diffHtml(before, payload);
        return diff || '<p class="muted">No field changes.</p>';
      }
      return fieldListHtml(payload);
    }
    if (row.op_type === 'create') return fieldListHtml(payload);
    if (row.op_type === 'delete') {
      const p = personMap[row.target_id];
      return p ? `<p class="muted">${esc(personName(p))}</p>` : '';
    }
  }
  if (row.entity === 'tree') return fieldListHtml(payload);
  return ''; // relationship: the title line already says it all
}

// Describe a resolved (applied/reverted) row from its before/after snapshots.
function describeResolved(row) {
  const { op_type, entity } = row;
  const before = row.before_snapshot;
  const after = row.after_snapshot;
  if (entity === 'person') {
    if (op_type === 'create') {
      const p = (after && after.person) || after || {};
      return { action: 'Added person: ' + personName(p), detail: '' };
    }
    if (op_type === 'delete') {
      const p = (before && before.person) || before || {};
      return { action: 'Removed person: ' + personName(p), detail: '' };
    }
    return { action: 'Edited person: ' + personName(after || before), detail: diffHtml(before, after) };
  }
  if (entity === 'relationship') {
    return { action: op_type === 'delete' ? 'Removed a family link' : 'Added a family link', detail: '' };
  }
  if (entity === 'tree') {
    return { action: 'Updated the title', detail: diffHtml(before, after) };
  }
  return { action: op_type + ' ' + entity, detail: '' };
}

// --- Auth views ---

function renderSignup() {
  root().innerHTML =
    '<div class="admin-card admin-auth">' +
      '<h1>Create the first admin</h1>' +
      '<p class="muted">No admin exists yet. Set up the account that will moderate edits.</p>' +
      authFormHtml('Create admin') +
    '</div>';
  wireAuthForm(async (u, p) => {
    await adminApi.setup(u, p);
    renderDashboard();
  });
}

function renderLogin() {
  root().innerHTML =
    '<div class="admin-card admin-auth">' +
      '<h1>Admin sign in</h1>' +
      authFormHtml('Sign in') +
    '</div>';
  wireAuthForm(async (u, p) => {
    await adminApi.login(u, p);
    renderDashboard();
  });
}

function authFormHtml(submitLabel) {
  return '<form id="auth-form" novalidate>' +
    '<label>Username<input type="text" id="auth-user" autocomplete="username" /></label>' +
    '<label>Password<input type="password" id="auth-pass" autocomplete="current-password" /></label>' +
    `<button type="submit" class="btn">${esc(submitLabel)}</button>` +
    '<div class="form-error" id="auth-error" hidden></div>' +
  '</form>';
}

function wireAuthForm(submit) {
  const form = document.getElementById('auth-form');
  const errEl = document.getElementById('auth-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const u = document.getElementById('auth-user').value.trim();
    const p = document.getElementById('auth-pass').value;
    try {
      await submit(u, p);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

// --- Dashboard ---

async function renderDashboard() {
  let username = 'admin';
  try { username = (await adminApi.me()).username; }
  catch (err) { if (err.status === 401) return renderLogin(); }

  root().innerHTML =
    '<header class="admin-bar">' +
      '<h1>Katari Lineage · Admin</h1>' +
      `<div class="admin-bar-right"><span class="muted">${esc(username)}</span>` +
      '<button class="btn btn-ghost" id="btn-logout">Log out</button></div>' +
    '</header>' +
    '<div class="admin-grid">' +
      '<section class="admin-card"><h2>Settings</h2><div id="moderation-box">Loading…</div></section>' +
      '<section class="admin-card"><h2>Add admin</h2><div id="add-admin-box"></div></section>' +
      '<section class="admin-card admin-wide"><h2>People <span id="people-count" class="count"></span></h2><div id="people-box">Loading…</div></section>' +
      '<section class="admin-card admin-wide"><h2>Ancestor lineage <span class="count">1840–1940</span></h2><div id="lineage-box">Loading…</div></section>' +
      '<section class="admin-card admin-wide"><h2>Pending edits <span id="queue-count" class="count"></span></h2><div id="queue-box">Loading…</div></section>' +
      '<section class="admin-card admin-wide"><h2>History</h2><div id="history-box">Loading…</div></section>' +
    '</div>';

  document.getElementById('btn-logout').addEventListener('click', async () => {
    try { await adminApi.logout(); } catch { /* ignore */ }
    boot();
  });

  // Delegated once — these box innerHTMLs are replaced on every reload, but the
  // elements themselves are stable, so listeners must not be re-attached per reload.
  wireQueueActions(document.getElementById('queue-box'));
  wirePeopleActions(document.getElementById('people-box'));
  wireLineageActions(document.getElementById('lineage-box'));

  renderModeration();
  renderAddAdmin();
  reloadPeople();
  reloadLineage();
  reloadQueue();
  reloadHistory();
}

// Wire one settings checkbox: PATCH on change, reflect the server's returned
// value, revert + show the error on failure, re-enable when done.
function wireSettingToggle(toggleId, stateEl, setText, apiCall, respKey) {
  const toggle = document.getElementById(toggleId);
  toggle.addEventListener('change', async () => {
    toggle.disabled = true;
    try {
      const r = await apiCall(toggle.checked);
      toggle.checked = r[respKey] === true;
      setText(toggle.checked);
    } catch (err) {
      toggle.checked = !toggle.checked; // revert optimistic flip
      stateEl.textContent = err.message;
    } finally {
      toggle.disabled = false;
    }
  });
}

async function renderModeration() {
  const box = document.getElementById('moderation-box');
  let settings;
  try { settings = await adminApi.getSettings(); }
  catch (err) { box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`; return; }
  const modOn = settings.moderation_enabled === true;
  const deceasedOn = settings.show_years_deceased === true;
  const livingOn = settings.show_birth_year_living === true;

  box.innerHTML =
    '<label class="switch"><input type="checkbox" id="mod-toggle"' + (modOn ? ' checked' : '') + ' /> ' +
    'Require approval for public edits</label>' +
    '<p class="muted" id="mod-state"></p>' +
    '<label class="switch"><input type="checkbox" id="dec-toggle"' + (deceasedOn ? ' checked' : '') + ' /> ' +
    'Show years for deceased people (birth + death)</label>' +
    '<p class="muted" id="dec-state"></p>' +
    '<label class="switch"><input type="checkbox" id="liv-toggle"' + (livingOn ? ' checked' : '') + ' /> ' +
    'Show birth year for living people</label>' +
    '<p class="muted" id="liv-state"></p>';

  const modStateEl = document.getElementById('mod-state');
  const setModText = (on) => { modStateEl.textContent = on ? 'ON — edits are queued for review.' : 'OFF — edits apply immediately.'; };
  setModText(modOn);
  wireSettingToggle('mod-toggle', modStateEl, setModText, (v) => adminApi.setModeration(v), 'moderation_enabled');

  const decStateEl = document.getElementById('dec-state');
  const setDecText = (on) => { decStateEl.textContent = on ? 'ON — deceased people show birth + death years.' : 'OFF — deceased people show no years publicly.'; };
  setDecText(deceasedOn);
  wireSettingToggle('dec-toggle', decStateEl, setDecText, (v) => adminApi.setShowYearsDeceased(v), 'show_years_deceased');

  const livStateEl = document.getElementById('liv-state');
  const setLivText = (on) => { livStateEl.textContent = on ? 'ON — living people show their birth year.' : 'OFF — living people show no years publicly.'; };
  setLivText(livingOn);
  wireSettingToggle('liv-toggle', livStateEl, setLivText, (v) => adminApi.setShowBirthYearLiving(v), 'show_birth_year_living');
}

function renderAddAdmin() {
  const box = document.getElementById('add-admin-box');
  box.innerHTML =
    '<form id="add-admin-form" novalidate>' +
      '<label>Username<input type="text" id="aa-user" autocomplete="off" /></label>' +
      '<label>Password<input type="password" id="aa-pass" autocomplete="new-password" /></label>' +
      '<button type="submit" class="btn">Add admin</button>' +
      '<div class="form-error" id="aa-error" hidden></div>' +
      '<div class="form-ok" id="aa-ok" hidden></div>' +
    '</form>';
  const form = document.getElementById('add-admin-form');
  const errEl = document.getElementById('aa-error');
  const okEl = document.getElementById('aa-ok');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true; okEl.hidden = true;
    const u = document.getElementById('aa-user').value.trim();
    const p = document.getElementById('aa-pass').value;
    try {
      const r = await adminApi.addAdmin(u, p);
      okEl.textContent = `Added admin "${r.username}".`;
      okEl.hidden = false;
      form.reset();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

async function reloadQueue() {
  const box = document.getElementById('queue-box');
  const countEl = document.getElementById('queue-count');
  let rows = [];
  try { rows = await adminApi.listChanges('pending'); }
  catch (err) { box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`; return; }
  if (countEl) countEl.textContent = rows.length ? `(${rows.length})` : '';
  if (!rows.length) { box.innerHTML = '<p class="muted">No pending edits.</p>'; return; }

  // Source the current records so a pending edit can be shown as a before→after
  // diff. Best-effort: if the tree fetch fails we still render (field-list fallback).
  let personMap = {};
  try {
    const tree = await adminApi.getTree();
    for (const p of (tree.persons || [])) personMap[p.id] = p;
  } catch (_) { personMap = {}; }

  box.innerHTML = rows.map((r) => {
    const note = r.submitter_note ? `<div class="muted">Note: ${esc(r.submitter_note)}</div>` : '';
    const detail = pendingDetailHtml(r, personMap);
    const payloadJson = esc(JSON.stringify(r.payload || {}, null, 2));
    return '<div class="q-card" data-id="' + esc(r.id) + '">' +
      '<div class="q-title">' + esc(describePending(r, personMap)) + '</div>' +
      '<div class="muted">submitted ' + esc(fmtDate(r.submitted_at)) + '</div>' + note +
      (detail ? '<div class="q-diff">' + detail + '</div>' : '') +
      '<details class="q-raw"><summary>Edit raw payload</summary>' +
        '<textarea class="q-payload" rows="6" spellcheck="false">' + payloadJson + '</textarea>' +
      '</details>' +
      '<div class="q-actions">' +
        '<button class="btn" data-act="approve">Approve</button>' +
        '<button class="btn btn-ghost" data-act="approve-edit">Edit &amp; approve</button>' +
        '<button class="btn btn-danger" data-act="reject">Reject</button>' +
      '</div>' +
      '<div class="form-error q-error" hidden></div>' +
    '</div>';
  }).join('');
}

function wireQueueActions(box) {
  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const card = btn.closest('.q-card');
    const id = card.getAttribute('data-id');
    const errEl = card.querySelector('.q-error');
    errEl.hidden = true;
    const buttons = card.querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const act = btn.getAttribute('data-act');
      if (act === 'reject') {
        await adminApi.reject(id);
      } else if (act === 'approve-edit') {
        let payload;
        try { payload = JSON.parse(card.querySelector('.q-payload').value); }
        catch { throw new Error('Payload is not valid JSON.'); }
        await adminApi.approve(id, payload);
      } else {
        await adminApi.approve(id);
      }
      await reloadQueue();
      await reloadHistory();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      buttons.forEach((b) => { b.disabled = false; });
    }
  });
}

async function reloadHistory() {
  const box = document.getElementById('history-box');
  let applied = [];
  let reverted = [];
  try {
    [applied, reverted] = await Promise.all([
      adminApi.listChanges('applied'),
      adminApi.listChanges('reverted'),
    ]);
  } catch (err) {
    box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
    return;
  }
  const rows = applied.concat(reverted)
    .sort((a, b) => new Date(b.resolved_at || 0) - new Date(a.resolved_at || 0));
  if (!rows.length) { box.innerHTML = '<p class="muted">No history yet.</p>'; return; }
  box.innerHTML = rows.map((r) => {
    const { action, detail } = describeResolved(r);
    const isReverted = r.status === 'reverted';
    const revertBtn = r.status === 'applied'
      ? '<button class="btn btn-ghost" data-revert="' + esc(r.id) + '">Revert</button>'
      : '';
    return '<div class="h-card' + (isReverted ? ' h-card--reverted' : '') + '">' +
      '<div class="h-card-head">' +
        '<span class="h-card-title">' + esc(action) + '</span>' +
        (isReverted ? '<span class="badge">reverted</span>' : '') +
      '</div>' +
      (detail ? '<div class="h-card-detail">' + detail + '</div>' : '') +
      '<div class="h-card-foot"><span class="muted">' + esc(fmtDate(r.resolved_at)) + '</span>' + revertBtn + '</div>' +
    '</div>';
  }).join('');
  wireRevertActions(box);
}

function wireRevertActions(box) {
  box.querySelectorAll('button[data-revert]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Revert this change? This applies the inverse and logs it.')) return;
      btn.disabled = true;
      try {
        await adminApi.revert(btn.getAttribute('data-revert'));
        await reloadHistory();
        await reloadQueue();
      } catch (err) {
        btn.disabled = false;
        window.alert('Revert failed: ' + err.message);
      }
    });
  });
}

// --- People (admin edit-any-card) ---

// Editable fields for the admin person editor (ordered as shown in the form).
// Mirrors the public sidebar's admin tier; the per-card hide flags are omitted
// because R5 drives year visibility off the life-status toggles, not per-card.
const PERSON_EDIT_FIELDS = [
  { k: 'name_en', type: 'text' },
  { k: 'name_hi', type: 'text' },
  { k: 'gender', type: 'select', opts: ['M', 'F', 'other'] },
  { k: 'birth_year', type: 'number' },
  { k: 'death_year', type: 'number' },
  { k: 'deceased', type: 'checkbox' },
  { k: 'sequence', type: 'number' },
  { k: 'spouse_en', type: 'text' },
  { k: 'spouse_hi', type: 'text' },
  { k: 'spouse_gender', type: 'select', opts: ['', 'M', 'F', 'other'] },
  { k: 'spouse_birth_year', type: 'number' },
  { k: 'spouse_death_year', type: 'number' },
  { k: 'spouse_deceased', type: 'checkbox' },
  { k: 'notes', type: 'textarea' },
];

let _people = []; // cache of the last-loaded rows; edit reads `before` from here.

function personYears(p) {
  const b = p.birth_year != null && p.birth_year !== '' ? p.birth_year : null;
  const d = p.death_year != null && p.death_year !== '' ? p.death_year : null;
  if (b && d) return b + '–' + d;
  if (b) return 'b. ' + b;
  if (d) return 'd. ' + d;
  return '';
}

async function reloadPeople() {
  const box = document.getElementById('people-box');
  const countEl = document.getElementById('people-count');
  try { _people = await adminApi.listPersons(); }
  catch (err) { box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`; return; }
  if (countEl) countEl.textContent = _people.length ? `(${_people.length})` : '';
  box.innerHTML = peopleListHtml(_people);
}

function peopleListHtml(persons) {
  if (!persons.length) return '<p class="muted">No people yet.</p>';
  const sorted = persons.slice().sort((a, b) => personName(a).localeCompare(personName(b)));
  const rows = sorted.map((p) => {
    const years = personYears(p);
    const search = ((p.name_en || '') + ' ' + (p.name_hi || '')).toLowerCase();
    return '<div class="people-row" data-search="' + esc(search) + '">' +
      '<div class="people-row-main"><span class="people-name">' + esc(personName(p)) + '</span>' +
      (years ? ' <span class="muted">' + esc(years) + '</span>' : '') + '</div>' +
      '<button class="btn btn-ghost" data-edit="' + esc(p.id) + '">Edit</button>' +
    '</div>';
  }).join('');
  return '<input type="text" id="people-filter" placeholder="Filter by name…" autocomplete="off" />' +
    '<div class="people-list">' + rows + '</div>';
}

function personFieldHtml(person, field) {
  const { k, type, opts } = field;
  const label = FIELD_LABELS[k] || k;
  const id = 'pe-' + k;
  let control;
  if (type === 'checkbox') {
    control = `<input type="checkbox" id="${id}"${person[k] === true ? ' checked' : ''} />`;
    return `<label class="switch"><span>${esc(label)}</span>${control}</label>`;
  }
  if (type === 'select') {
    control = `<select id="${id}">` + opts.map((o) =>
      `<option value="${esc(o)}"${(person[k] || '') === o ? ' selected' : ''}>${esc(o || '—')}</option>`).join('') + '</select>';
  } else if (type === 'textarea') {
    control = `<textarea id="${id}" rows="3">${esc(person[k] == null ? '' : person[k])}</textarea>`;
  } else {
    const t = type === 'number' ? 'number' : 'text';
    const v = person[k] == null ? '' : person[k];
    control = `<input type="${t}" id="${id}" value="${esc(v)}" />`;
  }
  // A chip row directly after the English name fields (its previous sibling is
  // the input) lets attachTransliterate find it and offer Hindi suggestions.
  const chips = (k === 'name_en' || k === 'spouse_en') ? '<div class="chip-row"></div>' : '';
  return `<label>${esc(label)}${control}${chips}</label>`;
}

// Wire English → Hindi transliteration chips for the person + spouse name fields,
// reusing the public attachTransliterate with the admin fetcher. Preserves an
// existing Hindi value (only fills a blank one) — see transliterate.js.
function wirePersonTransliterate() {
  if (typeof attachTransliterate !== 'function') return;
  const opts = { translit: (t) => adminApi.transliterate(t) };
  attachTransliterate(document.getElementById('pe-name_en'), document.getElementById('pe-name_hi'), opts);
  attachTransliterate(document.getElementById('pe-spouse_en'), document.getElementById('pe-spouse_hi'), opts);
}

function openPersonEdit(id) {
  const box = document.getElementById('people-box');
  const person = _people.find((p) => p.id === id);
  if (!person) { reloadPeople(); return; }
  const fields = PERSON_EDIT_FIELDS.map((f) => personFieldHtml(person, f)).join('');
  box.innerHTML =
    '<form id="people-edit-form" data-id="' + esc(id) + '" novalidate>' +
      '<div class="pe-head"><button type="button" class="btn btn-ghost" data-back>← Back</button>' +
      '<span class="pe-title">' + esc(personName(person)) + '</span></div>' +
      '<div class="pe-grid">' + fields + '</div>' +
      '<div class="pe-actions">' +
        '<button type="submit" class="btn">Save changes</button>' +
        '<button type="button" class="btn btn-danger" data-delete="' + esc(id) + '">Delete</button>' +
      '</div>' +
      '<div class="form-error" id="pe-error" hidden></div>' +
      '<div class="form-ok" id="pe-ok" hidden></div>' +
    '</form>';
  wirePersonTransliterate();
}

// Read the edit form into a payload with the right types (mirrors the public
// sidebar's coercion: '' → null for years/text, checkboxes → boolean).
function collectPersonForm() {
  const data = {};
  for (const { k, type } of PERSON_EDIT_FIELDS) {
    const el = document.getElementById('pe-' + k);
    if (!el) continue;
    if (type === 'checkbox') { data[k] = el.checked; continue; }
    if (type === 'number') { data[k] = el.value === '' ? null : parseInt(el.value, 10); continue; }
    const v = (el.value || '').trim();
    data[k] = v === '' ? null : v;
  }
  return data;
}

// Client no-op guard mirror (the server enforces it too — Phase 2.24). Returns
// only the keys whose value differs from the current record; '' ≈ null and
// values compare as strings so 1950 (number) equals "1950" (text).
function changedKeys(before, payload) {
  const norm = (v) => (v === '' || v === null || v === undefined ? null : v);
  const out = {};
  for (const k of Object.keys(payload)) {
    let incoming = payload[k];
    if (k === 'name_en' && typeof incoming === 'string') incoming = incoming.trim();
    const a = norm(incoming);
    const b = norm(before[k]);
    if (a === null && b === null) continue;
    if (a === null || b === null || String(a) !== String(b)) out[k] = payload[k];
  }
  return out;
}

// Delete the person currently open in the editor (confirmed). The server cascades
// their family links; on success we drop back to the refreshed list + history.
async function deletePersonFromEditor(id) {
  const person = _people.find((p) => p.id === id);
  const label = person ? personName(person) : 'this person';
  if (!window.confirm('Delete ' + label + '? This also removes their family links and cannot be undone.')) return;
  const errEl = document.getElementById('pe-error');
  if (errEl) errEl.hidden = true;
  try {
    await adminApi.deletePerson(id);
    await reloadPeople();
    await reloadHistory();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.hidden = false; }
    else window.alert('Delete failed: ' + err.message);
  }
}

function wirePeopleActions(box) {
  box.addEventListener('input', (e) => {
    if (e.target.id !== 'people-filter') return;
    const q = e.target.value.trim().toLowerCase();
    box.querySelectorAll('.people-row').forEach((row) => {
      const hay = row.getAttribute('data-search') || '';
      row.style.display = (!q || hay.includes(q)) ? '' : 'none';
    });
  });

  box.addEventListener('click', (e) => {
    const editBtn = e.target.closest('button[data-edit]');
    if (editBtn) { openPersonEdit(editBtn.getAttribute('data-edit')); return; }
    const delBtn = e.target.closest('button[data-delete]');
    if (delBtn) { deletePersonFromEditor(delBtn.getAttribute('data-delete')); return; }
    if (e.target.closest('button[data-back]')) { reloadPeople(); }
  });

  box.addEventListener('submit', async (e) => {
    const form = e.target.closest('#people-edit-form');
    if (!form) return;
    e.preventDefault();
    const id = form.getAttribute('data-id');
    const errEl = document.getElementById('pe-error');
    const okEl = document.getElementById('pe-ok');
    errEl.hidden = true; okEl.hidden = true;

    const before = _people.find((p) => p.id === id) || {};
    const data = collectPersonForm();
    if (!data.name_en) { errEl.textContent = 'Name (English) is required.'; errEl.hidden = false; return; }

    const diff = changedKeys(before, data);
    if (Object.keys(diff).length === 0) { okEl.textContent = 'No changes to save.'; okEl.hidden = false; return; }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await adminApi.updatePerson(id, diff);
      await reloadPeople();
      await reloadHistory();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      btn.disabled = false;
    }
  });
}

// --- Ancestor lineage (admin-editable chain above "Bade Lal Singh") ---

// Suggested initial chain (era 1840–1940). Loaded on demand via the UI button;
// never auto-applied, so live family data is never clobbered without an explicit
// Save. Years are spread across the era and remain editable per generation.
const DEFAULT_LINEAGE = [
  { name_en: 'Titay Singh', name_hi: '', birth_year: 1840, death_year: null, deceased: true },
  { name_en: 'Jeevlal Singh', name_hi: '', birth_year: 1865, death_year: null, deceased: true },
  { name_en: 'Shukan Singh', name_hi: '', birth_year: 1890, death_year: null, deceased: true },
  { name_en: 'Gopal Singh', name_hi: '', birth_year: 1910, death_year: null, deceased: true },
  { name_en: 'Rameshwar Singh', name_hi: '', birth_year: 1930, death_year: 1940, deceased: true },
];

let _lineage = [];      // working copy of the editable chain (root → youngest)
let _lineageFocal = null;

function toLineageRow(p) {
  return {
    id: p.id,
    name_en: p.name_en || '',
    name_hi: p.name_hi || '',
    birth_year: p.birth_year != null ? p.birth_year : '',
    death_year: p.death_year != null ? p.death_year : '',
    deceased: p.deceased !== false,
  };
}

async function reloadLineage() {
  const box = document.getElementById('lineage-box');
  try {
    const data = await adminApi.getLineage();
    _lineage = (data.ancestors || []).map(toLineageRow);
    _lineageFocal = data.focal || null;
  } catch (err) {
    box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
    return;
  }
  renderLineageEditor();
}

function renderLineageEditor() {
  const box = document.getElementById('lineage-box');
  const rows = _lineage.map((a, i) => {
    const upDis = i === 0 ? ' disabled' : '';
    const downDis = i === _lineage.length - 1 ? ' disabled' : '';
    return '<div class="lin-row" data-idx="' + i + '">' +
      '<span class="lin-gen">' + (i + 1) + '</span>' +
      '<input type="text" data-field="name_en" placeholder="Name (English)" value="' + esc(a.name_en) + '" />' +
      '<input type="text" data-field="name_hi" placeholder="नाम" value="' + esc(a.name_hi) + '" />' +
      '<input type="number" class="lin-year" data-field="birth_year" placeholder="Birth" value="' + esc(a.birth_year) + '" />' +
      '<input type="number" class="lin-year" data-field="death_year" placeholder="Death" value="' + esc(a.death_year) + '" />' +
      '<span class="lin-ops">' +
        '<button type="button" class="btn btn-ghost lin-mini" data-act="up"' + upDis + '>↑</button>' +
        '<button type="button" class="btn btn-ghost lin-mini" data-act="down"' + downDis + '>↓</button>' +
        '<button type="button" class="btn btn-danger lin-mini" data-act="remove">✕</button>' +
      '</span>' +
      '<div class="lin-chips chip-row"></div>' +
    '</div>';
  }).join('');

  const focalName = _lineageFocal ? personName(_lineageFocal) : '(focal not found)';
  box.innerHTML =
    '<p class="muted">Oldest first. The chain links top→down into the focal person.</p>' +
    '<div class="lin-list">' + (rows || '<p class="muted">No ancestors yet.</p>') + '</div>' +
    '<div class="lin-focal">↓ <strong>' + esc(focalName) + '</strong> <span class="muted">(focal — descendants below)</span></div>' +
    '<div class="lin-actions">' +
      '<button type="button" class="btn btn-ghost" data-act="add">+ Add generation</button>' +
      '<button type="button" class="btn btn-ghost" data-act="seed">Load 1840–1940 default</button>' +
      '<button type="button" class="btn" data-act="save">Save lineage</button>' +
    '</div>' +
    '<div class="form-error" id="lin-error" hidden></div>' +
    '<div class="form-ok" id="lin-ok" hidden></div>';
  wireLineageTransliterate();
}

// English → Hindi chips for each ancestor row. Re-wired after every render (the
// rows are rebuilt on add/remove/reorder/seed). The chip writes fire an input
// event so the working `_lineage` array stays in sync for save.
function wireLineageTransliterate() {
  if (typeof attachTransliterate !== 'function') return;
  const box = document.getElementById('lineage-box');
  if (!box) return;
  box.querySelectorAll('.lin-row').forEach((row) => {
    attachTransliterate(
      row.querySelector('input[data-field="name_en"]'),
      row.querySelector('input[data-field="name_hi"]'),
      { translit: (t) => adminApi.transliterate(t), container: row.querySelector('.lin-chips') }
    );
  });
}

function wireLineageActions(box) {
  // Keep the working array synced as the admin types, so structural ops
  // (reorder/add/remove) preserve in-progress edits across re-renders.
  box.addEventListener('input', (e) => {
    const row = e.target.closest('.lin-row');
    if (!row || !e.target.dataset.field) return;
    const idx = parseInt(row.getAttribute('data-idx'), 10);
    if (_lineage[idx]) _lineage[idx][e.target.dataset.field] = e.target.value;
  });

  box.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.getAttribute('data-act');
    const row = btn.closest('.lin-row');
    const idx = row ? parseInt(row.getAttribute('data-idx'), 10) : -1;

    if (act === 'up' && idx > 0) {
      [_lineage[idx - 1], _lineage[idx]] = [_lineage[idx], _lineage[idx - 1]];
      return renderLineageEditor();
    }
    if (act === 'down' && idx < _lineage.length - 1) {
      [_lineage[idx + 1], _lineage[idx]] = [_lineage[idx], _lineage[idx + 1]];
      return renderLineageEditor();
    }
    if (act === 'remove') { _lineage.splice(idx, 1); return renderLineageEditor(); }
    if (act === 'add') {
      _lineage.push({ name_en: '', name_hi: '', birth_year: '', death_year: '', deceased: true });
      return renderLineageEditor();
    }
    if (act === 'seed') {
      _lineage = DEFAULT_LINEAGE.map((a) => ({ ...a, birth_year: a.birth_year, death_year: a.death_year == null ? '' : a.death_year }));
      return renderLineageEditor();
    }
    if (act === 'save') await saveLineage(btn);
  });
}

function lineagePayload() {
  return _lineage.map((a) => {
    const row = { name_en: (a.name_en || '').trim(), deceased: a.deceased !== false };
    if (a.id) row.id = a.id;
    row.name_hi = (a.name_hi || '').trim() || null;
    row.birth_year = a.birth_year === '' || a.birth_year == null ? null : parseInt(a.birth_year, 10);
    row.death_year = a.death_year === '' || a.death_year == null ? null : parseInt(a.death_year, 10);
    return row;
  });
}

async function saveLineage(btn) {
  const errEl = document.getElementById('lin-error');
  const okEl = document.getElementById('lin-ok');
  errEl.hidden = true; okEl.hidden = true;

  const payload = lineagePayload();
  if (payload.some((a) => !a.name_en)) { errEl.textContent = 'Every generation needs an English name.'; errEl.hidden = false; return; }

  btn.disabled = true;
  try {
    const data = await adminApi.setLineage(payload);
    _lineage = (data.ancestors || []).map(toLineageRow);
    _lineageFocal = data.focal || _lineageFocal;
    renderLineageEditor();
    const ok = document.getElementById('lin-ok');
    ok.textContent = 'Lineage saved.';
    ok.hidden = false;
    await reloadPeople();
    await reloadHistory();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
    btn.disabled = false;
  }
}

// --- Entry point ---

async function boot() {
  try {
    const st = await adminApi.status();
    if (st.needsSetup) return renderSignup();
    if (st.authed) return renderDashboard();
    return renderLogin();
  } catch (err) {
    root().innerHTML = `<div class="admin-card"><div class="form-error">Could not reach the server: ${esc(err.message)}</div></div>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
