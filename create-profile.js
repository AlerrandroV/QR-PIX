/* =================================================================
   create-profile.js
   Wizard de 3 etapas para criação de perfil de cobrança PIX.
   Reutiliza a lógica de validação do pix-payload.js.
================================================================= */

'use strict';

// ── Estado global do wizard ──────────────────────────────────────
const profile = {
  name: '',
  city: '',
  bank: '',
  keyType: '',
  pixKey: '',
  username: '',
  avatarDataUrl: ''
};

let currentStep = 1;
const TOTAL_STEPS = 3;

// ── Bancos para autocomplete ─────────────────────────────────────
const BANKS = [
  'Banco do Brasil', 'Bradesco', 'Caixa Econômica Federal', 'Itaú Unibanco',
  'Santander', 'Banco Safra', 'BTG Pactual', 'Banco Pan', 'Banco Inter',
  'C6 Bank', 'Banco Original', 'Banco BV', 'Banco Votorantim', 'Banco BMG',
  'Banco Mercantil do Brasil', 'Banco Daycoval', 'Banco Fibra', 'Banco ABC Brasil',
  'Banestes', 'Banrisul', 'BRB (Banco de Brasília)', 'Banco da Amazônia',
  'Banco do Nordeste', 'Citibank', 'Banco BNP Paribas Brasil', 'J.P. Morgan',
  'Banco Inbursa', 'HSBC', 'Banco Western Union', 'Banco Travelex', 'Ebury',
  'Banco Semear', 'Banco Topázio', 'Banco Bari', 'Banco Digio', 'Banco Genial',
  'Banco Master', 'Banco Guanabara', 'Banco Industrial do Brasil', 'Banco Paulista',
  'Banco Pine', 'Banco Ribeirão Preto', 'Banco VR', 'Banco B3', 'Banco Sofisa',
  'Banco CSF', 'Banco Crefisa', 'Banco BS2', 'Sicredi', 'Sicoob', 'Cresol',
  'Unicred', 'Ailos', 'Nubank', 'Neon', 'PicPay', 'PicPay Bank',
  'Mercado Pago', 'PagBank (PagSeguro)', 'Next', 'Agibank', 'XP Investimentos',
  'Mercado Bitcoin', 'Wise', 'Wise Brasil IP', 'EBANX', 'Dlocal', 'Revolut',
  'Transfero', 'Money Cloud', 'Asaas', 'Celcoin', 'FitBank', 'Galax Pay',
  'Iugu', 'Efí', 'Dock', 'Stone', 'SumUp', 'Cielo', 'PagHiper',
  'PagueVeloz', 'Pay4Fun', 'RecargaPay'
];

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
const avatarUpload    = $('avatar-upload');
const avatarInput     = $('avatar-input');
const avatarPreview   = $('avatar-preview');
const btnNext         = $('btn-next');
const btnPrev         = $('btn-prev');
const btnBack         = $('btn-back');
const keyTypeChips    = document.querySelectorAll('.key-type-chip');

// ── Helpers de validação (reutiliza padrões do pix-payload.js) ──
function validatePixKey(type, value) {
  if (!value) return null;
  if (type === 'cpf')    return /^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(value);
  if (type === 'cnpj')   return /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(value);
  if (type === 'phone')  return /^(\+55\s?)?\(?\d{2}\)?[\s-]?9?\d{4}[\s-]?\d{4}$/.test(value);
  if (type === 'email')  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (type === 'random') return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
  return null;
}

function formatPixKeyPlaceholder(type) {
  const map = {
    cpf:    'Ex: 000.000.000-00',
    cnpj:   'Ex: 00.000.000/0001-00',
    phone:  'Ex: +55 11 99999-9999',
    email:  'Ex: voce@email.com',
    random: 'Ex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  };
  return map[type] || 'Chave PIX';
}

function validateUsername(val) {
  if (!val) return null;
  return /^[a-zA-Z0-9_]{3,30}$/.test(val);
}

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

// ── Navegação entre etapas ───────────────────────────────────────
function showStep(step) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    $('step-' + i).classList.toggle('cp-step--hidden', i !== step);
  }
  updateStepper(step);
  btnPrev.style.display = step > 1 ? '' : 'none';
  if (step === TOTAL_STEPS) {
    btnNext.innerHTML = 'Confirmar <span class="material-symbols-rounded" slot="trailing-icon">check</span>';
  } else {
    btnNext.innerHTML = 'Próximo <span class="material-symbols-rounded" slot="trailing-icon">arrow_forward</span>';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
  const valid = validatePixKey(profile.keyType, key);
  if (!valid) { fieldPixKey.focus(); showError('Chave PIX inválida para o tipo selecionado.'); return false; }
  return true;
}

function validateStep3() {
  if (!$('chk-terms').checked) {
    showError('Você precisa aceitar os Termos de Uso para continuar.');
    return false;
  }
  return true;
}

// ── Preenchimento do card de revisão (etapa 3) ───────────────────
function fillReview() {
  $('preview-name').textContent = profile.name || '—';
  $('preview-bank').textContent = profile.bank || '—';
  $('preview-city').textContent = profile.city || '—';
  $('preview-username').textContent = profile.username ? '@' + profile.username : '';
  const typeLabels = { cpf:'CPF', cnpj:'CNPJ', phone:'Telefone', email:'E-mail', random:'Chave Aleatória' };
  $('preview-key-type').textContent = typeLabels[profile.keyType] || '—';
  $('preview-key').textContent      = profile.pixKey || '—';
  const previewAvatar = $('preview-avatar');
  if (profile.avatarDataUrl) {
    previewAvatar.innerHTML = '<img src="' + profile.avatarDataUrl + '" alt="Foto de perfil" />';
  } else {
    previewAvatar.innerHTML = '<span class="material-symbols-rounded" style="font-size:40px;color:var(--md-sys-color-primary)">account_circle</span>';
  }
}

