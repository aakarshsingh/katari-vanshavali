async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

const api = {
  getTree() {
    return apiFetch('/api/tree');
  },

  patchTree(data) {
    return apiFetch('/api/tree', { method: 'PATCH', body: JSON.stringify(data) });
  },

  createPerson(data) {
    return apiFetch('/api/persons', { method: 'POST', body: JSON.stringify(data) });
  },

  updatePerson(id, data) {
    return apiFetch(`/api/persons/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deletePerson(id) {
    return apiFetch(`/api/persons/${id}`, { method: 'DELETE' });
  },

  createRelationship(parentId, childId) {
    return apiFetch('/api/relationships', {
      method: 'POST',
      body: JSON.stringify({ parentId, childId }),
    });
  },

  deleteRelationship(id) {
    return apiFetch(`/api/relationships/${id}`, { method: 'DELETE' });
  },

  transliterate(text) {
    return apiFetch('/api/transliterate', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
};
