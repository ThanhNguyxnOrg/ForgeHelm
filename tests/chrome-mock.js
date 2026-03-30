/**
 * Chrome API mock for testing Chrome Extension modules.
 * Provides minimal stubs for chrome.storage.local and chrome.runtime.
 */

const storageData = {};

globalThis.chrome = {
  storage: {
    local: {
      get(keys, cb) {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          if (storageData[k] !== undefined) result[k] = storageData[k];
        }
        if (cb) cb(result);
        return Promise.resolve(result);
      },
      set(items, cb) {
        Object.assign(storageData, items);
        if (cb) cb();
        return Promise.resolve();
      },
      remove(keys, cb) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete storageData[k];
        if (cb) cb();
        return Promise.resolve();
      },
    },
  },
  runtime: {
    getManifest() {
      return { version: '1.0.0' };
    },
    sendMessage(msg, cb) {
      if (cb) cb({ ok: true, data: null });
    },
    onMessage: {
      addListener() {},
    },
    onInstalled: {
      addListener() {},
    },
    lastError: null,
    getURL(path) {
      return `chrome-extension://fake-id/${path}`;
    },
  },
};

/**
 * Reset all mock storage between tests.
 */
export function resetStorage() {
  for (const k of Object.keys(storageData)) delete storageData[k];
}

export function setStorageData(data) {
  Object.assign(storageData, data);
}
