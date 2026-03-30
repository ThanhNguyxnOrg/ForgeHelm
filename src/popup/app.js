import { icon } from '../lib/icons.js';
import { escapeHtml, debounce } from '../lib/utils.js';
import { createState } from './state.js';
import { renderRepoCard } from './renderer.js';
import { showModal } from './components/modal.js';
import { showToast } from './components/toast.js';
import { showProgress, hideProgress } from './components/progress.js';
import { registerCommands, openPalette, isPaletteOpen } from './components/command-palette.js';
import { initTheme, cycleTheme, getTheme, THEMES } from './components/theme.js';
import { scheduleSoftDelete, cancelSoftDelete, isPending } from './components/soft-delete.js';

const state = createState();
const pendingDeleteRepos = new Set();

function send(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, payload }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(res || { ok: false, error: 'No response' });
    });
  });
}

function getThemeIcon(theme) {
  if (theme === THEMES.LIGHT) return 'sun';
  if (theme === THEMES.DARK) return 'moon';
  return 'monitor';
}

function getThemeLabel(theme) {
  if (theme === THEMES.LIGHT) return 'Light';
  if (theme === THEMES.DARK) return 'Dark';
  return 'System';
}

function updateThemeButton() {
  const el = document.getElementById('themeIcon');
  if (el) el.innerHTML = icon(getThemeIcon(getTheme()), { size: 14 });
  const btn = document.getElementById('themeBtn');
  if (btn) btn.title = `Theme: ${getThemeLabel(getTheme())}`;
}

function injectIcons() {
  const map = {
    headerIcon: ['hammer', { size: 20 }],
    settingsIcon: ['settings', {}],
    searchIcon: ['search', { size: 14 }],
    refreshIcon: ['refresh', {}],
    externalLinkIcon: ['externalLink', {}],
    tokenToggleIcon: ['eye', {}],
    bulkPublicIcon: ['unlock', { size: 12 }],
    bulkPrivateIcon: ['lock', { size: 12 }],
    bulkArchiveIcon: ['archive', { size: 12 }],
    bulkDeleteIcon: ['trash', { size: 12 }],
    rateLimitIcon: ['shield', {}],
    cmdPaletteIcon: ['command', { size: 14 }],
  };
  for (const [id, [name, opts]] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = icon(name, opts);
  }
  updateThemeButton();
}

