// AppShell — Settings

function openSettings(section) {
  const overlay = document.querySelector(".settings-overlay");
  overlay.classList.add("open");
  closeAllPopups();
  if (section) activateSettingsSection(section);
  loadSettingsValues();
}

function closeSettings() {
  document.querySelector(".settings-overlay").classList.remove("open");
}

function activateSettingsSection(id) {
  document.querySelectorAll(".settings-nav-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.section === id);
  });
  document.querySelectorAll(".settings-section").forEach((s) => {
    s.classList.toggle("active", s.dataset.section === id);
  });
}

function loadSettingsValues() {
  const themeRadios = document.querySelectorAll('input[name="settings-theme"]');
  themeRadios.forEach((r) => { r.checked = r.value === config.theme; });

  const sidebarRadios = document.querySelectorAll('input[name="settings-sidebar"]');
  sidebarRadios.forEach((r) => { r.checked = r.value === config.sidebar_mode; });

  const langRadios = document.querySelectorAll('input[name="settings-language"]');
  langRadios.forEach((r) => { r.checked = r.value === (config.locale || "system"); });

  setChecked("settings_autostart", config.start_with_windows);
  setChecked("settings_autostart_visible", config.autostart_visible);
  setChecked("settings_close_tray", config.close_to_tray);
  setChecked("settings_tray_icon", config.show_tray_icon);


  const enabled = config.sidebar_modes_enabled || ["full", "icons", "hidden"];
  setChecked("mode_full_enabled", enabled.includes("full"));
  setChecked("mode_icons_enabled", enabled.includes("icons"));
  setChecked("mode_hidden_enabled", enabled.includes("hidden"));
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function updateSubToggle(parentId, childId) {
  const parent = document.getElementById(parentId);
  const child = document.getElementById(childId);
  if (!parent || !child) return;
  const sub = child.closest(".toggle-sub") || child.closest("label.toggle");
  if (sub) sub.style.display = parent.checked ? "" : "none";
}

async function onSettingToggle(key, el) {
  config[key] = el.checked;
  await api.save_config({ [key]: el.checked });

  if (key === "start_with_windows") {
    await api.set_autostart(el.checked);
    config.start_with_windows = el.checked;
    showToast(el.checked ? t("toast.autostart_enabled") : t("toast.autostart_disabled"), "success");
  } else if (key === "autostart_visible") {
    await api.set_autostart_visible(el.checked);
    config.autostart_visible = el.checked;
    showToast(t("toast.saved"), "success");
  } else if (key === "show_tray_icon") {
    await api.toggle_tray_icon(el.checked);
    showToast(t("toast.saved"), "success");
  } else {
    showToast(t("toast.saved"), "success");
  }
}

async function onThemeChange(val) {
  await setTheme(val);
  config.theme = val;
  showToast(t("toast.saved"), "success");
}

async function onSidebarModeChange(val) {
  setSidebarMode(val);
  showToast(t("toast.saved"), "success");
}

async function onLanguageChange(val) {
  await setLocale(val);
}

async function onSidebarModeEnabled(mode, el) {
  let enabled = config.sidebar_modes_enabled || ["full", "icons", "hidden"];
  if (el.checked) {
    if (!enabled.includes(mode)) enabled.push(mode);
  } else {
    enabled = enabled.filter(m => m !== mode);
    if (enabled.length === 0) {
      enabled = ["full"];
      setChecked("mode_full_enabled", true);
    }
  }
  config.sidebar_modes_enabled = enabled;
  await api.save_config({ sidebar_modes_enabled: enabled });
  showToast(t("toast.sidebar_modes"), "success");
}
