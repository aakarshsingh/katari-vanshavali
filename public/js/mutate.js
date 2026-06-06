// Mutation chokepoint. Every tree edit goes through here so we can route it
// either directly (moderation OFF, or the caller is an admin) or into the
// moderation queue (anonymous contributor while moderation is ON).
//
// Returns for the DIRECT path:
//   create/update/delete person → { persons, relationships }
//   updateTitle                 → { tree }
// Returns for the QUEUED path:
//   { pending: true, id, change }
//
// The optimistic localStorage overlay + "submitted for approval" toast for the
// queued path is layered on in overlay.js (Phase 2.11).

function _isQueued() {
  const m = window.__moderation || {};
  return !!(m.enabled && !m.admin);
}

function _state() {
  return window.__state || { persons: [], relationships: [], tree: null };
}

// overlay.js provides the persistent client_token; null is acceptable to the
// server if overlay isn't present.
function _token() {
  return (window.overlay && typeof window.overlay.token === 'function')
    ? window.overlay.token()
    : null;
}

// Submit a change to the moderation queue, record the optimistic overlay entry,
// toast the contributor, and refresh the view so they see their pending edit.
async function _queue(change) {
  const res = await api.submitChange({ ...change, client_token: _token() });
  if (window.overlay) {
    window.overlay.add({ id: res.id, change });
    window.overlay.toast('Submitted to admin for approval');
  }
  if (typeof window.refreshWithOverlay === 'function') window.refreshWithOverlay();
  return { pending: true, id: res.id, change };
}

async function createPersonWithParent(data, parentId) {
  if (_isQueued()) {
    const payload = { ...data };
    if (parentId) payload.parent_id = parentId;
    return _queue({ op_type: 'create', entity: 'person', payload });
  }
  const person = await api.createPerson({ ...data, tree_id: _state().tree && _state().tree.id });
  let relationships = _state().relationships;
  if (parentId) {
    const rel = await api.createRelationship(parentId, person.id);
    relationships = [...relationships, rel];
  }
  const persons = [..._state().persons, person];
  return { persons, relationships };
}

// reparent: { changed: bool, to: parentId|null } — applied only on the direct path.
async function updatePerson(id, data, reparent) {
  if (_isQueued()) {
    return _queue({ op_type: 'update', entity: 'person', target_id: id, payload: { ...data } });
  }
  const person = await api.updatePerson(id, data);
  let relationships = _state().relationships;
  if (reparent && reparent.changed) {
    const oldRel = relationships.find((r) => r.child_id === id);
    if (oldRel) {
      await api.deleteRelationship(oldRel.id);
      relationships = relationships.filter((r) => r.id !== oldRel.id);
    }
    if (reparent.to) {
      const rel = await api.createRelationship(reparent.to, id);
      relationships = [...relationships, rel];
    }
  }
  const persons = _state().persons.map((p) => (p.id === id ? person : p));
  return { persons, relationships };
}

async function deletePerson(id) {
  if (_isQueued()) {
    return _queue({ op_type: 'delete', entity: 'person', target_id: id });
  }
  await api.deletePerson(id);
  const persons = _state().persons.filter((p) => p.id !== id);
  const relationships = _state().relationships.filter(
    (r) => r.parent_id !== id && r.child_id !== id
  );
  return { persons, relationships };
}

async function updateTitle(field, value) {
  if (_isQueued()) {
    return _queue({ op_type: 'update', entity: 'tree', payload: { [field]: value } });
  }
  const { tree } = await api.patchTree({ [field]: value });
  return { tree };
}

window.mutate = { createPersonWithParent, updatePerson, deletePerson, updateTitle };
