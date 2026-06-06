let sidebarMode = 'new';
let sidebarParentId = null;
let sidebarPersonId = null;
let sidebarOrigParentId = null; // current parent when editing (for re-parent detection)

function findParentId(personId) {
  const rels = (window.__state && window.__state.relationships) || [];
  const rel = rels.find(r => r.child_id === personId);
  return rel ? rel.parent_id : '';
}

// All descendants of personId — excluded as re-parent targets to avoid cycles.
function descendantsOf(personId) {
  const rels = (window.__state && window.__state.relationships) || [];
  const childrenOf = {};
  for (const r of rels) (childrenOf[r.parent_id] = childrenOf[r.parent_id] || []).push(r.child_id);
  const set = new Set();
  (function walk(id) {
    for (const c of (childrenOf[id] || [])) { if (!set.has(c)) { set.add(c); walk(c); } }
  })(personId);
  return set;
}

function getSidebarEls() {
  return {
    sidebar: document.getElementById('sidebar'),
    title: document.getElementById('sidebar-title'),
    form: document.getElementById('person-form'),
    nameEn: document.getElementById('f-name-en'),
    nameHi: document.getElementById('f-name-hi'),
    birth: document.getElementById('f-birth'),
    death: document.getElementById('f-death'),
    seq: document.getElementById('f-seq'),
    living: document.getElementById('f-living'),
    deathField: document.getElementById('death-field'),
    spouseEn: document.getElementById('f-spouse-en'),
    spouseHi: document.getElementById('f-spouse-hi'),
    spouseBirth: document.getElementById('f-spouse-birth'),
    spouseDeath: document.getElementById('f-spouse-death'),
    spouseLiving: document.getElementById('f-spouse-living'),
    spouseDeathField: document.getElementById('spouse-death-field'),
    notes: document.getElementById('f-notes'),
    hideDeath: document.getElementById('f-hide-death'),
    spouseHideDeath: document.getElementById('f-spouse-hide-death'),
    married: document.getElementById('f-married'),
    spouseFields: document.getElementById('spouse-fields'),
    parent: document.getElementById('f-parent'),
    parentGroup: document.getElementById('parent-group'),
    btnSave: document.getElementById('btn-save'),
    btnDelete: document.getElementById('btn-delete'),
    btnClose: document.getElementById('sidebar-close'),
    error: document.getElementById('form-error'),
  };
}

