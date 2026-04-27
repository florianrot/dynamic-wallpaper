// AppShell — Context Menu

let activeContextMenu = null;

function showContextMenu(e, items) {
  e.preventDefault();
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = items.map(item => {
    if (item.separator) return '<div class="context-menu__separator"></div>';
    const iconHtml = item.icon ? `<span class="context-menu__item__icon">${item.icon}</span>` : '';
    const shortcutHtml = item.shortcut ? `<span class="context-menu__item__shortcut">${item.shortcut}</span>` : '';
    const dangerClass = item.danger ? ' context-menu__item--danger' : '';
    return `<button class="context-menu__item${dangerClass}">${iconHtml}${item.label}${shortcutHtml}</button>`;
  }).join('');

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  let x = e.clientX;
  let y = e.clientY;
  if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
  if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  requestAnimationFrame(() => menu.classList.add('visible'));
  activeContextMenu = menu;

  menu.querySelectorAll('.context-menu__item').forEach((btn, i) => {
    const item = items.filter(it => !it.separator)[i];
    if (item?.action) btn.addEventListener('click', () => { item.action(); closeContextMenu(); });
  });

  setTimeout(() => {
    document.addEventListener('click', closeContextMenu);
    document.addEventListener('contextmenu', closeContextMenu);
  }, 10);
}

function closeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.classList.remove('visible');
    const el = activeContextMenu;
    activeContextMenu = null;
    setTimeout(() => el.remove(), 120);
  }
  document.removeEventListener('click', closeContextMenu);
  document.removeEventListener('contextmenu', closeContextMenu);
}
