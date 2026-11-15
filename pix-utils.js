/* =================================================================
   pix-utils.js — regras de domínio compartilhadas (sem UI).
   Formatadores e validadores de chave PIX, lista de bancos,
   armazenamento local e opções do QR Code.
   Exposto em window.PixUtils (também usado por módulos ES).
================================================================= */
(function () {
  'use strict';

  // ── Instituições ────────────────────────────────────────────────
  const BANKS = [
    'Banco do Brasil', 'Bradesco', 'Caixa Econômica Federal', 'Itaú Unibanco', 'Santander',
    'Banco Safra', 'BTG Pactual', 'Banco Pan', 'Banco Inter', 'C6 Bank', 'Banco Original',
    'Banco BV', 'Banco Votorantim', 'Banco BMG', 'Banco Mercantil do Brasil', 'Banco Daycoval',
    'Banco Fibra', 'Banco ABC Brasil', 'Banestes', 'Banrisul', 'BRB (Banco de Brasília)',
    'Banco da Amazônia', 'Banco do Nordeste', 'Citibank', 'Banco BNP Paribas Brasil',
    'J.P. Morgan', 'Banco Inbursa', 'HSBC', 'Banco Western Union', 'Banco Travelex', 'Ebury',
    'Banco Semear', 'Banco Topázio', 'Banco Bari', 'Banco Digio', 'Banco Genial', 'Banco Master',
    'Banco Guanabara', 'Banco Industrial do Brasil', 'Banco Paulista', 'Banco Pine',
    'Banco Ribeirão Preto', 'Banco VR', 'Banco B3', 'Banco Sofisa', 'Banco CSF', 'Banco Crefisa',
    'Banco BS2', 'Sicredi', 'Sicoob', 'Cresol', 'Unicred', 'Ailos', 'Nubank', 'Neon', 'PicPay',
    'PicPay Bank', 'Mercado Pago', 'PagBank (PagSeguro)', 'Next', 'Agibank', 'XP Investimentos',
    'Mercado Bitcoin', 'Wise', 'Wise Brasil IP', 'EBANX', 'Dlocal', 'Revolut', 'Transfero',
    'Money Cloud', 'Asaas', 'Celcoin', 'FitBank', 'Galax Pay', 'Iugu', 'Efí', 'Dock', 'Stone',
    'SumUp', 'Cielo', 'PagHiper', 'PagueVeloz', 'Pay4Fun', 'RecargaPay',
  ];

  const EMAIL_PROVIDERS = [
    'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'yahoo.com', 'icloud.com',
    'proton.me', 'live.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'globo.com',
  ];

  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function searchBanks(q, limit = 6) {
    const n = norm(q.trim());
    if (!n) return [];
    return BANKS.filter((b) => norm(b).includes(n)).slice(0, limit);
  }

  function emailCompletions(value, limit = 5) {
    const at = value.indexOf('@');
    if (at < 1) return [];
    const local = value.slice(0, at);
    const partial = value.slice(at + 1).toLowerCase();
    const list = EMAIL_PROVIDERS.filter((p) => p.startsWith(partial) && p !== partial);
    return list.slice(0, limit).map((p) => local + '@' + p);
  }

  // ── Formatadores / validadores ──────────────────────────────────
  const onlyDigits = (v) => String(v).replace(/\D/g, '');

  function formatCpf(raw) {
    const d = onlyDigits(raw).slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
  }

  function validateCpf(value) {
    const d = onlyDigits(value);
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += +d[i] * (10 - i);
    let r = (sum * 10) % 11;
    if (r === 10) r = 0;
    if (r !== +d[9]) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += +d[i] * (11 - i);
    r = (sum * 10) % 11;
    if (r === 10) r = 0;
    return r === +d[10];
  }

  function formatCnpj(raw) {
    const d = onlyDigits(raw).slice(0, 14);
    if (d.length <= 2) return d;
    if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
    if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
    if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12);
  }

  function validateCnpj(value) {
    const d = onlyDigits(value);
    if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
    const calc = (n) => {
      let sum = 0, pos = n - 7;
      for (let i = n; i >= 1; i--) {
        sum += +d[n - i] * pos--;
        if (pos < 2) pos = 9;
      }
      return sum % 11 < 2 ? 0 : 11 - (sum % 11);
    };
    return calc(12) === +d[12] && calc(13) === +d[13];
  }

  function formatPhone(raw) {
    let d = onlyDigits(raw);
    if (d.startsWith('55') && d.length > 11) d = d.slice(2);
    d = d.slice(0, 11);
    if (!d.length) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function validatePhone(value) {
    const d = onlyDigits(String(value).replace(/^\+55/, ''));
    if (d.length < 10 || d.length > 11) return false;
    if (d.length === 11 && d[2] !== '9') return false;
    return true;
  }

  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
  const validateRandom = (v) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v).trim());

  const KEY_TYPES = {
    cpf:    { label: 'CPF',             icon: 'badge',          placeholder: '000.000.000-00',      inputMode: 'numeric', type: 'text',  format: formatCpf,   validate: validateCpf },
    cnpj:   { label: 'CNPJ',            icon: 'domain',         placeholder: '00.000.000/0000-00',  inputMode: 'numeric', type: 'text',  format: formatCnpj,  validate: validateCnpj },
    phone:  { label: 'Telefone',        icon: 'call',           placeholder: '(00) 00000-0000',     inputMode: 'tel',     type: 'tel',   format: formatPhone, validate: validatePhone },
    email:  { label: 'E-mail',          icon: 'mail',           placeholder: 'nome@email.com',      inputMode: 'email',   type: 'email', format: (v) => v.trim(), validate: validateEmail },
    random: { label: 'Chave aleatória', icon: 'key',            placeholder: '00000000-0000-0000-0000-000000000000', inputMode: 'text', type: 'text', format: (v) => v.trim(), validate: validateRandom },
  };

  // ── Valores ─────────────────────────────────────────────────────
  function formatCents(cents) {
    const n = Math.max(0, parseInt(cents, 10) || 0);
    const int = Math.floor(n / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return int + ',' + String(n % 100).padStart(2, '0');
  }
  const formatCurrency = (cents) => 'R$ ' + formatCents(cents);

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
  }

  // ── Armazenamento ───────────────────────────────────────────────
  const KEYS_STORAGE = 'pixkeys';
  const TX_STORAGE = 'pixkey_current_tx';
  const QR_STORAGE = 'pixkey_qr_settings';

  function readJson(storage, key, fallback) {
    try { const v = JSON.parse(storage.getItem(key)); return v ?? fallback; } catch { return fallback; }
  }

  const keys = {
    all: () => readJson(localStorage, KEYS_STORAGE, []),
    save(list) { localStorage.setItem(KEYS_STORAGE, JSON.stringify(list)); },
    add(entry) {
      const list = keys.all();
      const dup = list.find((k) => k.key === entry.key && k.keyType === entry.keyType);
      if (dup) return dup;
      const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), ...entry };
      list.unshift(item);
      keys.save(list);
      return item;
    },
    remove(id) { keys.save(keys.all().filter((k) => k.id !== id)); },
    touch(id) {
      const list = keys.all();
      const i = list.findIndex((k) => k.id === id);
      if (i > 0) { list.unshift(list.splice(i, 1)[0]); keys.save(list); }
    },
  };

  // Transação em andamento (chave escolhida → valor → QR)
  const tx = {
    get: () => readJson(sessionStorage, TX_STORAGE, {}),
    set(data) { try { sessionStorage.setItem(TX_STORAGE, JSON.stringify(data)); } catch {} },
    // Lê da query string (links compartilháveis) ou da sessão
    read() {
      const qp = new URLSearchParams(location.search);
      if (qp.has('key')) {
        return {
          bank: qp.get('bank') || '', name: qp.get('name') || '',
          keyType: qp.get('keyType') || '', key: qp.get('key') || '',
          value: parseInt(qp.get('value') || '0', 10) || 0,
          city: qp.get('city') || '',
          store: qp.get('store') || '',   // aberto a partir de uma loja pública
        };
      }
      return tx.get();
    },
  };

  // ── QR Code ─────────────────────────────────────────────────────
  const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
  const QR_DEFAULTS = {
    dotsType: 'square', dotsColor: '#000000',
    cornerSqType: '', cornerSqColor: '#000000',
    cornerDotType: '', cornerDotColor: '#000000',
    bgColor: '#ffffff', logoSize: 0.3, logoMargin: 5,
    margin: 10, logoDataUrl: null, eccLevel: 0,
  };

  const qrSettings = {
    load: () => ({ ...QR_DEFAULTS, ...readJson(localStorage, QR_STORAGE, {}) }),
    save(opts) { localStorage.setItem(QR_STORAGE, JSON.stringify(opts)); },
  };

  // Converte as configurações salvas em opções do QRCodeStyling
  function buildQrOptions(cfg, { data, size, type = 'svg' }) {
    return {
      width: size, height: size, type, data,
      margin: cfg.margin,
      qrOptions: { errorCorrectionLevel: ECC_LEVELS[cfg.eccLevel] || 'L' },
      dotsOptions: { type: cfg.dotsType || 'square', color: cfg.dotsColor },
      cornersSquareOptions: { type: cfg.cornerSqType || undefined, color: cfg.cornerSqColor },
      cornersDotOptions: { type: cfg.cornerDotType || undefined, color: cfg.cornerDotColor },
      backgroundOptions: { color: cfg.bgColor },
      image: cfg.logoDataUrl || undefined,
      imageOptions: { crossOrigin: 'anonymous', imageSize: cfg.logoSize, margin: cfg.logoMargin, hideBackgroundDots: true },
    };
  }

  // Redimensiona/recorta imagem para data URL quadrada
  function imageToSquareDataUrl(file, size = 256, mime = 'image/jpeg') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const s = Math.min(img.width, img.height);
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = size;
          canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
          resolve(canvas.toDataURL(mime, 0.88));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  window.PixUtils = {
    BANKS, EMAIL_PROVIDERS, KEY_TYPES, ECC_LEVELS, QR_DEFAULTS,
    searchBanks, emailCompletions, onlyDigits,
    formatCpf, validateCpf, formatCnpj, validateCnpj, formatPhone, validatePhone,
    validateEmail, validateRandom,
    formatCents, formatCurrency, initials,
    keys, tx, qrSettings, buildQrOptions, imageToSquareDataUrl,
  };
})();
