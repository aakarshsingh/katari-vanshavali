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

function describePending(row) {
  const { op_type, entity } = row;
  const p = row.payload || {};
  if (entity === 'person') {
    if (op_type === 'create') return 'Add person: ' + (p.name_en || '(unnamed)');
    if (op_type === 'update') return 'Edit person';
    if (op_type === 'delete') return 'Remove person';
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
    return { action: 'Edited person', detail: diffHtml(before, after) };
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
      '<section class="admin-card"><h2>Moderation</h2><div id="moderation-box">Loading…</div></section>' +
      '<section class="admin-card"><h2>Add admin</h2><div id="add-admin-box"></div></section>' +
      '<section class="admin-card admin-wide"><h2>Pending edits <span id="queue-count" class="count"></span></h2><div id="queue-box">Loading…</div></section>' +
      '<section class="admin-card admin-wide"><h2>History</h2><div id="history-box">Loading…</div></section>' +
    '</div>';

  document.getElementById('btn-logout').addEventListener('click', async () => {
    try { await adminApi.logout(); } catch { /* ignore */ }
    boot();
  });

  // Delegated once — #queue-box innerHTML is replaced on every reload, but the
  // element itself is stable, so the listener must not be re-attached per reload.
  wireQueueActions(document.getElementById('queue-box'));

  renderModeration();
  renderAddAdmin();
  reloadQueue();
  reloadHistory();
}

async function renderModeration() {
  const box = document.getElementById('moderation-box');
  let enabled = false;
  try { enabled = (await adminApi.getSettings()).moderation_enabled === true; }
  catch (err) { box.innerHTML = `<div class="form-error">${esc(err.message)}</div>`; return; }
  box.innerHTML =
    '<label class="switch"><input type="checkbox" id="mod-toggle"' + (enabled ? ' checked' : '') + ' /> ' +
    'Require approval for public edits</label>' +
    '<p class="muted" id="mod-state"></p>';
  const stateEl = document.getElementById('mod-state');
  const setStateText = (on) => { stateEl.textContent = on ? 'ON — edits are queued for review.' : 'OFF — edits apply immediately.'; };
  setStateText(enabled);
  const toggle = document.getElementById('mod-toggle');
  toggle.addEventListener('change', async () => {
    toggle.disabled = true;
    try {
      const r = await adminApi.setModeration(toggle.checked);
      toggle.checked = r.moderation_enabled === true;
      setStateText(toggle.checked);
    } catch (err) {
      toggle.checked = !toggle.checked; // revert optimistic flip
      stateEl.textContent = err.message;
    } finally {
      toggle.disabled = false;
    }
  });
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
  box.innerHTML = rows.map((r) => {
    const note = r.submitter_note ? `<div class="muted">Note: ${esc(r.submitter_note)}</div>` : '';
    const payloadJson = esc(JSON.stringify(r.payload || {}, null, 2));
    return '<div class="q-card" data-id="' + esc(r.id) + '">' +
      '<div class="q-title">' + esc(describePending(r)) + '</div>' +
      '<div class="muted">submitted ' + esc(fmtDate(r.submitted_at)) + '</div>' + note +
      '<textarea class="q-payload" rows="6" spellcheck="false">' + payloadJson + '</textarea>' +
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
