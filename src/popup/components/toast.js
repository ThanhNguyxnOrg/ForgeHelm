import { icon } from '../../lib/icons.js';
import { escapeHtml } from '../../lib/utils.js';

const TOAST_DURATION = 3500;

const TOAST_STYLES = {
  success: { bg: 'bg-fh-green-muted/90', border: 'border-fh-green/20', icon: 'check', iconColor: 'text-fh-green', iconBg: 'bg-fh-green-subtle' },
  error:   { bg: 'bg-fh-red-muted/90', border: 'border-fh-red/20', icon: 'x', iconColor: 'text-fh-red', iconBg: 'bg-fh-red-subtle' },
  info:    { bg: 'bg-fh-surface/95', border: 'border-fh-border', icon: 'info', iconColor: 'text-fh-accent', iconBg: 'bg-fh-accent-subtle' },
  warning: { bg: 'bg-fh-elevated/95', border: 'border-fh-yellow/20', icon: 'alertTriangle', iconColor: 'text-fh-yellow', iconBg: 'bg-fh-yellow-subtle' },
};

export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const style = TOAST_STYLES[type] || TOAST_STYLES.info;

  const el = document.createElement('div');
  el.className = `flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-fh-lg
                  ${style.bg} ${style.border}
                  text-xs text-fh-text pointer-events-auto
                  animate-toast-enter backdrop-blur-md`;
  el.setAttribute('role', 'alert');

  el.innerHTML = `
    <span class="${style.iconColor} ${style.iconBg} shrink-0 p-1 rounded-lg">${icon(style.icon, { size: 12 })}</span>
    <span class="flex-1 font-medium">${escapeHtml(message)}</span>
    <button class="toast-close shrink-0 text-fh-text-muted hover:text-fh-text transition-colors p-0.5 rounded" aria-label="Dismiss">
      ${icon('x', { size: 12 })}
    </button>`;

  el.querySelector('.toast-close').addEventListener('click', () => dismissToast(el));

  container.appendChild(el);

  setTimeout(() => dismissToast(el), TOAST_DURATION);
}

function dismissToast(el) {
  if (!el || !el.parentNode) return;
  el.classList.remove('animate-toast-enter');
  el.classList.add('animate-toast-exit');
  setTimeout(() => el.remove(), 200);
}
