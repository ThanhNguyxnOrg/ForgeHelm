(() => {
  if (document.getElementById('fh-launcher-root')) return;

  const host = document.createElement('div');
  host.id = 'fh-launcher-root';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = chrome.runtime.getURL('content-script/launcher.css');
  shadow.appendChild(style);

  const HAMMER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/></svg>`;

  const CLOSE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

  const fab = document.createElement('button');
  fab.className = 'fh-fab';
  fab.innerHTML = HAMMER_SVG;
  fab.title = 'Open ForgeHelm';
  shadow.appendChild(fab);

  const backdrop = document.createElement('div');
  backdrop.className = 'fh-backdrop';
  shadow.appendChild(backdrop);

  const panel = document.createElement('div');
  panel.className = 'fh-panel';
  panel.innerHTML = `
    <div class="fh-panel-header">
      <div class="fh-panel-title">
        <span class="fh-panel-icon">${HAMMER_SVG}</span>
        <span>ForgeHelm</span>
      </div>
      <button class="fh-panel-close" title="Close">${CLOSE_SVG}</button>
    </div>
    <iframe class="fh-panel-iframe" src="${chrome.runtime.getURL('popup/popup.html')}"></iframe>
  `;
  shadow.appendChild(panel);

  let isOpen = false;

  function toggle() {
    isOpen = !isOpen;
    panel.classList.toggle('fh-panel-open', isOpen);
    backdrop.classList.toggle('fh-backdrop-visible', isOpen);
    fab.classList.toggle('fh-fab-hidden', isOpen);
  }

  fab.addEventListener('click', toggle);
  backdrop.addEventListener('click', toggle);
  panel.querySelector('.fh-panel-close').addEventListener('click', toggle);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) toggle();
  });

  chrome.storage.local.get(['fh_launched'], (data) => {
    if (!data.fh_launched) {
      fab.classList.add('fh-fab-pulse');
      chrome.storage.local.set({ fh_launched: true });
      setTimeout(() => fab.classList.remove('fh-fab-pulse'), 6000);
    }
  });
})();
