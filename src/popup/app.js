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
    settingsIcon: ['settings', {}],
    searchIcon: ['search', { size: 14 }],
    refreshIcon: ['refresh', {}],
    externalLinkIcon: ['externalLink', {}],
    tokenToggleIcon: ['eye', {}],
    bulkPublicIcon: ['unlock', { size: 12 }],
    bulkPrivateIcon: ['lock', { size: 12 }],
    bulkArchiveIcon: ['archive', { size: 12 }],
    bulkTopicsIcon: ['tag', { size: 12 }],
    bulkDescriptionIcon: ['edit', { size: 12 }],
    bulkFilesIcon: ['file', { size: 12 }],
    bulkTransferIcon: ['send', { size: 12 }],
    bulkForkIcon: ['fork', { size: 12 }],
    bulkDeleteIcon: ['trash', { size: 12 }],
    rateLimitIcon: ['shield', {}],
    cmdPaletteIcon: ['command', { size: 14 }],
    securityErrorIcon: ['alertTriangle', { size: 40 }],
    frameCloseIcon: ['x', { size: 14 }],
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
    { id: 'bulk-description', label: 'Edit descriptions of selected repos', icon: 'edit', category: 'Bulk Actions' },
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
      case 'bulk-description':
        handleBulkDescription();
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
    if (!s.token) {
      document.getElementById('emptyIcon').innerHTML = `<img src="../icons/icon-128.png" class="w-16 h-16 object-contain opacity-40 mx-auto" alt="ForgeHelm logo">`;
    } else {
      document.getElementById('emptyIcon').innerHTML = `<img src="../icons/icon-128.png" class="w-12 h-12 object-contain opacity-25 mx-auto" alt="ForgeHelm logo">`;
    }
    document.getElementById('emptyTitle').textContent = s.token ? 'No repositories found' : 'Welcome to ForgeHelm';
    document.getElementById('emptyDesc').textContent = s.token
      ? 'Your account has no owned repositories.'
      : 'Enter your classic GitHub PAT (`ghp_`) in Settings to get started.';
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
  const listEl = document.getElementById('repoList');

  if (s.selected.size > 0) {
    bar.classList.remove('hidden');
    countEl.textContent = `${s.selected.size} selected`;
    if (listEl) listEl.classList.add('pb-28');
  } else {
    bar.classList.add('hidden');
    if (listEl) listEl.classList.remove('pb-28');
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
  const chunkSize = 5;

  for (let i = 0; i < batch.length; i += chunkSize) {
    const chunk = batch.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (repo) => {
      try {
        const res = await send('GET_CI_STATUS', { fullName: repo.full_name });
        if (res.ok && res.data) {
          state.updateRepo(repo.full_name, { _ciStatus: res.data });
        }
      } catch (_) {
        // CI status is best-effort
      }
    }));
    renderRepos();
  }
}

