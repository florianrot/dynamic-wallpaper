// AppShell — Toast

let toastCount = 0;
function _escToast(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function showToast(message, type = "info", duration = 3000) {
  const container = document.querySelector(".toast-container");
  if (!container) return;

  if (container.children.length >= 3) {
    container.lastElementChild?.remove();
  }

  const id = ++toastCount;
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.dataset.id = id;
  toast.innerHTML = `
    <span class="toast__dot"></span>
    <span>${_escToast(message)}</span>
    <button class="toast__close" onclick="removeToast(${id})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  container.prepend(toast);

  if (type === "error") duration = 5000;
  setTimeout(() => removeToast(id), duration);
}

function removeToast(id) {
  const toast = document.querySelector(`.toast[data-id="${id}"]`);
  if (!toast) return;
  toast.classList.add("removing");
  setTimeout(() => toast.remove(), 200);
}

function showUndoToast(message, undoFn) {
  const container = document.querySelector(".toast-container");
  if (!container) return;
  const id = ++toastCount;
  const toast = document.createElement("div");
  toast.className = "toast toast--info";
  toast.dataset.id = id;
  let undone = false;
  toast.innerHTML = `<span class="toast__dot"></span><span>${message}</span>
    <button class="btn btn--xs btn--ghost toast-undo" data-toast="${id}">${t("common.undo")}</button>
    <button class="toast__close" onclick="removeToast(${id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  toast.querySelector(".toast-undo").addEventListener("click", () => { if (!undone) { undone = true; undoFn(); removeToast(id); } });
  container.prepend(toast);
  setTimeout(() => removeToast(id), 5000);
}
