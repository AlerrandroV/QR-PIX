// theme.js — carregado em TODAS as páginas antes de qualquer outro script
(function () {
  const SETTINGS_KEY = "pixkey_settings";

  function loadSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function applyTheme(tema) {
    const root = document.documentElement;
    if (tema === "dark") {
      root.setAttribute("data-theme", "dark");
    } else if (tema === "light") {
      root.removeAttribute("data-theme");
    } else {
      // "system" ou undefined
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? root.setAttribute("data-theme", "dark")
        : root.removeAttribute("data-theme");
    }
  }

  function applyEyeCare(value) {
    const overlay = document.getElementById("eyecare-overlay");
    if (overlay) overlay.remove();
    return false;
  }

  // ── Aplicar imediatamente ao carregar ──
  const settings = loadSettings();
  applyTheme(settings.tema ?? "system");
  applyEyeCare(settings.eyecare ?? "off");

  // ── Reagir a mudança do tema do sistema em tempo real ──
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if ((loadSettings().tema ?? "system") === "system") applyTheme("system");
  });



  window.addEventListener("pixkey:settings-imported", (event) => {
    const incoming = event.detail || loadSettings();
    applyTheme(incoming.tema ?? "system");
    applyEyeCare(incoming.eyecare ?? "off");
  });

  // ── Expor utilitários globais para settings.js reutilizar ──
  window.PixKeyTheme = { applyTheme, applyEyeCare, loadSettings };
})();
