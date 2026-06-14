import { jest } from '@jest/globals';
import { resetStorage, setStorageData } from './chrome-mock.js';
import { github } from '../src/lib/api.js';

describe('GitHubClient token validation logic', () => {
  beforeEach(() => {
    resetStorage();
    github.setToken('');
    // Clear global fetch mock if any
    globalThis.fetch = jest.fn();
  });

  test('validateToken should throw if scopeCheck fails with 403', async () => {
    // Setup fetch mock for 2 requests:
    // 1st request to /user succeeds
    // 2nd request to /user/repos fails with 403
    globalThis.fetch.mockImplementation((url) => {
      if (url.includes('/user/repos')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          headers: new Headers(),
          json: () => Promise.resolve({ message: 'Forbidden' })
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ login: 'testuser' })
      });
    });

    await expect(github.validateToken('ghp_test')).rejects.toThrow(/Token lacks repository access/);
  });

  test('request should throw if max rate limit retries are exhausted instead of returning undefined', async () => {
    // Setup fetch mock that always returns a 403 Rate Limit error
    globalThis.fetch.mockImplementation(() => {
      const headers = new Headers();
      headers.set('X-RateLimit-Remaining', '0');
      headers.set('Retry-After', '0'); // 0 so tests don't actually sleep
      return Promise.resolve({
        ok: false,
        status: 403,
        headers,
        json: () => Promise.resolve({ message: 'API rate limit exceeded' })
      });
    });

    github.setToken('test_token');

    // the request defaults to 3 retries, so it'll run 4 times.
    // It should throw at the end, not return undefined
    await expect(github.request('/test', {}, 1)).rejects.toThrow(/API rate limit exceeded/);
  });

  test('transferRepo should not fail when GitHub returns accepted response without JSON body', async () => {
    globalThis.fetch.mockImplementation(() => Promise.resolve({
      ok: true,
      status: 202,
      headers: new Headers(),
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    }));

    github.setToken('test_token');

    await expect(github.transferRepo('owner/repo', 'new-owner')).resolves.toEqual({});
  });

  test('forkRepo should not fail when GitHub returns accepted response without JSON body', async () => {
    globalThis.fetch.mockImplementation(() => Promise.resolve({
      ok: true,
      status: 202,
      headers: new Headers(),
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    }));

    github.setToken('test_token');
    await expect(github.forkRepo('owner/repo')).resolves.toEqual({});
  });

  test('createOrUpdateFile should create a new file when it does not exist (GET returns 404)', async () => {
    let putRequestPayload = null;
    globalThis.fetch.mockImplementation((url, opts) => {
      if (opts.method === 'PUT') {
        putRequestPayload = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 201,
          headers: new Headers(),
          json: () => Promise.resolve({ content: { name: 'LICENSE' } }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: () => Promise.resolve({ message: 'Not Found' }),
      });
    });

    github.setToken('test_token');
    const result = await github.createOrUpdateFile('owner/repo', 'LICENSE', 'MIT Content', 'add license');
    
    expect(result.content.name).toBe('LICENSE');
    expect(putRequestPayload).toBeDefined();
    expect(putRequestPayload.sha).toBeUndefined();
    expect(putRequestPayload.message).toBe('add license');
    expect(atob(putRequestPayload.content)).toBe('MIT Content');
  });

  test('createOrUpdateFile should update an existing file with sha (GET returns 200 with sha)', async () => {
    let putRequestPayload = null;
    globalThis.fetch.mockImplementation((url, opts) => {
      if (opts.method === 'PUT') {
        putRequestPayload = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ content: { name: 'LICENSE' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ sha: 'old-sha-123', name: 'LICENSE' }),
      });
    });

    github.setToken('test_token');
    const result = await github.createOrUpdateFile('owner/repo', 'LICENSE', 'Updated MIT Content', 'update license');
    
    expect(result.content.name).toBe('LICENSE');
    expect(putRequestPayload).toBeDefined();
    expect(putRequestPayload.sha).toBe('old-sha-123');
    expect(putRequestPayload.message).toBe('update license');
    expect(atob(putRequestPayload.content)).toBe('Updated MIT Content');
  });
});
