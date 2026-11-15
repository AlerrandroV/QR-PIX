/* =================================================================
   ui.js — comportamento compartilhado por TODAS as telas.
   Deve ser o primeiro script do <head> (aplica o tema antes do
   primeiro paint, evitando "flash" de tema errado).

   API pública: window.QrUI
     loadSettings() / updateSettings(partial)
     snackbar(message, { action, onAction, duration })
     dialog({ title, body, icon, actions:[{label, value, variant}] }) → Promise<value|null>
     confirm({ title, body, confirmLabel, cancelLabel, danger }) → Promise<boolean>
     attachSuggestions(field, getItems, onPick)
     setBeforeBack(fn)   — fn() retorna false p/ cancelar o "voltar"
     goBack()
     escapeHtml(str)
================================================================= */
(function () {
  'use strict';

  // ── Configurações / tema ───────────────────────────────────────
  const SETTINGS_KEY = 'pixkey_settings';
  const defaults = { tema: 'system', eyecare: 'off' };
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      return stored ? { ...defaults, ...stored } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  }

  function saveSettings(settings) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  }

  function resolveTheme(tema) {
    if (tema === 'dark' || tema === 'light') return tema;
    return darkQuery.matches ? 'dark' : 'light';
  }

  function applyTheme(tema) {
    document.documentElement.setAttribute('data-theme', resolveTheme(tema));
  }

  function applyEyeCare(mode) {
    const root = document.documentElement;
    const h = new Date().getHours();
    const on = mode === 'on' || (mode === 'night' && (h >= 18 || h < 6));
    on ? root.setAttribute('data-eyecare', mode) : root.removeAttribute('data-eyecare');
  }

  // Sincroniza a cor da barra de status do sistema com a superfície
  function syncThemeColor() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--md-sys-color-surface').trim();
    if (color) meta.setAttribute('content', color);
  }

  function applyAppearance() {
    const s = loadSettings();
    applyTheme(s.tema);
    applyEyeCare(s.eyecare);
    if (document.readyState !== 'loading') syncThemeColor();
    return s;
  }

  function updateSettings(partial) {
    const next = { ...loadSettings(), ...partial };
    saveSettings(next);
    applyAppearance();
    return next;
  }

  applyAppearance();
  window.addEventListener('pageshow', applyAppearance);
  window.addEventListener('storage', (e) => { if (e.key === SETTINGS_KEY) applyAppearance(); });
  const onSystem = () => { if (loadSettings().tema === 'system') applyAppearance(); };
  darkQuery.addEventListener ? darkQuery.addEventListener('change', onSystem) : darkQuery.addListener(onSystem);

  // Altura real da viewport (barra de endereço móvel)
  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
  }
  window.addEventListener('resize', setAppHeight);
  setAppHeight();

  // ── Utilidades ──────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function onReady(fn) {
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', fn, { once: true })
      : fn();
  }

  // ── Navegação "voltar" ──────────────────────────────────────────
  // Todo botão com [data-nav="back"] volta no histórico; se a tela foi
  // aberta direto (sem histórico do app), vai para data-fallback.
  let beforeBack = null;
  function setBeforeBack(fn) { beforeBack = fn; }

  function goBack(fallback) {
    const btn = document.querySelector('[data-nav="back"]');
    const target = fallback || btn?.dataset.fallback || 'index.html';
    let sameOrigin = false;
    try { sameOrigin = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch {}
    if (sameOrigin && history.length > 1) history.back();
    else location.replace(target);
  }

  function bindBackButtons() {
    document.querySelectorAll('[data-nav="back"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (beforeBack) {
          const ok = await beforeBack();
          if (ok === false) return;
        }
        goBack();
      });
    });
  }

  // ── App bar ganha cor ao rolar o conteúdo ──────────────────────
  function bindScrollElevation() {
    const bar = document.querySelector('.app-bar');
    const main = document.querySelector('.app-main');
    if (!bar || !main) return;
    const update = () => bar.classList.toggle('is-scrolled', main.scrollTop > 4);
    main.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ── Painéis expansíveis (.expand) ───────────────────────────────
  function bindExpanders() {
    document.querySelectorAll('.expand').forEach((exp) => {
      const trigger = exp.querySelector(':scope > .list-item');
      if (!trigger) return;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', () => {
        const open = !exp.classList.contains('is-open');
        document.querySelectorAll('.expand.is-open').forEach((o) => {
          o.classList.remove('is-open');
          o.querySelector(':scope > .list-item')?.setAttribute('aria-expanded', 'false');
        });
        exp.classList.toggle('is-open', open);
        trigger.setAttribute('aria-expanded', String(open));
      });
      trigger.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger.click(); }
      });
    });
  }

  // Elementos com data-href viram links (list-items não-<a>)
  function bindHrefItems() {
    document.querySelectorAll('[data-href]').forEach((el) => {
      el.addEventListener('click', () => { location.href = el.dataset.href; });
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
      });
    });
  }

  // ── Snackbar ────────────────────────────────────────────────────
  let snackEl = null;
  let snackTimer = null;

  function snackbar(message, opts = {}) {
    const { action, onAction, duration = action ? 6000 : 3000, dismissible = !!action } = opts;
    if (!snackEl) {
      snackEl = document.createElement('div');
      snackEl.className = 'snackbar';
      snackEl.setAttribute('role', 'status');
      snackEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(snackEl);
    }
    snackEl.innerHTML =
      '<span class="snackbar__text"></span>' +
      (action ? '<button class="snackbar__action" type="button"></button>' : '') +
      (dismissible ? '<button class="snackbar__close" type="button" aria-label="Fechar"><span class="icon icon--sm">close</span></button>' : '');
    snackEl.querySelector('.snackbar__text').textContent = message;
    if (action) {
      const a = snackEl.querySelector('.snackbar__action');
      a.textContent = action;
      a.addEventListener('click', () => { hideSnackbar(); onAction && onAction(); });
    }
    snackEl.querySelector('.snackbar__close')?.addEventListener('click', hideSnackbar);

    clearTimeout(snackTimer);
    requestAnimationFrame(() => snackEl.classList.add('is-visible'));
    if (duration > 0) snackTimer = setTimeout(hideSnackbar, duration);
  }

  function hideSnackbar() {
    clearTimeout(snackTimer);
    snackEl && snackEl.classList.remove('is-visible');
  }

  // ── Dialog (md-dialog com fallback nativo) ──────────────────────
  async function dialog({ title, body, icon, actions = [] }) {
    const defined = await Promise.race([
      customElements.whenDefined('md-dialog').then(() => true),
      new Promise((r) => setTimeout(() => r(false), 1500)),
    ]);

    if (!defined) {
      // Sem Material Web (offline sem cache): fallback simples
      const primary = actions.find((a) => a.variant === 'filled') || actions[actions.length - 1];
      return window.confirm(title + (body ? '\n\n' + body : '')) ? primary?.value ?? true : null;
    }

    return new Promise((resolve) => {
      const dlg = document.createElement('md-dialog');
      dlg.innerHTML =
        (icon ? `<md-icon slot="icon">${escapeHtml(icon)}</md-icon>` : '') +
        `<div slot="headline">${escapeHtml(title)}</div>` +
        `<form slot="content" method="dialog" id="qr-dlg-form">${body ? `<p>${escapeHtml(body)}</p>` : ''}</form>` +
        `<div slot="actions">${actions.map((a, i) => {
          const tag = a.variant === 'filled' ? 'md-filled-button' : 'md-text-button';
          const cls = a.danger ? ' class="btn-danger"' : '';
          return `<${tag} form="qr-dlg-form" value="${i}"${cls}>${escapeHtml(a.label)}</${tag}>`;
        }).join('')}</div>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('closed', () => {
        const idx = parseInt(dlg.returnValue, 10);
        resolve(Number.isNaN(idx) ? null : actions[idx]?.value ?? null);
        dlg.remove();
      });
      requestAnimationFrame(() => dlg.show());
    });
  }

  async function confirm({ title, body, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, icon }) {
    const res = await dialog({
      title, body, icon,
      actions: [
        { label: cancelLabel, value: false },
        { label: confirmLabel, value: true, variant: danger ? 'text' : 'filled', danger },
      ],
    });
    return res === true;
  }

  // ── Sugestões (autocomplete) ────────────────────────────────────
  // field: md-outlined-text-field dentro de um .field
  // getItems(value) → [{ label, value, icon }]
  function attachSuggestions(field, getItems, onPick) {
    const wrap = field.closest('.field') || field.parentElement;
    const list = document.createElement('ul');
    list.className = 'suggestions';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    wrap.appendChild(list);

    function render() {
      const items = getItems(field.value || '') || [];
      if (!items.length) { list.hidden = true; return; }
      list.innerHTML = items.map((it, i) =>
        `<li class="list-item list-item--action" role="option" tabindex="-1" data-i="${i}">
           <span class="icon list-item__leading list-item__leading--plain" aria-hidden="true">${escapeHtml(it.icon || 'search')}</span>
           <span class="list-item__content"><span class="list-item__headline">${escapeHtml(it.label)}</span></span>
         </li>`).join('');
      list.hidden = false;
      list.querySelectorAll('li').forEach((li) => {
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const it = items[+li.dataset.i];
          list.hidden = true;
          onPick(it);
        });
      });
    }

    field.addEventListener('input', render);
    field.addEventListener('focus', () => { if (field.value) render(); });
    field.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
    field.addEventListener('keydown', (e) => { if (e.key === 'Escape') list.hidden = true; });
    return { close: () => { list.hidden = true; }, render };
  }

  // ── Instalação PWA ──────────────────────────────────────────────
  let deferredInstall = null;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  function setInstallVisible(v) {
    document.querySelectorAll('[data-install]').forEach((el) => { el.hidden = !v; });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (!isStandalone) onReady(() => setInstallVisible(true));
  });
  window.addEventListener('appinstalled', () => { deferredInstall = null; setInstallVisible(false); });

  function bindInstall() {
    setInstallVisible(!!deferredInstall && !isStandalone);
    document.querySelectorAll('[data-install]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!deferredInstall) return;
        deferredInstall.prompt();
        const { outcome } = await deferredInstall.userChoice;
        deferredInstall = null;
        if (outcome === 'accepted') setInstallVisible(false);
      });
    });
  }

  // ── Service Worker + aviso de atualização ──────────────────────
  let swReg = null;

  function applyUpdate() {
    if (swReg && swReg.waiting) swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    else location.reload();
  }

  function notifyUpdate() {
    snackbar('Nova versão disponível', { action: 'Atualizar', onAction: applyUpdate, duration: 0, dismissible: true });
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) notifyUpdate();
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) notifyUpdate();
        });
      });
    }).catch((err) => console.warn('[QR PIX] SW:', err));

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; location.reload(); }
    });
  }

  // ── Boot ────────────────────────────────────────────────────────
  onReady(() => {
    syncThemeColor();
    bindBackButtons();
    bindScrollElevation();
    bindExpanders();
    bindHrefItems();
    bindInstall();
  });
  document.readyState === 'complete' ? registerSW() : window.addEventListener('load', registerSW, { once: true });

  window.QrUI = {
    SETTINGS_KEY, loadSettings, saveSettings, updateSettings,
    applyTheme, applyEyeCare, applyAppearance,
    snackbar, hideSnackbar, dialog, confirm,
    attachSuggestions, setBeforeBack, goBack, escapeHtml, onReady,
  };
  // Compatibilidade com código antigo
  window.PixKeyUI = window.QrUI;
})();
