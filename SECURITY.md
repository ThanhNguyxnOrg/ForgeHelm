# 🔒 Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | ✅ Active |

## Reporting a Vulnerability

If you discover a security vulnerability in ForgeHelm, **please do NOT open a public issue**.

Instead, please report it privately:

1. **Email**: thanhnguyentuan2007@gmail.com
2. **Subject**: `[SECURITY] ForgeHelm — <brief description>`

We will respond within **48 hours** and work with you to understand and address the issue.

## Security Practices

ForgeHelm follows these security principles:

- **Tokens are stored locally** in `chrome.storage.local` — never transmitted to third parties
- **All API calls** go exclusively to `https://api.github.com`
- **No analytics, no telemetry, no tracking** — zero external data collection
- **Classic PAT supported and documented** — recommended operational scopes: `repo` + `delete_repo`
- **Content Security Policy** enforced via Manifest V3
- **Input escaping** on all user-generated content before DOM insertion
- **Typed confirmation** required for all destructive operations

## Scope

The following are considered in-scope for security reports:

- Token exposure or leakage
- Cross-site scripting (XSS) via repo metadata
- Clickjacking or UI redressing attacks
- Unauthorized API calls or permission escalation
- Data exfiltration through content scripts
