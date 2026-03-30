import { icon } from '../lib/icons.js';
import { escapeHtml, relativeTime, formatNumber } from '../lib/utils.js';

export function renderRepoCard(repo, isSelected, isBusy, isPendingDelete) {
  const badgeClass = repo.private ? 'fh-badge-private' : 'fh-badge-public';
  const badgeLabel = repo.private ? 'Private' : 'Public';
  const badgeIcon = repo.private ? icon('lock', { size: 10 }) : icon('globe', { size: 10 });

  let cardClass = isSelected ? 'fh-card-interactive fh-card-selected' : 'fh-card-interactive';
  if (isPendingDelete) cardClass += ' fh-card-pending-delete';

  const archivedBadge = repo.archived
    ? `<span class="fh-badge-archived">${icon('archive', { size: 10 })} Archived</span>`
    : '';
  const forkBadge = repo.fork
    ? `<span class="fh-badge-fork">${icon('fork', { size: 10 })} Fork</span>`
    : '';

  const busyOverlay = isBusy
    ? `<div class="absolute inset-0 bg-fh-bg/70 backdrop-blur-xs rounded-lg flex items-center justify-center z-10">
         <span class="animate-spin-slow text-fh-accent">${icon('loader', { size: 20 })}</span>
       </div>`
    : '';

  const langDot = repo.language
    ? `<span class="inline-flex items-center gap-1 text-2xs text-fh-text-muted">
         <span class="fh-dot" style="background:${getLanguageColor(repo.language)}"></span>
         ${escapeHtml(repo.language)}
       </span>`
    : '';

  const starsBadge = repo.stargazers_count > 0
    ? `<span class="inline-flex items-center gap-0.5 text-2xs text-fh-text-muted">${icon('star', { size: 11 })} ${formatNumber(repo.stargazers_count)}</span>`
    : '';

  const forkCount = repo.forks_count > 0
    ? `<span class="inline-flex items-center gap-0.5 text-2xs text-fh-text-muted">${icon('fork', { size: 11 })} ${formatNumber(repo.forks_count)}</span>`
    : '';

  const ciBadge = renderCiBadge(repo._ciStatus);

  return `
    <div class="${cardClass} relative p-3 group" data-repo="${escapeHtml(repo.full_name)}" role="listitem">
      ${busyOverlay}
      <div class="flex items-start gap-2.5">
        <input type="checkbox" class="repo-checkbox mt-1 w-3.5 h-3.5 accent-fh-accent cursor-pointer shrink-0 rounded"
               data-name="${escapeHtml(repo.full_name)}" ${isSelected ? 'checked' : ''} ${isBusy ? 'disabled' : ''}
               aria-label="Select ${escapeHtml(repo.name)}">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <a href="https://github.com/${escapeHtml(repo.full_name)}" target="_blank" rel="noopener"
               class="text-sm font-semibold text-fh-accent hover:underline truncate"
               aria-label="Open ${escapeHtml(repo.name)} on GitHub">
              ${escapeHtml(repo.name)}
            </a>
            <span class="${badgeClass}">${badgeIcon} ${badgeLabel}</span>
            ${archivedBadge}
            ${forkBadge}
            ${ciBadge}
          </div>
          ${repo.description
            ? `<p class="text-xs text-fh-text-secondary mt-1 fh-truncate-2 leading-relaxed">${escapeHtml(repo.description)}</p>`
            : ''}
          <div class="flex items-center gap-3 mt-2 text-fh-text-muted">
            ${langDot}
            ${starsBadge}
            ${forkCount}
            <span class="text-2xs text-fh-text-muted ml-auto">${relativeTime(repo.updated_at)}</span>
          </div>
        </div>
        <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button class="fh-btn-icon visibility-btn" data-name="${escapeHtml(repo.full_name)}"
                  data-private="${repo.private}" title="Toggle visibility" ${isBusy ? 'disabled' : ''}
                  aria-label="${repo.private ? 'Make public' : 'Make private'}">
            ${repo.private ? icon('unlock', { size: 14 }) : icon('lock', { size: 14 })}
          </button>
          ${!repo.archived ? `
          <button class="fh-btn-icon archive-btn" data-name="${escapeHtml(repo.full_name)}"
                  title="Archive" ${isBusy ? 'disabled' : ''} aria-label="Archive repository">
            ${icon('archive', { size: 14 })}
          </button>` : `
          <button class="fh-btn-icon archive-btn" data-name="${escapeHtml(repo.full_name)}"
                  data-unarchive="true" title="Unarchive" ${isBusy ? 'disabled' : ''} aria-label="Unarchive repository">
            ${icon('archive', { size: 14 })}
          </button>`}
          <button class="fh-btn-icon delete-btn text-fh-red/60 hover:text-fh-red hover:bg-fh-red-subtle"
                  data-name="${escapeHtml(repo.full_name)}" title="Delete" ${isBusy ? 'disabled' : ''}
                  aria-label="Delete repository">
            ${icon('trash', { size: 14 })}
          </button>
        </div>
      </div>
    </div>`;
}

function renderCiBadge(status) {
  if (!status) return '';
  if (status === 'success') {
    return `<span class="fh-badge border-fh-green/20 bg-fh-green-subtle text-fh-green">${icon('circleCheck', { size: 10 })} CI</span>`;
  }
  if (status === 'failure') {
    return `<span class="fh-badge border-fh-red/20 bg-fh-red-subtle text-fh-red">${icon('circleX', { size: 10 })} CI</span>`;
  }
  if (status === 'pending') {
    return `<span class="fh-badge border-fh-yellow/20 bg-fh-yellow-subtle text-fh-yellow">${icon('loader', { size: 10 })} CI</span>`;
  }
  return '';
}

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  'C++': '#f34b7d', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584',
  Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF',
  Dart: '#00B4AB', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051',
  Vue: '#41b883', Svelte: '#ff3e00', Lua: '#000080', Zig: '#ec915c',
  Jupyter: '#DA5B0B', R: '#198CE7', Scala: '#c22d40', Haskell: '#5e5086',
  Elixir: '#6e4a7e', Clojure: '#db5855', 'Objective-C': '#438eff',
};

function getLanguageColor(lang) {
  return LANG_COLORS[lang] || '#8b949e';
}
