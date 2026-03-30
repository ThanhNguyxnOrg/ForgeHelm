import { MessageRouter } from './lib/message-router.js';
import { github } from './lib/api.js';
import { storage } from './lib/storage.js';
import { logger } from './lib/logger.js';

const router = new MessageRouter();

router.register('VALIDATE_TOKEN', async ({ token }) => {
  const user = await github.validateToken(token);
  await storage.setToken(token);
  github.setToken(token);
  return user;
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
  return github.updateRepo(fullName, updates);
});

router.register('CHANGE_VISIBILITY', async ({ fullName, isPrivate }) => {
  return github.changeVisibility(fullName, isPrivate);
});

router.register('DELETE_REPO', async ({ fullName }) => {
  return github.deleteRepo(fullName);
});

router.register('ARCHIVE_REPO', async ({ fullName, archived }) => {
  return github.archiveRepo(fullName, archived);
});

router.register('TRANSFER_REPO', async ({ fullName, newOwner, newName }) => {
  return github.transferRepo(fullName, newOwner, newName);
});

router.register('FORK_REPO', async ({ fullName, org }) => {
  return github.forkRepo(fullName, org);
});

router.register('GET_TOPICS', async ({ fullName }) => {
  return github.getTopics(fullName);
});

router.register('UPDATE_TOPICS', async ({ fullName, topics }) => {
  return github.setTopics(fullName, topics);
});

router.register('GET_RATE_LIMIT', async () => {
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
