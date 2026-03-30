import { icon } from '../../lib/icons.js';

let paletteRoot = null;
let backdropEl = null;
let paletteEl = null;
let activeIndex = 0;
let filteredCommands = [];
let allCommands = [];
let onExecute = null;

export function registerCommands(commands, executeFn) {
  allCommands = commands;
  onExecute = executeFn;
}

export function openPalette() {
  if (paletteEl) return;

  paletteRoot = document.getElementById('commandPaletteRoot');
  if (!paletteRoot) return;
  paletteRoot.setAttribute('aria-hidden', 'false');

  backdropEl = document.createElement('div');
  backdropEl.className = 'fh-palette-backdrop animate-fade-in';
  backdropEl.addEventListener('click', closePalette);

  paletteEl = document.createElement('div');
  paletteEl.className = 'fh-palette animate-scale-in';
  paletteEl.setAttribute('role', 'dialog');
  paletteEl.setAttribute('aria-label', 'Command palette');

  const inputWrap = document.createElement('div');
  inputWrap.className = 'relative';

  const searchIcon = document.createElement('span');
  searchIcon.className = 'absolute left-3.5 top-1/2 -translate-y-1/2 text-fh-text-muted pointer-events-none';
  searchIcon.innerHTML = icon('command', { size: 14 });

  const input = document.createElement('input');
  input.className = 'fh-palette-input pl-9';
  input.placeholder = 'Type a command…';
  input.setAttribute('aria-label', 'Search commands');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');

  inputWrap.appendChild(searchIcon);
  inputWrap.appendChild(input);

  const list = document.createElement('div');
  list.className = 'fh-palette-list';
  list.setAttribute('role', 'listbox');

  paletteEl.appendChild(inputWrap);
  paletteEl.appendChild(list);

  paletteRoot.appendChild(backdropEl);
  paletteRoot.appendChild(paletteEl);

  activeIndex = 0;
  filteredCommands = [...allCommands];
  renderList(list);

  requestAnimationFrame(() => input.focus());

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    filteredCommands = q
      ? allCommands.filter((c) => fuzzyMatch(q, c.label.toLowerCase()) || (c.category && c.category.toLowerCase().includes(q)))
      : [...allCommands];
    activeIndex = 0;
    renderList(list);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filteredCommands.length - 1);
      renderList(list);
      scrollActiveIntoView(list);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList(list);
      scrollActiveIntoView(list);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filteredCommands[activeIndex];
      if (cmd) executeCommand(cmd);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });

  document.addEventListener('keydown', handleGlobalEsc);
}

export function closePalette() {
  if (!paletteEl) return;

  paletteEl.style.opacity = '0';
  paletteEl.style.transform = 'translate(-50%, 0) scale(0.97)';
  paletteEl.style.transition = 'all 0.15s ease-in';

  if (backdropEl) {
    backdropEl.style.opacity = '0';
    backdropEl.style.transition = 'opacity 0.15s ease-in';
  }

  setTimeout(() => {
    if (backdropEl) { backdropEl.remove(); backdropEl = null; }
    if (paletteEl) { paletteEl.remove(); paletteEl = null; }
    if (paletteRoot) paletteRoot.setAttribute('aria-hidden', 'true');
  }, 150);

  document.removeEventListener('keydown', handleGlobalEsc);
}

export function isPaletteOpen() {
  return !!paletteEl;
}

function handleGlobalEsc(e) {
  if (e.key === 'Escape') closePalette();
}

function executeCommand(cmd) {
  closePalette();
  if (onExecute) onExecute(cmd.id);
}

function fuzzyMatch(query, target) {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}

function renderList(listEl) {
  if (filteredCommands.length === 0) {
    listEl.innerHTML = '<div class="fh-palette-empty">No matching commands</div>';
    return;
  }

  let lastCategory = null;
  let html = '';

  for (let i = 0; i < filteredCommands.length; i++) {
    const cmd = filteredCommands[i];
    if (cmd.category && cmd.category !== lastCategory) {
      lastCategory = cmd.category;
      html += `<div class="fh-palette-category">${escHtml(cmd.category)}</div>`;
    }

    const isActive = i === activeIndex;
    const shortcutHtml = cmd.shortcut
      ? `<span class="ml-auto flex items-center gap-0.5">${cmd.shortcut.split('+').map((k) => `<kbd class="fh-kbd">${escHtml(k)}</kbd>`).join('')}</span>`
      : '';

    const iconHtml = cmd.icon
      ? `<span class="text-fh-text-muted shrink-0">${icon(cmd.icon, { size: 16 })}</span>`
      : '';

    html += `<div class="fh-palette-item" data-active="${isActive}" data-index="${i}" role="option" aria-selected="${isActive}">
      ${iconHtml}
      <span class="flex-1 truncate">${escHtml(cmd.label)}</span>
      ${shortcutHtml}
    </div>`;
  }

  listEl.innerHTML = html;

  listEl.querySelectorAll('.fh-palette-item').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index, 10);
      const cmd = filteredCommands[idx];
      if (cmd) executeCommand(cmd);
    });
    el.addEventListener('mouseenter', () => {
      activeIndex = parseInt(el.dataset.index, 10);
      listEl.querySelectorAll('.fh-palette-item').forEach((item, j) => {
        item.dataset.active = String(j === activeIndex);
        item.setAttribute('aria-selected', String(j === activeIndex));
      });
    });
  });
}

function scrollActiveIntoView(listEl) {
  const active = listEl.querySelector('[data-active="true"]');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