function initCommandPalette() {
  const commands = [
    { id: 'search', label: 'Search repositories', icon: 'search', shortcut: '/', category: 'Navigation' },
    { id: 'refresh', label: 'Refresh repository list', icon: 'refresh', shortcut: 'F5', category: 'Navigation' },
    { id: 'settings', label: 'Toggle settings panel', icon: 'settings', category: 'Navigation' },
    { id: 'theme', label: 'Toggle theme (Dark / Light / System)', icon: 'sun', category: 'Navigation' },
    { id: 'select-all', label: 'Select all visible repos', icon: 'selectAll', shortcut: 'Ctrl+A', category: 'Selection' },
    { id: 'deselect-all', label: 'Deselect all repos', icon: 'deselectAll', shortcut: 'Ctrl+Shift+A', category: 'Selection' },
    { id: 'bulk-public', label: 'Make selected repos public', icon: 'globe', category: 'Bulk Actions' },
    { id: 'bulk-private', label: 'Make selected repos private', icon: 'lock', category: 'Bulk Actions' },
    { id: 'bulk-archive', label: 'Archive selected repos', icon: 'archive', category: 'Bulk Actions' },
    { id: 'bulk-delete', label: 'Delete selected repos', icon: 'trash', category: 'Bulk Actions' },
    { id: 'export-json', label: 'Export repos as JSON', icon: 'fileJson', category: 'Export' },
    { id: 'export-csv', label: 'Export repos as CSV', icon: 'download', category: 'Export' },
    { id: 'filter-public', label: 'Show public repos only', icon: 'globe', category: 'Filters' },
    { id: 'filter-private', label: 'Show private repos only', icon: 'lock', category: 'Filters' },
    { id: 'filter-all', label: 'Show all repos', icon: 'layout', category: 'Filters' },
    { id: 'sort-updated', label: 'Sort by last updated', icon: 'arrowUpDown', category: 'Sort' },
    { id: 'sort-name', label: 'Sort by name', icon: 'arrowUpDown', category: 'Sort' },
    { id: 'sort-stars', label: 'Sort by stars', icon: 'star', category: 'Sort' },
  ];

  registerCommands(commands, (cmdId) => {
    switch (cmdId) {
      case 'search':
        document.getElementById('searchInput').focus();
        break;
      case 'refresh':
        loadRepos();
        break;
      case 'settings':
        toggleSettings();
        break;
      case 'theme':
        handleThemeToggle();
        break;
      case 'select-all': {
        const filtered = state.getFiltered();
        state.selectAll(filtered.map((r) => r.full_name));
        renderRepos();
        updateBulkBar();
        break;
      }
      case 'deselect-all':
        state.deselectAll();
        renderRepos();
        updateBulkBar();
        break;
      case 'bulk-public':
        handleBulkPublic();
        break;
      case 'bulk-private':
        handleBulkPrivate();
        break;
      case 'bulk-archive':
        handleBulkArchive();
        break;
      case 'bulk-delete':
        handleBulkDelete();
        break;
      case 'export-json':
        exportRepos('json');
        break;
      case 'export-csv':
        exportRepos('csv');
        break;
      case 'filter-public':
        document.getElementById('visibilityFilter').value = 'public';
        state.set({ visibility: 'public' });
        renderRepos();
        break;
      case 'filter-private':
        document.getElementById('visibilityFilter').value = 'private';
        state.set({ visibility: 'private' });
        renderRepos();
        break;
      case 'filter-all':
        document.getElementById('visibilityFilter').value = 'all';
        state.set({ visibility: 'all' });
        renderRepos();
        break;
      case 'sort-updated':
        document.getElementById('sortFilter').value = 'updated';
        state.set({ sort: 'updated' });
        renderRepos();
        break;
      case 'sort-name':
        document.getElementById('sortFilter').value = 'name';
        state.set({ sort: 'name' });
        renderRepos();
        break;
      case 'sort-stars':
        document.getElementById('sortFilter').value = 'stars';
        state.set({ sort: 'stars' });
        renderRepos();
        break;
    }
  });
}

function handleThemeToggle() {
  const newTheme = cycleTheme();
  updateThemeButton();
  showToast(`Theme: ${getThemeLabel(newTheme)}`, 'info');
}

function exportRepos(format) {
  const repos = state.getFiltered();
  if (repos.length === 0) {
    showToast('No repos to export', 'warning');
    return;
  }

  let content, filename, type;

  if (format === 'json') {
    const data = repos.map((r) => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description || '',
      private: r.private,
      fork: r.fork,
      archived: r.archived,
      language: r.language || '',
      stars: r.stargazers_count,
      forks: r.forks_count,
      updated_at: r.updated_at,
      html_url: r.html_url,
    }));
    content = JSON.stringify(data, null, 2);
    filename = `forgehelm-repos-${Date.now()}.json`;
    type = 'application/json';
  } else {
    const headers = ['Name', 'Full Name', 'Visibility', 'Language', 'Stars', 'Forks', 'Archived', 'Updated', 'URL'];
    const rows = repos.map((r) => [
      r.name, r.full_name, r.private ? 'Private' : 'Public',
      r.language || '', r.stargazers_count, r.forks_count,
      r.archived ? 'Yes' : 'No', r.updated_at, r.html_url,
    ]);
    content = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    filename = `forgehelm-repos-${Date.now()}.csv`;
    type = 'text/csv';
  }

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${repos.length} repos as ${format.toUpperCase()}`, 'success');
}

function showSkeletons() {
  document.getElementById('repoList').classList.add('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('skeletonList').classList.remove('hidden');
}

function hideSkeletons() {
  document.getElementById('skeletonList').classList.add('hidden');
}

function renderRepos() {
  const filtered = state.getFiltered();
  const s = state.get();
  const listEl = document.getElementById('repoList');
  const emptyEl = document.getElementById('emptyState');
  const countEl = document.getElementById('repoCount');

  hideSkeletons();

  if (s.allRepos.length === 0 && !s.loading) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    document.getElementById('emptyIcon').innerHTML = icon('hammer', { size: 40, className: 'opacity-30' });
    document.getElementById('emptyTitle').textContent = s.token ? 'No repositories found' : 'Welcome to ForgeHelm';
    document.getElementById('emptyDesc').textContent = s.token
      ? 'Your account has no owned repositories.'
      : 'Enter your GitHub token in Settings to get started.';
    countEl.textContent = '0 repos';
    return;
  }

  if (filtered.length === 0 && s.allRepos.length > 0) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    document.getElementById('emptyIcon').innerHTML = icon('search', { size: 40, className: 'opacity-30' });
    document.getElementById('emptyTitle').textContent = 'No matches';
    document.getElementById('emptyDesc').textContent = 'Try adjusting your search or filters.';
    countEl.textContent = `0 / ${s.allRepos.length} repos`;
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  listEl.innerHTML = filtered
    .map((r) => renderRepoCard(
      r,
      s.selected.has(r.full_name),
      s.busyRepos.has(r.full_name),
      pendingDeleteRepos.has(r.full_name)
    ))
    .join('');

  const showing = filtered.length === s.allRepos.length
    ? `${filtered.length} repos`
    : `${filtered.length} / ${s.allRepos.length} repos`;
  countEl.textContent = showing;
}

function updateBulkBar() {
  const s = state.get();
  const bar = document.getElementById('bulkBar');
  const countEl = document.getElementById('selectedCount');

  if (s.selected.size > 0) {
    bar.classList.remove('hidden');
    countEl.textContent = `${s.selected.size} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

