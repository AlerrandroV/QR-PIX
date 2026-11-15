/* =================================================================
   qr-customize.js — tela Estilo do QR Code
   Controles declarativos: [data-option="chave"] em chips, cores e
   sliders; a chave corresponde a PixUtils.QR_DEFAULTS.
================================================================= */
(function () {
  'use strict';
  const { qrSettings, buildQrOptions, QR_DEFAULTS } = window.PixUtils;
  const UI = window.QrUI;
  const $ = (id) => document.getElementById(id);

  let saved = qrSettings.load();
  let current = { ...saved };

  const ECC = [
    { title: 'Baixa (L)', pct: '7%' },
    { title: 'Média (M)', pct: '15%' },
    { title: 'Quartil (Q)', pct: '25%' },
    { title: 'Alta (H)', pct: '30%' },
  ];
  const FORMAT = {
    margin: (v) => v + ' px',
    logoMargin: (v) => v + ' px',
    logoSize: (v) => Math.round(v * 100) + '%',
  };

  const isDirty = () => JSON.stringify(current) !== JSON.stringify(saved);

  // ── Preview ───────────────────────────────────────────────────
  const preview = new QRCodeStyling(buildQrOptions(current, { data: 'https://qrpix.site', size: 336, type: 'canvas' }));
  preview.append($('qr-canvas'));

  function refresh() {
    preview.update(buildQrOptions(current, { data: 'https://qrpix.site', size: 336, type: 'canvas' }));
    $('btn-save').disabled = !isDirty();
  }

  // ── Sincroniza controles com o estado ─────────────────────────
  function syncControls() {
    document.querySelectorAll('md-chip-set[data-option]').forEach((set) => {
      const val = String(current[set.dataset.option] ?? '');
      set.querySelectorAll('md-filter-chip').forEach((c) => { c.selected = c.dataset.value === val; });
    });
    document.querySelectorAll('input[type="color"][data-option]').forEach((inp) => {
      inp.value = current[inp.dataset.option];
      inp.closest('.swatch').style.background = inp.value;
    });
    document.querySelectorAll('md-slider[data-option]').forEach((s) => { s.value = current[s.dataset.option]; });
    document.querySelectorAll('[data-display]').forEach((el) => {
      const k = el.dataset.display;
      el.textContent = FORMAT[k] ? FORMAT[k](current[k]) : current[k];
    });
    const e = ECC[current.eccLevel] || ECC[0];
    $('ecc-title').textContent = e.title;
    $('ecc-badge').textContent = e.pct + ' de recuperação';

    const hasLogo = !!current.logoDataUrl;
    $('btn-clear-logo').hidden = !hasLogo;
    document.querySelectorAll('[data-logo-only]').forEach((el) => { el.hidden = !hasLogo; });
    $('logo-preview').innerHTML = hasLogo ? `<img src="${current.logoDataUrl}" alt="" />` : '<span class="icon">image</span>';
    if (!hasLogo) $('logo-name').textContent = 'Nenhuma imagem';
    else if ($('logo-name').textContent === 'Nenhuma imagem') $('logo-name').textContent = 'Logo salvo';
  }

  function set(key, value) {
    current[key] = value;
    syncControls();
    refresh();
  }

  // ── Bind controles ────────────────────────────────────────────
  document.querySelectorAll('md-chip-set[data-option]').forEach((setEl) => {
    setEl.querySelectorAll('md-filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => set(setEl.dataset.option, chip.dataset.value));
    });
  });

  document.querySelectorAll('input[type="color"][data-option]').forEach((inp) => {
    inp.addEventListener('input', () => set(inp.dataset.option, inp.value));
  });

  document.querySelectorAll('md-slider[data-option]').forEach((s) => {
    s.addEventListener('input', () => set(s.dataset.option, Number(s.value)));
  });

  // ── Logo ──────────────────────────────────────────────────────
  const logoInput = $('logo-input');
  $('btn-upload-logo').addEventListener('click', () => logoInput.click());
  logoInput.addEventListener('change', () => {
    const file = logoInput.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { UI.snackbar('A imagem deve ter no máximo 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      $('logo-name').textContent = file.name;
      // Logos maiores pedem correção de erro mais alta
      if (current.eccLevel < 2) current.eccLevel = 2;
      set('logoDataUrl', ev.target.result);
    };
    reader.readAsDataURL(file);
    logoInput.value = '';
  });
  $('btn-clear-logo').addEventListener('click', () => set('logoDataUrl', null));

  // ── Salvar / restaurar ────────────────────────────────────────
  function save() {
    try {
      qrSettings.save(current);
      saved = { ...current };
      refresh();
      UI.snackbar('Estilo salvo');
      return true;
    } catch {
      UI.snackbar('Não foi possível salvar. Tente uma imagem de logo menor.');
      return false;
    }
  }
  $('btn-save').addEventListener('click', save);

  $('btn-reset').addEventListener('click', async () => {
    const ok = await UI.confirm({
      icon: 'restart_alt',
      title: 'Restaurar estilo padrão?',
      body: 'Cores, formatos e logo voltam ao QR Code preto e branco tradicional.',
      confirmLabel: 'Restaurar',
    });
    if (!ok) return;
    current = { ...QR_DEFAULTS };
    syncControls();
    refresh();
  });

  // ── Sair sem salvar ───────────────────────────────────────────
  UI.setBeforeBack(async () => {
    if (!isDirty()) return true;
    const choice = await UI.dialog({
      icon: 'edit_note',
      title: 'Salvar alterações?',
      body: 'Você alterou o estilo do QR Code e ainda não salvou.',
      actions: [
        { label: 'Descartar', value: 'discard' },
        { label: 'Salvar', value: 'save', variant: 'filled' },
      ],
    });
    if (choice === 'save') return save();
    if (choice === 'discard') { current = { ...saved }; return true; }
    return false;
  });
  window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  // ── Init (após os web components existirem) ───────────────────
  Promise.all(['md-filter-chip', 'md-slider'].map((t) => customElements.whenDefined(t)))
    .then(syncControls);
  syncControls();
  refresh();
})();
