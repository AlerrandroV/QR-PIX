/* =================================================================
   create-profile.js — assistente de 3 etapas (perfil de cobrança).
   O Firebase é carregado sob demanda: a tela continua funcionando
   (e salva localmente) mesmo se o Firestore estiver inacessível.
================================================================= */
const { KEY_TYPES, keys, imageToSquareDataUrl } = window.PixUtils;
const UI = window.QrUI;
const $ = (id) => document.getElementById(id);

const PROFILE_STORAGE = 'qrpix_profile';
const TOTAL = 3;
let step = 1;
const profile = { name: '', city: '', bank: '', keyType: '', pixKey: '', username: '', avatarDataUrl: '' };

let firebase = null;
async function fb() {
  if (!firebase) firebase = await import('./firebase.js');
  return firebase;
}

// ── Campos ────────────────────────────────────────────────────────
const fName = $('field-name');
const fCity = $('field-city');
const fBank = $('field-bank');
const fUser = $('field-username');
const btnNext = $('btn-next');
const btnPrev = $('btn-prev');

// Restaura rascunho/perfil salvo localmente
let stored = {};
try { stored = JSON.parse(localStorage.getItem(PROFILE_STORAGE)) || {}; } catch {}

const keyForm = window.KeyForm.mount({
  chips: $('key-types'),
  field: $('field-key'),
  status: $('key-status'),
  initialType: stored.keyType,
  initialValue: stored.pixKey,
});
window.KeyForm.bankAutocomplete(fBank);

customElements.whenDefined('md-outlined-text-field').then(() => {
  fName.value = stored.name || '';
  fCity.value = stored.city || '';
  fBank.value = stored.bank || '';
  fUser.value = stored.username || '';
});
if (stored.avatarDataUrl) {
  profile.avatarDataUrl = stored.avatarDataUrl;
  $('avatar-preview').innerHTML = `<img src="${stored.avatarDataUrl}" alt="" />`;
}

// ── Navegação entre etapas ───────────────────────────────────────
function showStep(n) {
  step = n;
  document.querySelectorAll('[data-step]').forEach((el) => { el.hidden = +el.dataset.step !== n; });
  document.querySelectorAll('[data-step-ind]').forEach((el) => {
    const i = +el.dataset.stepInd;
    el.classList.toggle('is-active', i === n);
    el.classList.toggle('is-done', i < n);
    el.querySelector('.stepper__dot').innerHTML = i < n ? '<span class="icon">check</span>' : String(i);
    if (i === n) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
  });
  document.querySelectorAll('.stepper__line').forEach((l, i) => l.classList.toggle('is-done', i < n - 1));
  btnPrev.hidden = n === 1;
  $('btn-next-label').textContent = n === TOTAL ? 'Criar perfil' : 'Continuar';
  $('btn-next-icon').textContent = n === TOTAL ? 'check' : 'arrow_forward';
  document.querySelector('.app-main').scrollTo({ top: 0 });
}

function fail(field, msg) {
  if (field) {
    field.error = true;
    field.errorText = msg;
    field.focus();
    field.addEventListener('input', () => { field.error = false; }, { once: true });
  }
  UI.snackbar(msg);
  return false;
}

// ── Etapa 1 ──────────────────────────────────────────────────────
function validateStep1() {
  profile.name = fName.value.trim();
  profile.city = fCity.value.trim();
  profile.bank = fBank.value.trim();
  profile.keyType = keyForm.type();
  profile.pixKey = keyForm.value();
  if (!profile.name) return fail(fName, 'Informe o nome do titular');
  if (!profile.city) return fail(fCity, 'Informe a cidade');
  if (!profile.bank) return fail(fBank, 'Informe a instituição financeira');
  if (!profile.keyType) return fail(null, 'Escolha o tipo da chave PIX');
  if (!keyForm.isValid()) { keyForm.showErrors(); return fail(null, 'Confira a chave PIX'); }
  return true;
}

// ── Etapa 2: username ────────────────────────────────────────────
const USERNAME_RE = /^(?!\.)(?!.*\.\.)[a-zA-Z0-9_.]{3,20}(?<!\.)$/;
let usernameState = 'idle'; // idle | checking | available | taken | invalid | offline
let checkTimer = null;

function setUsername(state, text) {
  usernameState = state;
  const st = $('username-status');
  const icons = { checking: 'progress_activity', available: 'check_circle', taken: 'error', invalid: 'error' };
  st.className = 'field__status' + (state === 'available' ? ' is-valid' : state === 'taken' || state === 'invalid' ? ' is-invalid' : '');
  st.innerHTML = icons[state] ? `<span class="icon icon--filled${state === 'checking' ? ' spin' : ''}">${icons[state]}</span>` : '';
  fUser.error = state === 'taken' || state === 'invalid';
  if (fUser.error) fUser.errorText = text;
  else fUser.supportingText = text || '3 a 20 caracteres: letras, números, ponto e _';
}

