import { jest } from '@jest/globals';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';

// Setup crypto and text encoders for JSDOM environment
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
} else if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: webcrypto.subtle,
    writable: false,
  });
}

if (!globalThis.TextEncoder) {
  globalThis.TextEncoder = TextEncoder;
}
if (!globalThis.TextDecoder) {
  globalThis.TextDecoder = TextDecoder;
}

import './chrome-mock.js';
import { generateSalt, deriveKey, encrypt, decrypt } from '../src/lib/crypto.js';
import { storage } from '../src/lib/storage.js';
import { resetStorage } from './chrome-mock.js';
import { logger } from '../src/lib/logger.js';

describe('Cryptographic Helpers', () => {
  test('should generate salt correctly', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).toBeDefined();
    expect(salt2).toBeDefined();
    expect(salt1).not.toBe(salt2);
    expect(salt1.length).toBeGreaterThan(10);
  });

  test('should encrypt and decrypt a message using a derived key from PIN', async () => {
    const pin = '1234';
    const salt = generateSalt();
    const message = 'ghp_mySuperSecretToken12345';

    const key = await deriveKey(pin, salt);
    expect(key).toBeDefined();

    const encrypted = await encrypt(message, key);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    // Decrypt with correct key
    const decrypted = await decrypt(encrypted.ciphertext, encrypted.iv, key);
    expect(decrypted).toBe(message);

    // Decrypt with incorrect key (derived from wrong PIN)
    const wrongKey = await deriveKey('5678', salt);
    await expect(decrypt(encrypted.ciphertext, encrypted.iv, wrongKey)).rejects.toThrow('Invalid PIN or decryption failed');
  });
});

describe('Encrypted Token Storage Flow (Option B)', () => {
  beforeEach(() => {
    resetStorage();
  });

  test('should encrypt token and save to local storage, and cache in session storage', async () => {
    const pin = '1234';
    const token = 'ghp_secureTokenValue';

    // Verify initial state
    expect(await storage.getToken()).toBeNull();
    expect(await storage.isLocked()).toBe(false);
    expect(await storage.hasPinCreated()).toBe(false);

    // Set token encrypted
    const success = await storage.setTokenEncrypted(token, pin);
    expect(success).toBe(true);

    // Check PIN created status
    expect(await storage.hasPinCreated()).toBe(true);

    // Should not be locked since it's cached in session memory
    expect(await storage.isLocked()).toBe(false);

    // Get token should return cached token immediately
    const retrievedToken = await storage.getToken();
    expect(retrievedToken).toBe(token);
  });

  test('should lock token when session is cleared but local is present, and unlock with PIN', async () => {
    const pin = '1234';
    const token = 'ghp_secureTokenValue';

    // Save encrypted
    await storage.setTokenEncrypted(token, pin);

    // Simulate new session/browser restart by clearing session storage (but keeping local storage)
    await chrome.storage.session.remove('fh_token');

    // Should now be locked
    expect(await storage.isLocked()).toBe(true);

    // getToken should now return null because session is empty and local is encrypted
    expect(await storage.getToken()).toBeNull();

    // Try unlocking with wrong PIN
    await expect(storage.unlockToken('5678')).rejects.toThrow('Invalid PIN or decryption failed');
    expect(await storage.isLocked()).toBe(true);
    expect(await storage.getToken()).toBeNull();

    // Unlock with correct PIN
    const unlocked = await storage.unlockToken(pin);
    expect(unlocked).toBe(token);

    // Should be unlocked and cache restored
    expect(await storage.isLocked()).toBe(false);
    expect(await storage.getToken()).toBe(token);
  });

  test('should support backward compatibility with legacy plaintext tokens', async () => {
    const legacyToken = 'ghp_legacyPlaintextToken';

    // Write legacy token directly to local storage
    await chrome.storage.local.set({ fh_token: legacyToken });

    // Should detect legacy token
    expect(await storage.hasLegacyToken()).toBe(true);
    expect(await storage.hasPinCreated()).toBe(false);
    expect(await storage.isLocked()).toBe(false);

    // getToken should return the legacy plaintext token
    expect(await storage.getToken()).toBe(legacyToken);
  });

  test('should clear all token and salt data when clearToken is called', async () => {
    await storage.setTokenEncrypted('ghp_token', '1234');
    expect(await storage.hasPinCreated()).toBe(true);

    await storage.clearToken();
    expect(await storage.hasPinCreated()).toBe(false);
    expect(await storage.getToken()).toBeNull();
    expect(await storage.isLocked()).toBe(false);
  });
});

