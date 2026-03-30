import { icon } from '../lib/icons.js';
import { escapeHtml, debounce } from '../lib/utils.js';
import { createState } from './state.js';
import { renderRepoCard } from './renderer.js';
import { showModal } from './components/modal.js';
import { showToast } from './components/toast.js';
import { showProgress, hideProgress } from './components/progress.js';

const state = createState();

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

function injectIcons() {
  const map = {
    headerIcon: ['hammer', { size: 20 }],
    settingsIcon: ['settings', {}],
    searchIcon: ['search', {}],
    refreshIcon: ['refresh', {}],
    externalLinkIcon: ['externalLink', {}],
    tokenToggleIcon: ['eye', {}],
    bulkPublicIcon: ['unlock', { size: 12 }],
    bulkPrivateIcon: ['lock', { size: 12 }],
    bulkArchiveIcon: ['archive', { size: 12 }],
    bulkDeleteIcon: ['trash', { size: 12 }],
    rateLimitIcon: ['shield', {}],
  };
  for (const [id, [name, opts]] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = icon(name, opts);
  }
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
    .map((r) => renderRepoCard(r, s.selected.has(r.full_name), s.busyRepos.has(r.full_name)))
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
  } else {
    state.set({ loading: false });
    showToast(res.error || 'Failed to load repos', 'error');
  }
  renderRepos();
  updateBulkBar();
}

async function handleSaveToken() {
  const input = document.getElementById('tokenInput');
  const statusEl = document.getElementById('tokenStatus');
  const t = input.value.trim();

  if (!t) {
    statusEl.className = 'text-2xs px-2 py-1 rounded bg-fh-red/10 text-fh-red';
    statusEl.textContent = 'Please enter a token';
    statusEl.classList.remove('hidden');
    return;
  }

  statusEl.className = 'text-2xs px-2 py-1 rounded bg-fh-accent/10 text-fh-accent flex items-center gap-1';
  statusEl.innerHTML = `<span class="animate-spin-slow">${icon('loader', { size: 12 })}</span> Validating…`;
  statusEl.classList.remove('hidden');

  const res = await send('VALIDATE_TOKEN', { token: t });

  if (res.ok) {
    const user = res.data;
    state.set({ token: t, user });
    statusEl.className = 'text-2xs px-2 py-1 rounded bg-fh-green/10 text-fh-green';
    statusEl.textContent = `Authenticated as @${user.login}`;
    showUserBadge(user);
    showToast(`Welcome, ${user.login}!`, 'success');
    setTimeout(() => toggleSettings(false), 800);
    loadRepos();
  } else {
    statusEl.className = 'text-2xs px-2 py-1 rounded bg-fh-red/10 text-fh-red';
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

async function handleDelete(fullName) {
  const repoName = fullName.split('/')[1];
  showModal({
    title: `Delete ${escapeHtml(repoName)}?`,
    body: `<p class="text-fh-red">This action is <strong>permanent</strong> and cannot be undone.</p>
           <p class="mt-1">All code, issues, PRs, and settings will be permanently deleted.</p>`,
    confirmText: 'Delete this repository',
    confirmClass: 'fh-btn-danger',
    typed: repoName,
    dangerous: true,
    onConfirm: async () => {
      state.markBusy(fullName);
      renderRepos();
      const res = await send('DELETE_REPO', { fullName });
      if (res.ok) {
        state.removeRepo(fullName);
        showToast(`${repoName} deleted`, 'success');
      } else {
        state.unmarkBusy(fullName);
        showToast(res.error || 'Delete failed', 'error');
      }
      renderRepos();
      updateBulkBar();
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
      const errors = [];

      for (const fullName of targets) {
        state.markBusy(fullName);
        renderRepos();
        showProgress(actionName, done, targets.length);

        try {
          await actionFn(fullName);
          done++;
        } catch (err) {
          failed++;
          errors.push(`${fullName.split('/')[1]}: ${err.message}`);
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
    body: `<p class="text-fh-red"><strong>This cannot be undone.</strong></p>
           <p class="mt-1">All code, issues, and settings for ${count} repos will be lost forever.</p>`,
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
    if (e.key === '/' && !e.target.closest('input, textarea')) {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if (e.ctrlKey && e.key === 'a' && !e.target.closest('input, textarea')) {
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
  });
}

async function init() {
  injectIcons();
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
