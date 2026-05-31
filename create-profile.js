/* =================================================================
   create-profile.js
   Wizard de 3 etapas para criação de perfil de cobrança PIX.
================================================================= */

'use strict';

// ── Estado global do wizard ──────────────────────────────────────
const profile = { name: '', city: '', bank: '', keyType: '', pixKey: '', username: '', avatarDataUrl: '' };
let currentStep = 1;
const TOTAL_STEPS = 3;

// ── Bancos ──────────────────────────────────────────────────────
const BANKS = [
  'Banco do Brasil','Bradesco','Caixa Econômica Federal','Itaú Unibanco',
  'Santander','Banco Safra','BTG Pactual','Banco Pan','Banco Inter',
  'C6 Bank','Banco Original','Banco BV','Banco Votorantim','Banco BMG',
  'Banco Mercantil do Brasil','Banco Daycoval','Banco Fibra','Banco ABC Brasil',
  'Banestes','Banrisul','BRB (Banco de Brasília)','Banco da Amazônia',
  'Banco do Nordeste','Citibank','Banco BNP Paribas Brasil','J.P. Morgan',
  'Banco Inbursa','HSBC','Banco Western Union','Banco Travelex','Ebury',
  'Banco Semear','Banco Topázio','Banco Bari','Banco Digio','Banco Genial',
  'Banco Master','Banco Guanabara','Banco Industrial do Brasil','Banco Paulista',
  'Banco Pine','Banco Ribeirão Preto','Banco VR','Banco B3','Banco Sofisa',
  'Banco CSF','Banco Crefisa','Banco BS2','Sicredi','Sicoob','Cresol',
  'Unicred','Ailos','Nubank','Neon','PicPay','PicPay Bank',
  'Mercado Pago','PagBank (PagSeguro)','Next','Agibank','XP Investimentos',
  'Mercado Bitcoin','Wise','Wise Brasil IP','EBANX','Dlocal','Revolut',
  'Transfero','Money Cloud','Asaas','Celcoin','FitBank','Galax Pay',
  'Iugu','Efí','Dock','Stone','SumUp','Cielo','PagHiper',
  'PagueVeloz','Pay4Fun','RecargaPay'
];

// ── Provedores de e-mail para autocomplete ─────────────────────────
const EMAIL_PROVIDERS = [
  'gmail.com','hotmail.com','outlook.com','yahoo.com.br','yahoo.com',
  'proton.me','protonmail.com','icloud.com','me.com','live.com',
  'msn.com','uol.com.br','bol.com.br','terra.com.br','ig.com.br',
  'globo.com','zipmail.com.br','r7.com','oi.com.br'
];

// ── Formatadores (igual ao new-key.js) ─────────────────────────────
const onlyDigits = v => v.replace(/\D/g, '');

function formatCpf(raw) {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0,3) + '.' + d.slice(3);
  if (d.length <= 9) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6);
  return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6,9) + '-' + d.slice(9);
}

function validateCpf(value) {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(d[10]);
}

function formatCnpj(raw) {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return d.slice(0,2) + '.' + d.slice(2);
  if (d.length <= 8) return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5);
  if (d.length <= 12) return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5,8) + '/' + d.slice(8);
  return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5,8) + '/' + d.slice(8,12) + '-' + d.slice(12);
}

