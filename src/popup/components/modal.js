import { icon } from '../../lib/icons.js';
import { escapeHtml } from '../../lib/utils.js';

let overlay = null;
let modalEl = null;

export function showModal({ title, body, confirmText, confirmClass, onConfirm, typed, dangerous }) {
  closeModal();

  overlay = document.getElementById('modalOverlay');
  overlay.className = 'fixed inset-0 z-40 fh-overlay-backdrop animate-fade-in';
  overlay.innerHTML = '';

  const dangerStripe = dangerous
    ? '<div class="h-1 bg-gradient-to-r from-fh-red to-fh-orange rounded-t-xl"></div>'
    : '';

  const typedSection = typed
    ? `<div class="mt-3">
         <label class="text-2xs text-fh-text-muted block mb-1">Type <span class="font-mono font-bold text-fh-text">${escapeHtml(typed)}</span> to confirm</label>
         <input id="modalTypedInput" type="text" class="fh-input text-xs font-mono" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(typed)}">
       </div>`
    : '';

  modalEl = document.createElement('div');
  modalEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  modalEl.innerHTML = `
    <div class="bg-fh-surface border border-fh-border rounded-xl shadow-fh-lg w-full max-w-sm animate-slide-up">
      ${dangerStripe}
      <div class="p-4">
        <div class="flex items-start gap-3">
          <div class="${dangerous ? 'text-fh-red' : 'text-fh-accent'} shrink-0 mt-0.5">
            ${dangerous ? icon('alertTriangle', { size: 20 }) : icon('info', { size: 20 })}
          </div>
          <div class="flex-1">
            <h3 class="text-sm font-semibold mb-1">${escapeHtml(title)}</h3>
            <div class="text-xs text-fh-text-secondary">${body}</div>
            ${typedSection}
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-4">
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
  }

  confirmBtn.addEventListener('click', () => {
    closeModal();
    if (onConfirm) onConfirm();
  });

  document.addEventListener('keydown', handleEsc);
}

function handleEsc(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
  }
  if (overlay) {
    overlay.className = 'hidden fixed inset-0 z-40';
    overlay.innerHTML = '';
  }
  document.removeEventListener('keydown', handleEsc);
}
