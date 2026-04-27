// AppShell — Sidebar

const SIDEBAR_FULL_DEFAULT = 240;
const SIDEBAR_ICONS_W = 52;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 400;
const SIDEBAR_SNAP_ICONS = 140;
const SIDEBAR_SNAP_HIDDEN = 40;
const AUTO_COLLAPSE_ICONS = 600;
const AUTO_COLLAPSE_HIDDEN = 400;

const MODES = ["full", "icons", "hidden"];

let sidebarDragging = false;
let sidebarStartX = 0;
let sidebarStartW = 0;
let sidebarDragW = 0;

function initSidebar(mode, width) {
  const sidebar = document.querySelector(".sidebar");
  const app = document.querySelector(".app");

  sidebar.setAttribute("data-mode", mode);
  app.setAttribute("data-sidebar", mode);

  if (mode === "full" && width) {
    sidebar.style.setProperty("--sidebar-w", width + "px");
  }

  initSidebarResize();
}

function setSidebarMode(mode) {
  const sidebar = document.querySelector(".sidebar");
  const app = document.querySelector(".app");

  sidebar.setAttribute("data-mode", mode);
  app.setAttribute("data-sidebar", mode);

  if (mode === "full") {
    const w = config.sidebar_width || SIDEBAR_FULL_DEFAULT;
    sidebar.style.setProperty("--sidebar-w", w + "px");
  }

  config.sidebar_mode = mode;
  api.save_config({ sidebar_mode: mode });
}

function setSidebarVisual(mode, width) {
  const sidebar = document.querySelector(".sidebar");
  const app = document.querySelector(".app");
  sidebar.setAttribute("data-mode", mode);
  app.setAttribute("data-sidebar", mode);
  if (mode === "full" && width) {
    sidebar.style.setProperty("--sidebar-w", width + "px");
  }
}

function getEnabledModes() {
  const enabled = config.sidebar_modes_enabled || ["full", "icons", "hidden"];
  return MODES.filter(m => enabled.includes(m));
}

function cycleSidebarMode() {
  const enabled = getEnabledModes();
  if (enabled.length <= 1) return;
  const current = config.sidebar_mode || "full";
  const idx = enabled.indexOf(current);
  const next = enabled[(idx + 1) % enabled.length];
  setSidebarMode(next);
}

function initSidebarResize() {
  const handle = document.querySelector(".sidebar__resize");
  if (!handle) return;

  const tooltip = handle.querySelector(".sidebar__resize-tooltip");
  if (tooltip) {
    handle.addEventListener("mousemove", (e) => {
      const sidebar = document.querySelector(".sidebar");
      const sidebarRect = sidebar.getBoundingClientRect();
      tooltip.style.left = (sidebarRect.right + 12) + "px";
      tooltip.style.top = e.clientY + "px";
      tooltip.style.transform = "translateY(-50%)";
    });
  }

  handle.addEventListener("mousedown", (e) => {
    if (config.sidebar_mode === "hidden") return;
    e.preventDefault();
    sidebarDragging = true;
    sidebarStartX = e.clientX;
    sidebarStartW = document.querySelector(".sidebar").offsetWidth;
    sidebarDragW = sidebarStartW;
    handle.classList.add("dragging");
    document.querySelector(".sidebar").classList.add("dragging-active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!sidebarDragging) return;
    sidebarDragW = sidebarStartW + (e.clientX - sidebarStartX);

    if (sidebarDragW < SIDEBAR_SNAP_HIDDEN) {
      setSidebarVisual("hidden");
    } else if (sidebarDragW < SIDEBAR_SNAP_ICONS) {
      setSidebarVisual("icons");
    } else {
      const w = Math.min(Math.max(sidebarDragW, SIDEBAR_MIN), SIDEBAR_MAX);
      setSidebarVisual("full", w);
    }
  });

  document.addEventListener("mouseup", () => {
    if (!sidebarDragging) return;

    if (sidebarDragW < SIDEBAR_SNAP_HIDDEN) {
      setSidebarMode("hidden");
    } else if (sidebarDragW < SIDEBAR_SNAP_ICONS) {
      setSidebarMode("icons");
    } else {
      const w = Math.min(Math.max(sidebarDragW, SIDEBAR_MIN), SIDEBAR_MAX);
      config.sidebar_mode = "full";
      config.sidebar_width = w;
      document.querySelector(".sidebar").style.setProperty("--sidebar-w", w + "px");
      api.save_config({ sidebar_mode: "full", sidebar_width: w });
    }
    endDrag();
  });

  function endDrag() {
    sidebarDragging = false;
    handle.classList.remove("dragging");
    document.querySelector(".sidebar").classList.remove("dragging-active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
}

// ── Responsive auto-collapse ──

function initWindowResize() {
  let manualMode = config.sidebar_mode;
  let autoCollapsed = false;

  const check = () => {
    const w = window.innerWidth;
    if (manualMode === "hidden") return;

    if (w < AUTO_COLLAPSE_HIDDEN && !autoCollapsed) {
      autoCollapsed = true;
      setSidebarVisual("hidden");
    } else if (w < AUTO_COLLAPSE_ICONS && w >= AUTO_COLLAPSE_HIDDEN && !autoCollapsed) {
      autoCollapsed = true;
      setSidebarVisual("icons");
    } else if (w >= AUTO_COLLAPSE_ICONS && autoCollapsed) {
      autoCollapsed = false;
      setSidebarVisual(manualMode, config.sidebar_width || SIDEBAR_FULL_DEFAULT);
    }
  };

  window.addEventListener("resize", check);
}