// ── Salvar perfil no localStorage ───────────────────────────────
function saveProfile() {
  try { localStorage.setItem('qrpix_profile', JSON.stringify(Object.assign({}, profile, { createdAt: Date.now() }))); } catch(e) {}
}

// ── Snackbar de sucesso ──────────────────────────────────────────
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

// ── Feedback de erro inline ──────────────────────────────────────
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

// ── Event: botão Próximo / Confirmar ─────────────────────────────
btnNext.addEventListener('click', () => {
  if (currentStep === 1) {
    profile.name   = fieldName.value.trim();
    profile.city   = fieldCity.value.trim();
    profile.bank   = fieldBank.value.trim();
    profile.pixKey = fieldPixKey.value.trim();
    if (!validateStep1()) return;
    currentStep = 2; showStep(currentStep); return;
  }
  if (currentStep === 2) {
    profile.username = (fieldUsername.value || '').trim().replace(/^@/, '');
    currentStep = 3; fillReview(); showStep(currentStep); return;
  }
  if (currentStep === 3) {
    if (!validateStep3()) return;
    saveProfile();
    showSuccessSnackbar();
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  }
});

// ── Event: botão Anterior ────────────────────────────────────────
btnPrev.addEventListener('click', () => { if (currentStep > 1) { currentStep--; showStep(currentStep); } });

// ── Event: botão Voltar (topbar) ─────────────────────────────────
btnBack.addEventListener('click', () => {
  if (currentStep > 1) { currentStep--; showStep(currentStep); }
  else { window.location.href = 'index.html'; }
});

// ── Key type chips ───────────────────────────────────────────────
keyTypeChips.forEach(chip => {
  chip.addEventListener('click', () => {
    keyTypeChips.forEach(c => { c.classList.remove('key-type-chip--active'); c.setAttribute('aria-pressed','false'); });
    chip.classList.add('key-type-chip--active');
    chip.setAttribute('aria-pressed','true');
    profile.keyType = chip.dataset.type;
    fieldPixKey.label = formatPixKeyPlaceholder(profile.keyType).replace('Ex: ','');
    fieldPixKey.value = '';
    fieldPixKey.type  = profile.keyType === 'email' ? 'email' : (profile.keyType === 'phone' ? 'tel' : 'text');
    keyValIcon.className = 'key-validation-icon';
    keyValIcon.innerHTML = '';
  });
});

// ── Validação em tempo real da chave PIX ─────────────────────────
fieldPixKey.addEventListener('input', () => {
  const val = fieldPixKey.value.trim();
  if (!val || !profile.keyType) { keyValIcon.className = 'key-validation-icon'; keyValIcon.innerHTML = ''; return; }
  const ok = validatePixKey(profile.keyType, val);
  keyValIcon.className = 'key-validation-icon ' + (ok ? 'valid' : 'invalid');
  keyValIcon.innerHTML = '<span class="material-symbols-rounded">' + (ok ? 'check_circle' : 'cancel') + '</span>';
});

// ── Validação em tempo real do username ──────────────────────────
fieldUsername.addEventListener('input', () => {
  const val = fieldUsername.value.trim().replace(/^@/, '');
  if (!val) { usernameValIcon.className = 'key-validation-icon'; usernameValIcon.innerHTML = ''; return; }
  const ok = validateUsername(val);
  usernameValIcon.className = 'key-validation-icon ' + (ok ? 'valid' : 'invalid');
  usernameValIcon.innerHTML = '<span class="material-symbols-rounded">' + (ok ? 'check_circle' : 'cancel') + '</span>';
});

// ── Autocomplete de banco (sugestão ACIMA do input) ──────────────
function renderBankSuggestions(q) {
  if (!q) { bankSuggestions.hidden = true; bankSuggestions.innerHTML = ''; return; }
  const matches = BANKS.filter(b => b.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  if (!matches.length) { bankSuggestions.hidden = true; return; }
  bankSuggestions.innerHTML = matches.map(b =>
    '<li class="bank-suggestion-item" role="option" tabindex="0">' +
    '<span class="material-symbols-rounded">account_balance</span>' +
    '<span>' + b + '</span></li>'
  ).join('');
  bankSuggestions.hidden = false;
  bankSuggestions.querySelectorAll('.bank-suggestion-item').forEach(item => {
    const selectBank = () => {
      fieldBank.value = item.querySelector('span:last-child').textContent;
      bankSuggestions.hidden = true;
      bankSuggestions.innerHTML = '';
    };
    item.addEventListener('mousedown', e => { e.preventDefault(); selectBank(); });
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectBank(); } });
  });
}

fieldBank.addEventListener('input', () => renderBankSuggestions(fieldBank.value.trim()));
fieldBank.addEventListener('focus', () => { if (fieldBank.value.trim()) renderBankSuggestions(fieldBank.value.trim()); });
fieldBank.addEventListener('blur',  () => setTimeout(() => { bankSuggestions.hidden = true; }, 200));

// ── Upload de avatar ─────────────────────────────────────────────
avatarUpload.addEventListener('click', () => avatarInput.click());
avatarUpload.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') avatarInput.click(); });

avatarInput.addEventListener('change', () => {
  const file = avatarInput.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showError('A imagem deve ter no máximo 2 MB.'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const size   = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      canvas.getContext('2d').drawImage(img, (img.width-size)/2, (img.height-size)/2, size, size, 0, 0, 256, 256);
      profile.avatarDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      avatarPreview.innerHTML = '<img src="' + profile.avatarDataUrl + '" alt="Preview da foto de perfil" />';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// ── Init ─────────────────────────────────────────────────────────
showStep(1);
