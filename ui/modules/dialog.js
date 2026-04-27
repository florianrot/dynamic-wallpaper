// AppShell — Confirmation Dialog

function showConfirmDialog({ title, message, confirmText, cancelText, danger = false } = {}) {
  title = title || t("dialog.confirm");
  message = message || t("dialog.default_message");
  confirmText = confirmText || t("dialog.confirm");
  cancelText = cancelText || t("dialog.cancel");
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const btnClass = danger ? 'btn btn--danger' : 'btn btn--primary';
    modal.innerHTML = `
      <div class="modal__backdrop"></div>
      <div class="modal__card">
        <div class="modal__title">${title}</div>
        <div class="modal__text">${message}</div>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-action="cancel">${cancelText}</button>
          <button class="${btnClass}" data-action="confirm">${confirmText}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('visible'));

    const close = (result) => {
      modal.classList.remove('visible');
      setTimeout(() => modal.remove(), 200);
      resolve(result);
    };

    modal.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
    modal.querySelector('[data-action="confirm"]').addEventListener('click', () => close(true));
    modal.querySelector('.modal__backdrop').addEventListener('click', () => close(false));
  });
}
