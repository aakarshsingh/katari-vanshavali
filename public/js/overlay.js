// Optimistic overlay for anonymous contributors while moderation is ON.
// Their pending edits live in localStorage keyed by a per-browser client_token
// and are merged over the shared server tree so they keep seeing their own
// changes (labelled pending) until an admin approves/rejects. Never shared with
// other visitors — localStorage only.

const OVERLAY_TOKEN_KEY = 'vanshavali_client_token';
const OVERLAY_ENTRIES_KEY = 'vanshavali_overlay';

function token() {
  let t = localStorage.getItem(OVERLAY_TOKEN_KEY);
  if (!t) {
    t = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 't-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    localStorage.setItem(OVERLAY_TOKEN_KEY, t);
  }
  return t;
}

function _read() {
  try { return JSON.parse(localStorage.getItem(OVERLAY_ENTRIES_KEY) || '[]'); }
  catch { return []; }
}
function _write(entries) {
  localStorage.setItem(OVERLAY_ENTRIES_KEY, JSON.stringify(entries));
}

// entry: { id: <change_request id>, change: { op_type, entity, target_id, payload } }
function add(entry) {
  const entries = _read();
  entries.push(entry);
  _write(entries);
}
function list() { return _read(); }
function remove(changeId) { _write(_read().filter((e) => e.id !== changeId)); }
function clear() { _write([]); }

// Merge pending entries over a server-base { tree, persons, relationships },
// returning a new merged view. Pending persons carry __pending for optional UI.
function applyOverlay(base) {
  const entries = _read();
  let tree = base.tree;
  let persons = [...(base.persons || [])];
  let relationships = [...(base.relationships || [])];

  for (const { change } of entries) {
    if (!change) continue;
    const { entity, op_type, target_id, payload = {} } = change;
    if (entity === 'person' && op_type === 'update' && target_id) {
      persons = persons.map((p) => (p.id === target_id ? { ...p, ...payload, __pending: true } : p));
    } else if (entity === 'person' && op_type === 'create') {
      const tempId = 'pending-' + Math.random().toString(16).slice(2);
      persons.push({ id: tempId, gender: 'M', ...payload, __pending: true });
      if (payload.parent_id) {
        relationships.push({
          id: 'pending-rel-' + tempId,
          parent_id: payload.parent_id,
          child_id: tempId,
          __pending: true,
        });
      }
    } else if (entity === 'person' && op_type === 'delete' && target_id) {
      persons = persons.filter((p) => p.id !== target_id);
      relationships = relationships.filter(
        (r) => r.parent_id !== target_id && r.child_id !== target_id
      );
    } else if (entity === 'tree' && op_type === 'update') {
      tree = tree ? { ...tree, ...payload } : tree;
    }
  }
  return { tree, persons, relationships };
}

// Drop overlay entries the server has resolved. Returns true if anything changed.
async function reconcile() {
  const entries = _read();
  if (!entries.length) return false;
  let changed = false;
  try {
    const mine = await api.myChanges(token());
    const status = {};
    for (const m of mine) status[m.id] = m.status;
    for (const e of entries) {
      const s = status[e.id];
      if (s === 'applied' || s === 'reverted') { remove(e.id); changed = true; }
      else if (s === 'rejected') { remove(e.id); changed = true; toast('A submitted edit was not approved.'); }
      // pending (or not yet known) → keep
    }
  } catch (err) {
    console.warn('Overlay reconcile failed:', err.message);
  }
  return changed;
}

// Lightweight toast (inline-styled to avoid coupling to a CSS file).
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)',
      background: '#1a1008', color: '#fdf6e3', padding: '10px 16px', borderRadius: '6px',
      font: '14px system-ui, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,.3)',
      zIndex: '9999', opacity: '0', transition: 'opacity .2s', pointerEvents: 'none',
      maxWidth: '80vw', textAlign: 'center',
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.opacity = '0'; }, 4000);
}

window.overlay = { token, add, list, remove, clear, applyOverlay, reconcile, toast };