async function loadRepos() {
  state.set({ loading: true });
  showSkeletons();

  const res = await send('FETCH_REPOS');
  if (res.ok) {
    state.set({ allRepos: res.data, loading: false, selected: new Set(), busyRepos: new Set() });
    fetchCiStatuses(res.data);
  } else {
    state.set({ loading: false });
    showToast(res.error || 'Failed to load repos', 'error');
  }
  renderRepos();
  updateBulkBar();
}

async function fetchCiStatuses(repos) {
  const batch = repos.slice(0, 20);
  for (const repo of batch) {
    try {
      const res = await send('GET_CI_STATUS', { fullName: repo.full_name });
      if (res.ok && res.data) {
        state.updateRepo(repo.full_name, { _ciStatus: res.data });
      }
    } catch (_) {
      // CI status is best-effort
    }
  }
  renderRepos();
}

async function handleSaveToken() {
  const input = document.getElementById('tokenInput');
  const statusEl = document.getElementById('tokenStatus');
  const t = input.value.trim();

  if (!t) {
    statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-red-subtle text-fh-red';
    statusEl.textContent = 'Please enter a token';
    statusEl.classList.remove('hidden');
    return;
  }

  statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-accent-subtle text-fh-accent flex items-center gap-1';
  statusEl.innerHTML = `<span class="animate-spin-slow">${icon('loader', { size: 12 })}</span> Validating…`;
  statusEl.classList.remove('hidden');

  const res = await send('VALIDATE_TOKEN', { token: t });

  if (res.ok) {
    const user = res.data;
    state.set({ token: t, user });
    statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-green-subtle text-fh-green';
    statusEl.textContent = `Authenticated as @${user.login}`;
    showUserBadge(user);
    showToast(`Welcome, ${user.login}!`, 'success');
    setTimeout(() => toggleSettings(false), 800);
    loadRepos();
  } else {
    statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-red-subtle text-fh-red';
    statusEl.textContent = res.error || 'Invalid token';
    showToast('Token validation failed', 'error');
  }
}

function showUserBadge(user) {
  const badge = document.getElementById('userBadge');
  const avatar = document.getElementById('userAvatar');
  const name = document.getElementById('userName');
  badge.classList.remove('hidden');
  badge.classList.add('flex');
  avatar.src = user.avatar_url;
  name.textContent = `@${user.login}`;
}

async function handleClearToken() {
  await send('CLEAR_TOKEN');
  state.set({ token: '', user: null, allRepos: [], selected: new Set(), busyRepos: new Set() });
  document.getElementById('tokenInput').value = '';
  document.getElementById('tokenStatus').classList.add('hidden');
  document.getElementById('userBadge').classList.add('hidden');
  document.getElementById('userBadge').classList.remove('flex');
  renderRepos();
  updateBulkBar();
  showToast('Token cleared', 'info');
}