describe('Background IPC Security (Sender and Frame Handshake Verification)', () => {
  beforeAll(async () => {
    // Import service-worker dynamically to register onMessage listener
    await import('../src/service-worker.js');
  });

  beforeEach(() => {
    resetStorage();
  });

  test('should block messages from unauthorized external senders', async () => {
    const invalidSender = { id: 'some-malicious-extension-id' };
    const replyPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'GET_SETTINGS' },
        invalidSender,
        (response) => resolve(response)
      );
    });

    const result = await replyPromise;
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Unauthorized sender');
  });

  test('should block tab messages from framed context if challenge handshake is not performed', async () => {
    const tabSender = {
      id: 'fake-id', // Authorized extension ID
      tab: { id: 123 },
      url: 'https://github.com/some/repo',
      documentId: 'doc-123'
    };

    const replyPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'GET_SETTINGS' },
        tabSender,
        (response) => resolve(response)
      );
    });

    const result = await replyPromise;
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unauthorized frame context');
  });

  test('should allow tab messages from framed context after a successful challenge handshake', async () => {
    const tabSender = {
      id: 'fake-id',
      tab: { id: 123 },
      url: 'https://github.com/some/repo',
      documentId: 'doc-123'
    };

    const challenge = 'crypto-secure-challenge-token-123';

    // Step 1: Content script registers the challenge
    const regPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'REGISTER_CHALLENGE', payload: { challenge } },
        tabSender, // Registered by content script in the tab
        (response) => resolve(response)
      );
    });
    const regResult = await regPromise;
    expect(regResult.ok).toBe(true);
    expect(regResult.data).toBe(true);

    // Step 2: Iframe popup verifies the challenge
    const verifyPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'VERIFY_CHALLENGE', payload: { challenge } },
        tabSender, // Sent by the iframe popup
        (response) => resolve(response)
      );
    });
    const verifyResult = await verifyPromise;
    expect(verifyResult.ok).toBe(true);
    expect(verifyResult.data).toBe(true);

    // Step 3: Now the iframe popup can fetch settings or perform other actions
    const actionPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'GET_SETTINGS' },
        tabSender,
        (response) => resolve(response)
      );
    });
    const actionResult = await actionPromise;
    expect(actionResult.ok).toBe(true);
    expect(actionResult.data).toBeDefined(); // should return default settings
  });

  test('should allow messages from popup itself (non-tab sender) without handshake', async () => {
    const popupSender = {
      id: 'fake-id', // Authorized extension ID
      // no tab property (e.g. toolbar popup)
    };

    const actionPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'GET_SETTINGS' },
        popupSender,
        (response) => resolve(response)
      );
    });
    const actionResult = await actionPromise;
    expect(actionResult.ok).toBe(true);
    expect(actionResult.data).toBeDefined();
  });
});