// Two-tier form: non-admins get only Name + Gender + Spouse name/gender. The
// detail inputs (.admin-only: birth/death/Living/sequence/notes/spouse years +
// the two hide-death checkboxes) are REMOVED from the DOM for non-admins — not
// merely hidden — so they can never be read or submitted. Applied lazily on
// sidebar open (idempotent): `window.__moderation.admin` is resolved
// asynchronously by main.loadModerationState() after DOMContentLoaded, so doing
// this at init time would always see admin:false. Removal is permanent for the
// session; admin status doesn't change mid-session.
function applyAdminTier() {
  const isAdmin = !!(window.__moderation && window.__moderation.admin);
  if (!isAdmin) {
    document.querySelectorAll('#person-form .admin-only').forEach((el) => el.remove());
  }
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function clearError(el) {
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

// Show/hide the spouse fields based on the Married checkbox.
function setMarried(els, on) {
  if (els.married) els.married.checked = !!on;
  if (els.spouseFields) els.spouseFields.hidden = !on;
}

// "Living" is checked by default (positive framing). Death year is shown only
// when Living is UNchecked — so it stays hidden for the living, esp. children.
function setLiving(els, alive) {
  if (els.living) els.living.checked = !!alive;
  if (els.deathField) els.deathField.hidden = !!alive;
  if (alive && els.death) els.death.value = '';
}

function setSpouseLiving(els, alive) {
  if (els.spouseLiving) els.spouseLiving.checked = !!alive;
  if (els.spouseDeathField) els.spouseDeathField.hidden = !!alive;
  if (alive && els.spouseDeath) els.spouseDeath.value = '';
}

function collectForm(els) {
  const genderEl = els.form.querySelector('[name="gender"]:checked');
  const spouseGenderEl = els.form.querySelector('[name="spouse_gender"]:checked');
  const married = !!(els.married && els.married.checked);

  // Public tier (always present): name + gender + spouse name/gender.
  const data = {
    name_en: els.nameEn.value.trim(),
    name_hi: els.nameHi.value.trim() || null,
    gender: genderEl ? genderEl.value : 'M',
    spouse_en: married && els.spouseEn ? (els.spouseEn.value.trim() || null) : null,
    spouse_hi: married && els.spouseHi ? (els.spouseHi.value.trim() || null) : null,
    spouse_gender: married && spouseGenderEl ? spouseGenderEl.value : null,
  };

  // Admin tier: detail fields exist only when .admin-only wasn't removed.
  // `els.living` is the sentinel for the tier being present.
  if (els.living) {
    const deceased = !els.living.checked;                          // unchecked Living = deceased
    const spouseDeceased = married && !(els.spouseLiving && els.spouseLiving.checked);
    data.birth_year = els.birth && els.birth.value ? parseInt(els.birth.value, 10) : null;
    data.death_year = deceased && els.death && els.death.value ? parseInt(els.death.value, 10) : null;
    data.sequence = els.seq && els.seq.value ? parseInt(els.seq.value, 10) : null;
    data.deceased = deceased;
    data.spouse_birth_year = married && els.spouseBirth && els.spouseBirth.value ? parseInt(els.spouseBirth.value, 10) : null;
    data.spouse_death_year = spouseDeceased && els.spouseDeath && els.spouseDeath.value ? parseInt(els.spouseDeath.value, 10) : null;
    data.spouse_deceased = spouseDeceased;
    data.notes = els.notes ? (els.notes.value.trim() || null) : null;
    data.death_year_hidden = !!(els.hideDeath && els.hideDeath.checked);
    data.spouse_death_year_hidden = !!(els.spouseHideDeath && els.spouseHideDeath.checked);
  }
  return data;
}

function populateForm(els, person) {
  els.nameEn.value = person.name_en || '';
  els.nameHi.value = person.name_hi || '';
  if (els.birth) els.birth.value = person.birth_year != null ? person.birth_year : '';
  if (els.death) els.death.value = person.death_year != null ? person.death_year : '';
  if (els.seq) els.seq.value = person.sequence != null ? person.sequence : '';
  if (els.spouseEn) els.spouseEn.value = person.spouse_en || '';
  if (els.spouseHi) els.spouseHi.value = person.spouse_hi || '';
  if (els.spouseBirth) els.spouseBirth.value = person.spouse_birth_year != null ? person.spouse_birth_year : '';
  if (els.spouseDeath) els.spouseDeath.value = person.spouse_death_year != null ? person.spouse_death_year : '';
  if (els.notes) els.notes.value = person.notes || '';
  if (els.hideDeath) els.hideDeath.checked = !!person.death_year_hidden;
  if (els.spouseHideDeath) els.spouseHideDeath.checked = !!person.spouse_death_year_hidden;
  const genderRadio = els.form.querySelector(`[name="gender"][value="${person.gender || 'M'}"]`);
  if (genderRadio) genderRadio.checked = true;
  const spouseGenderRadio = person.spouse_gender
    ? els.form.querySelector(`[name="spouse_gender"][value="${person.spouse_gender}"]`)
    : null;
  if (spouseGenderRadio) spouseGenderRadio.checked = true;
  // A person is "married" if they have a spouse name recorded.
  setMarried(els, !!(person.spouse_en || person.spouse_hi));
  // Living unless flagged deceased or a death year exists (back-compat).
  setLiving(els, !(person.deceased || person.death_year != null));
  setSpouseLiving(els, !(person.spouse_deceased || person.spouse_death_year != null));
}

function resetForm(els) {
  els.form.reset();
  clearError(els.error);
  setMarried(els, false);
  setLiving(els, true);
  setSpouseLiving(els, true);
  // Clear any leftover transliteration chips from a previous person.
  ['chips-name', 'chips-spouse'].forEach((id) => {
    const c = document.getElementById(id);
    if (c) c.innerHTML = '';
  });
  const btnAddChild = document.getElementById('btn-add-child');
  if (btnAddChild) btnAddChild.hidden = true;
}

function openSidebar(els) {
  els.sidebar.classList.add('open');
  els.sidebar.setAttribute('aria-hidden', 'false');
  els.nameEn.focus();
}

function closeSidebar() {
  const els = getSidebarEls();
  if (!els.sidebar) return;
  els.sidebar.classList.remove('open');
  els.sidebar.setAttribute('aria-hidden', 'true');
  sidebarMode = 'new';
  sidebarParentId = null;
  sidebarPersonId = null;
  sidebarOrigParentId = null;
}

// Populate the Parent <select> from current state; preselect selectedId.
// excludeIds: a Set of person ids to omit (self + descendants when editing).
function populateParentOptions(els, selectedId, excludeIds) {
  if (!els.parent) return;
  const state = window.__state;
  const persons = (state && state.persons) || [];
  const skip = excludeIds || new Set();
  const opts = ['<option value="">— none (root) —</option>'];
  for (const p of persons) {
    if (skip.has(p.id)) continue;
    const sel = p.id === selectedId ? ' selected' : '';
    const label = (p.name_en || '(unnamed)').replace(/[<>&]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
    opts.push(`<option value="${p.id}"${sel}>${label}</option>`);
  }
  els.parent.innerHTML = opts.join('');
}

function openNew(parentId) {
  if (window.__locked) return;
  applyAdminTier();
  const els = getSidebarEls();
  if (!els.sidebar) return;

  sidebarMode = 'new';
  sidebarParentId = parentId || null;
  sidebarPersonId = null;

  resetForm(els);
  populateParentOptions(els, parentId || '');
  if (els.parentGroup) els.parentGroup.hidden = false;
  els.title.textContent = parentId ? 'Add Child' : 'Add Person';
  els.btnDelete.hidden = true;
  openSidebar(els);
}

function openEdit(personId) {
  if (window.__locked) return;
  applyAdminTier();
  const els = getSidebarEls();
  if (!els.sidebar) return;

  const state = window.__state;
  const person = state && state.persons.find(p => p.id === personId);
  if (!person) return;

  sidebarMode = 'edit';
  sidebarParentId = null;
  sidebarPersonId = personId;

  resetForm(els);
  // Show the actual current parent and allow re-parenting (excluding self + descendants).
  sidebarOrigParentId = findParentId(personId);
  const exclude = descendantsOf(personId);
  exclude.add(personId);
  populateParentOptions(els, sidebarOrigParentId, exclude);
  if (els.parentGroup) els.parentGroup.hidden = false;
  els.title.textContent = 'Edit Person';
  els.btnDelete.hidden = false;
  const btnAddChild = document.getElementById('btn-add-child');
  if (btnAddChild) btnAddChild.hidden = false;
  populateForm(els, person);
  openSidebar(els);
}

async function handleSubmit(e) {
  e.preventDefault();
  const els = getSidebarEls();
  clearError(els.error);

  const data = collectForm(els);
  if (!data.name_en) {
    showError(els.error, 'Name (English) is required.');
    return;
  }

  const selectedParent = (els.parent && els.parent.value) || null;
  const hasNodes = window.__state.persons && window.__state.persons.length > 0;
  if (sidebarMode === 'new' && !selectedParent && hasNodes) {
    showError(els.error, 'Select a parent — the tree already has a root.');
    return;
  }

  els.btnSave.disabled = true;
  try {
    if (sidebarMode === 'new') {
      const result = await mutate.createPersonWithParent(data, selectedParent);
      if (!result.pending) {
        setState({ persons: result.persons, relationships: result.relationships });
      }
    } else {
      // Re-parent if the parent selection changed (applied on the direct path).
      const selectedParentNow = (els.parent && els.parent.value) || null;
      const reparent = {
        changed: selectedParentNow !== (sidebarOrigParentId || null),
        to: selectedParentNow,
      };
      const result = await mutate.updatePerson(sidebarPersonId, data, reparent);
      if (!result.pending) {
        setState({ persons: result.persons, relationships: result.relationships });
      }
    }
    closeSidebar();
  } catch (err) {
    showError(els.error, err.message || 'Save failed. Please try again.');
  } finally {
    els.btnSave.disabled = false;
  }
}

async function handleDelete() {
  if (!sidebarPersonId) return;
  if (!confirm('Delete this person? This cannot be undone.')) return;

  const els = getSidebarEls();
  els.btnDelete.disabled = true;
  try {
    const result = await mutate.deletePerson(sidebarPersonId);
    closeSidebar();
    if (!result.pending) {
      setState({ persons: result.persons, relationships: result.relationships });
    }
  } catch (err) {
    showError(els.error, err.message || 'Delete failed.');
    els.btnDelete.disabled = false;
  }
}

function initSidebar() {
  const els = getSidebarEls();
  if (!els.sidebar) return;

  els.btnClose && els.btnClose.addEventListener('click', closeSidebar);
  els.form && els.form.addEventListener('submit', handleSubmit);
  // Enter in any text/number input saves (textarea keeps normal newlines).
  els.form && els.form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      if (els.form.requestSubmit) els.form.requestSubmit(); else handleSubmit(e);
    }
  });
  els.btnDelete && els.btnDelete.addEventListener('click', handleDelete);
  els.married && els.married.addEventListener('change', () => setMarried(els, els.married.checked));
  els.living && els.living.addEventListener('change', () => setLiving(els, els.living.checked));
  els.spouseLiving && els.spouseLiving.addEventListener('change', () => setSpouseLiving(els, els.spouseLiving.checked));

  const btnAddChild = document.getElementById('btn-add-child');
  btnAddChild && btnAddChild.addEventListener('click', () => {
    const parentId = sidebarPersonId;
    closeSidebar();
    openNew(parentId);
  });

  const btnAddPerson = document.getElementById('btn-add-person');
  btnAddPerson && btnAddPerson.addEventListener('click', () => openNew(null));

  // Phase 13 hook: wire transliterate chips if available
  if (typeof attachTransliterate === 'function') {
    attachTransliterate(els.nameEn, els.nameHi);
    attachTransliterate(els.spouseEn, els.spouseHi);
  }
}

window.openNew = openNew;
window.openEdit = openEdit;
window.closeSidebar = closeSidebar;
document.addEventListener('DOMContentLoaded', initSidebar);
