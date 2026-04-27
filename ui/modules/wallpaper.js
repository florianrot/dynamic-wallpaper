// Dynamic Wallpaper — Wallpaper Module (Library + Schedule)

let dwSchedule = [];
let dwThumbnails = [];
let dwSaveTimeout = null;
let dwThumbSize = 100;

function natSort(a, b) {
  return a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: "base" });
}

// ── Library ──

async function initLibrary() {
  if (config.folder) {
    document.getElementById("folder_path").textContent = config.folder;
    const images = await api.get_images();
    updateFolderCount(images.length);
  }
  dwThumbSize = config.thumb_size || 100;
  applyThumbSize();
  await loadThumbnails();
  renderThumbnailGrid();
  document.getElementById("btn_browse").addEventListener("click", onBrowseFolder);
  updateStatus();
  setInterval(updateStatus, 60000);
}

function applyThumbSize() {
  document.documentElement.style.setProperty("--dw-thumb-width", dwThumbSize + "px");
  const label = document.getElementById("thumb_size_label");
  if (label) label.textContent = dwThumbSize + "px";
}

function changeThumbSize(delta) {
  dwThumbSize = Math.max(60, Math.min(240, dwThumbSize + delta));
  applyThumbSize();
  config.thumb_size = dwThumbSize;
  api.save_config({ thumb_size: dwThumbSize });
}

async function updateStatus() {
  try {
    const status = await api.get_wallpaper_status();
    const el = document.getElementById("dw_status");
    if (!el) return;
    if (status.current_file) {
      el.innerHTML = '<span class="status-dot status-dot--online status-dot--pulse"></span>' + t("wallpaper.status.active", { file: status.current_file });
    } else {
      el.innerHTML = '<span class="status-dot status-dot--offline"></span>' + t("wallpaper.status.inactive");
    }
  } catch (e) {}
}

async function onBrowseFolder() {
  const resp = await api.browse_folder();
  if (!resp || !resp.ok) return;
  document.getElementById("folder_path").textContent = resp.folder;
  config.folder = resp.folder;
  updateFolderCount((resp.images || []).length);
  await loadThumbnails();
  renderThumbnailGrid();
  renderSchedule();
  showToast(t("toast.saved"), "success");
}

function updateFolderCount(count) {
  const el = document.getElementById("folder_count");
  if (!el) return;
  if (count > 0) {
    el.textContent = t("wallpaper.images_count", { count });
    el.style.display = "";
  } else {
    el.style.display = "none";
  }
}

async function loadThumbnails() {
  try {
    const resp = await api.get_thumbnails();
    dwThumbnails = (resp && resp.ok) ? (resp.thumbnails || []) : [];
  } catch (e) { dwThumbnails = []; }
}

function renderThumbnailGrid() {
  const grid = document.getElementById("thumbnail_grid");
  if (!grid) return;
  grid.innerHTML = "";
  const sorted = dwThumbnails.slice().sort(natSort);
  for (const thumb of sorted) {
    if (!thumb.data_url) continue;
    const item = document.createElement("div");
    item.className = "dw-thumb";
    const img = document.createElement("img");
    img.src = thumb.data_url;
    img.alt = thumb.file;
    item.appendChild(img);
    const label = document.createElement("span");
    label.textContent = thumb.file;
    item.appendChild(label);
    grid.appendChild(item);
  }
}

// ── Schedule ──

async function initSchedule() {
  dwSchedule = (config.schedule || []).map(s => ({ ...s }));
  const lockToggle = document.getElementById("lockscreen_toggle");
  if (lockToggle) {
    lockToggle.checked = config.lockscreen !== false;
    lockToggle.addEventListener("change", () => {
      config.lockscreen = lockToggle.checked;
      api.save_config({ lockscreen: lockToggle.checked });
      showToast(t("toast.saved"), "success");
    });
  }
  renderSchedule();
  document.getElementById("btn_add_slot").addEventListener("click", onAddSlot);
}

function getThumbUrl(filename) {
  const t = dwThumbnails.find(th => th.file === filename);
  return t ? t.data_url : "";
}

function closeAllDropdowns() {
  document.querySelectorAll(".img-picker__dropdown.open").forEach(d => d.classList.remove("open"));
}