async function handleSaveToken() {
  const input = document.getElementById('tokenInput');
  const pinInput = document.getElementById('settingsPinInput');
  const statusEl = document.getElementById('tokenStatus');
  const t = input.value.trim();
  const p = pinInput.value.trim();

  if (!t) {
    statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-red-subtle text-fh-red';
    statusEl.textContent = 'Please enter a token';
    statusEl.classList.remove('hidden');
    return;
  }

  if (p.length !== 4) {
    statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-red-subtle text-fh-red';
    statusEl.textContent = 'Please enter a 4-digit security PIN';
    statusEl.classList.remove('hidden');
    return;
  }

  statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-accent-subtle text-fh-accent flex items-center gap-1';
  statusEl.innerHTML = `<span class="animate-spin-slow">${icon('loader', { size: 12 })}</span> Validating & encrypting…`;
  statusEl.classList.remove('hidden');

  const res = await send('SET_TOKEN_ENCRYPTED', { token: t, pin: p });

  if (res.ok) {
    const user = res.data;
    state.set({ token: t, user });
    const caps = await send('CHECK_TOKEN_CAPABILITIES', { token: t });

    statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-green-subtle text-fh-green';
    if (caps.ok) {
      const capData = caps.data;
      const missing = [];
      if (!capData.scopes.repo) missing.push('repo');
      if (!capData.scopes.delete_repo) missing.push('delete_repo');

      if (missing.length > 0) {
        statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-yellow-subtle text-fh-yellow';
        statusEl.textContent = `Authenticated as @${user.login}. Missing scope(s): ${missing.join(', ')}`;
        showToast(`Token warning: missing ${missing.join(', ')}`, 'warning');
      } else {
        statusEl.textContent = `Authenticated as @${user.login} · token encrypted successfully`;
      }
    } else {
      statusEl.textContent = `Authenticated as @${user.login} · token encrypted successfully`;
    }

    pinInput.value = '';
    showUserBadge(user);
    showToast(`Welcome, ${user.login}!`, 'success');
    setTimeout(() => toggleSettings(false), 800);
    loadRepos();
  } else {
    statusEl.className = 'text-2xs px-2.5 py-1.5 rounded-lg bg-fh-red-subtle text-fh-red';
    statusEl.textContent = res.error || 'Token validation or encryption failed';
    showToast('Failed to save encrypted token', 'error');
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
  if (isOpen) {
    updatePinSettingsUI();
  }
}

async function updatePinSettingsUI() {
  const hasPinRes = await send('HAS_PIN_CREATED');
  const labelEl = document.getElementById('pinSettingsLabel');
  const pinInput = document.getElementById('settingsPinInput');
  const bannerEl = document.getElementById('migrationBanner');
  
  if (!labelEl || !pinInput || !bannerEl) return;
  
  const hasPin = hasPinRes.ok && hasPinRes.data;
  if (hasPin) {
    labelEl.textContent = 'Enter current 4-digit PIN to save updates';
    pinInput.placeholder = '••••';
    bannerEl.classList.add('hidden');
  } else {
    labelEl.textContent = 'Create a 4-digit PIN to encrypt token';
    pinInput.placeholder = 'Set PIN';
    
    // Check for legacy token
    const legacyRes = await send('HAS_LEGACY_TOKEN');
    if (legacyRes.ok && legacyRes.data) {
      bannerEl.classList.remove('hidden');
    } else {
      bannerEl.classList.add('hidden');
    }
  }

  // Load and sync autoLockTimeout setting
  const autoLockSelect = document.getElementById('autoLockSelect');
  if (autoLockSelect) {
    const settingsRes = await send('GET_SETTINGS');
    if (settingsRes.ok && settingsRes.data) {
      autoLockSelect.value = settingsRes.data.autoLockTimeout !== undefined ? settingsRes.data.autoLockTimeout : 0;
    }
  }

  // Load and sync launcher checkbox setting
  const launcherCheckbox = document.getElementById('launcherCheckbox');
  if (launcherCheckbox) {
    const settingsRes = await send('GET_SETTINGS');
    if (settingsRes.ok && settingsRes.data) {
      launcherCheckbox.checked = settingsRes.data.showFloatingLauncher !== false;
    }
  }

  // Update token capabilities
  const capPanel = document.getElementById('capabilitiesPanel');
  if (capPanel) {
    const activeToken = state.get().token;
    if (activeToken) {
      const capsRes = await send('CHECK_TOKEN_CAPABILITIES', { token: activeToken });
      if (capsRes.ok && capsRes.data) {
        const caps = capsRes.data;
        capPanel.classList.remove('hidden');
        
        const typeEl = document.getElementById('capTokenType');
        if (typeEl) {
          typeEl.textContent = caps.tokenType || 'unknown';
        }
        
        const repoIndicator = document.getElementById('capScopeRepo');
        if (repoIndicator) {
          repoIndicator.className = `w-2 h-2 rounded-full transition-colors ${caps.scopes.repo ? 'bg-fh-green' : 'bg-fh-red'}`;
        }
        
        const deleteIndicator = document.getElementById('capScopeDelete');
        if (deleteIndicator) {
          deleteIndicator.className = `w-2 h-2 rounded-full transition-colors ${caps.scopes.delete_repo ? 'bg-fh-green' : 'bg-fh-red'}`;
        }
        
        const warnEl = document.getElementById('capWarnings');
        if (warnEl) {
          const missing = [];
          if (!caps.scopes.repo) missing.push('repo');
          if (!caps.scopes.delete_repo) missing.push('delete_repo');
          
          if (missing.length > 0) {
            warnEl.textContent = `⚠️ Missing scope: ${missing.join(', ')}`;
            warnEl.classList.remove('hidden');
          } else {
            warnEl.classList.add('hidden');
          }
        }
      } else {
        capPanel.classList.add('hidden');
      }
    } else {
      capPanel.classList.add('hidden');
    }
  }
}

function showUnlockScreen() {
  const el = document.getElementById('unlockScreen');
  if (el) el.classList.remove('hidden');
  const pinInput = document.getElementById('unlockPinInput');
  if (pinInput) {
    pinInput.value = '';
    pinInput.focus();
  }
}

async function handleUnlock() {
  const pinInput = document.getElementById('unlockPinInput');
  const pin = pinInput.value.trim();
  const errEl = document.getElementById('unlockError');
  
  if (pin.length !== 4) {
    errEl.textContent = 'PIN must be 4 digits';
    errEl.classList.remove('hidden');
    return;
  }
  
  errEl.classList.add('hidden');
  const unlockBtn = document.getElementById('unlockBtn');
  unlockBtn.disabled = true;
  unlockBtn.textContent = 'Unlocking...';
  
  const res = await send('UNLOCK_TOKEN', { pin });
  unlockBtn.disabled = false;
  unlockBtn.textContent = 'Unlock';
  
  if (res.ok) {
    const user = res.data;
    state.set({ token: res.token, user });
    document.getElementById('unlockScreen').classList.add('hidden');
    showUserBadge(user);
    loadRepos();
    refreshRateLimit();
    showToast(`Welcome back!`, 'success');
    
    // Sync settings token input field
    const tokenRes = await send('GET_TOKEN');
    if (tokenRes.ok && tokenRes.data?.token) {
      document.getElementById('tokenInput').value = tokenRes.data.token;
    }
  } else {
    errEl.textContent = res.error || 'Incorrect PIN';
    errEl.classList.remove('hidden');
    pinInput.value = '';
    pinInput.focus();
  }
}

async function handleForgotPin() {
  showModal({
    title: 'Clear Storage?',
    body: '<p class="text-fh-red font-medium">This will clear your saved GitHub token and PIN.</p><p class="text-fh-text-muted mt-1">You will need to configure your GitHub token and set a new PIN again.</p>',
    confirmText: 'Clear Everything',
    confirmClass: 'fh-btn-danger',
    dangerous: true,
    onConfirm: async () => {
      await send('CLEAR_TOKEN');
      document.getElementById('unlockScreen').classList.add('hidden');
      toggleSettings(true);
      loadRepos();
      showToast('Storage cleared. Please set up a new token.', 'info');
    }
  });
}

function showSecurityBlockedScreen() {
  const el = document.getElementById('securityBlockedScreen');
  if (el) el.classList.remove('hidden');
  const iconEl = document.getElementById('securityErrorIcon');
  if (iconEl) iconEl.innerHTML = icon('alertTriangle', { size: 40 });
}

function toggleTokenVisibility() {
  const input = document.getElementById('tokenInput');
  const iconEl = document.getElementById('tokenToggleIcon');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  iconEl.innerHTML = icon(isPassword ? 'eyeOff' : 'eye');
}

async function handleChangeVisibility(fullName, currentlyPrivate) {
  const repo = state.get().allRepos.find((r) => r.full_name === fullName);
  if (repo?.archived) {
    showToast('Cannot change visibility of archived repo. Unarchive first.', 'warning');
    return;
  }
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
        const updated = state.get().allRepos.find((r) => r.full_name === fullName);
        const hiddenByVisibility = state.get().visibility === 'private' && updated && !updated.private;
        showToast(
          hiddenByVisibility
            ? `${fullName.split('/')[1]} is now ${newVis} (hidden by current filter)`
            : `${fullName.split('/')[1]} is now ${newVis}`,
          'success'
        );
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
        const updated = state.get().allRepos.find((r) => r.full_name === fullName);
        const hiddenByArchived = state.get().type === 'archived' && updated && !updated.archived;
        showToast(
          hiddenByArchived
            ? `${fullName.split('/')[1]} ${action}d (hidden by current filter)`
            : `${fullName.split('/')[1]} ${action}d`,
          'success'
        );
      } else {
        showToast(res.error || `Failed to ${action}`, 'error');
      }
      renderRepos();
    },
  });
}

