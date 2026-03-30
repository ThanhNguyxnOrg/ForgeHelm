export function showProgress(label, current, total) {
  const container = document.getElementById('globalProgress');
  const labelEl = document.getElementById('progressLabel');
  const countEl = document.getElementById('progressCount');
  const bar = document.getElementById('progressBar');

  if (!container) return;

  container.classList.remove('hidden');
  labelEl.textContent = label;
  countEl.textContent = `${current} / ${total}`;
  bar.style.width = `${Math.round((current / total) * 100)}%`;
}

export function hideProgress() {
  const container = document.getElementById('globalProgress');
  if (container) container.classList.add('hidden');
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = '0%';
}