function renderSchedule() {
  const listEl = document.getElementById("schedule_list");
  const emptyEl = document.getElementById("schedule_empty");
  if (!listEl) return;

  const sorted = dwSchedule.slice().sort((a, b) => a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
  listEl.innerHTML = "";
  const thumbsSorted = dwThumbnails.slice().sort(natSort);

  if (sorted.length === 0) {
    if (emptyEl) emptyEl.style.display = "";
    return;
  }
  if (emptyEl) emptyEl.style.display = "none";

  for (const entry of sorted) {
    const row = document.createElement("div");
    row.className = "dw-schedule-row";

    const timeInput = createTimePicker(entry.time, (newTime) => {
      entry.time = newTime;
      dwDebouncedSave();
    });

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
        const optImg = document.createElement("img");
        optImg.src = thumb.data_url;
        opt.appendChild(optImg);
      }
      const label = document.createElement("span");
      label.textContent = thumb.file;
      opt.appendChild(label);

      opt.addEventListener("click", (e) => {
        e.stopPropagation();
        entry.file = thumb.file;
        closeAllDropdowns();
        renderSchedule();
        dwDebouncedSave();
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

    const delBtn = document.createElement("button");
    delBtn.className = "dw-delete-btn";
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    delBtn.addEventListener("click", () => {
      row.style.transition = "opacity 0.15s ease, transform 0.15s ease";
      row.style.opacity = "0";
      row.style.transform = "translateX(8px)";
      setTimeout(() => {
        const idx = dwSchedule.indexOf(entry);
        if (idx >= 0) dwSchedule.splice(idx, 1);
        renderSchedule();
        dwDebouncedSave();
      }, 150);
    });

    row.appendChild(timeInput);
    row.appendChild(picker);
    row.appendChild(delBtn);
    listEl.appendChild(row);
  }
}

function createTimePicker(value, onChange) {
  const [h, m] = (value || "12:00").split(":").map(Number);

  const wrapper = document.createElement("div");
  wrapper.className = "time-picker";

  const display = document.createElement("div");
  display.className = "time-picker__display";

  const valSpan = document.createElement("input");
  valSpan.type = "text";
  valSpan.className = "time-picker__value";
  valSpan.value = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  valSpan.maxLength = 5;
  valSpan.addEventListener("click", (e) => e.stopPropagation());
  valSpan.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      valSpan.blur();
    }
  });
  valSpan.addEventListener("blur", () => {
    const match = valSpan.value.match(/^(\d{1,2}):?(\d{2})$/);
    if (match) {
      const hh = Math.min(23, Math.max(0, parseInt(match[1])));
      const mm = Math.min(59, Math.max(0, parseInt(match[2])));
      const newTime = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
      valSpan.value = newTime;
      onChange(newTime);
    } else {
      valSpan.value = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    }
  });

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("class", "time-picker__icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "path");
  circle.setAttribute("d", "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z");
  const hand1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  hand1.setAttribute("d", "M12 6v6l4 2");
  icon.appendChild(circle);
  icon.appendChild(hand1);

  display.appendChild(valSpan);
  display.appendChild(icon);

  const dropdown = document.createElement("div");
  dropdown.className = "time-picker__dropdown";

  const hourCol = document.createElement("div");
  hourCol.className = "time-picker__col";
  for (let i = 0; i < 24; i++) {
    const item = document.createElement("div");
    item.className = "time-picker__item" + (i === h ? " selected" : "");
    item.textContent = String(i).padStart(2, "0");
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      hourCol.querySelectorAll(".selected").forEach(s => s.classList.remove("selected"));
      item.classList.add("selected");
      const curMin = valSpan.value.split(":")[1];
      const newTime = String(i).padStart(2, "0") + ":" + curMin;
      valSpan.value = newTime;
      onChange(newTime);
    });
    hourCol.appendChild(item);
  }

  const minCol = document.createElement("div");
  minCol.className = "time-picker__col";
  for (let i = 0; i < 60; i += 5) {
    const item = document.createElement("div");
    item.className = "time-picker__item" + (i === m ? " selected" : "");
    item.textContent = String(i).padStart(2, "0");
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      minCol.querySelectorAll(".selected").forEach(s => s.classList.remove("selected"));
      item.classList.add("selected");
      const curHour = valSpan.value.split(":")[0];
      const newTime = curHour + ":" + String(i).padStart(2, "0");
      valSpan.value = newTime;
      onChange(newTime);
    });
    minCol.appendChild(item);
  }

  dropdown.appendChild(hourCol);
  dropdown.appendChild(minCol);

  display.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".time-picker__dropdown.open").forEach(d => { if (d !== dropdown) d.classList.remove("open"); });
    document.querySelectorAll(".time-picker__display.open").forEach(d => { if (d !== display) d.classList.remove("open"); });
    dropdown.classList.toggle("open");
    display.classList.toggle("open");
    if (dropdown.classList.contains("open")) {
      const sel = hourCol.querySelector(".selected");
      if (sel) sel.scrollIntoView({ block: "center" });
    }
  });

  wrapper.appendChild(display);
  wrapper.appendChild(dropdown);
  return wrapper;
}

function onAddSlot() {
  dwSchedule.push({ file: "", time: "12:00" });
  renderSchedule();
  dwDebouncedSave();
}

function dwDebouncedSave() {
  if (dwSaveTimeout) clearTimeout(dwSaveTimeout);
  dwSaveTimeout = setTimeout(() => dwSaveAll(), 400);
}

async function dwSaveAll() {
  const data = { schedule: dwSchedule };
  await api.save_config(data);
  showToast(t("toast.saved"), "success");
}

// Close dropdowns on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".img-picker")) {
    closeAllDropdowns();
  }
  if (!e.target.closest(".time-picker")) {
    document.querySelectorAll(".time-picker__dropdown.open").forEach(d => d.classList.remove("open"));
    document.querySelectorAll(".time-picker__display.open").forEach(d => d.classList.remove("open"));
  }
});
