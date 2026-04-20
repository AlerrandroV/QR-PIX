(function () {
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
    // Notifica outras páginas abertas via storage event
    try {
      localStorage.setItem('pixkey_settings_ts', Date.now().toString());
    } catch {}
    return next;
  }

  // ── Reaplicar ao voltar (bfcache / history.back) ──
  window.addEventListener('pageshow', () => applyAppearance());

  // ── Reaplicar quando outra aba/página muda as configurações ──
  window.addEventListener('storage', (e) => {
    if (e.key === SETTINGS_KEY || e.key === 'pixkey_settings_ts') {
      applyAppearance();
    }
  });

  // ── Mudança de tema do sistema ──
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystem = () => { if (loadSettings().tema === 'system') applyAppearance(); };
  typeof media.addEventListener === 'function'
    ? media.addEventListener('change', onSystem)
    : media.addListener(onSystem);

  applyAppearance();

  // Viewport real para PWA
  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
  }
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', setAppHeight);
  setAppHeight();

  window.PixKeyUI = {
    SETTINGS_KEY, loadSettings, saveSettings,
    applyTheme, applyEyeCare, applyAppearance, updateSettings,
  };
})();


window.addEventListener("pixkey:settings-imported", () => {
  // Eventos de tema/eyecare são aplicados pelo theme.js; aqui mantemos consistência para módulos que releem configurações.
});
