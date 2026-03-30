import { STORAGE_KEYS } from './constants.js';

const storage = {
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

  async getToken() {
    return this.get(STORAGE_KEYS.TOKEN);
  },

  async setToken(token) {
    return this.set(STORAGE_KEYS.TOKEN, token);
  },

  async clearToken() {
    return this.remove(STORAGE_KEYS.TOKEN);
  },

  async getSettings() {
    const settings = await this.get(STORAGE_KEYS.SETTINGS);
    return settings || {
      defaultSort: 'updated',
      defaultVisibility: 'all',
      confirmDangerousActions: true,
      showArchivedRepos: true,
    };
  },

  async saveSettings(settings) {
    return this.set(STORAGE_KEYS.SETTINGS, settings);
  },
};

export { storage };