function toggleSettings(force) {
  const panel = document.getElementById('settingsPanel');
  const isOpen = force !== undefined ? force : panel.classList.contains('hidden');
  state.set({ settingsOpen: isOpen });
  panel.classList.toggle('hidden', !isOpen);
}

function toggleTokenVisibility() {
  const input = document.getElementById('tokenInput');
  const iconEl = document.getElementById('tokenToggleIcon');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  iconEl.innerHTML = icon(isPassword ? 'eyeOff' : 'eye');
}

async function handleChangeVisibility(fullName, currentlyPrivate) {
  const newVis = currentlyPrivate ? 'public' : 'private';
  showModal({
    title: `Make ${escapeHtml(fullName.split('/')[1])} ${newVis}?`,
    body: currentlyPrivate
      ? 'This repo will become visible to everyone.'
      : 'This repo will only be visible to you and collaborators.',
    confirmText: `Make ${newVis}`,
    confirmClass: 'fh-btn-primary',
    onConfirm: async () => {
      state.markBusy(fullName);
      renderRepos();
      const res = await send('CHANGE_VISIBILITY', { fullName, isPrivate: !currentlyPrivate });
      state.unmarkBusy(fullName);
      if (res.ok) {
        state.updateRepo(fullName, res.data);
        showToast(`${fullName.split('/')[1]} is now ${newVis}`, 'success');
      } else {
        showToast(res.error || 'Visibility change failed', 'error');
      }
      renderRepos();
    },
  });
}

async function handleArchive(fullName, unarchive) {
  const action = unarchive ? 'unarchive' : 'archive';
  showModal({
    title: `${unarchive ? 'Unarchive' : 'Archive'} ${escapeHtml(fullName.split('/')[1])}?`,
    body: unarchive
      ? 'This will make the repo writable again.'
      : 'Archived repos become read-only. You can unarchive later.',
    confirmText: unarchive ? 'Unarchive' : 'Archive',
    confirmClass: 'fh-btn-primary',
    dangerous: !unarchive,
    onConfirm: async () => {
      state.markBusy(fullName);
      renderRepos();
      const res = await send('ARCHIVE_REPO', { fullName, archived: !unarchive });
      state.unmarkBusy(fullName);
      if (res.ok) {
        state.updateRepo(fullName, res.data);
        showToast(`${fullName.split('/')[1]} ${action}d`, 'success');
      } else {
        showToast(res.error || `Failed to ${action}`, 'error');
      }
      renderRepos();
    },
  });
}

function showUndoToast(fullName) {
  const repoName = fullName.split('/')[1];
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'fh-undo-toast relative overflow-hidden animate-toast-enter';
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <span class="text-white shrink-0 p-1 rounded-lg bg-white/10">${icon('trash', { size: 12 })}</span>
    <span class="flex-1 font-medium text-white">${escapeHtml(repoName)} will be deleted</span>
    <button class="fh-undo-btn" data-undo="${escapeHtml(fullName)}">Undo</button>
    <div class="fh-countdown-bar" style="animation-duration: 30s"></div>
  `;

  el.querySelector('.fh-undo-btn').addEventListener('click', () => {
    cancelSoftDelete(fullName);
    pendingDeleteRepos.delete(fullName);
    renderRepos();
    updateBulkBar();
    el.remove();
    showToast(`${repoName} restored`, 'success');
  });

  container.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 30500);
}

async function handleDelete(fullName) {
  const repoName = fullName.split('/')[1];
  showModal({
    title: `Delete ${escapeHtml(repoName)}?`,
    body: `<p class="text-fh-red font-medium">This action is permanent and cannot be undone.</p>
           <p class="mt-1.5 text-fh-text-muted">You'll have 30 seconds to undo after confirming.</p>`,
    confirmText: 'Delete this repository',
    confirmClass: 'fh-btn-danger',
    typed: repoName,
    dangerous: true,
    onConfirm: async () => {
      pendingDeleteRepos.add(fullName);
      renderRepos();
      showUndoToast(fullName);

      try {
        await scheduleSoftDelete(
          fullName,
          async () => {
            const res = await send('DELETE_REPO', { fullName });
            pendingDeleteRepos.delete(fullName);
            if (res.ok) {
              state.removeRepo(fullName);
              showToast(`${repoName} deleted`, 'success');
            } else {
              showToast(res.error || 'Delete failed', 'error');
            }
            renderRepos();
            updateBulkBar();
          },
          () => {
            pendingDeleteRepos.delete(fullName);
          }
        );
      } catch (_) {
        pendingDeleteRepos.delete(fullName);
        renderRepos();
      }
    },
  });
}

