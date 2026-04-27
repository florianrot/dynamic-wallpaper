// AppShell — Keyboard + Command Palette

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.querySelector(".cmd-overlay.open")) { closeCmdPalette(); return; }
      if (document.querySelector(".shortcuts-overlay.open")) { closeShortcuts(); return; }
      if (document.querySelector(".settings-overlay.open")) { closeSettings(); return; }
      if (document.querySelector(".support-overlay.open") && typeof closeSupport === "function") { closeSupport(); return; }
      closeAllPopups();
      return;
    }

    if (e.ctrlKey && e.key === "b") { e.preventDefault(); cycleSidebarMode(); return; }
    if (e.ctrlKey && e.key === ",") {
      e.preventDefault();
      const overlay = document.querySelector(".settings-overlay");
      overlay.classList.contains("open") ? closeSettings() : openSettings("account");
      return;
    }
    if (e.ctrlKey && e.key === "k") { e.preventDefault(); toggleCmdPalette(); return; }
    if (e.ctrlKey && e.key === "/") { e.preventDefault(); toggleShortcuts(); return; }
    if (e.key === "?" && !e.ctrlKey && !isInputFocused()) { e.preventDefault(); toggleShortcuts(); return; }

    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isInputFocused()) {
      const items = [...document.querySelectorAll(".nav-item[data-page]")];
      const activeIdx = items.findIndex((i) => i.classList.contains("active"));
      if (activeIdx === -1) return;
      const next = e.key === "ArrowDown"
        ? Math.min(activeIdx + 1, items.length - 1)
        : Math.max(activeIdx - 1, 0);
      items[next].click();
      items[next].focus();
      e.preventDefault();
    }
  });
}

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// ── Shortcuts Overlay ──

function toggleShortcuts() {
  document.querySelector(".shortcuts-overlay").classList.toggle("open");
}
function closeShortcuts() {
  document.querySelector(".shortcuts-overlay").classList.remove("open");
}

// ── Command Palette ──

let cmdActiveIdx = 0;
let cmdResults = [];
let cmdAiResult = null;
let cmdAiLoading = false;

function toggleCmdPalette() {
  const overlay = document.querySelector(".cmd-overlay");
  overlay.classList.contains("open") ? closeCmdPalette() : openCmdPalette();
}

function openCmdPalette() {
  const overlay = document.querySelector(".cmd-overlay");
  overlay.classList.add("open");
  const input = overlay.querySelector(".cmd-palette__input");
  input.value = "";
  cmdAiResult = null;
  cmdAiLoading = false;
  cmdResults = commandRegistry.search("");
  cmdActiveIdx = 0;
  renderCmdResults();
  setTimeout(() => input.focus(), 50);
}

function closeCmdPalette() {
  document.querySelector(".cmd-overlay").classList.remove("open");
}

function onCmdInput(e) {
  const q = e.target.value.trim();
  cmdResults = commandRegistry.search(q);
  cmdActiveIdx = 0;
  cmdAiResult = null;
  cmdAiLoading = false;
  renderCmdResults();

  cmdAiResult = null;
  cmdAiLoading = false;
}

function onCmdKeydown(e) {
  const totalItems = cmdResults.length + (cmdAiResult ? 1 : 0);
  if (totalItems === 0) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    cmdActiveIdx = Math.min(cmdActiveIdx + 1, totalItems - 1);
    renderCmdResults();
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    cmdActiveIdx = Math.max(cmdActiveIdx - 1, 0);
    renderCmdResults();
  }
  if (e.key === "Enter") {
    e.preventDefault();
    if (cmdActiveIdx < cmdResults.length) {
      executeCmdItem(cmdResults[cmdActiveIdx]);
    } else if (cmdAiResult) {
      executeCmdItem(cmdAiResult);
    }
  }
}

function executeCmdItem(result) {
  const item = result.item;
  if (item && item.handler) {
    commandRegistry.recordUse(item.id);
    item.handler();
  }
  closeCmdPalette();
}

function renderCmdResults() {
  const list = document.querySelector(".cmd-palette__list");
  if (!list) return;

  if (cmdResults.length === 0 && !cmdAiLoading && !cmdAiResult) {
    const input = document.querySelector(".cmd-palette__input");
    if (input && input.value.trim()) {
      list.innerHTML = `<div class="cmd-palette__empty">${t("cmd.no_results")}</div>`;
    } else {
      list.innerHTML = `<div class="cmd-palette__empty">${t("cmd.start_typing")}</div>`;
    }
    return;
  }

  let html = "";
  let lastSection = "";
  let idx = 0;

  for (const result of cmdResults) {
    const section = result.section || result.item.group;
    if (section !== lastSection) {
      html += `<div class="cmd-palette__section">${section}</div>`;
      lastSection = section;
    }
    html += renderCmdItem(result.item, idx === cmdActiveIdx, idx);
    idx++;
  }

  if (cmdAiLoading) {
    html += '<div class="cmd-palette__ai-separator">AI</div>';
    html += `<div class="cmd-palette__ai-loading"><div class="shimmer"><span></span><span></span><span></span></div> ${t("cmd.searching")}</div>`;
  }

  if (cmdAiResult) {
    html += '<div class="cmd-palette__ai-separator">AI</div>';
    html += `<div class="cmd-palette__ai-result">${renderCmdItem(cmdAiResult.item, idx === cmdActiveIdx, idx)}</div>`;
  }

  list.innerHTML = html;

  const active = list.querySelector(".cmd-palette__item.active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function renderCmdItem(item, isActive, idx) {
  const icon = item.icon
    ? `<span class="cmd-palette__item-icon">${item.icon}</span>`
    : "";
  const shortcut = item.shortcut
    ? `<span class="cmd-palette__item-shortcut">${item.shortcut}</span>`
    : "";
  return `<div class="cmd-palette__item${isActive ? " active" : ""}" data-idx="${idx}" onclick="cmdItemClick(${idx})" onmouseenter="cmdItemHover(${idx})">${icon}<span class="cmd-palette__item-label">${item.title}</span>${shortcut}</div>`;
}

function cmdItemClick(idx) {
  if (idx < cmdResults.length) {
    executeCmdItem(cmdResults[idx]);
  } else if (cmdAiResult) {
    executeCmdItem(cmdAiResult);
  }
}

function cmdItemHover(idx) {
  if (idx !== cmdActiveIdx) {
    cmdActiveIdx = idx;
    renderCmdResults();
  }
}
