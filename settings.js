/* =================================================================
   settings.js — tela Ajustes
================================================================= */
(function () {
  'use strict';
  const UI = window.QrUI;

  const TEMA_LABELS = { light: 'Claro', dark: 'Escuro', system: 'Padrão do sistema' };
  const EYECARE_LABELS = { off: 'Desativada', on: 'Sempre ativada', night: 'Somente à noite' };
  const STORAGE = { keys: 'pixkeys', settings: 'pixkey_settings', qrSettings: 'pixkey_qr_settings' };

  const $ = (id) => document.getElementById(id);

  // ── Aparência ─────────────────────────────────────────────────
  function syncAppearanceUi() {
    const s = UI.loadSettings();
    $('tema-subtitle').textContent = TEMA_LABELS[s.tema] || s.tema;
    $('eyecare-subtitle').textContent = EYECARE_LABELS[s.eyecare] || s.eyecare;
    document.querySelectorAll('md-radio[name="tema"]').forEach((r) => { r.checked = r.value === s.tema; });
    document.querySelectorAll('md-radio[name="eyecare"]').forEach((r) => { r.checked = r.value === s.eyecare; });
  }

  function bindRadios(name, key) {
    document.querySelectorAll(`md-radio[name="${name}"]`).forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        UI.updateSettings({ [key]: radio.value });
        syncAppearanceUi();
      });
    });
  }

  // ── Backup ────────────────────────────────────────────────────
  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }

  async function exportBackup() {
    const payload = {
      format: 'pixkey-backup',
      version: 40,
      exportedAt: new Date().toISOString(),
      data: {
        settings: readJson(STORAGE.settings, {}),
        qrSettings: readJson(STORAGE.qrSettings, null),
        keys: readJson(STORAGE.keys, []),
        profile: await window.QrData.profile.get(),
        products: await window.QrData.products.all(),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `qrpix-backup-${new Date().toISOString().slice(0, 10)}.json`,
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    UI.snackbar('Backup exportado');
  }

  async function importBackup(file) {
    const parsed = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== 'object') throw new Error('Arquivo inválido');
    const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
    const keys = Array.isArray(data.keys) ? data.keys : [];
    const profile = data.profile && typeof data.profile === 'object' ? data.profile : null;
    const products = Array.isArray(data.products) ? data.products : null;
    const settings = data.settings && typeof data.settings === 'object' ? data.settings : {};
    const qr = data.qrSettings && typeof data.qrSettings === 'object' ? data.qrSettings : null;

    const ok = await UI.confirm({
      icon: 'restore',
      title: 'Restaurar backup?',
      body: `${keys.length} chave(s)` + (products ? `, ${products.length} produto(s)` : '') +
        (profile ? ', o perfil da loja' : '') + ' e suas preferências substituirão os dados atuais deste aparelho.',
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;

    localStorage.setItem(STORAGE.keys, JSON.stringify(keys));
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
    qr ? localStorage.setItem(STORAGE.qrSettings, JSON.stringify(qr)) : localStorage.removeItem(STORAGE.qrSettings);
    if (profile || products) await window.QrData.importAll({ profile, products });
    UI.applyAppearance();
    syncAppearanceUi();
    UI.snackbar('Backup restaurado');
  }

  function bindBackup() {
    const input = $('backup-file');
    $('item-export').addEventListener('click', exportBackup);
    $('item-import').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try { await importBackup(file); }
      catch (err) {
        console.error(err);
        UI.snackbar('Não foi possível ler o arquivo. Verifique se é um backup válido.');
      } finally { input.value = ''; }
    });
  }

  // ── Doação ────────────────────────────────────────────────────
  function bindDonate() {
    $('item-donate').addEventListener('click', () => {
      const params = new URLSearchParams({
        bank: 'Mercado Pago',
        name: 'Victor Alerrandro Tavares',
        keyType: 'email',
        key: 'v.alerrandro.t@hotmail.com',
        value: '0',
      });
      location.href = 'generate-qr-pix.html?' + params;
    });
  }

  // ── Atualizações ──────────────────────────────────────────────
  function bindUpdate() {
    const item = $('item-update');
    const sub = $('update-subtitle');
    const icon = $('update-icon');
    const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '';
    $('app-version').textContent = version ? 'Versão ' + version : 'Versão desconhecida';

    const set = (text, ic) => { sub.textContent = text; icon.textContent = ic; icon.classList.toggle('spin', ic === 'progress_activity'); };

    if (!('serviceWorker' in navigator)) { set('Indisponível neste navegador', 'block'); return; }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) { set('Versão ' + version, 'check_circle'); return; }
      const upToDate = () => set('Você está na versão mais recente', 'check_circle');
      const available = () => set('Nova versão disponível — toque para instalar', 'system_update_alt');

      reg.waiting ? available() : upToDate();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) available();
        });
      });

      item.addEventListener('click', () => {
        if (reg.waiting) {
          set('Aplicando atualização…', 'progress_activity');
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          return;
        }
        set('Verificando…', 'progress_activity');
        reg.update()
          .then(() => setTimeout(() => { if (!reg.waiting && !reg.installing) upToDate(); }, 2500))
          .catch(() => set('Sem conexão', 'cloud_off'));
      });
    }).catch(() => set('Erro ao verificar', 'error'));
  }

  // ── Init ──────────────────────────────────────────────────────
  customElements.whenDefined('md-radio').then(syncAppearanceUi);
  syncAppearanceUi();
  bindRadios('tema', 'tema');
  bindRadios('eyecare', 'eyecare');
  bindBackup();
  bindDonate();
  bindUpdate();
})();
