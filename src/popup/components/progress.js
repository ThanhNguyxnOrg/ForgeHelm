export function showProgress(label, current, total) {
  const container = document.getElementById('globalProgress');
  const labelEl = document.getElementById('progressLabel');
  const countEl = document.getElementById('progressCount');
  const bar = document.getElementById('progressBar');

  if (!container) return;

  const pct = Math.round((current / total) * 100);

  container.classList.remove('hidden');
  container.setAttribute('aria-valuenow', String(pct));
  labelEl.textContent = label;
  countEl.textContent = `${current} / ${total}`;
  bar.style.width = `${pct}%`;
}

export function hideProgress() {
  const container = document.getElementById('globalProgress');
  if (container) {
    container.classList.add('hidden');
    container.setAttribute('aria-valuenow', '0');
  }
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = '0%';
}
