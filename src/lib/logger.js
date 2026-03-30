const LOG_PREFIX = '[ForgeHelm]';

const LogLevel = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

let currentLevel = LogLevel.INFO;

function formatArgs(level, ...args) {
  const timestamp = new Date().toISOString().slice(11, 23);
  return [`${LOG_PREFIX} ${timestamp} [${level}]`, ...args];
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
