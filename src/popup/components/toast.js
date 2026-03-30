import { icon } from '../../lib/icons.js';

const TOAST_DURATION = 3500;

const TOAST_STYLES = {
  success: { bg: 'bg-fh-green-muted/90', border: 'border-fh-green/30', icon: 'check', iconColor: 'text-fh-green' },
  error:   { bg: 'bg-fh-red-muted/90', border: 'border-fh-red/30', icon: 'x', iconColor: 'text-fh-red' },
  info:    { bg: 'bg-fh-surface/95', border: 'border-fh-border', icon: 'info', iconColor: 'text-fh-accent' },
  warning: { bg: 'bg-fh-overlay/95', border: 'border-fh-yellow/30', icon: 'alertTriangle', iconColor: 'text-fh-yellow' },
};

export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const style = TOAST_STYLES[type] || TOAST_STYLES.info;

  const el = document.createElement('div');
  el.className = `flex items-center gap-2 px-3 py-2 rounded-lg border shadow-fh-lg
                  ${style.bg} ${style.border}
                  text-xs text-fh-text pointer-events-auto
                  animate-slide-up`;

  el.innerHTML = `
    <span class="${style.iconColor} shrink-0">${icon(style.icon, { size: 14 })}</span>
    <span class="flex-1">${message}</span>
    <button class="toast-close shrink-0 text-fh-text-muted hover:text-fh-text transition-colors">
      ${icon('x', { size: 12 })}
    </button>`;

  el.querySelector('.toast-close').addEventListener('click', () => dismissToast(el));

  container.appendChild(el);

  setTimeout(() => dismissToast(el), TOAST_DURATION);
}

function dismissToast(el) {
  if (!el || !el.parentNode) return;
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'all 0.2s ease-in';
  setTimeout(() => el.remove(), 200);
}
