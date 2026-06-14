const LOG_PREFIX = '[ForgeHelm]';

const LogLevel = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

let currentLevel = LogLevel.INFO;

const GHP_REGEX = /gh[pousr]_[A-Za-z0-9_]{36,251}/g;
const PAT_REGEX = /github_pat_[A-Za-z0-9_]{82,255}/g;

function sanitize(val, seen = new WeakSet()) {
  if (val === null || val === undefined) return val;

  if (typeof val === 'string') {
    return val.replace(GHP_REGEX, '[REDACTED_TOKEN]').replace(PAT_REGEX, '[REDACTED_TOKEN]');
  }

  if (val instanceof Error) {
    try {
      const msg = val.message.replace(GHP_REGEX, '[REDACTED_TOKEN]').replace(PAT_REGEX, '[REDACTED_TOKEN]');
      const newErr = new Error(msg);
      if (val.stack) {
        newErr.stack = val.stack.replace(GHP_REGEX, '[REDACTED_TOKEN]').replace(PAT_REGEX, '[REDACTED_TOKEN]');
      }
      return newErr;
    } catch (_) {
      return val;
    }
  }

  if (typeof val === 'object') {
    if (seen.has(val)) return '[Circular]';
    seen.add(val);

    try {
      // Fast path for simple objects: serialize, replace, deserialize
      const str = JSON.stringify(val);
      if (str && (str.includes('ghp_') || str.includes('github_pat_') || str.includes('gho_') || str.includes('ghu_') || str.includes('ghs_'))) {
        const sanitizedStr = str.replace(GHP_REGEX, '[REDACTED_TOKEN]').replace(PAT_REGEX, '[REDACTED_TOKEN]');
        return JSON.parse(sanitizedStr);
      }
      return val;
    } catch (_) {
      // Fallback for circular or complex objects
      if (Array.isArray(val)) {
        return val.map(item => sanitize(item, seen));
      }
      const res = {};
      for (const [k, v] of Object.entries(val)) {
        res[k] = sanitize(v, seen);
      }
      return res;
    }
  }

  return val;
}

function formatArgs(level, ...args) {
  const timestamp = new Date().toISOString().slice(11, 23);
  const sanitizedArgs = args.map(arg => {
    try {
      return sanitize(arg);
    } catch (_) {
      return arg;
    }
  });
  return [`${LOG_PREFIX} ${timestamp} [${level}]`, ...sanitizedArgs];
}

export const logger = {
  setLevel(level) {
    currentLevel = level;
  },

  error(...args) {
    console.error(...formatArgs('ERR', ...args));
  },

  warn(...args) {
    if (currentLevel >= LogLevel.WARN) {
      console.warn(...formatArgs('WRN', ...args));
    }
  },

  info(...args) {
    if (currentLevel >= LogLevel.INFO) {
      console.log(...formatArgs('INF', ...args));
    }
  },

  debug(...args) {
    if (currentLevel >= LogLevel.DEBUG) {
      console.debug(...formatArgs('DBG', ...args));
    }
  },
};

export { LogLevel };
