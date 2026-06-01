let state = Object.freeze({
  tree: null,
  persons: [],
  relationships: [],
  lang: 'en',
});

function setState(partial) {
  state = Object.freeze({ ...state, ...partial });
  window.__state = state;
  if (typeof renderTree === 'function') renderTree(state);
  return state;
}

async function init() {
  try {
    const data = await api.getTree();
    setState({
      tree: data.tree,
      persons: data.persons,
      relationships: data.relationships,
    });
    if (data.persons.length === 0) {
      showEmptyHint();
    } else {
      hideEmptyHint();
      console.log(`Tree loaded: ${data.persons.length} persons`);
    }
  } catch (err) {
    console.error('Failed to load tree:', err.message);
    showEmptyHint();
  }

  wireLangToggle();
  wireTitleEdit();
  wireExportDialog();
}

function showEmptyHint() {
  const hint = document.getElementById('empty-hint');
  if (hint) hint.style.display = '';
}

function hideEmptyHint() {
  const hint = document.getElementById('empty-hint');
  if (hint) hint.style.display = 'none';
}

function wireLangToggle() {
  const btn = document.getElementById('btn-lang');
  const label = document.getElementById('lang-label');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const newLang = state.lang === 'en' ? 'hi' : 'en';
    setState({ lang: newLang });
    if (label) label.textContent = newLang.toUpperCase();
  });
}

function wireTitleEdit() {
  const titleEl = document.getElementById('tree-title');
  if (!titleEl) return;
  titleEl.addEventListener('blur', async () => {
    const newTitle = titleEl.textContent.trim();
    if (!newTitle || !state.tree || newTitle === state.tree.title_en) return;
    try {
      const { tree } = await api.patchTree({ title_en: newTitle });
      setState({ tree });
    } catch (err) {
      console.error('Failed to update title:', err.message);
      titleEl.textContent = state.tree ? state.tree.title_en : 'वंशावली';
    }
  });
  titleEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
    if (e.key === 'Escape') {
      titleEl.textContent = state.tree ? state.tree.title_en : 'वंशावली';
      titleEl.blur();
    }
  });
}

function wireExportDialog() {
  const exportBtn = document.getElementById('btn-export');
  const dialog = document.getElementById('export-dialog');
  const cancelBtn = document.getElementById('btn-export-cancel');
  const confirmBtn = document.getElementById('btn-export-confirm');
  if (!exportBtn || !dialog) return;

  exportBtn.addEventListener('click', () => dialog.showModal());
  cancelBtn && cancelBtn.addEventListener('click', () => dialog.close());
  confirmBtn && confirmBtn.addEventListener('click', () => {
    const form = document.getElementById('export-form');
    const format = form.querySelector('[name="format"]:checked')?.value || 'png';
    const lang = form.querySelector('[name="lang"]:checked')?.value || 'en';
    dialog.close();
    if (typeof doExport === 'function') doExport({ format, lang });
  });
}

window.__state = state;
document.addEventListener('DOMContentLoaded', init);
