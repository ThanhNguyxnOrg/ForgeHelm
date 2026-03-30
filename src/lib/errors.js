export class ForgeHelmError extends Error {
  constructor(message, code = 'UNKNOWN') {
    super(message);
    this.name = 'ForgeHelmError';
    this.code = code;
  }
}

export class GitHubApiError extends ForgeHelmError {
  constructor(status, message, errors = [], docUrl = '') {
    super(message, 'GITHUB_API');
    this.name = 'GitHubApiError';
    this.status = status;
    this.errors = errors;
    this.docUrl = docUrl;
  }

  get isRateLimit() {
    return this.status === 403 || this.status === 429;
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

  return new GitHubApiError(response.status, message, errors, docUrl);
}