async function handleTopics(fullName) {
  const repoName = fullName.split('/')[1];
  state.markBusy(fullName);
  renderRepos();

  const topicsRes = await send('GET_TOPICS', { fullName });
  state.unmarkBusy(fullName);
  renderRepos();

  const currentTopics = (topicsRes.ok && Array.isArray(topicsRes.data)) ? topicsRes.data : [];

  showModal({
    title: `Topics for ${escapeHtml(repoName)}`,
    body: `<p class="text-fh-text-secondary mb-2">Current: ${currentTopics.length > 0 ? currentTopics.map(t => `<span class="fh-badge border-fh-accent/20 bg-fh-accent-subtle text-fh-accent mr-1">${escapeHtml(t)}</span>`).join('') : '<span class="text-fh-text-muted">none</span>'}</p>
           <div class="mt-3">
             <label class="text-2xs text-fh-text-muted block mb-1.5">New topics <span class="text-fh-text-muted">(comma-separated)</span></label>
             <input data-field="topics" type="text" class="fh-input text-xs" autocomplete="off" spellcheck="false" placeholder="react, typescript, awesome" value="${escapeHtml(currentTopics.join(', '))}" aria-label="Repository topics">
           </div>`,
    confirmText: 'Update Topics',
    confirmClass: 'fh-btn-primary',
    onConfirm: async (formData) => {
      const raw = formData.topics || '';
      const topics = raw.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
      state.markBusy(fullName);
      renderRepos();
      const res = await send('UPDATE_TOPICS', { fullName, topics });
      state.unmarkBusy(fullName);
      if (res.ok) {
        showToast(`${repoName} topics updated`, 'success');
      } else {
        showToast(res.error || 'Failed to update topics', 'error');
      }
      renderRepos();
    },
  });
}

async function handleDescription(fullName) {
  const repo = state.get().allRepos.find((r) => r.full_name === fullName);
  const repoName = fullName.split('/')[1];
  const currentDescription = repo?.description || '';

  showModal({
    title: `Edit description for ${escapeHtml(repoName)}`,
    body: `<div class="mt-1">
             <label class="text-2xs text-fh-text-muted block mb-1.5">Description</label>
             <input data-field="description" type="text" class="fh-input text-xs" autocomplete="off" spellcheck="false" placeholder="Repository description" value="${escapeHtml(currentDescription)}" aria-label="Repository description">
           </div>`,
    confirmText: 'Update Description',
    confirmClass: 'fh-btn-primary',
    onConfirm: async (formData) => {
      const description = (formData.description || '').trim();
      state.markBusy(fullName);
      renderRepos();
      const res = await send('UPDATE_REPO', { fullName, updates: { description } });
      state.unmarkBusy(fullName);
      if (res.ok) {
        state.updateRepo(fullName, res.data);
        showToast(`${repoName} description updated`, 'success');
      } else {
        showToast(res.error || 'Failed to update description', 'error');
      }
      renderRepos();
    },
  });
}

