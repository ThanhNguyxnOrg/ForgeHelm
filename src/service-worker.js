import { MessageRouter } from './lib/message-router.js';
import { github } from './lib/api.js';
import { storage } from './lib/storage.js';
import { logger } from './lib/logger.js';
import { TokenError } from './lib/errors.js';
import { STORAGE_KEYS } from './lib/constants.js';

const router = new MessageRouter();
// Session-storage backed challenge and verification cache to withstand service worker suspension
async function getActiveChallenges() {
  const list = await storage.sessionGet('fh_active_challenges') || [];
  return new Set(list);
}

async function saveActiveChallenges(challengesSet) {
  await storage.sessionSet('fh_active_challenges', Array.from(challengesSet));
}

async function getVerifiedFrames() {
  const list = await storage.sessionGet('fh_verified_frames') || [];
  return new Set(list);
}

async function saveVerifiedFrames(framesSet) {
  await storage.sessionSet('fh_verified_frames', Array.from(framesSet));
}

async function checkInactivityLock() {
  const token = await storage.getToken();
  if (!token) return;

  const isLocked = await storage.isLocked();
  if (isLocked) return;

  const settings = await storage.getSettings();
  const timeoutMin = settings.autoLockTimeout || 0;
  if (timeoutMin > 0) {
    const lastActivity = await storage.getLastActivity();
    if (lastActivity) {
      const elapsedMs = Date.now() - lastActivity;
      if (elapsedMs > timeoutMin * 60 * 1000) {
        logger.info(`Auto-locking extension due to ${timeoutMin}m inactivity`);
        await storage.sessionRemove(STORAGE_KEYS.TOKEN);
        github.setToken('');
        throw new TokenError('Extension locked due to inactivity. Please enter your PIN to unlock.');
      }
    }
  }
  await storage.updateLastActivity();
}

async function ensureToken() {
  await checkInactivityLock();
  if (github.token) return;
  const token = await storage.getToken();
  if (!token) throw new TokenError('No token configured or extension is locked. Please unlock or configure your token.');
  github.setToken(token);
}

// Register secure challenge from content script
router.register('REGISTER_CHALLENGE', async ({ challenge }, sender) => {
  if (sender && sender.tab) {
    const activeChallenges = await getActiveChallenges();
    activeChallenges.add(challenge);
    await saveActiveChallenges(activeChallenges);
    return true;
  }
  return false;
});

// Verify secure challenge from framed popup
router.register('VERIFY_CHALLENGE', async ({ challenge }, sender) => {
  if (challenge) {
    const activeChallenges = await getActiveChallenges();
    if (activeChallenges.has(challenge)) {
      activeChallenges.delete(challenge);
      await saveActiveChallenges(activeChallenges);

      const frameId = sender.documentId || sender.url;
      const verifiedFrames = await getVerifiedFrames();
      verifiedFrames.add(frameId);
      await saveVerifiedFrames(verifiedFrames);
      return true;
    }
  }
  return false;
});

// Check if a PIN has been created
router.register('HAS_PIN_CREATED', async () => {
  return storage.hasPinCreated();
});

// Check if the extension is locked
router.register('IS_LOCKED', async () => {
  try {
    await checkInactivityLock();
  } catch (_) {
    // checkInactivityLock throws if it locks, which is expected
  }
  return storage.isLocked();
});

// Unlock token with a PIN
router.register('UNLOCK_TOKEN', async ({ pin }) => {
  const decryptedToken = await storage.unlockToken(pin);
  if (!decryptedToken) {
    throw new Error('Incorrect PIN or failed to decrypt');
  }
  
  // Validate decrypted token with GitHub
  const user = await github.validateToken(decryptedToken);
  github.setToken(decryptedToken);
  await storage.updateLastActivity();
  return user;
});

// Set token encrypted with a PIN
router.register('SET_TOKEN_ENCRYPTED', async ({ token, pin }) => {
  const user = await github.validateToken(token);
  await storage.setTokenEncrypted(token, pin);
  github.setToken(token);
  await storage.updateLastActivity();
  return user;
});

// Check for legacy plaintext token in storage
router.register('HAS_LEGACY_TOKEN', async () => {
  return storage.hasLegacyToken();
});

// Migrate legacy plaintext token to encrypted
router.register('MIGRATE_LEGACY_TOKEN', async ({ pin }) => {
  const token = await storage.getToken();
  if (!token) throw new Error('No legacy token found to migrate');
  
  await storage.setTokenEncrypted(token, pin);
  github.setToken(token);
  await storage.updateLastActivity();
  return true;
});

router.register('VALIDATE_TOKEN', async ({ token }) => {
  const user = await github.validateToken(token);
  await storage.setToken(token);
  github.setToken(token);
  await storage.updateLastActivity();
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
  await storage.updateLastActivity();
  return true;
});

router.register('CLEAR_TOKEN', async () => {
  await storage.clearToken();
  github.setToken('');
  return true;
});

router.register('FETCH_REPOS', async () => {
  await ensureToken();
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
  await ensureToken();
  return github.fetchAllRepos();
});

router.register('CREATE_OR_UPDATE_FILE', async ({ fullName, path, content, commitMessage }) => {
  await ensureToken();
  return github.createOrUpdateFile(fullName, path, content, commitMessage);
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    logger.info('ForgeHelm installed');
  } else if (details.reason === 'update') {
    logger.info(`ForgeHelm updated to v${chrome.runtime.getManifest().version}`);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate that the message comes from the extension itself
  if (sender && sender.id !== chrome.runtime.id) {
    sendResponse({ ok: false, error: 'Unauthorized sender' });
    return false;
  }

  // Enforce handshake verification for framed contexts (asynchronously)
  const handleMessage = async () => {
    if (sender && sender.tab && message.type !== 'REGISTER_CHALLENGE' && message.type !== 'VERIFY_CHALLENGE') {
      const frameId = sender.documentId || sender.url;
      const verifiedFrames = await getVerifiedFrames();
      if (!verifiedFrames.has(frameId)) {
        throw new Error('Unauthorized frame context. Handshake verification failed.');
      }
    }
    return router.handle(message, sender);
  };

  handleMessage()
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true;
});
