import { icon } from '../../lib/icons.js';
import { escapeHtml } from '../../lib/utils.js';

let overlay = null;
let modalEl = null;
let previousFocus = null;

export function showModal({ title, body, confirmText, confirmClass, onConfirm, typed, dangerous }) {
  closeModal();

  previousFocus = document.activeElement;

  overlay = document.getElementById('modalOverlay');
  overlay.className = 'fixed inset-0 z-40 fh-overlay-backdrop animate-fade-in';
  overlay.setAttribute('aria-hidden', 'false');
  overlay.innerHTML = '';

  const dangerStripe = dangerous
    ? '<div class="fh-stripe-danger"></div>'
    : '<div class="fh-stripe-accent"></div>';

  const typedSection = typed
    ? `<div class="mt-3">
         <label class="text-2xs text-fh-text-muted block mb-1.5">Type <span class="font-mono font-bold text-fh-text px-1 py-0.5 bg-fh-overlay rounded">${escapeHtml(typed)}</span> to confirm</label>
         <input id="modalTypedInput" type="text" class="fh-input text-xs font-mono" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(typed)}" aria-label="Confirmation input">
       </div>`
    : '';

  modalEl = document.createElement('div');
  modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  modalEl.setAttribute('role', 'dialog');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('aria-label', title);
  modalEl.innerHTML = `
    <div class="fh-glass-elevated rounded-xl w-full max-w-sm animate-scale-in">
      ${dangerStripe}
      <div class="p-5">
        <div class="flex items-start gap-3">
          <div class="${dangerous ? 'text-fh-red' : 'text-fh-accent'} shrink-0 mt-0.5 p-1.5 rounded-lg ${dangerous ? 'bg-fh-red-subtle' : 'bg-fh-accent-subtle'}">
            ${dangerous ? icon('alertTriangle', { size: 18 }) : icon('info', { size: 18 })}
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-sm font-semibold mb-1.5">${escapeHtml(title)}</h3>
            <div class="text-xs text-fh-text-secondary leading-relaxed">${body}</div>
            ${typedSection}
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5 pt-4 border-t border-fh-border/50">
          <button id="modalCancelBtn" class="fh-btn-secondary">Cancel</button>
          <button id="modalConfirmBtn" class="${confirmClass || 'fh-btn-primary'}" ${typed ? 'disabled' : ''}>${escapeHtml(confirmText || 'Confirm')}</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modalEl);

  const cancelBtn = modalEl.querySelector('#modalCancelBtn');
  const confirmBtn = modalEl.querySelector('#modalConfirmBtn');
  const typedInput = modalEl.querySelector('#modalTypedInput');

  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', closeModal);

  if (typedInput) {
    typedInput.addEventListener('input', () => {
      confirmBtn.disabled = typedInput.value !== typed;
    });
    typedInput.focus();
  } else {
    cancelBtn.focus();
  }

  confirmBtn.addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });

  modalEl.addEventListener('keydown', trapFocus);
  document.addEventListener('keydown', handleEsc);
}

function trapFocus(e) {
  if (e.key !== 'Tab' || !modalEl) return;

  const focusable = modalEl.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function handleEsc(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  if (modalEl) {
    modalEl.removeEventListener('keydown', trapFocus);
    modalEl.remove();
    modalEl = null;
  }
  if (overlay) {
    overlay.className = 'hidden fixed inset-0 z-40';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '';
  }
  document.removeEventListener('keydown', handleEsc);

  if (previousFocus && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
    previousFocus = null;
  }
}