async function runBulkAction(actionName, actionFn, confirmOpts) {
  const s = state.get();
  const targets = [...s.selected];
  if (targets.length === 0) return;

  showModal({
    ...confirmOpts,
    onConfirm: async () => {
      let done = 0;
      let failed = 0;

      for (const fullName of targets) {
        state.markBusy(fullName);
        renderRepos();
        showProgress(actionName, done, targets.length);

        try {
          await actionFn(fullName);
          done++;
        } catch (err) {
          failed++;
        }

        state.unmarkBusy(fullName);
        showProgress(actionName, done + failed, targets.length);
      }

      hideProgress();
      state.deselectAll();
      renderRepos();
      updateBulkBar();

      if (failed === 0) {
        showToast(`${actionName}: ${done} repos processed`, 'success');
      } else {
        showToast(`${actionName}: ${done} done, ${failed} failed`, 'warning');
      }
    },
  });
}

function handleBulkPublic() {
  const count = state.get().selected.size;
  runBulkAction('Make Public', async (fn) => {
    const res = await send('CHANGE_VISIBILITY', { fullName: fn, isPrivate: false });
    if (!res.ok) throw new Error(res.error);
    state.updateRepo(fn, res.data);
  }, {
    title: `Make ${count} repos public?`,
    body: 'All selected repos will become publicly visible.',
    confirmText: `Make ${count} public`,
    confirmClass: 'fh-btn-primary',
  });
}

function handleBulkPrivate() {
  const count = state.get().selected.size;
  runBulkAction('Make Private', async (fn) => {
    const res = await send('CHANGE_VISIBILITY', { fullName: fn, isPrivate: true });
    if (!res.ok) throw new Error(res.error);
    state.updateRepo(fn, res.data);
  }, {
    title: `Make ${count} repos private?`,
    body: 'All selected repos will become private.',
    confirmText: `Make ${count} private`,
    confirmClass: 'fh-btn-primary',
  });
}

function handleBulkArchive() {
  const count = state.get().selected.size;
  runBulkAction('Archive', async (fn) => {
    const res = await send('ARCHIVE_REPO', { fullName: fn, archived: true });
    if (!res.ok) throw new Error(res.error);
    state.updateRepo(fn, res.data);
  }, {
    title: `Archive ${count} repos?`,
    body: 'Archived repos become read-only. You can unarchive later.',
    confirmText: `Archive ${count} repos`,
    confirmClass: 'fh-btn-primary',
    dangerous: true,
  });
}

function handleBulkDelete() {
  const count = state.get().selected.size;
  runBulkAction('Delete', async (fn) => {
    const res = await send('DELETE_REPO', { fullName: fn });
    if (!res.ok) throw new Error(res.error);
    state.removeRepo(fn);
  }, {
    title: `Delete ${count} repos permanently?`,
    body: `<p class="text-fh-red font-medium">This cannot be undone.</p>
           <p class="mt-1.5 text-fh-text-muted">All code, issues, and settings for ${count} repos will be lost forever.</p>`,
    confirmText: `Delete ${count} repos`,
    confirmClass: 'fh-btn-danger',
    typed: `DELETE ${count}`,
    dangerous: true,
  });
}

