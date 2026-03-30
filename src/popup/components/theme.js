const THEME_KEY = 'fh_theme';
const THEMES = { DARK: 'dark', LIGHT: 'light', SYSTEM: 'system' };

let currentTheme = THEMES.SYSTEM;
let mediaQuery = null;
let onChange = null;

export function initTheme(changeCallback) {
  onChange = changeCallback;
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  chrome.storage.local.get(THEME_KEY, (data) => {
    currentTheme = data[THEME_KEY] || THEMES.SYSTEM;
    applyTheme();
  });

  mediaQuery.addEventListener('change', () => {
    if (currentTheme === THEMES.SYSTEM) applyTheme();
  });
}

export function cycleTheme() {
  if (currentTheme === THEMES.SYSTEM) {
    currentTheme = THEMES.LIGHT;
  } else if (currentTheme === THEMES.LIGHT) {
    currentTheme = THEMES.DARK;
  } else {
    currentTheme = THEMES.SYSTEM;
  }

  chrome.storage.local.set({ [THEME_KEY]: currentTheme });
  applyTheme();
  return currentTheme;
}

export function getTheme() {
  return currentTheme;
}

export function getResolvedTheme() {
  if (currentTheme === THEMES.SYSTEM) {
    return mediaQuery?.matches ? THEMES.DARK : THEMES.LIGHT;
  }
  return currentTheme;
}

function applyTheme() {
  const resolved = getResolvedTheme();
  document.documentElement.setAttribute('data-theme', resolved);
  if (onChange) onChange(resolved, currentTheme);
}

export { THEMES };
