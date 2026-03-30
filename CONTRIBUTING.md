# 🤝 Contributing to ForgeHelm

First off, **thank you** for considering contributing to ForgeHelm! Every contribution makes this tool better for everyone.

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Development Setup](#-development-setup)
- [Making Changes](#-making-changes)
- [Commit Convention](#-commit-convention)
- [Pull Request Process](#-pull-request-process)
- [Reporting Bugs](#-reporting-bugs)
- [Suggesting Features](#-suggesting-features)

---

## 📜 Code of Conduct

Be kind. Be respectful. We're all here to build something great together.

---

## 🚀 Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your changes
4. **Make your changes** and test them
5. **Submit a Pull Request**

---

## 🔧 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ForgeHelm.git
cd ForgeHelm

# Install dependencies
npm install

# Start development (watch CSS)
npm run dev

# Load extension in Chrome
# 1. Navigate to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `src/` folder
```

---

## ✏️ Making Changes

### File Structure

- **`src/lib/`** — Shared modules (API, storage, utils)
- **`src/popup/`** — Extension popup UI
- **`src/content-script/`** — GitHub page integration
- **`src/styles/`** — Tailwind CSS source

### Guidelines

- Write clean, readable JavaScript (ES2022+)
- Follow existing code patterns and naming conventions
- No frameworks — vanilla JS only
- Test your changes in Chrome before submitting
- Keep commits focused and atomic

---

## 💬 Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style (formatting, no logic change) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build process, dependencies, tooling |

### Examples

```
feat: add bulk archive functionality
fix: handle rate limit 429 response correctly
docs: update installation instructions
refactor: extract modal component from popup.js
```

---

## 🔀 Pull Request Process

1. **Update your branch** with the latest `main`
2. **Ensure your code works** — test in Chrome
3. **Write a clear PR description** explaining what and why
4. **Link related issues** if applicable
5. **Wait for review** — we'll get back to you promptly

### PR Title Format

Use the same convention as commits:

```
feat: add bulk topic management
fix: prevent double-click on delete button
```

---

## 🐛 Reporting Bugs

Use the [GitHub Issues](https://github.com/ThanhNguyxn07/ForgeHelm/issues) page with the **Bug Report** template.

Include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Chrome version
- Screenshots (if applicable)

---

## 💡 Suggesting Features

Use the [GitHub Issues](https://github.com/ThanhNguyxn07/ForgeHelm/issues) page with the **Feature Request** template.

Include:
- Clear description of the feature
- Use case — why is this needed?
- Proposed solution (optional)

---

<div align="center">

**Thank you for making ForgeHelm better! ⚒️**

</div>
