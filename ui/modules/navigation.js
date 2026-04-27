// AppShell — Navigation

function initNavigation() {
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.addEventListener("click", () => navigateTo(item.dataset.page));
  });
  updateSidebarIndicator();
}

function navigateTo(pageId, animate = true) {
  const oldPage = document.querySelector('.page.active');

  document.querySelectorAll('.nav-item[data-page]').forEach((n) => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });

  if (oldPage && animate && oldPage.dataset.page !== pageId) {
    oldPage.style.animation = 'fadeOutDown 0.15s var(--ease-fast) forwards';
    setTimeout(() => {
      oldPage.classList.remove('active');
      oldPage.style.animation = '';
      showPage(pageId);
    }, 150);
  } else {
    document.querySelectorAll('.page.active').forEach(p => p.classList.remove('active'));
    showPage(pageId);
  }

  currentPage = pageId;
  updateSidebarIndicator();
}

function showPage(pageId) {
  const page = document.querySelector(`.page[data-page="${pageId}"]`);
  if (page) {
    page.classList.add('active');
    page.style.animation = 'none';
    page.offsetHeight;
    page.style.animation = '';
  }
}

function updateSidebarIndicator() {
  const indicator = document.getElementById('sidebar_indicator');
  const activeItem = document.querySelector('.nav-item.active');
  const nav = document.querySelector('.sidebar__nav');
  if (!indicator || !activeItem || !nav) return;
  const navRect = nav.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();
  indicator.style.top = (itemRect.top - navRect.top + (itemRect.height - 18) / 2) + 'px';
}

// Window focus dimming
window.addEventListener('blur', () => {
  document.querySelector('.app')?.classList.add('window-unfocused');
});
window.addEventListener('focus', () => {
  document.querySelector('.app')?.classList.remove('window-unfocused');
});
