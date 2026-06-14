(() => {
  let host = null;
  let shadow = null;
  let fab = null;
  let backdrop = null;
  let panel = null;
  let isOpen = false;

  function initLauncher(fh_launched) {
    if (host || document.getElementById('fh-launcher-root')) return;

    host = document.createElement('div');
    host.id = 'fh-launcher-root';
    document.body.appendChild(host);

    shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = chrome.runtime.getURL('content-script/launcher.css');
    shadow.appendChild(style);

    const iconUrl = chrome.runtime.getURL('icons/icon-48.png');

    fab = document.createElement('button');
    fab.className = 'fh-fab';
    fab.innerHTML = `<img src="${iconUrl}" style="width: 22px; height: 22px; object-fit: contain; display: block;" alt="ForgeHelm logo">`;
    fab.title = 'Open ForgeHelm';
    shadow.appendChild(fab);

    backdrop = document.createElement('div');
    backdrop.className = 'fh-backdrop';
    shadow.appendChild(backdrop);

    const array = new Uint32Array(8);
    crypto.getRandomValues(array);
    const challenge = Array.from(array, dec => dec.toString(16).padStart(8, '0')).join('');

    panel = document.createElement('div');
    panel.className = 'fh-panel';
    shadow.appendChild(panel);

    chrome.runtime.sendMessage(
      { type: 'REGISTER_CHALLENGE', payload: { challenge } },
      () => {
        if (panel) {
          panel.innerHTML = `
            <iframe class="fh-panel-iframe" src="${chrome.runtime.getURL('popup/popup.html')}?challenge=${challenge}"></iframe>
          `;
        }
      }
    );

    function toggle() {
      isOpen = !isOpen;
      panel.classList.toggle('fh-panel-open', isOpen);
      backdrop.classList.toggle('fh-backdrop-visible', isOpen);
      fab.classList.toggle('fh-fab-hidden', isOpen);
    }

    fab.addEventListener('click', toggle);
    backdrop.addEventListener('click', toggle);

    const handleKeydown = (e) => {
      if (e.key === 'Escape' && isOpen) toggle();
    };
    document.addEventListener('keydown', handleKeydown);

    // Save cleaner for dynamic removal
    host._cleanup = () => {
      document.removeEventListener('keydown', handleKeydown);
      host.remove();
      host = null;
      shadow = null;
      fab = null;
      backdrop = null;
      panel = null;
      isOpen = false;
    };

    if (!fh_launched) {
      fab.classList.add('fh-fab-pulse');
      chrome.storage.local.set({ fh_launched: true });
      setTimeout(() => {
        if (fab) fab.classList.remove('fh-fab-pulse');
      }, 6000);
    }
  }

  function destroyLauncher() {
    if (host && typeof host._cleanup === 'function') {
      host._cleanup();
    }
  }

  // Load initial settings
  chrome.storage.local.get(['fh_settings', 'fh_launched'], (data) => {
    const settings = data.fh_settings || {};
    const showLauncher = settings.showFloatingLauncher !== false;
    if (showLauncher) {
      initLauncher(data.fh_launched);
    }
  });

  // Listen for storage changes in settings to dynamically show/hide the FAB launcher
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.fh_settings) {
      const newSettings = changes.fh_settings.newValue || {};
      const showLauncher = newSettings.showFloatingLauncher !== false;
      if (showLauncher) {
        chrome.storage.local.get(['fh_launched'], (data) => {
          initLauncher(data.fh_launched);
        });
      } else {
        destroyLauncher();
      }
    }
  });

  // Listen for close message from the iframe popup
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'FH_CLOSE_SIDEBAR') {
      if (isOpen && fab) {
        fab.click();
      }
    }
  });
})();
