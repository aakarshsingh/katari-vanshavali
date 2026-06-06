// Standalone fetch client for the unlinked /admin page. The JWT set by
// /api/auth/{setup,login} rides in an httpOnly same-origin cookie, so every
// call uses credentials:'same-origin'. Throws on non-2xx with err.status set,
// so the app layer can branch on 401 (re-show login) vs other failures.

async function adminFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const adminApi = {
  // --- Auth ---
  status() { return adminFetch('/api/auth/status'); },
  setup(username, password) {
    return adminFetch('/api/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  login(username, password) {
    return adminFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  logout() { return adminFetch('/api/auth/logout', { method: 'POST' }); },
  me() { return adminFetch('/api/auth/me'); },
  addAdmin(username, password) {
    return adminFetch('/api/auth/admins', { method: 'POST', body: JSON.stringify({ username, password }) });
  },

  // --- Settings ---
  getSettings() { return adminFetch('/api/settings'); },
  setModeration(enabled) {
    return adminFetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ moderation_enabled: enabled }) });
  },
  setShowBirthYear(enabled) {
    return adminFetch('/api/settings', { method: 'PATCH', body: JSON.stringify({ show_birth_year: enabled }) });
  },

  // --- Moderation queue / history ---
  // status: 'pending' | 'applied' | 'reverted' | 'rejected'
  listChanges(status) {
    return adminFetch('/api/changes?status=' + encodeURIComponent(status));
  },
  // payload omitted → server applies the originally-submitted payload.
  approve(id, payload) {
    const opts = { method: 'POST' };
    if (payload !== undefined) opts.body = JSON.stringify({ payload });
    return adminFetch('/api/changes/' + id + '/approve', opts);
  },
  reject(id) { return adminFetch('/api/changes/' + id + '/reject', { method: 'POST' }); },
  revert(id) { return adminFetch('/api/changes/' + id + '/revert', { method: 'POST' }); },
};

window.adminApi = adminApi;