function handleBulkDescription() {
  const count = state.get().selected.size;
  showModal({
    title: `Edit description on ${count} repos`,
    body: `<p class="text-fh-text-secondary mb-2">This will set the same description for all selected repositories.</p>
           <div class="mt-3">
             <label class="text-2xs text-fh-text-muted block mb-1.5">Description</label>
             <input data-field="description" type="text" class="fh-input text-xs" autocomplete="off" spellcheck="false" placeholder="Repository description" aria-label="Repository description">
           </div>`,
    confirmText: `Update ${count} repos`,
    confirmClass: 'fh-btn-primary',
    onConfirm: async (formData) => {
      const description = (formData.description || '').trim();
      const targets = [...state.get().selected];
      let done = 0;
      let failed = 0;

      for (const fullName of targets) {
        state.markBusy(fullName);
        renderRepos();
        showProgress('Edit Description', done, targets.length);

        try {
          const res = await send('UPDATE_REPO', { fullName, updates: { description } });
          if (!res.ok) throw new Error(res.error);
          state.updateRepo(fullName, res.data);
          done++;
        } catch (_) {
          failed++;
        }

        state.unmarkBusy(fullName);
        showProgress('Edit Description', done + failed, targets.length);
      }

      hideProgress();
      state.deselectAll();
      renderRepos();
      updateBulkBar();

      if (failed === 0) {
        showToast(`Description updated on ${done} repos`, 'success');
      } else {
        showToast(`Description: ${done} done, ${failed} failed`, 'warning');
      }
    },
  });
}

async function handleTransfer(fullName) {
  const repoName = fullName.split('/')[1];
  showModal({
    title: `Transfer ${escapeHtml(repoName)}`,
    body: `<p class="text-fh-text-secondary font-medium">This sends a transfer request. The recipient must accept it.</p>
           <div class="mt-3 space-y-2">
             <div>
               <label class="text-2xs text-fh-text-muted block mb-1.5">New owner <span class="text-fh-red">*</span></label>
               <input data-field="newOwner" type="text" class="fh-input text-xs font-mono" autocomplete="off" spellcheck="false" placeholder="username or org" aria-label="New owner">
             </div>
             <div>
               <label class="text-2xs text-fh-text-muted block mb-1.5">New name <span class="text-fh-text-muted">(optional)</span></label>
               <input data-field="newName" type="text" class="fh-input text-xs font-mono" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(repoName)}" aria-label="New repository name">
             </div>
           </div>`,
    confirmText: 'Send Request',
    confirmClass: 'fh-btn-primary',
    typed: repoName,
    dangerous: false,
    onConfirm: async (formData) => {
      const newOwner = (formData.newOwner || '').trim();
      if (!newOwner) {
        showToast('New owner is required', 'error');
        return;
      }
      const newName = (formData.newName || '').trim() || undefined;
      state.markBusy(fullName);
      renderRepos();
      const res = await send('TRANSFER_REPO', { fullName, newOwner, newName });
      state.unmarkBusy(fullName);
      if (res.ok) {
        showToast(`Transfer requested. ${newOwner} must accept it.`, 'success');
      } else {
        // Show detailed error from GitHub API
        showToast(`Transfer failed: ${res.error || 'Unknown error'}`, 'error');
      }
      renderRepos();
      updateBulkBar();
    },
  });
}