describe('Log Sanitizer & Secret Redaction', () => {
  let consoleSpy;
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('should redact classic and fine-grained PATs from string logs', () => {
    // Info level logs
    logger.setLevel(2);
    logger.info('User input token: ghp_123456789012345678901234567890123456');
    expect(consoleSpy).toHaveBeenCalled();
    const loggedText = consoleSpy.mock.calls[0][1];
    expect(loggedText).not.toContain('ghp_123456789012345678901234567890123456');
    expect(loggedText).toContain('[REDACTED_TOKEN]');

    logger.info('Or fine-grained token github_pat_1234567890123456789012345678901234567890123456789012345678901234567890123456789012');
    const loggedText2 = consoleSpy.mock.calls[1][1];
    expect(loggedText2).not.toContain('github_pat_');
    expect(loggedText2).toContain('[REDACTED_TOKEN]');
  });

  test('should redact secrets from objects and arrays', () => {
    logger.setLevel(2);
    logger.info({ token: 'ghp_123456789012345678901234567890123456', other: 'public_data' });
    const loggedObj = consoleSpy.mock.calls[0][1];
    expect(loggedObj.token).toBe('[REDACTED_TOKEN]');
    expect(loggedObj.other).toBe('public_data');
  });

  test('should handle circular objects without throwing', () => {
    const obj = { name: 'circular_test' };
    obj.self = obj; // circular reference
    expect(() => logger.info(obj)).not.toThrow();
  });
});

describe('Auto-Lock Inactivity Timer', () => {
  beforeEach(async () => {
    resetStorage();
    // Enable autoLockTimeout to 15 minutes
    await storage.saveSettings({
      defaultSort: 'updated',
      defaultVisibility: 'all',
      confirmDangerousActions: true,
      showArchivedRepos: true,
      autoLockTimeout: 15,
    });
  });

  test('should lock the extension and clear session token when inactivity timeout is exceeded', async () => {
    const pin = '1234';
    const token = 'ghp_mySecureTokenValue';

    // Store encrypted
    await storage.setTokenEncrypted(token, pin);

    // Set last activity to 16 minutes ago
    const sixteenMinsAgo = Date.now() - 16 * 60 * 1000;
    await chrome.storage.local.set({ fh_last_activity: sixteenMinsAgo });

    // Try verifying lock state
    const isLockedPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'IS_LOCKED' },
        { id: 'fake-id' },
        (response) => resolve(response)
      );
    });

    const isLockedRes = await isLockedPromise;
    expect(isLockedRes.ok).toBe(true);
    expect(isLockedRes.data).toBe(true); // Should be locked!

    // Verify token is indeed cleared from session cache
    const sessionToken = await chrome.storage.session.get('fh_token');
    expect(sessionToken.fh_token).toBeUndefined();
  });

  test('should NOT lock the extension and should update activity timestamp when within timeout', async () => {
    const pin = '1234';
    const token = 'ghp_mySecureTokenValue';

    // Store encrypted
    await storage.setTokenEncrypted(token, pin);

    // Set last activity to 5 minutes ago
    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    await chrome.storage.local.set({ fh_last_activity: fiveMinsAgo });

    // Check lock state
    const isLockedPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'IS_LOCKED' },
        { id: 'fake-id' },
        (response) => resolve(response)
      );
    });

    const isLockedRes = await isLockedPromise;
    expect(isLockedRes.ok).toBe(true);
    expect(isLockedRes.data).toBe(false); // Should NOT be locked

    // Check that activity timestamp was updated to a recent time
    const lastActivity = await storage.getLastActivity();
    expect(lastActivity).toBeGreaterThan(Date.now() - 1000); // basically just updated
  });

  test('should never lock the extension if autoLockTimeout is set to 0', async () => {
    const pin = '1234';
    const token = 'ghp_mySecureTokenValue';

    // Disable auto lock (0)
    await storage.saveSettings({ autoLockTimeout: 0 });
    await storage.setTokenEncrypted(token, pin);

    // Set last activity to 2 hours ago
    const twoHoursAgo = Date.now() - 120 * 60 * 1000;
    await chrome.storage.local.set({ fh_last_activity: twoHoursAgo });

    // Check lock state
    const isLockedPromise = new Promise((resolve) => {
      chrome.runtime.onMessage.trigger(
        { type: 'IS_LOCKED' },
        { id: 'fake-id' },
        (response) => resolve(response)
      );
    });

    const isLockedRes = await isLockedPromise;
    expect(isLockedRes.ok).toBe(true);
    expect(isLockedRes.data).toBe(false); // Should NOT be locked
  });
});