async function checkUsername(val) {
  setUsername('checking', 'Verificando disponibilidade…');
  try {
    const free = await (await fb()).isUsernameAvailable(val);
    if (fUser.value.trim().replace(/^@/, '') !== val) return; // usuário continuou digitando
    setUsername(free ? 'available' : 'taken', free ? 'Disponível' : 'Este nome já está em uso');
  } catch {
    setUsername('offline', 'Sem conexão para verificar agora');
  }
}

fUser.addEventListener('input', () => {
  clearTimeout(checkTimer);
  const val = fUser.value.trim().replace(/^@/, '');
  if (!val) return setUsername('idle');
  if (!USERNAME_RE.test(val)) return setUsername('invalid', 'Use 3 a 20 caracteres (sem ponto no início/fim)');
  setUsername('checking', 'Verificando disponibilidade…');
  checkTimer = setTimeout(() => checkUsername(val), 600);
});

async function validateStep2() {
  profile.username = fUser.value.trim().replace(/^@/, '');
  if (!profile.username) return true;
  if (!USERNAME_RE.test(profile.username)) return fail(fUser, 'Nome de usuário inválido');
  if (usernameState === 'checking' || usernameState === 'idle') {
    clearTimeout(checkTimer);
    await checkUsername(profile.username);
  }
  if (usernameState === 'taken') return fail(fUser, 'Este nome já está em uso');
  return true;
}

// Avatar
$('btn-avatar').addEventListener('click', () => $('avatar-input').click());
$('avatar-preview').addEventListener('click', () => $('avatar-input').click());
$('avatar-input').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return UI.snackbar('A imagem deve ter no máximo 2 MB');
  try {
    profile.avatarDataUrl = await imageToSquareDataUrl(file, 256);
    $('avatar-preview').innerHTML = `<img src="${profile.avatarDataUrl}" alt="" />`;
  } catch {
    UI.snackbar('Não foi possível ler esta imagem');
  }
});

// ── Etapa 3: revisão ─────────────────────────────────────────────
function fillReview() {
  $('review-name').textContent = profile.name;
  $('review-username').textContent = profile.username ? '@' + profile.username : 'Sem nome de usuário';
  $('review-place').textContent = `${profile.bank} · ${profile.city}`;
  $('review-key-type').textContent = KEY_TYPES[profile.keyType]?.label || '';
  $('review-key').textContent = profile.pixKey;
  $('review-avatar').innerHTML = profile.avatarDataUrl
    ? `<img src="${profile.avatarDataUrl}" alt="" />`
    : '<span class="icon">storefront</span>';
}

async function submit() {
  if (!$('chk-terms').checked) return fail(null, 'Aceite os termos de uso para continuar');

  btnNext.disabled = true;
  $('btn-next-label').textContent = 'Salvando…';
  $('btn-next-icon').textContent = 'progress_activity';
  $('btn-next-icon').classList.add('spin');

  // Salva localmente sempre; a chave também fica disponível em "Cobrar"
  try { localStorage.setItem(PROFILE_STORAGE, JSON.stringify(profile)); } catch {}
  keys.add({ name: profile.name, bank: profile.bank, keyType: profile.keyType, key: profile.pixKey, city: profile.city });

  let online = true;
  try {
    const res = await (await fb()).saveProfileToFirestore(profile);
    online = !!res.ok;
    if (res.ok) try { sessionStorage.setItem('qrpix_profile_id', res.docId); } catch {}
  } catch {
    online = false;
  }

  btnNext.disabled = false;
  $('btn-next-icon').classList.remove('spin');
  showStep(3);

  const choice = await UI.dialog({
    icon: 'check_circle',
    title: 'Perfil criado!',
    body: online
      ? 'Sua chave já está pronta para receber. Que tal gerar a primeira cobrança?'
      : 'Salvamos o perfil neste aparelho. A publicação online será feita quando houver conexão.',
    actions: [
      { label: 'Início', value: 'home' },
      { label: 'Gerar cobrança', value: 'charge', variant: 'filled' },
    ],
  });
  location.href = choice === 'charge' ? 'generate-invoice.html' : 'index.html';
}

btnNext.addEventListener('click', async () => {
  if (step === 1 && validateStep1()) showStep(2);
  else if (step === 2 && (await validateStep2())) { fillReview(); showStep(3); }
  else if (step === 3) submit();
});
btnPrev.addEventListener('click', () => step > 1 && showStep(step - 1));

// Voltar do app bar volta uma etapa antes de sair da tela
UI.setBeforeBack(() => {
  if (step > 1) { showStep(step - 1); return false; }
  return true;
});

showStep(1);
