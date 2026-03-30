import { logger } from './logger.js';

const ALLOWED_TYPES = new Set([
  'VALIDATE_TOKEN',
  'FETCH_REPOS',
  'UPDATE_REPO',
  'DELETE_REPO',
  'CHANGE_VISIBILITY',
  'ARCHIVE_REPO',
  'TRANSFER_REPO',
  'FORK_REPO',
  'UPDATE_TOPICS',
  'EXPORT_REPOS',
  'GET_RATE_LIMIT',
  'GET_TOKEN',
  'SAVE_TOKEN',
  'CLEAR_TOKEN',
  'GET_SETTINGS',
  'SAVE_SETTINGS',
]);

export class MessageRouter {
  constructor() {
    this.handlers = new Map();
  }

  register(type, handler) {
    this.handlers.set(type, handler);
  }

  async handle(message, sender) {
    const { type, payload } = message || {};

    if (!type || !ALLOWED_TYPES.has(type)) {
      logger.warn('Unknown message type:', type);
      return { ok: false, error: `Unknown message type: ${type}` };
    }

    const handler = this.handlers.get(type);
    if (!handler) {
      logger.warn('No handler registered for:', type);
      return { ok: false, error: `No handler for: ${type}` };
    }

    try {
      const result = await handler(payload, sender);
      return { ok: true, data: result };
    } catch (err) {
      logger.error(`Handler [${type}] failed:`, err.message);
      return { ok: false, error: err.message };
    }
  }
}
