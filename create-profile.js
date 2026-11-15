/* =================================================================
   create-profile.js — assistente de 3 etapas (perfil da loja).
   Salva no aparelho via QrData; se o vendedor quiser, publica.
================================================================= */
(async function () {
  'use strict';
  const { KEY_TYPES, keys, formatPhone } = window.PixUtils;
  const UI = window.QrUI;
  const D = window.QrData;
  const $ = (id) => document.getElementById(id);

  // Já tem perfil? A edição é em outra tela.
  if (await D.profile.exists()) { location.replace('profile-edit.html'); return; }

  const TOTAL = 3;
  let step = 1;
  const profile = {};

  const fName = $('field-name');
  const fCity = $('field-city');
  const fBank = $('field-bank');
  const fBio = $('field-bio');
  const fWhats = $('field-whatsapp');
  const fInsta = $('field-instagram');
  const btnNext = $('btn-next');
  const btnPrev = $('btn-prev');

  const keyForm = window.KeyForm.mount({ chips: $('key-types'), field: $('field-key'), status: $('key-status') });
  window.KeyForm.bankAutocomplete(fBank);
  const username = window.ProfileForm.usernameField($('field-username'), $('username-status'));
  const avatar = window.ProfileForm.imagePicker({
    trigger: [$('btn-avatar'), $('avatar-preview')],
    preview: $('avatar-preview'),
    input: $('avatar-input'),
  });
  fWhats.addEventListener('input', () => {
    const v = formatPhone(fWhats.value);
    if (v !== fWhats.value) fWhats.value = v;
  });

  // ── Etapas ────────────────────────────────────────────────────
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

  function validateStep1() {
    Object.assign(profile, {
      name: fName.value.trim(), city: fCity.value.trim(), bank: fBank.value.trim(),
      keyType: keyForm.type(), pixKey: keyForm.value(),
    });
    if (!profile.name) return fail(fName, 'Informe o nome do titular ou da loja');
    if (!profile.city) return fail(fCity, 'Informe a cidade');
    if (!profile.bank) return fail(fBank, 'Informe a instituição financeira');
    if (!profile.keyType) return fail(null, 'Escolha o tipo da chave PIX');
    if (!keyForm.isValid()) { keyForm.showErrors(); return fail(null, 'Confira a chave PIX'); }
    return true;
  }

  async function validateStep2() {
    Object.assign(profile, {
      bio: fBio.value.trim(),
      whatsapp: fWhats.value.trim(),
      instagram: D.instagramHandle(fInsta.value),
      username: username.value(),
      avatarDataUrl: avatar.get(),
    });
    if (profile.whatsapp && D.whatsappNumber(profile.whatsapp).length < 12) return fail(fWhats, 'Confira o número de WhatsApp');
    return username.validate();
  }

  function fillReview() {
    $('review-name').textContent = profile.name;
    $('review-username').textContent = profile.username ? '@' + profile.username : 'Sem nome de usuário';
    $('review-place').textContent = `${profile.bank} · ${profile.city}`;
    $('review-key-type').textContent = KEY_TYPES[profile.keyType]?.label || '';
    $('review-key').textContent = profile.pixKey;
    $('review-avatar').innerHTML = profile.avatarDataUrl
      ? `<img src="${profile.avatarDataUrl}" alt="" />`
      : '<span class="icon">storefront</span>';
    $('publish-row').hidden = !profile.username;
    $('review-link').textContent = profile.username ? D.storeUrl(profile.username).replace(/^https?:\/\//, '') : '';
  }

  async function submit() {
    if (!$('chk-terms').checked) return fail(null, 'Aceite os termos de uso para continuar');
    btnNext.disabled = true;
    $('btn-next-label').textContent = 'Salvando…';

    const publish = !!profile.username && $('chk-publish').selected;
    await D.profile.save({ ...profile, published: publish });
    // A chave do perfil também fica disponível em "Cobrar"
    keys.add({ name: profile.name, bank: profile.bank, keyType: profile.keyType, key: profile.pixKey, city: profile.city });

    let online = true;
    if (publish) online = (await D.sync()).ok;

    const choice = await UI.dialog({
      icon: 'check_circle',
      title: 'Perfil criado!',
      body: !publish
        ? 'Seu perfil está salvo neste aparelho. Você pode publicar a loja quando quiser, na aba Perfil.'
        : online
          ? 'Sua loja está no ar. Agora adicione produtos ao catálogo.'
          : 'Salvamos tudo neste aparelho. A loja será publicada assim que houver conexão.',
      actions: [
        { label: 'Ver perfil', value: 'profile' },
        { label: 'Adicionar produtos', value: 'catalog', variant: 'filled' },
      ],
    });
    location.replace(choice === 'catalog' ? 'product-edit.html' : 'profile.html');
  }

  btnNext.addEventListener('click', async () => {
    if (step === 1 && validateStep1()) showStep(2);
    else if (step === 2 && (await validateStep2())) { fillReview(); showStep(3); }
    else if (step === 3) submit();
  });
  btnPrev.addEventListener('click', () => step > 1 && showStep(step - 1));

  UI.setBeforeBack(() => {
    if (step > 1) { showStep(step - 1); return false; }
    return true;
  });

  showStep(1);
})();
