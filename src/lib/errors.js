export class ForgeHelmError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message);
    this.name = 'ForgeHelmError';
    this.code = code;
  }
}

export class GitHubApiError extends ForgeHelmError {
  constructor(status, message, errors = [], docUrl = '', requiredPermissions = '') {
    super(message, 'GITHUB_API');
    this.name = 'GitHubApiError';
    this.status = status;
    this.errors = errors;
    this.docUrl = docUrl;
    this.requiredPermissions = requiredPermissions;
  }

  get isRateLimit() {
    if (this.status === 429) return true;
    if (this.status === 403) {
      const msg = this.message.toLowerCase();
      return msg.includes('rate limit') || msg.includes('abuse detection');
    }
    return false;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403 && !this.isRateLimit;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isValidation() {
    return this.status === 422;
  }

  get permissionHint() {
    if (!this.isForbidden) return '';
    if (this.requiredPermissions) {
      return `Required permission: ${this.requiredPermissions}`;
    }
    const msg = this.message.toLowerCase();
    if (msg.includes('resource not accessible')) {
      return 'Token lacks required permissions. For classic PAT: enable "repo" + "delete_repo" scopes. For fine-grained PAT: enable "Administration: Read & Write".';
    }
    return 'Access denied. Check your token permissions.';
  }
}

export class TokenError extends ForgeHelmError {
  constructor(message) {
    super(message, 'TOKEN');
    this.name = 'TokenError';
  }
}

export class StorageError extends ForgeHelmError {
  constructor(message) {
    super(message, 'STORAGE');
    this.name = 'StorageError';
  }
}

export async function parseGitHubError(response) {
  let body = {};
  try {
    body = await response.json();
  } catch {
    // intentional: response may not have JSON body
  }

  const message = body.message || `GitHub API error (${response.status})`;
  const errors = body.errors || [];
  const docUrl = body.documentation_url || '';

  // Extract required permissions from GitHub's response header (available on 403)
  const requiredPermissions = response.headers?.get('X-Accepted-GitHub-Permissions') || '';

  return new GitHubApiError(response.status, message, errors, docUrl, requiredPermissions);
}
