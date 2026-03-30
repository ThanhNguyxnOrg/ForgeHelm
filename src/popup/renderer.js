import { icon } from '../lib/icons.js';
import { escapeHtml, relativeTime, formatNumber } from '../lib/utils.js';

export function renderRepoCard(repo, isSelected, isBusy) {
  const vis = repo.private ? 'private' : 'public';
  const badgeClass = repo.private ? 'fh-badge-private' : 'fh-badge-public';
  const badgeLabel = repo.private ? 'Private' : 'Public';
  const badgeIcon = repo.private ? icon('lock') : icon('globe');

  const selectedClass = isSelected ? 'border-fh-accent/50 bg-fh-accent/5' : '';
  const archivedBadge = repo.archived
    ? `<span class="fh-badge-archived">${icon('archive', { size: 10 })} Archived</span>`
    : '';
  const forkBadge = repo.fork
    ? `<span class="fh-badge-fork">${icon('fork')} Fork</span>`
    : '';

  const busyOverlay = isBusy
    ? `<div class="absolute inset-0 bg-fh-bg/60 rounded-lg flex items-center justify-center z-10">
         <span class="animate-spin-slow text-fh-accent">${icon('loader', { size: 20 })}</span>
       </div>`
    : '';

  return `
    <div class="fh-card-interactive relative p-3 ${selectedClass}" data-repo="${escapeHtml(repo.full_name)}">
      ${busyOverlay}
      <div class="flex items-start gap-2.5">
        <input type="checkbox" class="repo-checkbox mt-0.5 accent-fh-accent cursor-pointer shrink-0"
               data-name="${escapeHtml(repo.full_name)}" ${isSelected ? 'checked' : ''} ${isBusy ? 'disabled' : ''}>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <a href="https://github.com/${escapeHtml(repo.full_name)}" target="_blank" rel="noopener"
               class="text-sm font-semibold text-fh-accent hover:underline truncate">
              ${escapeHtml(repo.name)}
            </a>
            <span class="${badgeClass}">${badgeIcon} ${badgeLabel}</span>
            ${archivedBadge}
            ${forkBadge}
          </div>
          ${repo.description
            ? `<p class="text-xs text-fh-text-secondary mt-1 fh-truncate-2">${escapeHtml(repo.description)}</p>`
            : ''}
          <div class="flex items-center gap-3 mt-1.5 text-fh-text-muted">
            ${repo.language
              ? `<span class="flex items-center gap-1 text-2xs">
                   <span class="w-2 h-2 rounded-full" style="background:${getLanguageColor(repo.language)}"></span>
                   ${escapeHtml(repo.language)}
                 </span>`
              : ''}
            ${repo.stargazers_count > 0
              ? `<span class="flex items-center gap-0.5 text-2xs">${icon('star')} ${formatNumber(repo.stargazers_count)}</span>`
              : ''}
            ${repo.forks_count > 0
              ? `<span class="flex items-center gap-0.5 text-2xs">${icon('fork')} ${formatNumber(repo.forks_count)}</span>`
              : ''}
            <span class="text-2xs">${relativeTime(repo.updated_at)}</span>
          </div>
        </div>
        <div class="flex items-center gap-0.5 shrink-0">
          <button class="fh-btn-icon visibility-btn" data-name="${escapeHtml(repo.full_name)}"
                  data-private="${repo.private}" title="Toggle visibility" ${isBusy ? 'disabled' : ''}>
            ${repo.private ? icon('unlock', { size: 14 }) : icon('lock', { size: 14 })}
          </button>
          ${!repo.archived ? `
          <button class="fh-btn-icon archive-btn" data-name="${escapeHtml(repo.full_name)}"
                  title="Archive" ${isBusy ? 'disabled' : ''}>
            ${icon('archive', { size: 14 })}
          </button>` : `
          <button class="fh-btn-icon archive-btn" data-name="${escapeHtml(repo.full_name)}"
                  data-unarchive="true" title="Unarchive" ${isBusy ? 'disabled' : ''}>
            ${icon('archive', { size: 14 })}
          </button>`}
          <button class="fh-btn-icon delete-btn text-fh-red/70 hover:text-fh-red hover:bg-fh-red/10"
                  data-name="${escapeHtml(repo.full_name)}" title="Delete" ${isBusy ? 'disabled' : ''}>
            ${icon('trash', { size: 14 })}
          </button>
        </div>
      </div>
    </div>`;
}

const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  'C++': '#f34b7d', 'C#': '#178600', Go: '#00ADD8', Rust: '#dea584',
  Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138', Kotlin: '#A97BFF',
  Dart: '#00B4AB', HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051',
  Vue: '#41b883', Svelte: '#ff3e00', Lua: '#000080', Zig: '#ec915c',
};

function getLanguageColor(lang) {
  return LANG_COLORS[lang] || '#8b949e';
}
