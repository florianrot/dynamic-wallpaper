// Dynamic Wallpaper — Settings UI
function api() { return window.pywebview && window.pywebview.api; }

const folderPathEl = document.getElementById("folder_path");
const folderInfoEl = document.getElementById("folder_info");
const folderPreview = document.getElementById("folder_preview");
const btnBrowse = document.getElementById("btn_browse");
const scheduleList = document.getElementById("schedule_list");
const btnAdd = document.getElementById("btn_add");
const lockscreenToggle = document.getElementById("lockscreen_toggle");
const autostartToggle = document.getElementById("autostart_toggle");
const trayToggle = document.getElementById("tray_toggle");
const themeToggle = document.getElementById("theme_toggle");
const errorEl = document.getElementById("error");

let schedule = [];
let thumbnails = [];
let saveTimeout = null;

// Natural sort: "1.png" before "2.png" before "10.png"
function natSort(a, b) {
  return a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: "base" });
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = "block";
}

function clearError() {
  errorEl.style.display = "none";
}

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveAll(), 400);
}

async function saveAll() {
  try {
    const theme = themeToggle.checked ? "light" : "dark";
    const resp = await api().save_config({
      schedule: schedule,
      lockscreen: lockscreenToggle.checked,
      autostart: autostartToggle.checked,
      theme: theme,
      show_tray: trayToggle.checked,
    });
    if (resp && resp.ok) clearError();
    else showError("Save failed: " + (resp && resp.error || "unknown"));
  } catch (e) {
    showError("Error: " + e.message);
  }
}

function getThumbUrl(filename) {
  const t = thumbnails.find(th => th.file === filename);
  return t ? t.data_url : "";
}

function closeAllDropdowns() {
  document.querySelectorAll(".img-picker__dropdown.open").forEach(d => {
    d.classList.remove("open");
  });
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".img-picker")) {
    closeAllDropdowns();
  }
});

function renderFolderPreview() {
  folderPreview.innerHTML = "";
  if (thumbnails.length === 0) {
    folderPreview.style.display = "none";
    return;
  }
  folderPreview.style.display = "";
  const sorted = thumbnails.slice().sort(natSort);
  for (const thumb of sorted) {
    if (!thumb.data_url) continue;
    const item = document.createElement("div");
    item.className = "folder-thumb";
    const img = document.createElement("img");
    img.src = thumb.data_url;
    img.alt = thumb.file;
    item.appendChild(img);
    const label = document.createElement("span");
    label.textContent = thumb.file;
    item.appendChild(label);
    folderPreview.appendChild(item);
  }
}

function renderSchedule() {
  const sorted = schedule.slice().sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
  scheduleList.innerHTML = "";
  const thumbsSorted = thumbnails.slice().sort(natSort);

  for (const entry of sorted) {
    const row = document.createElement("div");
    row.className = "schedule-row";

    // Time input
    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.value = entry.time;
    timeInput.addEventListener("change", () => {
      entry.time = timeInput.value;
      debouncedSave();
    });

    // Image picker
    const picker = document.createElement("div");
    picker.className = "img-picker";

    const selected = document.createElement("div");
    selected.className = "img-picker__selected";

    const thumbUrl = getThumbUrl(entry.file);
    if (thumbUrl && entry.file) {
      const img = document.createElement("img");
      img.className = "img-picker__thumb";
      img.src = thumbUrl;
      selected.appendChild(img);
      const name = document.createElement("span");
      name.className = "img-picker__name";
      name.textContent = entry.file;
      selected.appendChild(name);
    } else {
      const ph = document.createElement("span");
      ph.className = entry.file ? "img-picker__name" : "img-picker__placeholder";
      ph.textContent = entry.file || "Select image...";
      selected.appendChild(ph);
    }

    const dropdown = document.createElement("div");
    dropdown.className = "img-picker__dropdown";

    for (const thumb of thumbsSorted) {
      const opt = document.createElement("div");
      opt.className = "img-picker__option" + (thumb.file === entry.file ? " selected" : "");

      if (thumb.data_url) {
        const img = document.createElement("img");
        img.src = thumb.data_url;
        opt.appendChild(img);
      }
      const label = document.createElement("span");
      label.textContent = thumb.file;
      opt.appendChild(label);

      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        entry.file = thumb.file;
        closeAllDropdowns();
        renderSchedule();
        debouncedSave();
      });

      dropdown.appendChild(opt);
    }

    selected.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllDropdowns();
      dropdown.classList.toggle("open");
    });

    picker.appendChild(selected);
    picker.appendChild(dropdown);

    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn--sm btn--danger";
    delBtn.textContent = "×";
    delBtn.addEventListener("click", () => {
      const idx = schedule.indexOf(entry);
      if (idx >= 0) schedule.splice(idx, 1);
      renderSchedule();
      debouncedSave();
    });

    row.appendChild(timeInput);
    row.appendChild(picker);
    row.appendChild(delBtn);
    scheduleList.appendChild(row);
  }
}

