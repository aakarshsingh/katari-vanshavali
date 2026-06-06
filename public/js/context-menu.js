let ctxNodeId = null;

function showCtxMenu(e, nodeId) {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;
  ctxNodeId = nodeId;
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
  menu.hidden = false;
  menu.removeAttribute('hidden');
  menu.style.display = 'block';
}

function hideCtxMenu() {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;
  menu.style.display = 'none';
  ctxNodeId = null;
}

async function ctxDeletePerson(nodeId) {
  if (!nodeId) return;
  if (!confirm('Delete this person? This cannot be undone.')) return;
  try {
    const result = await mutate.deletePerson(nodeId);
    if (!result.pending) {
      setState({ persons: result.persons, relationships: result.relationships });
    }
  } catch (err) {
    alert('Delete failed: ' + (err.message || 'Unknown error'));
  }
}

function initCtxMenu() {
  const menu = document.getElementById('ctx-menu');
  if (!menu) return;

  const btnAddChild = document.getElementById('ctx-add-child');
  const btnEdit = document.getElementById('ctx-edit');
  const btnDelete = document.getElementById('ctx-delete');

  btnAddChild && btnAddChild.addEventListener('click', () => {
    const id = ctxNodeId;
    hideCtxMenu();
    if (typeof openNew === 'function') openNew(id);
  });

  btnEdit && btnEdit.addEventListener('click', () => {
    const id = ctxNodeId;
    hideCtxMenu();
    if (typeof openEdit === 'function') openEdit(id);
  });

  btnDelete && btnDelete.addEventListener('click', () => {
    const id = ctxNodeId;
    hideCtxMenu();
    ctxDeletePerson(id);
  });

  // Hide on click outside
  document.addEventListener('click', (e) => {
    if (menu.style.display === 'block' && !menu.contains(e.target)) {
      hideCtxMenu();
    }
  });

  // Hide on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideCtxMenu();
  });

}

window.showCtxMenu = showCtxMenu;
window.hideCtxMenu = hideCtxMenu;
document.addEventListener('DOMContentLoaded', initCtxMenu);