async function handleFork(fullName) {
  const repoName = fullName.split('/')[1];
  showModal({
    title: `Fork ${escapeHtml(repoName)}`,
    body: `<p class="text-fh-text-secondary">Fork this repository to your account or an organization.</p>
           <div class="mt-3">
             <label class="text-2xs text-fh-text-muted block mb-1.5">Organization <span class="text-fh-text-muted">(leave empty for personal account)</span></label>
             <input data-field="org" type="text" class="fh-input text-xs font-mono" autocomplete="off" spellcheck="false" placeholder="optional org name" aria-label="Organization name">
           </div>`,
    confirmText: 'Fork',
    confirmClass: 'fh-btn-primary',
    onConfirm: async (formData) => {
      const org = (formData.org || '').trim() || undefined;
      state.markBusy(fullName);
      renderRepos();
      const res = await send('FORK_REPO', { fullName, org });
      state.unmarkBusy(fullName);
      if (res.ok) {
        showToast(`${repoName} forked successfully`, 'success');
      } else {
        showToast(`Fork failed: ${res.error || 'Unknown error'}`, 'error');
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
    typed: 'DELETE',
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
  const targets = confirmOpts?.targets || [...s.selected];
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
  const selected = [...state.get().selected];
  const archivedTargets = selected.filter((fullName) => {
    const repo = state.get().allRepos.find((r) => r.full_name === fullName);
    return repo?.archived;
  });

  if (archivedTargets.length > 0) {
    showToast(`Skip ${archivedTargets.length} archived repo(s). Unarchive first, then make public.`, 'warning');
  }

  const targets = selected.filter((fullName) => !archivedTargets.includes(fullName));
  const count = targets.length;
  if (count === 0) return;

  runBulkAction('Make Public', async (fn) => {
    const res = await send('CHANGE_VISIBILITY', { fullName: fn, isPrivate: false });
    if (!res.ok) throw new Error(res.error);
    state.updateRepo(fn, res.data);
  }, {
    targets,
    title: `Make ${count} repos public?`,
    body: 'All selected non-archived repos will become publicly visible.',
    confirmText: `Make ${count} public`,
    confirmClass: 'fh-btn-primary',
  });
}

function handleBulkPrivate() {
  const selected = [...state.get().selected];
  const archivedTargets = selected.filter((fullName) => {
    const repo = state.get().allRepos.find((r) => r.full_name === fullName);
    return repo?.archived;
  });

  if (archivedTargets.length > 0) {
    showToast(`Skip ${archivedTargets.length} archived repo(s). Unarchive first, then make private.`, 'warning');
  }

  const targets = selected.filter((fullName) => !archivedTargets.includes(fullName));
  const count = targets.length;
  if (count === 0) return;

  runBulkAction('Make Private', async (fn) => {
    const res = await send('CHANGE_VISIBILITY', { fullName: fn, isPrivate: true });
    if (!res.ok) throw new Error(res.error);
    state.updateRepo(fn, res.data);
  }, {
    targets,
    title: `Make ${count} repos private?`,
    body: 'All selected non-archived repos will become private.',
    confirmText: `Make ${count} private`,
    confirmClass: 'fh-btn-primary',
  });
}

function handleBulkArchive() {
  const selected = [...state.get().selected];
  const archivedTargets = selected.filter((fullName) => {
    const repo = state.get().allRepos.find((r) => r.full_name === fullName);
    return repo?.archived;
  });

  const actionLabel = archivedTargets.length > 0 ? 'Archive/Unarchive' : 'Archive';
  const count = selected.length;

  runBulkAction(actionLabel, async (fn) => {
    const repo = state.get().allRepos.find((r) => r.full_name === fn);
    const nextArchived = repo?.archived ? false : true;
    const res = await send('ARCHIVE_REPO', { fullName: fn, archived: nextArchived });
    if (!res.ok) throw new Error(res.error);
    state.updateRepo(fn, res.data);
  }, {
    title: `${archivedTargets.length > 0 ? 'Toggle archive state for' : 'Archive'} ${count} repos?`,
    body: archivedTargets.length > 0
      ? 'Archived repos will be unarchived; non-archived repos will be archived.'
      : 'Archived repos become read-only. You can unarchive later.',
    confirmText: `${archivedTargets.length > 0 ? 'Apply to' : 'Archive'} ${count} repos`,
    confirmClass: 'fh-btn-primary',
    dangerous: true,
  });
}

function handleBulkFiles() {
  const count = state.get().selected.size;
  showModal({
    title: `Commit File to ${count} Repos`,
    body: `<div class="space-y-3">
             <div>
               <label class="text-2xs text-fh-text-muted block mb-1">Select Template</label>
               <select id="fileTemplateSelect" class="fh-select text-xs w-full">
                 <option value="custom">Custom (Blank)</option>
                 <option value="mit">MIT License</option>
                 <option value="gitignore-node">Node.js .gitignore</option>
                 <option value="gitignore-python">Python .gitignore</option>
                 <option value="readme">Simple README.md</option>
                 <option value="ci-workflow">Node.js CI Workflow</option>
               </select>
             </div>
             <div>
               <label class="text-2xs text-fh-text-muted block mb-1">File Path</label>
               <input id="filePathInput" data-field="path" type="text" class="fh-input text-xs font-mono" placeholder="LICENSE" autocomplete="off" spellcheck="false" required>
             </div>
             <div>
               <label class="text-2xs text-fh-text-muted block mb-1">File Content</label>
               <textarea id="fileContentInput" data-field="content" rows="6" class="fh-input text-xs font-mono w-full resize-y h-24 whitespace-pre" placeholder="Enter file content..." autocomplete="off" spellcheck="false" required></textarea>
             </div>
             <div>
               <label class="text-2xs text-fh-text-muted block mb-1">Commit Message</label>
               <input id="fileMessageInput" data-field="commitMessage" type="text" class="fh-input text-xs" placeholder="docs: add LICENSE" autocomplete="off" spellcheck="false" required>
             </div>
           </div>`,
    confirmText: `Commit to ${count} Repos`,
    confirmClass: 'fh-btn-primary',
    onConfirm: async (formData) => {
      const path = (formData.path || '').trim();
      const content = formData.content || '';
      const commitMessage = (formData.commitMessage || '').trim();

      if (!path || !content || !commitMessage) {
        showToast('Please fill in path, content, and commit message.', 'error');
        return;
      }

      const targets = [...state.get().selected];
      let done = 0;
      let failed = 0;

      for (const fullName of targets) {
        state.markBusy(fullName);
        renderRepos();
        showProgress('Commit File', done, targets.length);

        try {
          const repoName = fullName.split('/')[1];
          const owner = fullName.split('/')[0];
          const resolvedContent = content
            .replace(/\[YEAR\]/g, new Date().getFullYear())
            .replace(/\[OWNER\]/g, owner)
            .replace(/\[REPO_NAME\]/g, repoName)
            .replace(/\[FULL_NAME\]/g, fullName);

          const res = await send('CREATE_OR_UPDATE_FILE', {
            fullName,
            path,
            content: resolvedContent,
            commitMessage,
          });

          if (!res.ok) throw new Error(res.error);
          done++;
        } catch (err) {
          failed++;
        }

        state.unmarkBusy(fullName);
        showProgress('Commit File', done + failed, targets.length);
      }

      hideProgress();
      state.deselectAll();
      renderRepos();
      updateBulkBar();

      if (failed === 0) {
        showToast(`File committed to ${done} repos`, 'success');
      } else {
        showToast(`Commit: ${done} done, ${failed} failed`, 'warning');
      }
    },
  });

  const templateSelect = document.getElementById('fileTemplateSelect');
  const pathInput = document.getElementById('filePathInput');
  const contentInput = document.getElementById('fileContentInput');
  const messageInput = document.getElementById('fileMessageInput');

  if (templateSelect && pathInput && contentInput && messageInput) {
    templateSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected === 'mit') {
        pathInput.value = 'LICENSE';
        contentInput.value = `MIT License\n\nCopyright (c) [YEAR] [OWNER]\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.`;
        messageInput.value = 'docs: add MIT license';
      } else if (selected === 'gitignore-node') {
        pathInput.value = '.gitignore';
        contentInput.value = `# Logs\nlogs\n*.log\nnpm-debug.log*\nyarn-debug.log*\nyarn-error.log*\n\n# Dependency directories\nnode_modules/\njspm_packages/\n\n# Optional npm cache directory\n.npm\n\n# Output / distribution\ndist/\nbuild/\n\n# Environment variables\n.env\n.env.local\n.env.development.local\n.env.test.local\n.env.production.local\n\n# IDEs\n.vscode/\n.idea/\n*.suo\n*.ntvs*\n*.njsproj\n*.sln\n*.sw?`;
        messageInput.value = 'chore: add Node.js .gitignore';
      } else if (selected === 'gitignore-python') {
        pathInput.value = '.gitignore';
        contentInput.value = `# Byte-compiled / optimized / DLL files\n__pycache__/\n*.py[cod]\n*$py.class\n\n# C extensions\n*.so\n\n# Distribution / packaging\nbuild/\ndevelop-eggs/\ndist/\ndownloads/\neggs/\n.eggs/\nlib/\nlib64/\nparts/\nsbin/\nvar/\nwheels/\nshare/python-wheels/\n*.egg-info/\n.installed.cfg\n*.egg\nMANIFEST\n\n# Installer logs\npip-log.txt\npip-delete-this-directory.txt\n\n# Unit test / coverage reports\nhtmlcov/\n.tox/\n.nosexyproject\n.coverage\n.coverage.*\n.cache\nnosetests.xml\ncoverage.xml\n*.cover\n*.py,cover\n.hypothesis/\n.pytest_cache/\n\n# Translation\n*.mo\n*.pot\n\n# Django stuff:\n*.log\nlocal_settings.py\ndb.sqlite3\ndb.sqlite3-journal\n\n# Flask stuff:\ninstance/\n.webassets-cache\n\n# Virtual environments\nvenv/\n.venv/\nenv/\nENV/\nenv.bak/\nvenv.bak/`;
        messageInput.value = 'chore: add Python .gitignore';
      } else if (selected === 'readme') {
        pathInput.value = 'README.md';
        contentInput.value = `# [REPO_NAME]\n\nA new repository created/managed via ForgeHelm.\n\n## Setup\n\nClone the repository:\n\`\`\`bash\ngit clone https://github.com/[FULL_NAME].git\n\`\`\`\n\n## License\n\nMIT`;
        messageInput.value = 'docs: add README';
      } else if (selected === 'ci-workflow') {
        pathInput.value = '.github/workflows/ci.yml';
        contentInput.value = `name: Node.js CI\n\non:\n  push:\n    branches: [ main, master ]\n  pull_request:\n    branches: [ main, master ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n\n    steps:\n    - uses: actions/checkout@v4\n    - name: Use Node.js\n      uses: actions/setup-node@v4\n      with:\n        node-version: '20'\n        cache: 'npm'\n    - run: npm ci\n    - run: npm run build --if-present\n    - run: npm test --if-present`;
        messageInput.value = 'chore: add Node.js GitHub Actions workflow';
      } else {
        pathInput.value = '';
        contentInput.value = '';
        messageInput.value = '';
      }
    });
  }
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
    typed: 'DELETE',
    dangerous: true,
  });
}

