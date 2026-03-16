export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderChipGroup(container, items, selectedValue, onSelect) {
  container.innerHTML = '';
  items.forEach((item) => {
    const value = typeof item === 'string' ? item : item.key;
    const label = typeof item === 'string' ? item : item.label;
    const btn = document.createElement('button');
    btn.className = `chip ${value === selectedValue ? 'active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => onSelect(value));
    container.appendChild(btn);
  });
}

export function setStatus(node, kind, message) {
  node.className = `status ${kind}`;
  node.textContent = message;
}

export function showToast(node, message, kind = 'info') {
  node.className = `toast ${kind} show`;
  node.textContent = message;
  setTimeout(() => node.classList.remove('show'), 2200);
}

export function renderModels(listNode, models, selected, onPick) {
  listNode.innerHTML = '';
  models.forEach((name) => {
    const li = document.createElement('li');
    li.innerHTML = `<button class="model-item ${name === selected ? 'active' : ''}">${escapeHtml(name)}</button>`;
    li.querySelector('button').addEventListener('click', () => onPick(name));
    listNode.appendChild(li);
  });
}

export function renderHistory(listNode, history, onOpen, onDelete, onToggleFav) {
  listNode.innerHTML = '';
  if (!history.length) {
    listNode.innerHTML = '<div class="meta">Aucun élément.</div>';
    return;
  }

  history.forEach((item) => {
    const d = new Date(item.at);
    const stamp = Number.isNaN(d.getTime()) ? item.at : d.toLocaleString();
    const row = document.createElement('article');
    row.className = 'history-item';
    row.innerHTML = `
      <div class="history-head">
        <strong>${escapeHtml(item.mode)}</strong>
        <span>${escapeHtml(stamp)}</span>
      </div>
      <p>${escapeHtml(item.preview)}</p>
      <div class="row wrap">
        <button class="btn btn-tiny js-open">Ouvrir</button>
        <button class="btn btn-tiny js-fav">${item.favorite ? '★ Favori' : '☆ Favori'}</button>
        <button class="btn btn-tiny js-delete">Supprimer</button>
      </div>
    `;
    row.querySelector('.js-open').addEventListener('click', () => onOpen(item.id));
    row.querySelector('.js-delete').addEventListener('click', () => onDelete(item.id));
    row.querySelector('.js-fav').addEventListener('click', () => onToggleFav(item.id));
    listNode.appendChild(row);
  });
}
