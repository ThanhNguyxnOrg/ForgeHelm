import { MessageRouter } from './lib/message-router.js';
import { github } from './lib/api.js';
import { storage } from './lib/storage.js';
import { logger } from './lib/logger.js';
import { TokenError } from './lib/errors.js';

const router = new MessageRouter();

async function ensureToken() {
  if (github.token) return;
  const token = await storage.getToken();
  if (!token) throw new TokenError('No token configured. Please add your GitHub token in Settings.');
  github.setToken(token);
}

router.register('VALIDATE_TOKEN', async ({ token }) => {
  const user = await github.validateToken(token);
  await storage.setToken(token);
  github.setToken(token);
  return user;
});

router.register('CHECK_TOKEN_CAPABILITIES', async ({ token }) => {
  if (!token) throw new TokenError('No token provided for capability check.');
  return github.checkTokenCapabilities(token);
});

router.register('GET_TOKEN', async () => {
  const token = await storage.getToken();
  return { token };
});

router.register('SAVE_TOKEN', async ({ token }) => {
  await storage.setToken(token);
  github.setToken(token);
  return true;
});

router.register('CLEAR_TOKEN', async () => {
  await storage.clearToken();
  github.setToken('');
  return true;
});

router.register('FETCH_REPOS', async () => {
  const token = await storage.getToken();
  if (!token) return [];
  github.setToken(token);
  return github.fetchAllRepos();
});

router.register('UPDATE_REPO', async ({ fullName, updates }) => {
  await ensureToken();
  return github.updateRepo(fullName, updates);
});

router.register('CHANGE_VISIBILITY', async ({ fullName, isPrivate }) => {
  await ensureToken();
  return github.changeVisibility(fullName, isPrivate);
});

router.register('DELETE_REPO', async ({ fullName }) => {
  await ensureToken();
  return github.deleteRepo(fullName);
});

router.register('ARCHIVE_REPO', async ({ fullName, archived }) => {
  await ensureToken();
  return github.archiveRepo(fullName, archived);
});

router.register('TRANSFER_REPO', async ({ fullName, newOwner, newName }) => {
  await ensureToken();
  return github.transferRepo(fullName, newOwner, newName);
});

router.register('FORK_REPO', async ({ fullName, org }) => {
  await ensureToken();
  return github.forkRepo(fullName, org);
});

router.register('GET_TOPICS', async ({ fullName }) => {
  await ensureToken();
  return github.getTopics(fullName);
});

router.register('UPDATE_TOPICS', async ({ fullName, topics }) => {
  await ensureToken();
  return github.setTopics(fullName, topics);
});

router.register('GET_RATE_LIMIT', async () => {
  await ensureToken();
  try {
    const fresh = await github.fetchRateLimit();
    if (fresh?.rate) {
      return { remaining: fresh.rate.remaining, limit: fresh.rate.limit, reset: fresh.rate.reset };
    }
  } catch (_) {
    return github.getRateLimit();
  }
  return github.getRateLimit();
});

router.register('GET_SETTINGS', async () => {
  return storage.getSettings();
});

router.register('SAVE_SETTINGS', async ({ settings }) => {
  await storage.saveSettings(settings);
  return true;
});

router.register('GET_CI_STATUS', async ({ fullName }) => {
  await ensureToken();
  return github.getCiStatus(fullName);
});

router.register('EXPORT_REPOS', async () => {
  const token = await storage.getToken();
  if (!token) return [];
  github.setToken(token);
  return github.fetchAllRepos();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    logger.info('ForgeHelm installed');
  } else if (details.reason === 'update') {
    logger.info(`ForgeHelm updated to v${chrome.runtime.getManifest().version}`);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  router.handle(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true;
});