function bindEvents() {
  document.getElementById('settingsBtn').addEventListener('click', () => toggleSettings());
  document.getElementById('saveTokenBtn').addEventListener('click', handleSaveToken);
  document.getElementById('clearTokenBtn').addEventListener('click', handleClearToken);
  document.getElementById('tokenToggleBtn').addEventListener('click', toggleTokenVisibility);
  document.getElementById('refreshBtn').addEventListener('click', loadRepos);

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', handleThemeToggle);

  const cmdPaletteBtn = document.getElementById('cmdPaletteBtn');
  if (cmdPaletteBtn) cmdPaletteBtn.addEventListener('click', openPalette);

  const cmdPaletteHint = document.getElementById('cmdPaletteHint');
  if (cmdPaletteHint) cmdPaletteHint.addEventListener('click', openPalette);

  document.getElementById('tokenInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveToken();
  });

  const debouncedRender = debounce(() => { renderRepos(); updateBulkBar(); }, 150);

  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.set({ search: e.target.value });
    debouncedRender();
  });

  document.getElementById('visibilityFilter').addEventListener('change', (e) => {
    state.set({ visibility: e.target.value });
    renderRepos();
  });

  document.getElementById('typeFilter').addEventListener('change', (e) => {
    state.set({ type: e.target.value });
    renderRepos();
  });

  document.getElementById('sortFilter').addEventListener('change', (e) => {
    state.set({ sort: e.target.value });
    renderRepos();
  });

  document.getElementById('repoList').addEventListener('click', (e) => {
    const checkbox = e.target.closest('.repo-checkbox');
    if (checkbox) {
      state.toggleSelect(checkbox.dataset.name);
      updateBulkBar();
      renderRepos();
      return;
    }

    const visBtn = e.target.closest('.visibility-btn');
    if (visBtn) {
      handleChangeVisibility(visBtn.dataset.name, visBtn.dataset.private === 'true');
      return;
    }

    const archBtn = e.target.closest('.archive-btn');
    if (archBtn) {
      handleArchive(archBtn.dataset.name, archBtn.dataset.unarchive === 'true');
      return;
    }

    const delBtn = e.target.closest('.delete-btn');
    if (delBtn) {
      handleDelete(delBtn.dataset.name);
      return;
    }

    const card = e.target.closest('[data-repo]');
    if (card && !e.target.closest('a') && !e.target.closest('button') && !e.target.closest('input')) {
      state.toggleSelect(card.dataset.repo);
      updateBulkBar();
      renderRepos();
    }
  });

  document.getElementById('selectAllBtn').addEventListener('click', () => {
    const filtered = state.getFiltered();
    state.selectAll(filtered.map((r) => r.full_name));
    renderRepos();
    updateBulkBar();
  });

  document.getElementById('deselectAllBtn').addEventListener('click', () => {
    state.deselectAll();
    renderRepos();
    updateBulkBar();
  });

  document.getElementById('bulkPublicBtn').addEventListener('click', handleBulkPublic);
  document.getElementById('bulkPrivateBtn').addEventListener('click', handleBulkPrivate);
  document.getElementById('bulkArchiveBtn').addEventListener('click', handleBulkArchive);
  document.getElementById('bulkDeleteBtn').addEventListener('click', handleBulkDelete);

  document.addEventListener('keydown', (e) => {
    if (isPaletteOpen()) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }

    if (e.key === '/' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      if (e.shiftKey) {
        state.deselectAll();
      } else {
        const filtered = state.getFiltered();
        state.selectAll(filtered.map((r) => r.full_name));
      }
      renderRepos();
      updateBulkBar();
    }

    if (e.key === 'Escape') {
      const s = state.get();
      if (s.settingsOpen) {
        toggleSettings(false);
      } else if (s.selected.size > 0) {
        state.deselectAll();
        renderRepos();
        updateBulkBar();
      }
    }
  });
}

async function init() {
  initTheme((resolved) => {
    updateThemeButton();
  });

  injectIcons();
  initCommandPalette();
  bindEvents();

  const tokenRes = await send('GET_TOKEN');
  if (tokenRes.ok && tokenRes.data?.token) {
    state.set({ token: tokenRes.data.token });
    document.getElementById('tokenInput').value = tokenRes.data.token;

    const validateRes = await send('VALIDATE_TOKEN', { token: tokenRes.data.token });
    if (validateRes.ok) {
      state.set({ user: validateRes.data });
      showUserBadge(validateRes.data);
      loadRepos();
    } else {
      toggleSettings(true);
      showToast('Token expired or invalid. Please update.', 'warning');
    }
  } else {
    toggleSettings(true);
    renderRepos();
  }
}

init();
