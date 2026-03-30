export const API_BASE = 'https://api.github.com';
export const API_VERSION = '2022-11-28';
export const PER_PAGE = 100;

export const STORAGE_KEYS = {
  TOKEN: 'fh_token',
  SETTINGS: 'fh_settings',
  CACHE_REPOS: 'fh_cache_repos',
  CACHE_TIMESTAMP: 'fh_cache_ts',
};

export const REPO_SORT_OPTIONS = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'name', label: 'Name A→Z' },
  { value: 'stars', label: 'Stars' },
  { value: 'created', label: 'Recently created' },
  { value: 'size', label: 'Size' },
];

export const VISIBILITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

export const DANGER_LEVELS = {
  SAFE: 'safe',
  MODERATE: 'moderate',
  DESTRUCTIVE: 'destructive',
};

export const ACTION_TYPES = {
  CHANGE_VISIBILITY: 'change_visibility',
  DELETE: 'delete',
  ARCHIVE: 'archive',
  UNARCHIVE: 'unarchive',
  TRANSFER: 'transfer',
  UPDATE_TOPICS: 'update_topics',
  FORK: 'fork',
};

export const RATE_LIMIT_BUFFER = 50;
