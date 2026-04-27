// AppShell — Profile

function initProfile(user) {
  document.querySelectorAll(".profile-name").forEach((el) => {
    el.textContent = user.display_name || "User";
  });
}

function positionPopup(popup, anchor) {
  const rect = anchor.getBoundingClientRect();
  popup.style.bottom = (window.innerHeight - rect.top + 8) + "px";
  popup.style.left = rect.left + "px";
}

function togglePopup(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const popup = container.querySelector(".profile-popup");
  if (!popup) return;

  const isOpen = popup.classList.contains("open");
  closeAllPopups();

  if (!isOpen) {
    const anchor = container.querySelector(".profile-btn, .profile-avatar");
    if (anchor) {
      positionPopup(popup, anchor);
      const btn = container.querySelector(".profile-btn");
      if (btn) btn.setAttribute("aria-expanded", "true");
    }
    popup.classList.add("open");
  }
}

function closeAllPopups() {
  document.querySelectorAll(".profile-popup.open").forEach((p) => p.classList.remove("open"));
  document.querySelectorAll("[aria-expanded='true']").forEach((b) => b.setAttribute("aria-expanded", "false"));
}

// ── Global Click Handlers ──

function initGlobalClickHandlers() {
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".sidebar__footer") && !e.target.closest(".profile-floating")) {
      closeAllPopups();
    }
    if (!e.target.closest(".dropdown") && !e.target.closest(".custom-select")) {
      if (typeof closeDropdownPortal === 'function') closeDropdownPortal();
      if (typeof closeCustomSelect === 'function' && activeCustomSelect) closeCustomSelect(activeCustomSelect);
    }
  });
}
