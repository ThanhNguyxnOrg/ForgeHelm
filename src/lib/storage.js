import { STORAGE_KEYS } from './constants.js';
import { deriveKey, encrypt, decrypt, generateSalt } from './crypto.js';

const storage = {
  // --- Local Storage Helpers ---
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => resolve(result[key] ?? null));
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  // --- Session Storage Helpers ---
  async sessionGet(key) {
    return new Promise((resolve) => {
      if (!chrome.storage.session) {
        resolve(null);
        return;
      }
      chrome.storage.session.get([key], (result) => resolve(result[key] ?? null));
    });
  },

  async sessionSet(key, value) {
    return new Promise((resolve) => {
      if (!chrome.storage.session) {
        resolve();
        return;
      }
      chrome.storage.session.set({ [key]: value }, resolve);
    });
  },

  async sessionRemove(key) {
    return new Promise((resolve) => {
      if (!chrome.storage.session) {
        resolve();
        return;
      }
      chrome.storage.session.remove(key, resolve);
    });
  },

  // --- Token Operations ---
  async getToken() {
    // 1. Try reading from in-memory session cache first
    const sessionToken = await this.sessionGet(STORAGE_KEYS.TOKEN);
    if (sessionToken) return sessionToken;

    // 2. Fallback to check if a legacy plaintext token exists in local storage
    const localVal = await this.get(STORAGE_KEYS.TOKEN);
    if (typeof localVal === 'string' && (localVal.startsWith('ghp_') || localVal.startsWith('github_pat_'))) {
      return localVal;
    }
    return null;
  },

  async setToken(token) {
    // Backward compatibility wrapper for old tests or raw storage
    return this.set(STORAGE_KEYS.TOKEN, token);
  },

  async setTokenEncrypted(token, pin) {
    // Generate or get salt
    let salt = await this.get('fh_salt');
    if (!salt) {
      salt = generateSalt();
      await this.set('fh_salt', salt);
    }

    // Encrypt
    const key = await deriveKey(pin, salt);
    const encryptedData = await encrypt(token, key);

    // Save encrypted token payload in local storage
    await this.set(STORAGE_KEYS.TOKEN, encryptedData);
    
    // Cache decrypted token in session memory
    await this.sessionSet(STORAGE_KEYS.TOKEN, token);
    return true;
  },

  async unlockToken(pin) {
    const salt = await this.get('fh_salt');
    const encryptedData = await this.get(STORAGE_KEYS.TOKEN);
    
    if (!salt || !encryptedData || typeof encryptedData === 'string') {
      return null;
    }

    // Decrypt
    const key = await deriveKey(pin, salt);
    const decryptedToken = await decrypt(encryptedData.ciphertext, encryptedData.iv, key);
    
    // Cache decrypted token in session memory
    await this.sessionSet(STORAGE_KEYS.TOKEN, decryptedToken);
    return decryptedToken;
  },

  async clearToken() {
    await this.remove(STORAGE_KEYS.TOKEN);
    await this.remove('fh_salt');
    await this.sessionRemove(STORAGE_KEYS.TOKEN);
    return true;
  },

  async hasPinCreated() {
    const salt = await this.get('fh_salt');
    return !!salt;
  },

  async isLocked() {
    const localVal = await this.get(STORAGE_KEYS.TOKEN);
    // If we have an encrypted object in local storage, but no token in session storage
    if (localVal && typeof localVal === 'object' && localVal.ciphertext) {
      const sessionToken = await this.sessionGet(STORAGE_KEYS.TOKEN);
      return !sessionToken;
    }
    return false;
  },

  async hasLegacyToken() {
    const localVal = await this.get(STORAGE_KEYS.TOKEN);
    return typeof localVal === 'string' && (localVal.startsWith('ghp_') || localVal.startsWith('github_pat_'));
  },

  // --- Last Activity Helpers ---
  async updateLastActivity() {
    return this.set('fh_last_activity', Date.now());
  },

  async getLastActivity() {
    return this.get('fh_last_activity');
  },

  async getSettings() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    return {
      defaultSort: 'updated',
      defaultVisibility: 'all',
      confirmDangerousActions: true,
      showArchivedRepos: true,
      autoLockTimeout: 0, // default: 0 (disabled)
      showFloatingLauncher: true, // default: true
      ...settings
    };
  },

  async saveSettings(settings) {
    return this.set(STORAGE_KEYS.SETTINGS, settings);
  },
};

export { storage };