async function loadThumbnails() {
  try {
    const resp = await api().get_thumbnails();
    if (resp && resp.ok) {
      thumbnails = resp.thumbnails || [];
    }
  } catch {
    thumbnails = [];
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  themeToggle.checked = theme === "light";
}

async function load() {
  try {
    const resp = await api().get_config();
    if (!resp || !resp.ok) {
      showError("Failed to load: " + (resp && resp.error || "unknown"));
      return;
    }
    clearError();

    // Theme
    applyTheme(resp.theme || "dark");

    // Folder
    if (resp.folder) {
      folderPathEl.textContent = resp.folder;
      const images = resp.images || [];
      folderInfoEl.textContent = images.length > 0
        ? `${images.length} images found`
        : "No images found in this folder.";
    } else {
      folderPathEl.textContent = "No folder selected";
      folderInfoEl.textContent = "";
    }

    // Schedule
    schedule = (resp.schedule || []).map(s => ({ ...s }));
    lockscreenToggle.checked = !!resp.lockscreen;
    autostartToggle.checked = !!resp.autostart;
    trayToggle.checked = resp.show_tray !== false;

    await loadThumbnails();
    renderFolderPreview();
    renderSchedule();
  } catch (e) {
    showError("Load error: " + e.message);
  }
}

btnBrowse.addEventListener("click", async () => {
  try {
    const resp = await api().browse_folder();
    if (!resp || !resp.ok) return;
    folderPathEl.textContent = resp.folder;
    const images = resp.images || [];
    folderInfoEl.textContent = images.length > 0
      ? `${images.length} images found`
      : "No images found.";
    await api().save_config({ folder: resp.folder });
    await loadThumbnails();
    renderFolderPreview();
    renderSchedule();
    clearError();
  } catch (e) {
    showError("Browse failed: " + e.message);
  }
});

btnAdd.addEventListener("click", () => {
  schedule.push({ file: "", time: "12:00" });
  renderSchedule();
  debouncedSave();
});

lockscreenToggle.addEventListener("change", debouncedSave);
autostartToggle.addEventListener("change", debouncedSave);
trayToggle.addEventListener("change", debouncedSave);

themeToggle.addEventListener("change", () => {
  const theme = themeToggle.checked ? "light" : "dark";
  applyTheme(theme);
  debouncedSave();
});

function onReady() {
  let tries = 0;
  const check = () => {
    if (api()) {
      load();
      return;
    }
    if (tries++ < 40) {
      setTimeout(check, 100);
    } else {
      showError("pywebview bridge not available.");
    }
  };
  check();
}

// Footer link: open in external browser
document.getElementById("footer_link").addEventListener("click", (e) => {
  e.preventDefault();
  try {
    api().open_url("https://florianrothenbuehler.com");
  } catch {
    window.open("https://florianrothenbuehler.com", "_blank");
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", onReady);
} else {
  onReady();
}
