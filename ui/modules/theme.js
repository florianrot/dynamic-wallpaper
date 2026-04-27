// AppShell — Theme

function initTheme(pref) {
  applyTheme(pref);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (config.theme === "auto") applyTheme("auto");
  });
}

function applyTheme(pref) {
  let theme = pref;
  if (pref === "auto") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  const html = document.documentElement;
  html.setAttribute("data-theme-transition", "");
  html.setAttribute("data-theme", theme);
  requestAnimationFrame(() => {
    setTimeout(() => html.removeAttribute("data-theme-transition"), 300);
  });
}

async function setTheme(pref) {
  config.theme = pref;
  applyTheme(pref);
  await api.save_config({ theme: pref });
}