function handleBulkTopics() {
  const count = state.get().selected.size;
  showModal({
    title: `Set topics on ${count} repos`,
    body: `<p class="text-fh-text-secondary mb-2">These topics will <strong>replace</strong> existing topics on all selected repos.</p>
           <div class="mt-3">
             <label class="text-2xs text-fh-text-muted block mb-1.5">Topics <span class="text-fh-text-muted">(comma-separated)</span></label>
             <input data-field="topics" type="text" class="fh-input text-xs" autocomplete="off" spellcheck="false" placeholder="react, typescript, awesome" aria-label="Repository topics">
           </div>`,
    confirmText: `Update ${count} repos`,
    confirmClass: 'fh-btn-primary',
    onConfirm: async (formData) => {
      const raw = formData.topics || '';
      const topics = raw.split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
      const targets = [...state.get().selected];
      let done = 0;
      let failed = 0;

      for (const fullName of targets) {
        state.markBusy(fullName);
        renderRepos();
        showProgress('Set Topics', done, targets.length);

        try {
          const res = await send('UPDATE_TOPICS', { fullName, topics });
          if (!res.ok) throw new Error(res.error);
          done++;
        } catch (_) {
          failed++;
        }

        state.unmarkBusy(fullName);
        showProgress('Set Topics', done + failed, targets.length);
      }

      hideProgress();
      state.deselectAll();
      renderRepos();
      updateBulkBar();

      if (failed === 0) {
        showToast(`Topics updated on ${done} repos`, 'success');
      } else {
        showToast(`Topics: ${done} done, ${failed} failed`, 'warning');
      }
    },
  });
}

