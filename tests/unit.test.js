import { jest } from '@jest/globals';
import './chrome-mock.js';

/* ─── Unit tests for pure utility functions ─── */

import { escapeHtml, formatDate, relativeTime, formatNumber, parseLinkHeader, chunk } from '../src/lib/utils.js';

describe('escapeHtml', () => {
  test('escapes ampersand, angle brackets, double quotes', () => {
    expect(escapeHtml('a&b<c>d"e')).toBe('a&amp;b&lt;c&gt;d&quot;e');
  });

  test('returns empty string for non-string input', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(123)).toBe('');
  });

  test('BUG: does NOT escape single quotes — this is an XSS gap', () => {
    const input = "test'value";
    expect(escapeHtml(input)).toBe("test&#39;value");
  });
});

describe('formatDate', () => {
  test('formats ISO date string to locale date', () => {
    const result = formatDate('2024-01-15T10:30:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  test('returns empty string for falsy input', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
  });
});

describe('relativeTime', () => {
  test('returns "just now" for very recent dates', () => {
    const now = new Date().toISOString();
    expect(relativeTime(now)).toBe('just now');
  });

  test('returns empty string for falsy input', () => {
    expect(relativeTime('')).toBe('');
  });
});

describe('formatNumber', () => {
  test('formats thousands with k suffix', () => {
    expect(formatNumber(1500)).toBe('1.5k');
  });

  test('formats millions with M suffix', () => {
    expect(formatNumber(2000000)).toBe('2.0M');
  });

  test('returns plain number for small values', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

describe('parseLinkHeader', () => {
  test('parses GitHub Link header correctly', () => {
    const header = '<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=5>; rel="last"';
    const result = parseLinkHeader(header);
    expect(result.next).toBe('https://api.github.com/user/repos?page=2');
    expect(result.last).toBe('https://api.github.com/user/repos?page=5');
  });

  test('returns empty object for null/empty header', () => {
    expect(parseLinkHeader(null)).toEqual({});
    expect(parseLinkHeader('')).toEqual({});
  });
});

describe('chunk', () => {
  test('splits array into fixed-size chunks', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test('handles empty array', () => {
    expect(chunk([], 3)).toEqual([]);
  });
});

/* ─── Unit tests for state manager ─── */

import { createState } from '../src/popup/state.js';

describe('createState', () => {
  let state;
  beforeEach(() => {
    state = createState();
  });

  test('initial state has correct defaults', () => {
    const s = state.get();
    expect(s.token).toBe('');
    expect(s.allRepos).toEqual([]);
    expect(s.selected).toBeInstanceOf(Set);
    expect(s.selected.size).toBe(0);
    expect(s.sort).toBe('updated');
    expect(s.visibility).toBe('all');
  });

  test('set() merges patch into state', () => {
    state.set({ token: 'abc', loading: true });
    const s = state.get();
    expect(s.token).toBe('abc');
    expect(s.loading).toBe(true);
    expect(s.sort).toBe('updated'); // unchanged
  });

  test('toggleSelect adds and removes from selected set', () => {
    state.toggleSelect('user/repo1');
    expect(state.get().selected.has('user/repo1')).toBe(true);

    state.toggleSelect('user/repo1');
    expect(state.get().selected.has('user/repo1')).toBe(false);
  });

  test('selectAll replaces entire selection', () => {
    state.selectAll(['a', 'b', 'c']);
    expect(state.get().selected.size).toBe(3);
  });

  test('deselectAll clears selection', () => {
    state.selectAll(['a', 'b']);
    state.deselectAll();
    expect(state.get().selected.size).toBe(0);
  });

  test('markBusy and unmarkBusy manage busyRepos set', () => {
    state.markBusy('user/repo1');
    expect(state.get().busyRepos.has('user/repo1')).toBe(true);

    state.unmarkBusy('user/repo1');
    expect(state.get().busyRepos.has('user/repo1')).toBe(false);
  });

  test('removeRepo removes from allRepos, selected, and busyRepos', () => {
    state.set({ allRepos: [{ full_name: 'a/b' }, { full_name: 'c/d' }] });
    state.toggleSelect('a/b');
    state.markBusy('a/b');

    state.removeRepo('a/b');
    const s = state.get();
    expect(s.allRepos).toEqual([{ full_name: 'c/d' }]);
    expect(s.selected.has('a/b')).toBe(false);
    expect(s.busyRepos.has('a/b')).toBe(false);
  });

  test('updateRepo immutably updates a repo', () => {
    state.set({ allRepos: [{ full_name: 'a/b', private: false }] });
    state.updateRepo('a/b', { private: true });
    expect(state.get().allRepos[0].private).toBe(true);
  });

  test('getFiltered applies search filter', () => {
    state.set({
      allRepos: [
        { full_name: 'user/alpha', name: 'alpha', description: '', private: false, fork: false, archived: false, updated_at: '2024-01-01', stargazers_count: 0, created_at: '2024-01-01', size: 10 },
        { full_name: 'user/beta', name: 'beta', description: 'test desc', private: true, fork: false, archived: false, updated_at: '2024-01-02', stargazers_count: 5, created_at: '2024-01-02', size: 20 },
      ],
      search: 'beta',
    });
    const filtered = state.getFiltered();
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe('beta');
  });

  test('getFiltered applies visibility filter', () => {
    state.set({
      allRepos: [
        { full_name: 'u/a', name: 'a', description: '', private: false, fork: false, archived: false, updated_at: '2024-01-01', stargazers_count: 0, created_at: '2024-01-01', size: 10 },
        { full_name: 'u/b', name: 'b', description: '', private: true, fork: false, archived: false, updated_at: '2024-01-01', stargazers_count: 0, created_at: '2024-01-01', size: 10 },
      ],
      visibility: 'private',
    });
    const filtered = state.getFiltered();
    expect(filtered.length).toBe(1);
    expect(filtered[0].private).toBe(true);
  });

  test('getFiltered sorts by stars descending', () => {
    state.set({
      allRepos: [
        { full_name: 'u/a', name: 'a', description: '', private: false, fork: false, archived: false, updated_at: '2024-01-01', stargazers_count: 1, created_at: '2024-01-01', size: 10 },
        { full_name: 'u/b', name: 'b', description: '', private: false, fork: false, archived: false, updated_at: '2024-01-01', stargazers_count: 100, created_at: '2024-01-01', size: 10 },
      ],
      sort: 'stars',
    });
    const filtered = state.getFiltered();
    expect(filtered[0].stargazers_count).toBe(100);
  });

  test('subscribe notifies listeners on state changes', () => {
    const calls = [];
    state.subscribe((s) => calls.push(s.token));
    state.set({ token: 'tok1' });
    state.set({ token: 'tok2' });
    expect(calls).toEqual(['tok1', 'tok2']);
  });
});

/* ─── Unit tests for errors module ─── */

import { GitHubApiError, TokenError, parseGitHubError } from '../src/lib/errors.js';

describe('GitHubApiError', () => {
  test('isRateLimit true for 429', () => {
    const err = new GitHubApiError(429, 'rate limited');
    expect(err.isRateLimit).toBe(true);
  });

  test('isRateLimit true for 403 with rate limit message', () => {
    const err = new GitHubApiError(403, 'API rate limit exceeded');
    expect(err.isRateLimit).toBe(true);
  });

  test('isForbidden true for 403 without rate limit message', () => {
    const err = new GitHubApiError(403, 'Resource not accessible');
    expect(err.isForbidden).toBe(true);
    expect(err.isRateLimit).toBe(false);
  });

  test('isNotFound true for 404', () => {
    const err = new GitHubApiError(404, 'Not Found');
    expect(err.isNotFound).toBe(true);
  });

  test('permissionHint provides guidance for 403', () => {
    const err = new GitHubApiError(403, 'Resource not accessible by integration');
    expect(err.permissionHint).toContain('Token lacks required permissions');
  });

  test('permissionHint returns required permission if available', () => {
    const err = new GitHubApiError(403, 'Forbidden', [], '', 'repo:write');
    expect(err.permissionHint).toContain('repo:write');
  });
});

describe('parseGitHubError', () => {
  test('parses JSON error response', async () => {
    const response = {
      status: 404,
      headers: new Headers(),
      json: () => Promise.resolve({ message: 'Not Found', documentation_url: 'https://docs.github.com' }),
    };
    const err = await parseGitHubError(response);
    expect(err).toBeInstanceOf(GitHubApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not Found');
  });

  test('handles non-JSON response gracefully', async () => {
    const response = {
      status: 500,
      headers: new Headers(),
      json: () => Promise.reject(new Error('not json')),
    };
    const err = await parseGitHubError(response);
    expect(err.status).toBe(500);
    expect(err.message).toContain('500');
  });
});

/* ─── Unit tests for message-router ─── */

import { MessageRouter } from '../src/lib/message-router.js';

describe('MessageRouter', () => {
  test('routes messages to registered handlers', async () => {
    const router = new MessageRouter();
    router.register('FETCH_REPOS', async () => ['repo1', 'repo2']);

    const result = await router.handle({ type: 'FETCH_REPOS', payload: {} }, null);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(['repo1', 'repo2']);
  });

  test('rejects unknown message types', async () => {
    const router = new MessageRouter();
    const result = await router.handle({ type: 'INVALID_TYPE', payload: {} }, null);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Unknown');
  });

  test('wraps handler errors in error response', async () => {
    const router = new MessageRouter();
    router.register('FETCH_REPOS', async () => { throw new Error('boom'); });

    const result = await router.handle({ type: 'FETCH_REPOS', payload: {} }, null);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('boom');
  });

  test('handles null/undefined message gracefully', async () => {
    const router = new MessageRouter();
    const result = await router.handle(null, null);
    expect(result.ok).toBe(false);
  });
});

/* ─── Unit tests for soft-delete ─── */

import { scheduleSoftDelete, cancelSoftDelete, isPending, cancelAllPending } from '../src/popup/components/soft-delete.js';

describe('soft-delete', () => {
  afterEach(() => {
    cancelAllPending();
  });

  test('isPending returns true after scheduling', () => {
    scheduleSoftDelete('user/repo', async () => {}, () => {});
    expect(isPending('user/repo')).toBe(true);
  });

  test('cancelSoftDelete cancels pending delete and calls undoFn', () => {
    let undoCalled = false;
    scheduleSoftDelete('user/repo', async () => {}, () => { undoCalled = true; });

    const result = cancelSoftDelete('user/repo');
    expect(result).toBe(true);
    expect(undoCalled).toBe(true);
    expect(isPending('user/repo')).toBe(false);
  });

  test('cancelSoftDelete returns false when nothing is pending', () => {
    expect(cancelSoftDelete('nonexistent')).toBe(false);
  });
});
