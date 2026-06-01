let sidebarMode = 'new';
let sidebarParentId = null;
let sidebarPersonId = null;

function getSidebarEls() {
  return {
    sidebar: document.getElementById('sidebar'),
    title: document.getElementById('sidebar-title'),
    form: document.getElementById('person-form'),
    nameEn: document.getElementById('f-name-en'),
    nameHi: document.getElementById('f-name-hi'),
    birth: document.getElementById('f-birth'),
    death: document.getElementById('f-death'),
    spouseEn: document.getElementById('f-spouse-en'),
    spouseHi: document.getElementById('f-spouse-hi'),
    notes: document.getElementById('f-notes'),
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

function collectForm(els) {
  const genderEl = els.form.querySelector('[name="gender"]:checked');
  return {
    name_en: els.nameEn.value.trim(),
    name_hi: els.nameHi.value.trim() || null,
    birth_year: els.birth.value ? parseInt(els.birth.value, 10) : null,
    death_year: els.death.value ? parseInt(els.death.value, 10) : null,
    spouse_en: els.spouseEn.value.trim() || null,
    spouse_hi: els.spouseHi.value.trim() || null,
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
  els.notes.value = person.notes || '';
  const genderRadio = els.form.querySelector(`[name="gender"][value="${person.gender || 'M'}"]`);
  if (genderRadio) genderRadio.checked = true;
}

function resetForm(els) {
  els.form.reset();
  clearError(els.error);
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
}

function openNew(parentId) {
  const els = getSidebarEls();
  if (!els.sidebar) return;

  if (parentId === null || parentId === undefined) {
    const state = window.__state;
    if (state && state.persons && state.persons.length > 0) {
      showError(els.error, 'Tree already has a root. Use "Add Child" on an existing node.');
      openSidebar(els);
      els.btnDelete.hidden = true;
      els.title.textContent = 'Add Person';
      resetForm(els);
      return;
    }
  }

  sidebarMode = 'new';
  sidebarParentId = parentId || null;
  sidebarPersonId = null;

  resetForm(els);
  els.title.textContent = parentId ? 'Add Child' : 'Add Root Person';
  els.btnDelete.hidden = true;
  openSidebar(els);
}

function openEdit(personId) {
  const els = getSidebarEls();
  if (!els.sidebar) return;

  const state = window.__state;
  const person = state && state.persons.find(p => p.id === personId);
  if (!person) return;

  sidebarMode = 'edit';
  sidebarParentId = null;
  sidebarPersonId = personId;

  resetForm(els);
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

  els.btnSave.disabled = true;
  try {
    if (sidebarMode === 'new') {
      const person = await api.createPerson({ ...data, tree_id: window.__state.tree.id });
      const newPersons = [...window.__state.persons, person];
      let newRelationships = window.__state.relationships;

      if (sidebarParentId) {
        const relationship = await api.createRelationship(sidebarParentId, person.id);
        newRelationships = [...newRelationships, relationship];
      }

      setState({ persons: newPersons, relationships: newRelationships });
    } else {
      const person = await api.updatePerson(sidebarPersonId, data);
      const newPersons = window.__state.persons.map(p => p.id === person.id ? person : p);
      setState({ persons: newPersons });
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