function handleBulkTransfer() {
  const count = state.get().selected.size;
  showModal({
    title: `Transfer ${count} repos`,
    body: `<p class="text-fh-text-secondary font-medium">This sends transfer requests. Recipients must accept them.</p>
           <div class="mt-3 space-y-2">
             <div>
               <label class="text-2xs text-fh-text-muted block mb-1.5">New owner <span class="text-fh-red">*</span></label>
               <input data-field="newOwner" type="text" class="fh-input text-xs font-mono" autocomplete="off" spellcheck="false" placeholder="username or org" aria-label="New owner">
             </div>
             <div>
               <label class="text-2xs text-fh-text-muted block mb-1.5">New name <span class="text-fh-text-muted">(optional, applied to all)</span></label>
               <input data-field="newName" type="text" class="fh-input text-xs font-mono" autocomplete="off" spellcheck="false" placeholder="leave empty to keep original names" aria-label="New repository name">
             </div>
           </div>`,
    confirmText: `Transfer ${count} repos`,
    confirmClass: 'fh-btn-primary',
    typed: 'TRANSFER',
    dangerous: false,
    onConfirm: async (formData) => {
      const newOwner = (formData.newOwner || '').trim();
      if (!newOwner) {
        showToast('New owner is required', 'error');
        return;
      }
      const newName = (formData.newName || '').trim() || undefined;
      const targets = [...state.get().selected];
      let done = 0;
      let failed = 0;

      for (const fullName of targets) {
        state.markBusy(fullName);
        renderRepos();
        showProgress('Transfer', done, targets.length);

        try {
          const res = await send('TRANSFER_REPO', { fullName, newOwner, newName });
          if (!res.ok) throw new Error(res.error);
          done++;
        } catch (err) {
          console.error(`Transfer failed for ${fullName}:`, err);
          failed++;
        }

        state.unmarkBusy(fullName);
        showProgress('Transfer', done + failed, targets.length);
      }

      hideProgress();
      state.deselectAll();
      renderRepos();
      updateBulkBar();

      if (failed === 0) {
        showToast(`Transfer requested for ${done} repos. ${newOwner} must accept.`, 'success');
      } else {
        showToast(`Transfer: ${done} requested, ${failed} failed`, 'warning');
      }
    },
  });
}

function handleBulkFork() {
  const count = state.get().selected.size;
  showModal({
    title: `Fork ${count} repos`,
    body: `<p class="text-fh-text-secondary">Fork all selected repos to your account or an organization.</p>
           <div class="mt-3">
             <label class="text-2xs text-fh-text-muted block mb-1.5">Organization <span class="text-fh-text-muted">(leave empty for personal account)</span></label>
             <input data-field="org" type="text" class="fh-input text-xs font-mono" autocomplete="off" spellcheck="false" placeholder="optional org name" aria-label="Organization name">
           </div>`,
    confirmText: `Fork ${count} repos`,
    confirmClass: 'fh-btn-primary',
    onConfirm: async (formData) => {
      const org = (formData.org || '').trim() || undefined;
      const targets = [...state.get().selected];
      let done = 0;
      let failed = 0;

      for (const fullName of targets) {
        state.markBusy(fullName);
        renderRepos();
        showProgress('Fork', done, targets.length);

        try {
          const res = await send('FORK_REPO', { fullName, org });
          if (!res.ok) throw new Error(res.error);
          done++;
        } catch (err) {
          console.error(`Fork failed for ${fullName}:`, err);
          failed++;
        }

        state.unmarkBusy(fullName);
        showProgress('Fork', done + failed, targets.length);
      }

      hideProgress();
      state.deselectAll();
      renderRepos();
      updateBulkBar();

      if (failed === 0) {
        showToast(`${done} repos forked`, 'success');
      } else {
        showToast(`Fork: ${done} done, ${failed} failed`, 'warning');
      }
    },
  });
}

