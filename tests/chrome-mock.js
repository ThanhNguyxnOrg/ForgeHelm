/**
 * Chrome API mock for testing Chrome Extension modules.
 * Provides minimal stubs for chrome.storage.local and chrome.runtime.
 */

const storageData = {};
const sessionData = {};

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
    session: {
      get(keys, cb) {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          if (sessionData[k] !== undefined) result[k] = sessionData[k];
        }
        if (cb) cb(result);
        return Promise.resolve(result);
      },
      set(items, cb) {
        Object.assign(sessionData, items);
        if (cb) cb();
        return Promise.resolve();
      },
      remove(keys, cb) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) delete sessionData[k];
        if (cb) cb();
        return Promise.resolve();
      },
    },
  },
  runtime: {
    id: 'fake-id',
    getManifest() {
      return { version: '1.0.0' };
    },
    sendMessage(msg, cb) {
      if (cb) cb({ ok: true, data: null });
    },
    onMessage: {
      _listeners: [],
      addListener(fn) {
        this._listeners.push(fn);
      },
      trigger(message, sender, sendResponse) {
        let asyncResponse = false;
        for (const fn of this._listeners) {
          const result = fn(message, sender, sendResponse);
          if (result === true) {
            asyncResponse = true;
          }
        }
        return asyncResponse;
      },
      clear() {
        this._listeners = [];
      }
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
  for (const k of Object.keys(sessionData)) delete sessionData[k];
}

export function setStorageData(data) {
  Object.assign(storageData, data);
}

export function setSessionData(data) {
  Object.assign(sessionData, data);
}
