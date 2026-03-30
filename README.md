<div align="center">

<img src="https://raw.githubusercontent.com/ThanhNguyxn07/ForgeHelm/main/assets/banner.png" alt="ForgeHelm Banner" width="100%" />

# ⚒️ ForgeHelm

**The Ultimate Chrome Extension for Bulk GitHub Repository Management**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/ThanhNguyxn07/ForgeHelm)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-00C853?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![GitHub API](https://img.shields.io/badge/GitHub-API%20v3-181717?style=for-the-badge&logo=github&logoColor=white)](https://docs.github.com/en/rest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

[![Stars](https://img.shields.io/github/stars/ThanhNguyxn07/ForgeHelm?style=social)](https://github.com/ThanhNguyxn07/ForgeHelm/stargazers)
[![Forks](https://img.shields.io/github/forks/ThanhNguyxn07/ForgeHelm?style=social)](https://github.com/ThanhNguyxn07/ForgeHelm/network/members)
[![Issues](https://img.shields.io/github/issues/ThanhNguyxn07/ForgeHelm?color=f85149)](https://github.com/ThanhNguyxn07/ForgeHelm/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

<p align="center">
  <b>Archive · Delete · Transfer · Fork · Manage Topics · Change Visibility</b>
  <br />
  <i>All in one place — right from your browser.</i>
</p>

[🚀 Installation](#-installation) · [✨ Features](#-features) · [📖 Usage](#-usage) · [🏗️ Architecture](#️-architecture) · [🤝 Contributing](#-contributing)

---

</div>

## 🎯 Why ForgeHelm?

Managing dozens (or hundreds) of GitHub repositories is painful. Changing visibility one by one? Archiving old projects manually? Deleting test repos through GitHub's slow confirmation flow?

**ForgeHelm** puts you in the captain's seat — manage all your repos in bulk with a beautiful dark-themed UI that feels native to GitHub.

> 🔥 **ForgeHelm** = **Forge** (create, build, shape) + **Helm** (steering wheel, command center)

---

## ✨ Features

### 🎛️ Core Operations

| Feature | Single | Bulk | Description |
|---------|:------:|:----:|-------------|
| 🔓 Change Visibility | ✅ | ✅ | Toggle between Public / Private |
| 🗑️ Delete Repository | ✅ | ✅ | Permanent deletion with typed confirmation |
| 📦 Archive / Unarchive | ✅ | ✅ | Archive repos to mark as read-only |
| 🏷️ Manage Topics | ✅ | ✅ | Add, remove, or replace repository topics |
| 📤 Transfer Ownership | ✅ | ✅ | Transfer repos to another user or org |
| 🍴 Fork Repository | ✅ | ✅ | Fork to your account or organization |
| 📝 Edit Description | ✅ | ✅ | Update repo descriptions in bulk |

### 🔍 Smart Filtering & Search

- 🔎 **Real-time search** across repo names and descriptions
- 📊 **Filter** by visibility (Public / Private / All)
- 📋 **Filter** by type (Sources / Forks / Archived)
- 🔄 **Sort** by updated date, name, stars, created date, or size
- 🏷️ **Filter by topics** — find repos by their tags

### 🛡️ Safety & Security

- 🔐 **Fine-grained PAT support** — minimal permissions, maximum safety
- ⚠️ **Typed confirmation** for destructive actions (delete, transfer)
- 🚫 **Busy-lock system** — prevents double-actions on in-progress repos
- 📊 **Rate limit monitoring** — real-time GitHub API quota tracking
- 🔒 **Token stored locally** — never sent anywhere except `api.github.com`
- ♻️ **Retry with exponential backoff** on rate limits

### 🎨 User Experience

- 🌙 **GitHub Dark theme** — seamless integration with GitHub's UI
- 📌 **Floating launcher** — access ForgeHelm from any GitHub page
- 🪟 **Slide-in panel** — no popup, no new tab, just a clean side panel
- 📊 **Progress tracking** — real-time progress bars for bulk operations
- 🔔 **Toast notifications** — non-intrusive success/error feedback
- ⚡ **Skeleton loading** — smooth loading states
- 📋 **Export to JSON/CSV** — download your repo list

---

## 🚀 Installation

### From Source (Developer)

```bash
# 1. Clone the repository
git clone https://github.com/ThanhNguyxn07/ForgeHelm.git
cd ForgeHelm

# 2. Install dependencies
npm install

# 3. Build CSS
npm run build

# 4. Load in Chrome
#    → Open chrome://extensions
#    → Enable "Developer mode"
#    → Click "Load unpacked"
#    → Select the `src/` folder
```

### 🔑 Setting Up Your GitHub Token

ForgeHelm uses a **Fine-Grained Personal Access Token** for maximum security:

1. Go to [GitHub Settings → Developer Settings → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **"Generate new token"**
3. Configure:
   - **Token name**: `ForgeHelm`
   - **Expiration**: 90 days (recommended)
   - **Repository access**: All repositories
   - **Permissions**:
     - `Administration` → **Read and Write**
     - `Metadata` → **Read-only** (auto-selected)
4. Click **Generate token** and paste it into ForgeHelm

<details>
<summary>📸 <b>Token Setup Screenshots</b> (click to expand)</summary>

> Screenshots coming soon after v1.0 release

</details>

> [!TIP]
> **Why Fine-Grained?** Unlike classic PATs, fine-grained tokens let you scope access to specific repositories and permissions. Your token can only do what you explicitly allow.

> [!WARNING]
> **Never share your token.** ForgeHelm stores it in `chrome.storage.local` and only sends it to `https://api.github.com`. No third-party servers, no analytics, no telemetry.

---

## 📖 Usage

### Quick Start

1. **Click the ForgeHelm icon** in the Chrome toolbar (or use the floating launcher on GitHub)
2. **Enter your GitHub token** in the settings panel
3. **Browse your repos** — they'll load automatically
4. **Select repos** using checkboxes for bulk operations
5. **Choose an action** from the bulk action bar

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + A` | Select all visible repos |
| `Ctrl + Shift + A` | Deselect all |
| `Escape` | Close panel / Cancel action |
| `/` | Focus search input |

### Bulk Operations Workflow

```
Select repos → Choose action → Confirm → Watch progress → Done ✅
```

Each destructive action requires explicit confirmation:
- **Visibility change**: Simple confirm dialog
- **Archive**: Confirm dialog with warning
- **Delete**: Must type exact confirmation text
- **Transfer**: Must type repo name + new owner

---

## 🏗️ Architecture

```
ForgeHelm/
├── src/
│   ├── manifest.json              # Chrome Extension Manifest V3
│   ├── service-worker.js          # Background service worker (ES module)
│   ├── lib/                       # Shared modules
│   │   ├── api.js                 # GitHub API wrapper with retry logic
│   │   ├── constants.js           # Configuration constants
│   │   ├── errors.js              # Custom error classes
│   │   ├── icons.js               # Inline SVG icon library
│   │   ├── logger.js              # Structured logging
│   │   ├── message-router.js      # Message passing router
│   │   ├── storage.js             # Chrome storage abstraction
│   │   └── utils.js               # Utility functions
│   ├── popup/                     # Extension popup UI
│   │   ├── popup.html
│   │   ├── app.js                 # Main application logic
│   │   ├── state.js               # State management
│   │   ├── renderer.js            # DOM rendering engine
│   │   └── components/            # UI components
│   │       ├── modal.js
│   │       ├── toast.js
│   │       └── progress.js
│   ├── content-script/            # GitHub page integration
│   │   ├── launcher.js            # Floating action button
│   │   └── launcher.css           # Launcher styles
│   ├── styles/                    # Tailwind CSS
│   │   ├── input.css              # Source styles
│   │   └── output.css             # Compiled output
│   └── icons/                     # Extension icons
├── assets/                        # README assets
├── tailwind.config.js             # Tailwind configuration
├── package.json
├── LICENSE
├── CONTRIBUTING.md
└── .gitignore
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Chrome Extension Manifest V3 |
| **Language** | Vanilla JavaScript (ES2022+ modules) |
| **Styling** | Tailwind CSS 3.4 with custom GitHub Dark theme |
| **API** | GitHub REST API v3 with rate-limit-aware client |
| **Storage** | `chrome.storage.local` |
| **Icons** | Lucide icons (inline SVG) |
| **Build** | Tailwind CLI (zero bundler) |

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **No framework** | Extension popup doesn't need React/Vue overhead |
| **ES modules** | Native browser support, no bundler complexity |
| **Service worker as API proxy** | Keeps token secure, single point of API access |
| **Shadow DOM for launcher** | Isolates styles from GitHub's CSS |
| **Custom error classes** | Structured error handling with specific recovery paths |

---

## 🔧 Development

```bash
# Watch mode for CSS changes
npm run dev

# Build for production
npm run build
```

### Project Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch CSS changes in real-time |
| `npm run build` | Build minified CSS for production |
| `npm run build:css` | Build CSS only |

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📋 Roadmap

- [x] Core repo listing with search & filter
- [x] Single & bulk visibility change
- [x] Single & bulk delete with typed confirmation
- [x] Floating launcher for GitHub pages
- [ ] Archive / Unarchive operations
- [ ] Topic management (add/remove/replace)
- [ ] Transfer ownership
- [ ] Fork to account/org
- [ ] Export repo list (JSON/CSV)
- [ ] Rate limit dashboard
- [ ] GitHub OAuth flow (alternative to PAT)
- [ ] Organization repo support
- [ ] Repo analytics & insights
- [ ] i18n / Multi-language support

---

## 📜 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [GitHub REST API](https://docs.github.com/en/rest) — the backbone of ForgeHelm
- [Tailwind CSS](https://tailwindcss.com/) — utility-first CSS framework
- [Lucide Icons](https://lucide.dev/) — beautiful open-source icons
- [Chrome Extensions](https://developer.chrome.com/docs/extensions/) — platform documentation

---

<div align="center">

**⚒️ Built with determination by [ThanhNguyxn07](https://github.com/ThanhNguyxn07)**

<sub>If ForgeHelm helps you manage your repos, consider giving it a ⭐</sub>

</div>
