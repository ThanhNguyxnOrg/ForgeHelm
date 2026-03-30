import { MessageRouter } from './lib/message-router.js';
import { logger } from './lib/logger.js';

const router = new MessageRouter();

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
