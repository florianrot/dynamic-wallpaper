// Dynamic Wallpaper — Main Orchestrator
// Modules loaded via <script> tags before this file

document.addEventListener("DOMContentLoaded", async () => {
  await waitForBridge();
  config = await api.get_config();
  await initI18n(config.locale || "system");
  const info = await api.get_app_info();
  const user = await api.get_user();

  initTheme(config.theme);
  initSidebar(config.sidebar_mode || "full", config.sidebar_width);
  initProfile(user);
  initNavigation();
  initCommandRegistry();
  initKeyboard();
  initWindowResize();
  initGlobalClickHandlers();
  initTooltips();

  await initLibrary();
  await initSchedule();

  navigateTo("library", false);
});

function waitForBridge() {
  return new Promise((resolve) => {
    if (window.pywebview && window.pywebview.api) return resolve();
    window.addEventListener("pywebviewready", resolve);
  });
}
