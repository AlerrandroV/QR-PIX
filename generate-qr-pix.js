/* =================================================================
   generate-qr-pix.js — QR Code + Pix Copia e Cola
================================================================= */
(function () {
  'use strict';
  const { tx, KEY_TYPES, formatCurrency, qrSettings, buildQrOptions } = window.PixUtils;
  const UI = window.QrUI;
  const $ = (id) => document.getElementById(id);

  const t = tx.read();
  if (!t.key) { location.replace('index.html'); return; }
  tx.set(t);

  // Cliente vindo de uma loja pública: "concluir" volta para a loja
  if (t.store) {
    const storeHref = 'store.html?u=' + encodeURIComponent(t.store);
    $('btn-home').setAttribute('href', storeHref);
    $('btn-home').setAttribute('aria-label', 'Voltar para a loja');
    $('btn-home').querySelector('md-icon').textContent = 'storefront';
    document.querySelector('[data-nav="back"]').dataset.fallback = storeHref;
  }

  const payload = window.PixPayload.generatePixPayload({
    keyType: t.keyType,
    key: t.key,
    name: t.name,
    city: t.city || 'BRASILIA',
    value: t.value || 0,
  });

  // ── Dados ─────────────────────────────────────────────────────
  $('info-value').textContent = t.value ? formatCurrency(t.value) : 'Valor livre';
  $('info-to').textContent = t.value ? `para ${t.name}` : `${t.name} · o cliente digita o valor`;
  $('info-name').textContent = t.name;
  $('info-bank').textContent = t.bank || '—';
  $('info-key-type').textContent = 'Chave PIX · ' + (KEY_TYPES[t.keyType]?.label || t.keyType);
  $('info-key').textContent = t.key;
  $('copypaste-code').textContent = payload;

  // ── QR Code ───────────────────────────────────────────────────
  const cfg = qrSettings.load();
  const frame = $('qr-output');
  const qrSize = Math.max(200, Math.min(320, window.innerWidth - 96, Math.floor(window.innerHeight * 0.42)));
  frame.style.setProperty('--qr-size', qrSize + 'px');
  // Canvas em 2× a área visível: nítido em telas de alta densidade
new QRCodeStyling(buildQrOptions(cfg, { data: payload, size: qrSize * 2, type: 'canvas' })).append(frame);

  const fileQr = (size) => new QRCodeStyling(buildQrOptions(cfg, { data: payload, size, type: 'canvas' }));
  const fileName = 'qrpix-' + (t.name || 'cobranca').toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-');

  // ── Copiar ────────────────────────────────────────────────────
  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: payload });
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    UI.snackbar('Código copiado');
  }
  $('btn-copy').addEventListener('click', copy);

  // ── Baixar ────────────────────────────────────────────────────
  $('btn-download').addEventListener('click', () => {
    fileQr(1024).download({ name: fileName, extension: 'png' });
    UI.snackbar('Imagem salva');
  });

  // ── Compartilhar ──────────────────────────────────────────────
  $('btn-share').addEventListener('click', async () => {
    const text = (t.value ? `Cobrança de ${formatCurrency(t.value)} — ${t.name}` : `PIX para ${t.name}`) +
      '\n\nPix Copia e Cola:\n' + payload;
    if (!navigator.share) { await copy(); return; }
    try {
      const blob = await fileQr(720).getRawData('png');
      const file = new File([blob], fileName + '.png', { type: 'image/png' });
      const data = { title: 'QR Code PIX', text };
      if (navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      await navigator.share(data);
    } catch (err) {
      if (err.name !== 'AbortError') { try { await navigator.share({ title: 'QR Code PIX', text }); } catch {} }
    }
  });
})();
