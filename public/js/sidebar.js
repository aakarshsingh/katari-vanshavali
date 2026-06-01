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
    deceased: document.getElementById('f-deceased'),
    deathField: document.getElementById('death-field'),
    spouseEn: document.getElementById('f-spouse-en'),
    spouseHi: document.getElementById('f-spouse-hi'),
    spouseBirth: document.getElementById('f-spouse-birth'),
    spouseDeath: document.getElementById('f-spouse-death'),
    spouseDeceased: document.getElementById('f-spouse-deceased'),
    spouseDeathField: document.getElementById('spouse-death-field'),
    notes: document.getElementById('f-notes'),
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

// Death year is hidden by default (sensitive); the Deceased toggle reveals it.
function setDeceased(els, on) {
  if (els.deceased) els.deceased.checked = !!on;
  if (els.deathField) els.deathField.hidden = !on;
  if (!on && els.death) els.death.value = '';
}

function setSpouseDeceased(els, on) {
  if (els.spouseDeceased) els.spouseDeceased.checked = !!on;
  if (els.spouseDeathField) els.spouseDeathField.hidden = !on;
  if (!on && els.spouseDeath) els.spouseDeath.value = '';
}

function collectForm(els) {
  const genderEl = els.form.querySelector('[name="gender"]:checked');
  const spouseGenderEl = els.form.querySelector('[name="spouse_gender"]:checked');
  const married = !!(els.married && els.married.checked);
  const deceased = !!(els.deceased && els.deceased.checked);
  const spouseDeceased = married && !!(els.spouseDeceased && els.spouseDeceased.checked);
  // When not married, spouse data is cleared; death year only when "Deceased".
  return {
    name_en: els.nameEn.value.trim(),
    name_hi: els.nameHi.value.trim() || null,
    birth_year: els.birth.value ? parseInt(els.birth.value, 10) : null,
    death_year: deceased && els.death.value ? parseInt(els.death.value, 10) : null,
    deceased: deceased,
    spouse_en: married ? (els.spouseEn.value.trim() || null) : null,
    spouse_hi: married ? (els.spouseHi.value.trim() || null) : null,
    spouse_birth_year: married && els.spouseBirth.value ? parseInt(els.spouseBirth.value, 10) : null,
    spouse_death_year: spouseDeceased && els.spouseDeath.value ? parseInt(els.spouseDeath.value, 10) : null,
    spouse_deceased: spouseDeceased,
    spouse_gender: married && spouseGenderEl ? spouseGenderEl.value : null,
    gender: genderEl ? genderEl.value : 'M',
    notes: els.notes.value.trim() || null,
  };
}

function populateForm(els, person) {
  els.nameEn.value = person.name_en || '';
  els.nameHi.value = person.name_hi || '';
  els.birth.value = person.birth_year != null ? person.birth_year : '';
  els.death.value = person.death_year != null ? person.death_year : '';
  els.spouseEn.value = person.spouse_en || '';
  els.spouseHi.value = person.spouse_hi || '';
  els.spouseBirth.value = person.spouse_birth_year != null ? person.spouse_birth_year : '';
  els.spouseDeath.value = person.spouse_death_year != null ? person.spouse_death_year : '';
  els.notes.value = person.notes || '';
  const genderRadio = els.form.querySelector(`[name="gender"][value="${person.gender || 'M'}"]`);
  if (genderRadio) genderRadio.checked = true;
  const spouseGenderRadio = person.spouse_gender
    ? els.form.querySelector(`[name="spouse_gender"][value="${person.spouse_gender}"]`)
    : null;
  if (spouseGenderRadio) spouseGenderRadio.checked = true;
  // A person is "married" if they have a spouse name recorded.
  setMarried(els, !!(person.spouse_en || person.spouse_hi));
  // "Deceased" if flagged, or a death year exists (back-compat with old data).
  setDeceased(els, !!(person.deceased || person.death_year != null));
  setSpouseDeceased(els, !!(person.spouse_deceased || person.spouse_death_year != null));
}

function resetForm(els) {
  els.form.reset();
  clearError(els.error);
  setMarried(els, false);
  setDeceased(els, false);
  setSpouseDeceased(els, false);
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
      const person = await api.createPerson({ ...data, tree_id: window.__state.tree.id });
      const newPersons = [...window.__state.persons, person];
      let newRelationships = window.__state.relationships;

      if (selectedParent) {
        const relationship = await api.createRelationship(selectedParent, person.id);
        newRelationships = [...newRelationships, relationship];
      }

      setState({ persons: newPersons, relationships: newRelationships });
    } else {
      const person = await api.updatePerson(sidebarPersonId, data);
      let newRelationships = window.__state.relationships;

      // Re-parent if the parent selection changed.
      const selectedParent = (els.parent && els.parent.value) || null;
      if (selectedParent !== (sidebarOrigParentId || null)) {
        const oldRel = newRelationships.find(r => r.child_id === sidebarPersonId);
        if (oldRel) {
          await api.deleteRelationship(oldRel.id);
          newRelationships = newRelationships.filter(r => r.id !== oldRel.id);
        }
        if (selectedParent) {
          const rel = await api.createRelationship(selectedParent, sidebarPersonId);
          newRelationships = [...newRelationships, rel];
        }
      }

      const newPersons = window.__state.persons.map(p => p.id === person.id ? person : p);
      setState({ persons: newPersons, relationships: newRelationships });
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
    await api.deletePerson(sidebarPersonId);
    const deletedId = sidebarPersonId;
    const newPersons = window.__state.persons.filter(p => p.id !== deletedId);
    const newRelationships = window.__state.relationships.filter(
      r => r.parent_id !== deletedId && r.child_id !== deletedId
    );
    closeSidebar();
    setState({ persons: newPersons, relationships: newRelationships });
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
  els.btnDelete && els.btnDelete.addEventListener('click', handleDelete);
  els.married && els.married.addEventListener('change', () => setMarried(els, els.married.checked));
  els.deceased && els.deceased.addEventListener('change', () => setDeceased(els, els.deceased.checked));
  els.spouseDeceased && els.spouseDeceased.addEventListener('change', () => setSpouseDeceased(els, els.spouseDeceased.checked));

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