function bindEvents() {
  document.getElementById('settingsBtn').addEventListener('click', () => toggleSettings());
  document.getElementById('saveTokenBtn').addEventListener('click', handleSaveToken);
  document.getElementById('clearTokenBtn').addEventListener('click', handleClearToken);
  document.getElementById('tokenToggleBtn').addEventListener('click', toggleTokenVisibility);
  document.getElementById('refreshBtn').addEventListener('click', loadRepos);

  const autoLockSelect = document.getElementById('autoLockSelect');
  if (autoLockSelect) {
    autoLockSelect.addEventListener('change', async (e) => {
      const res = await send('GET_SETTINGS');
      if (res.ok) {
        const settings = res.data || {};
        settings.autoLockTimeout = parseInt(e.target.value, 10);
        await send('SAVE_SETTINGS', { settings });
        showToast('Auto-lock setting updated', 'success');
      }
    });
  }

  const launcherCheckbox = document.getElementById('launcherCheckbox');
  if (launcherCheckbox) {
    launcherCheckbox.addEventListener('change', async (e) => {
      const res = await send('GET_SETTINGS');
      if (res.ok) {
        const settings = res.data || {};
        settings.showFloatingLauncher = e.target.checked;
        await send('SAVE_SETTINGS', { settings });
        showToast('Launcher preference updated', 'success');
      }
    });
  }

  const frameCloseBtn = document.getElementById('frameCloseBtn');
  if (frameCloseBtn) {
    frameCloseBtn.addEventListener('click', () => {
      window.parent.postMessage({ type: 'FH_CLOSE_SIDEBAR' }, '*');
    });
  }

  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', handleThemeToggle);

  const cmdPaletteBtn = document.getElementById('cmdPaletteBtn');
  if (cmdPaletteBtn) cmdPaletteBtn.addEventListener('click', openPalette);

  const cmdPaletteHint = document.getElementById('cmdPaletteHint');
  if (cmdPaletteHint) cmdPaletteHint.addEventListener('click', openPalette);

  document.getElementById('tokenInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveToken();
  });

  const settingsPinInput = document.getElementById('settingsPinInput');
  if (settingsPinInput) {
    settingsPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSaveToken();
    });
  }

  const unlockBtn = document.getElementById('unlockBtn');
  if (unlockBtn) unlockBtn.addEventListener('click', handleUnlock);

  const forgotPinBtn = document.getElementById('forgotPinBtn');
  if (forgotPinBtn) forgotPinBtn.addEventListener('click', handleForgotPin);

  const unlockPinInput = document.getElementById('unlockPinInput');
  if (unlockPinInput) {
    unlockPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleUnlock();
    });
  }

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

    const topicsBtn = e.target.closest('.topics-btn');
    if (topicsBtn) {
      handleTopics(topicsBtn.dataset.name);
      return;
    }

    const descriptionBtn = e.target.closest('.description-btn');
    if (descriptionBtn) {
      handleDescription(descriptionBtn.dataset.name);
      return;
    }

    const transferBtn = e.target.closest('.transfer-btn');
    if (transferBtn) {
      handleTransfer(transferBtn.dataset.name);
      return;
    }

    const forkBtn = e.target.closest('.fork-btn');
    if (forkBtn) {
      handleFork(forkBtn.dataset.name);
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
  document.getElementById('bulkTopicsBtn').addEventListener('click', handleBulkTopics);
  document.getElementById('bulkTransferBtn').addEventListener('click', handleBulkTransfer);
  document.getElementById('bulkForkBtn').addEventListener('click', handleBulkFork);
  document.getElementById('bulkDescriptionBtn').addEventListener('click', handleBulkDescription);
  document.getElementById('bulkFilesBtn').addEventListener('click', handleBulkFiles);
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

  // 1. Check framed context & challenge handshake
  const isFramed = window.self !== window.top;
  if (isFramed) {
    const closeBtn = document.getElementById('frameCloseBtn');
    if (closeBtn) closeBtn.classList.remove('hidden');
    
    const urlParams = new URLSearchParams(window.location.search);
    const challenge = urlParams.get('challenge');
    if (!challenge) {
      showSecurityBlockedScreen();
      return;
    }
    const handshakeRes = await send('VERIFY_CHALLENGE', { challenge });
    if (!handshakeRes.ok || !handshakeRes.data) {
      showSecurityBlockedScreen();
      return;
    }
  }

  // 2. Check lock state
  const isLockedRes = await send('IS_LOCKED');
  if (isLockedRes.ok && isLockedRes.data) {
    showUnlockScreen();
    return;
  }

  // 3. Normal token loading
  const tokenRes = await send('GET_TOKEN');
  if (tokenRes.ok && tokenRes.data?.token) {
    state.set({ token: tokenRes.data.token });
    document.getElementById('tokenInput').value = tokenRes.data.token;

    const validateRes = await send('VALIDATE_TOKEN', { token: tokenRes.data.token });
    if (validateRes.ok) {
      state.set({ user: validateRes.data });
      showUserBadge(validateRes.data);
      loadRepos();
      refreshRateLimit();
    } else {
      toggleSettings(true);
      showToast('Token expired or invalid. Please update.', 'warning');
    }
  } else {
    // If PIN is not set up but we have a legacy token, we can still load it or prompt settings
    const hasPinRes = await send('HAS_PIN_CREATED');
    if (hasPinRes.ok && !hasPinRes.data) {
      // Check if they have a legacy token
      const legacyRes = await send('HAS_LEGACY_TOKEN');
      if (legacyRes.ok && legacyRes.data) {
        // We have a legacy token. Load it and display migration warning
        const legacyTokenRes = await send('GET_TOKEN');
        if (legacyTokenRes.ok && legacyTokenRes.data?.token) {
          state.set({ token: legacyTokenRes.data.token });
          const validateRes = await send('VALIDATE_TOKEN', { token: legacyTokenRes.data.token });
          if (validateRes.ok) {
            state.set({ user: validateRes.data });
            showUserBadge(validateRes.data);
            loadRepos();
            refreshRateLimit();
            toggleSettings(true); // Open settings to show migration banner
            return;
          }
        }
      }
    }
    
    toggleSettings(true);
    renderRepos();
  }
}

async function refreshRateLimit() {
  const res = await send('GET_RATE_LIMIT');
  if (!res.ok) return;

  const rl = res.data;
  const rateLimitBtn = document.getElementById('rateLimitBtn');
  const rateLimitInfo = document.getElementById('rateLimitInfo');

  if (rateLimitBtn) {
    rateLimitBtn.classList.remove('hidden');
    rateLimitBtn.title = `API: ${rl.remaining} / ${rl.limit} remaining`;
  }

  if (rateLimitInfo) {
    rateLimitInfo.classList.remove('hidden');
    const pct = rl.limit > 0 ? Math.round((rl.remaining / rl.limit) * 100) : 0;
    const color = pct > 50 ? 'text-fh-green' : pct > 20 ? 'text-fh-yellow' : 'text-fh-red';
    rateLimitInfo.innerHTML = `<span class="${color}">${rl.remaining}</span><span class="text-fh-text-muted">/${rl.limit}</span>`;
  }
}

init();
