(function () {
  // ── Configurações / tema ────────────────────────────────────────────────
  const SETTINGS_KEY = 'pixkey_settings';
  const defaults = { tema: 'system', eyecare: 'off' };

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      return stored ? { ...defaults, ...stored } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function applyTheme(tema) {
    const root = document.documentElement;
    if (tema === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (tema === 'light') {
      root.removeAttribute('data-theme');
    } else {
      window.matchMedia('(prefers-color-scheme: dark)').matches
        ? root.setAttribute('data-theme', 'dark')
        : root.removeAttribute('data-theme');
    }
  }

  function applyEyeCare(mode) {
    const root = document.documentElement;
    root.removeAttribute('data-eyecare');
    if (mode === 'on') {
      root.setAttribute('data-eyecare', 'on');
    } else if (mode === 'night') {
      const h = new Date().getHours();
      if (h >= 18 || h < 6) root.setAttribute('data-eyecare', 'night');
    }
  }

  function applyAppearance() {
    const s = loadSettings();
    applyTheme(s.tema);
    applyEyeCare(s.eyecare);
    return s;
  }

  function updateSettings(partial) {
    const next = { ...loadSettings(), ...partial };
    saveSettings(next);
    applyAppearance();
    try {
      localStorage.setItem('pixkey_settings_ts', Date.now().toString());
    } catch {}
    return next;
  }

  window.addEventListener('pageshow', () => applyAppearance());
  window.addEventListener('storage', (e) => {
    if (e.key === SETTINGS_KEY || e.key === 'pixkey_settings_ts') applyAppearance();
  });

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystem = () => { if (loadSettings().tema === 'system') applyAppearance(); };
  typeof media.addEventListener === 'function'
    ? media.addEventListener('change', onSystem)
    : media.addListener(onSystem);

  applyAppearance();

  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
  }
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', setAppHeight);
  setAppHeight();

  // ── Botão de instalação PWA ─────────────────────────────────────────
  let _deferredInstallPrompt = null;

  // Se já está rodando em modo standalone (instalado), oculta o botão
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function getInstallBtn() {
    return document.getElementById('btn-install');
  }

  function showInstallBtn() {
    const btn = getInstallBtn();
    if (btn) btn.style.display = '';
  }

  function hideInstallBtn() {
    const btn = getInstallBtn();
    if (btn) btn.style.display = 'none';
  }

  // O browser dispara beforeinstallprompt quando a PWA está installável.
  // Guardamos o evento para acionar o prompt manualmente no clique do botão.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Impede o mini-infobar automático
    _deferredInstallPrompt = e;
    if (!isStandalone) showInstallBtn();
  });

  // Quando o usuário instala pelo browser (fora do botão), oculta o botão
  window.addEventListener('appinstalled', () => {
    _deferredInstallPrompt = null;
    hideInstallBtn();
  });

  // Conecta o clique do botão ao prompt nativo — aguarda o DOM estar pronto
  function bindInstallBtn() {
    const btn = getInstallBtn();
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!_deferredInstallPrompt) return;
      _deferredInstallPrompt.prompt();
      const { outcome } = await _deferredInstallPrompt.userChoice;
      // Independente da escolha, descarta o prompt usado
      _deferredInstallPrompt = null;
      if (outcome === 'accepted') hideInstallBtn();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindInstallBtn, { once: true });
  } else {
    bindInstallBtn();
  }

  // ── Service Worker + sistema de atualização ───────────────────────
  let _snackbarEl = null;
  let _swReg = null;
  let _updatePending = false;

  function getSnackbar() {
    if (_snackbarEl) return _snackbarEl;

    const style = document.createElement('style');
    style.textContent = `
      #sw-update-snackbar {
        position: fixed;
        bottom: 88px;
        left: 50%;
        transform: translateX(-50%) translateY(24px);
        opacity: 0;
        transition: opacity 220ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1);
        z-index: 9999;
        background: var(--md-sys-color-inverse-surface, #2d3135);
        color: var(--md-sys-color-inverse-on-surface, #f0f4f8);
        border-radius: 12px;
        padding: 12px 8px 12px 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: Roboto, sans-serif;
        font-size: 14px;
        font-weight: 400;
        max-width: calc(100vw - 32px);
        width: max-content;
        box-shadow: 0 4px 16px rgba(0,0,0,0.28);
        pointer-events: none;
      }
      #sw-update-snackbar.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        pointer-events: all;
      }
      #sw-update-snackbar .snack-msg {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #sw-update-snackbar .snack-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-family: Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: var(--md-sys-color-primary-container, #90caf9);
        padding: 8px 12px;
        border-radius: 8px;
        white-space: nowrap;
        transition: background 150ms;
        flex-shrink: 0;
      }
      #sw-update-snackbar .snack-btn:active {
        background: rgba(255,255,255,0.12);
      }
      #sw-update-snackbar .snack-dismiss {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--md-sys-color-inverse-on-surface, #f0f4f8);
        opacity: 0.7;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-family: 'Material Symbols Rounded', sans-serif;
        font-size: 20px;
        flex-shrink: 0;
        transition: background 150ms;
      }
      #sw-update-snackbar .snack-dismiss:active {
        background: rgba(255,255,255,0.12);
      }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'sw-update-snackbar';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
      <span class="snack-msg">Nova vers&atilde;o dispon&iacute;vel</span>
      <button class="snack-btn" id="snack-update-btn">Atualizar</button>
      <button class="snack-dismiss" id="snack-dismiss-btn" aria-label="Fechar">close</button>
    `;
    document.body.appendChild(el);

    el.querySelector('#snack-update-btn').addEventListener('click', () => {
      hideSnackbar();
      applyUpdate();
    });
    el.querySelector('#snack-dismiss-btn').addEventListener('click', () => {
      hideSnackbar();
    });

    _snackbarEl = el;
    return el;
  }

  function showSnackbar() {
    const show = () => { getSnackbar().classList.add('visible'); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show, { once: true });
    } else {
      show();
    }
  }

  function hideSnackbar() {
    if (_snackbarEl) _snackbarEl.classList.remove('visible');
  }

  function applyUpdate() {
    if (_swReg && _swReg.waiting) {
      _swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('./sw.js').then((reg) => {
      _swReg = reg;

      if (reg.waiting) {
        _updatePending = true;
        showSnackbar();
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            _updatePending = true;
            showSnackbar();
          }
        });
      });
    }).catch((err) => {
      console.warn('[QR PIX] SW registration failed:', err);
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        window.location.reload();
      }
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('load', registerSW, { once: true });
  } else {
    registerSW();
  }

  window.PixKeyUI = {
    SETTINGS_KEY, loadSettings, saveSettings,
    applyTheme, applyEyeCare, applyAppearance, updateSettings,
  };
})();

window.addEventListener('pixkey:settings-imported', () => {});