function validateCnpj(value) {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (d, n) => {
    let sum = 0, pos = n - 7;
    for (let i = n; i >= 1; i--) {
      sum += parseInt(d[n - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return calc(d, 12) === parseInt(d[12]) && calc(d, 13) === parseInt(d[13]);
}

function formatPhone(raw) {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('55') && d.length > 11) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d.length) return '';
  if (d.length <= 2)  return '(' + d;
  if (d.length <= 6)  return '(' + d.slice(0,2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6);
  return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
}

function validatePhone(value) {
  const d = onlyDigits(value.replace(/^\+55/, ''));
  if (d.length < 10 || d.length > 11) return false;
  if (d.length === 11 && d[2] !== '9') return false;
  return true;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function validateRandom(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

const TYPE_CONFIG = {
  cpf:    { label: 'CPF',            placeholder: '000.000.000-00',                    inputMode: 'numeric', format: formatCpf,   validate: validateCpf },
  cnpj:   { label: 'CNPJ',           placeholder: '00.000.000/0000-00',                 inputMode: 'numeric', format: formatCnpj,  validate: validateCnpj },
  phone:  { label: 'Telefone',        placeholder: '(00) 00000-0000',                    inputMode: 'tel',     format: formatPhone, validate: validatePhone },
  email:  { label: 'E-mail',          placeholder: 'nome@email.com',                     inputMode: 'email',   format: v => v,      validate: validateEmail },
  random: { label: 'Chave aleatória', placeholder: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx', inputMode: 'text',    format: v => v,      validate: validateRandom },
};

// ── Validação de username ────────────────────────────────────────
// Regras: opcional; se preenchido → 3-20 chars, alfanumérico + ponto + underline.
// Não pode começar ou terminar com ponto. Sem pontos consecutivos.
function validateUsername(val) {
  if (!val) return null; // campo vazio = válido (opcional)
  if (val.length < 3 || val.length > 20) return false;
  if (!/^[a-zA-Z0-9_.]+$/.test(val)) return false;
  if (val.startsWith('.') || val.endsWith('.')) return false;
  if (/\.{2,}/.test(val)) return false;
  return true;
}

// ── Refs DOM ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fieldName       = $('field-name');
const fieldCity       = $('field-city');
const fieldBank       = $('field-bank');
const fieldPixKey     = $('field-pix-key');
const fieldUsername   = $('field-username');
const keyValIcon      = $('key-val-icon');
const usernameValIcon = $('username-val-icon');
const bankSuggestions = $('bank-suggestions');
const emailSuggestions= $('email-suggestions');
const avatarUpload    = $('avatar-upload');
const avatarInput     = $('avatar-input');
const avatarPreview   = $('avatar-preview');
const btnNext         = $('btn-next');
const btnPrev         = $('btn-prev');
const btnBack         = $('btn-back');
const keyTypeChips    = document.querySelectorAll('.key-type-chip');

// ── Stepper visual ───────────────────────────────────────────────
function updateStepper(step) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const el = $('step-ind-' + i);
    const circle = el.querySelector('.stepper__circle');
    el.classList.remove('stepper__item--active', 'stepper__item--done');
    if (i < step) {
      el.classList.add('stepper__item--done');
      circle.innerHTML = '<span class="material-symbols-rounded" style="font-size:16px">check</span>';
    } else if (i === step) {
      el.classList.add('stepper__item--active');
      circle.innerHTML = '<span>' + i + '</span>';
    } else {
      circle.innerHTML = '<span>' + i + '</span>';
    }
  }
  document.querySelectorAll('.stepper__line').forEach((line, idx) => {
    line.classList.toggle('stepper__line--done', idx < step - 1);
  });
}

function showStep(step) {
  for (let i = 1; i <= TOTAL_STEPS; i++) $('step-' + i).classList.toggle('cp-step--hidden', i !== step);
  updateStepper(step);
  btnPrev.style.display = step > 1 ? '' : 'none';
  btnNext.innerHTML = step === TOTAL_STEPS
    ? 'Confirmar <span class="material-symbols-rounded" slot="trailing-icon">check</span>'
    : 'Próximo <span class="material-symbols-rounded" slot="trailing-icon">arrow_forward</span>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Feedback de erro ──────────────────────────────────────────────
function showError(msg) {
  let el = document.getElementById('cp-error-msg');
  if (!el) {
    el = document.createElement('p');
    el.id = 'cp-error-msg';
    el.setAttribute('role', 'alert');
    el.style.cssText = 'color:var(--md-sys-color-error);font-size:13px;font-family:Roboto,sans-serif;padding:0 4px;margin-top:-6px;';
  }
  el.textContent = msg;
  $('step-' + currentStep).prepend(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Formatação e validação da chave PIX ─────────────────────────────
function onPixKeyInput(e) {
  if (!profile.keyType) return;
  const cfg = TYPE_CONFIG[profile.keyType];

  const formatted = cfg.format(e.target.value);
  if (formatted !== e.target.value) e.target.value = formatted;

  const val = e.target.value.trim();

  if (profile.keyType === 'email') renderEmailSuggestions(val);

  if (!val) {
    setKeyIcon(null);
    fieldPixKey.removeAttribute('error');
    fieldPixKey.setAttribute('supporting-text', ' ');
    return;
  }

  const valid = cfg.validate(val);
  setKeyIcon(valid);
  if (valid) {
    fieldPixKey.removeAttribute('error');
    fieldPixKey.setAttribute('supporting-text', 'Chave válida ✔');
  } else {
    fieldPixKey.setAttribute('error', '');
    fieldPixKey.setAttribute('supporting-text', 'Formato inválido');
  }
}

function setKeyIcon(valid) {
  if (valid === null) { keyValIcon.className = 'key-validation-icon'; keyValIcon.innerHTML = ''; return; }
  keyValIcon.className = 'key-validation-icon ' + (valid ? 'valid' : 'invalid');
  keyValIcon.innerHTML = '<span class="material-symbols-rounded">' + (valid ? 'check_circle' : 'cancel') + '</span>';
}

fieldPixKey.addEventListener('input', onPixKeyInput);

// ── Sugestões de provedor de e-mail ───────────────────────────────
function renderEmailSuggestions(val) {
  const atIdx = val.indexOf('@');
  if (atIdx === -1) { emailSuggestions.hidden = true; return; }

  const local   = val.slice(0, atIdx);
  const partial = val.slice(atIdx + 1).toLowerCase();

  const matches = EMAIL_PROVIDERS.filter(p => p.startsWith(partial)).slice(0, 5);
  if (!matches.length || partial === '') {
    const all = partial === '' ? EMAIL_PROVIDERS.slice(0, 6) : [];
    if (!all.length) { emailSuggestions.hidden = true; return; }
    buildEmailList(local, all);
    return;
  }
  if (matches.length === 1 && matches[0] === partial) { emailSuggestions.hidden = true; return; }
  buildEmailList(local, matches);
}

function buildEmailList(local, providers) {
  emailSuggestions.innerHTML = providers.map(p =>
    '<li class="bank-suggestion-item" role="option" tabindex="0">' +
    '<span class="material-symbols-rounded">alternate_email</span>' +
    '<span>' + local + '@' + p + '</span></li>'
  ).join('');
  emailSuggestions.hidden = false;

  emailSuggestions.querySelectorAll('.bank-suggestion-item').forEach(item => {
    const pick = () => {
      const chosen = item.querySelector('span:last-child').textContent;
      fieldPixKey.value = chosen;
      emailSuggestions.hidden = true;
      onPixKeyInput({ target: fieldPixKey });
      fieldPixKey.focus();
    };
    item.addEventListener('mousedown', e => { e.preventDefault(); pick(); });
    item.addEventListener('keydown',   e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
}

fieldPixKey.addEventListener('blur', () => setTimeout(() => { emailSuggestions.hidden = true; }, 180));

// ── Key type chips ───────────────────────────────────────────────
keyTypeChips.forEach(chip => {
  chip.addEventListener('click', () => {
    keyTypeChips.forEach(c => { c.classList.remove('key-type-chip--active'); c.setAttribute('aria-pressed','false'); });
    chip.classList.add('key-type-chip--active');
    chip.setAttribute('aria-pressed','true');
    profile.keyType = chip.dataset.type;

    const cfg = TYPE_CONFIG[profile.keyType];
    fieldPixKey.setAttribute('label', cfg.label);
    fieldPixKey.setAttribute('placeholder', cfg.placeholder);
    fieldPixKey.setAttribute('inputmode', cfg.inputMode);
    fieldPixKey.value = '';
    fieldPixKey.removeAttribute('error');
    fieldPixKey.setAttribute('supporting-text', ' ');
    setKeyIcon(null);
    emailSuggestions.hidden = true;
    setTimeout(() => fieldPixKey.focus(), 50);
  });
});

// ── Feedback visual do username em tempo real ────────────────────
function updateUsernameIcon(val) {
  const result = validateUsername(val);
  if (result === null) {
    // campo vazio — limpa ícone e erro
    usernameValIcon.className = 'key-validation-icon';
    usernameValIcon.innerHTML = '';
    fieldUsername.removeAttribute('error');
    fieldUsername.setAttribute('supporting-text', '3-20 caracteres: letras, números, . e _');
    return;
  }
  usernameValIcon.className = 'key-validation-icon ' + (result ? 'valid' : 'invalid');
  usernameValIcon.innerHTML = '<span class="material-symbols-rounded">' + (result ? 'check_circle' : 'cancel') + '</span>';
  if (result) {
    fieldUsername.removeAttribute('error');
    fieldUsername.setAttribute('supporting-text', 'Username disponível ✔');
  } else {
    fieldUsername.setAttribute('error', '');
    fieldUsername.setAttribute('supporting-text', 'Use 3-20 chars: letras, números, . e _ (sem ponto no início/fim)');
  }
}

fieldUsername.addEventListener('input', () => {
  const val = fieldUsername.value.trim().replace(/^@/, '');
  updateUsernameIcon(val);
});

// ── Validação por etapa ──────────────────────────────────────────
function validateStep1() {
  const name = fieldName.value.trim();
  const city = fieldCity.value.trim();
  const bank = fieldBank.value.trim();
  const key  = fieldPixKey.value.trim();
  if (!name) { fieldName.focus(); showError('O nome do titular é obrigatório.'); return false; }
  if (!city) { fieldCity.focus(); showError('A cidade é obrigatória.'); return false; }
  if (!bank) { fieldBank.focus(); showError('Informe a instituição financeira.'); return false; }
  if (!profile.keyType) { showError('Selecione o tipo de chave PIX.'); return false; }
  if (!key || !TYPE_CONFIG[profile.keyType].validate(key)) {
    fieldPixKey.focus();
    showError('Chave PIX inválida para o tipo selecionado.');
    fieldPixKey.setAttribute('error', '');
    return false;
  }
  return true;
}

function validateStep2() {
  const val = fieldUsername.value.trim().replace(/^@/, '');
  const result = validateUsername(val);
  // null = vazio = válido (campo opcional)
  if (result === false) {
    fieldUsername.focus();
    showError('Username inválido. Use 3-20 caracteres: letras, números, ponto ou underline.');
    fieldUsername.setAttribute('error', '');
    updateUsernameIcon(val);
    return false;
  }
  return true;
}

function validateStep3() {
  if (!$('chk-terms').checked) { showError('Você precisa aceitar os Termos de Uso para continuar.'); return false; }
  return true;
}

// ── Review (etapa 3) ──────────────────────────────────────────────
function fillReview() {
  $('preview-name').textContent     = profile.name  || '—';
  $('preview-bank').textContent     = profile.bank  || '—';
  $('preview-city').textContent     = profile.city  || '—';
  $('preview-username').textContent = profile.username ? '@' + profile.username : '';
  const typeLabels = { cpf:'CPF', cnpj:'CNPJ', phone:'Telefone', email:'E-mail', random:'Chave Aleatória' };
  $('preview-key-type').textContent = typeLabels[profile.keyType] || '—';
  $('preview-key').textContent      = profile.pixKey || '—';
  const a = $('preview-avatar');
  a.innerHTML = profile.avatarDataUrl
    ? '<img src="' + profile.avatarDataUrl + '" alt="Foto de perfil" />'
    : '<span class="material-symbols-rounded" style="font-size:40px;color:var(--md-sys-color-primary)">account_circle</span>';
}

// ── Salvar + snackbar ──────────────────────────────────────────────
function saveProfile() {
  try { localStorage.setItem('qrpix_profile', JSON.stringify(Object.assign({}, profile, { createdAt: Date.now() }))); } catch(e) {}
}

function showSuccessSnackbar() {
  const snack = document.createElement('div');
  snack.className = 'cp-snackbar';
  snack.setAttribute('role', 'alert');
  snack.setAttribute('aria-live', 'polite');
  snack.innerHTML =
    '<span class="material-symbols-rounded cp-snackbar__icon">check_circle</span>' +
    '<div class="cp-snackbar__body">' +
      '<p class="cp-snackbar__title">Perfil criado com sucesso!</p>' +
      '<p>Experimente <button class="cp-snackbar__action" id="snack-cta">gerar uma cobrança</button> agora!</p>' +
    '</div>';
  document.body.appendChild(snack);
  requestAnimationFrame(() => snack.classList.add('cp-snackbar--show'));
  snack.querySelector('#snack-cta').addEventListener('click', () => { window.location.href = 'generate-invoice.html'; });
  setTimeout(() => { snack.classList.remove('cp-snackbar--show'); setTimeout(() => snack.remove(), 350); }, 6000);
}

// ── Navegação wizard ───────────────────────────────────────────────
btnNext.addEventListener('click', () => {
  if (currentStep === 1) {
    profile.name    = fieldName.value.trim();
    profile.city    = fieldCity.value.trim();
    profile.bank    = fieldBank.value.trim();
    profile.pixKey  = fieldPixKey.value.trim();
    if (!validateStep1()) return;
    currentStep = 2; showStep(currentStep);
  } else if (currentStep === 2) {
    profile.username = (fieldUsername.value || '').trim().replace(/^@/, '');
    if (!validateStep2()) return;
    currentStep = 3; fillReview(); showStep(currentStep);
  } else if (currentStep === 3) {
    if (!validateStep3()) return;
    saveProfile();
    showSuccessSnackbar();
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  }
});

btnPrev.addEventListener('click', () => { if (currentStep > 1) { currentStep--; showStep(currentStep); } });
btnBack.addEventListener('click', () => {
  if (currentStep > 1) { currentStep--; showStep(currentStep); }
  else window.location.href = 'index.html';
});

// ── Autocomplete banco ───────────────────────────────────────────────
function renderBankSuggestions(q) {
  if (!q) { bankSuggestions.hidden = true; return; }
  const matches = BANKS.filter(b => b.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  if (!matches.length) { bankSuggestions.hidden = true; return; }
  bankSuggestions.innerHTML = matches.map(b =>
    '<li class="bank-suggestion-item" role="option" tabindex="0">' +
    '<span class="material-symbols-rounded">account_balance</span>' +
    '<span>' + b + '</span></li>'
  ).join('');
  bankSuggestions.hidden = false;
  bankSuggestions.querySelectorAll('.bank-suggestion-item').forEach(item => {
    const pick = () => { fieldBank.value = item.querySelector('span:last-child').textContent; bankSuggestions.hidden = true; };
    item.addEventListener('mousedown', e => { e.preventDefault(); pick(); });
    item.addEventListener('keydown',   e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); pick(); } });
  });
}
fieldBank.addEventListener('input',  () => renderBankSuggestions(fieldBank.value.trim()));
fieldBank.addEventListener('focus',  () => { if (fieldBank.value.trim()) renderBankSuggestions(fieldBank.value.trim()); });
fieldBank.addEventListener('blur',   () => setTimeout(() => { bankSuggestions.hidden = true; }, 200));

// ── Upload de avatar ──────────────────────────────────────────────
avatarUpload.addEventListener('click',   () => avatarInput.click());
avatarUpload.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') avatarInput.click(); });
avatarInput.addEventListener('change', () => {
  const file = avatarInput.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showError('A imagem deve ter no máximo 2 MB.'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      canvas.getContext('2d').drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0, 0, 256, 256);
      profile.avatarDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      avatarPreview.innerHTML = '<img src="' + profile.avatarDataUrl + '" alt="Preview" />';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ── Init ─────────────────────────────────────────────────────────
showStep(1);
