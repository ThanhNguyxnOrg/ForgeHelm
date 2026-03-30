import { API_BASE, API_VERSION, PER_PAGE, RATE_LIMIT_BUFFER } from './constants.js';
import { parseGitHubError, TokenError } from './errors.js';
import { parseLinkHeader, sleep } from './utils.js';
import { logger } from './logger.js';

class GitHubClient {
  constructor() {
    this.token = '';
    this.rateLimit = { remaining: 5000, reset: 0, limit: 5000 };
  }

  setToken(t) {
    this.token = t;
  }

  buildHeaders() {
    if (!this.token) throw new TokenError('No token configured. Please add your GitHub token in Settings.');
    const prefix = this.token.startsWith('ghp_') ? 'token' : 'Bearer';
    return {
      Authorization: `${prefix} ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': API_VERSION,
      'Content-Type': 'application/json',
    };
  }

  updateRateLimit(res) {
    const remaining = res.headers.get('X-RateLimit-Remaining');
    const reset = res.headers.get('X-RateLimit-Reset');
    const limit = res.headers.get('X-RateLimit-Limit');
    if (remaining !== null) this.rateLimit.remaining = parseInt(remaining, 10);
    if (reset !== null) this.rateLimit.reset = parseInt(reset, 10);
    if (limit !== null) this.rateLimit.limit = parseInt(limit, 10);
  }

  getRateLimit() {
    return { ...this.rateLimit };
  }

  async waitIfNeeded() {
    if (this.rateLimit.remaining > RATE_LIMIT_BUFFER) return;
    const now = Math.floor(Date.now() / 1000);
    const waitSec = Math.max(0, this.rateLimit.reset - now) + 1;
    logger.warn(`Rate limit low (${this.rateLimit.remaining}), waiting ${waitSec}s`);
    await sleep(waitSec * 1000);
  }

  async request(path, opts = {}, retries = 3) {
    await this.waitIfNeeded();

    const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(url, {
        ...opts,
        headers: { ...this.buildHeaders(), ...(opts.headers || {}) },
      });

      this.updateRateLimit(res);

      if (res.ok || res.status === 204) return res;

      const apiError = await parseGitHubError(res);

      if (apiError.isRateLimit && attempt < retries) {
        const retryAfter = res.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(60000, 1000 * Math.pow(2, attempt + 1));
        logger.warn(`Rate limited (${res.status}), retry ${attempt + 1}/${retries} in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }

      if (apiError.isForbidden && apiError.permissionHint) {
        apiError.message = `${apiError.message}. ${apiError.permissionHint}`;
      }

      throw apiError;
    }
  }

  async getJson(path) {
    const res = await this.request(path);
    return res.json();
  }

  async validateToken(testToken) {
    const prev = this.token;
    this.token = testToken;
    try {
      const user = await this.getJson('/user');
      const scopeCheck = await this.request('/user/repos?per_page=1&affiliation=owner');
      if (!scopeCheck.ok && scopeCheck.status === 403) {
        throw new TokenError('Token lacks repository access. Enable "Administration" permission for fine-grained PAT, or "repo" scope for classic PAT.');
      }
      return user;
    } catch (err) {
      this.token = prev;
      throw err;
    }
  }

  async fetchAllRepos(signal) {
    const repos = [];
    let page = 1;

    while (true) {
      if (signal?.aborted) break;
      const res = await this.request(
        `/user/repos?per_page=${PER_PAGE}&page=${page}&sort=updated&affiliation=owner`
      );
      const batch = await res.json();
      repos.push(...batch);

      const links = parseLinkHeader(res.headers.get('Link'));
      if (!links.next || batch.length < PER_PAGE) break;
      page++;
    }

    return repos;
  }

  async updateRepo(fullName, updates) {
    const res = await this.request(`/repos/${fullName}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return res.json();
  }

  async changeVisibility(fullName, isPrivate) {
    return this.updateRepo(fullName, { private: isPrivate });
  }

  async deleteRepo(fullName) {
    await this.request(`/repos/${fullName}`, { method: 'DELETE' });
    return true;
  }

  async archiveRepo(fullName, archived = true) {
    return this.updateRepo(fullName, { archived });
  }

  async transferRepo(fullName, newOwner, newName) {
    const body = { new_owner: newOwner };
    if (newName) body.new_name = newName;
    const res = await this.request(`/repos/${fullName}/transfer`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async forkRepo(fullName, org) {
    const body = org ? { organization: org } : {};
    const res = await this.request(`/repos/${fullName}/forks`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.json();
  }

  async getTopics(fullName) {
    const data = await this.getJson(`/repos/${fullName}/topics`);
    return data.names || [];
  }

  async setTopics(fullName, topics) {
    const res = await this.request(`/repos/${fullName}/topics`, {
      method: 'PUT',
      body: JSON.stringify({ names: topics }),
    });
    return res.json();
  }

  async getLanguages(fullName) {
    return this.getJson(`/repos/${fullName}/languages`);
  }

  async getCiStatus(fullName) {
    try {
      const data = await this.getJson(`/repos/${fullName}/actions/runs?per_page=1`);
      if (data.workflow_runs && data.workflow_runs.length > 0) {
        const run = data.workflow_runs[0];
        if (run.conclusion === 'success') return 'success';
        if (run.conclusion === 'failure') return 'failure';
        if (run.status === 'in_progress' || run.status === 'queued') return 'pending';
        return run.conclusion || run.status;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  async fetchRateLimit() {
    return this.getJson('/rate_limit');
  }
}

export const github = new GitHubClient();
