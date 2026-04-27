// AppShell — Custom Tooltip System

let tooltipEl = null;
let tooltipTimeout = null;

function initTooltips() {
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip';
  document.body.appendChild(tooltipEl);

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => showTooltip(target), 400);
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    hideTooltip();
  });

  document.addEventListener('mousedown', hideTooltip);
}

function showTooltip(target) {
  const i18nKey = target.dataset.i18nTooltip;
  const text = i18nKey ? t(i18nKey) : target.dataset.tooltip;
  if (!text || !tooltipEl) return;

  const shortcut = target.dataset.tooltipShortcut;
  if (shortcut) {
    const keys = shortcut.split("+").map(k => `<kbd>${k.trim()}</kbd>`).join("");
    tooltipEl.innerHTML = `<span>${text}</span><span class="tooltip__shortcut">${keys}</span>`;
  } else {
    tooltipEl.textContent = text;
  }
  tooltipEl.classList.add('visible');

  const rect = target.getBoundingClientRect();
  const tipRect = tooltipEl.getBoundingClientRect();

  let top = rect.bottom + 6;
  let left = rect.left + (rect.width - tipRect.width) / 2;

  if (top + tipRect.height > window.innerHeight) {
    top = rect.top - tipRect.height - 6;
  }
  left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

  tooltipEl.style.top = top + 'px';
  tooltipEl.style.left = left + 'px';
}

function hideTooltip() {
  clearTimeout(tooltipTimeout);
  if (tooltipEl) tooltipEl.classList.remove('visible');
}
