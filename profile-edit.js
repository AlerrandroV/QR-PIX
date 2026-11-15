/* =================================================================
   profile-edit.js — editar perfil da loja
================================================================= */
(async function () {
  'use strict';
  const UI = window.QrUI;
  const D = window.QrData;
  const { formatPhone } = window.PixUtils;
  const $ = (id) => document.getElementById(id);

  const profile = await D.profile.get();
  if (!profile?.name) { location.replace('create-profile.html'); return; }

  const f = {
    name: $('f-name'), bio: $('f-bio'), city: $('f-city'),
    whatsapp: $('f-whatsapp'), instagram: $('f-instagram'),
    username: $('f-username'), bank: $('f-bank'),
  };

  const avatar = window.ProfileForm.imagePicker({
    trigger: [$('btn-avatar'), $('avatar-preview')],
    preview: $('avatar-preview'),
    input: $('avatar-input'),
    onChange: () => { $('btn-avatar-remove').hidden = false; },
  });
  $('btn-avatar-remove').addEventListener('click', () => { avatar.set(''); $('btn-avatar-remove').hidden = true; });

  const username = window.ProfileForm.usernameField(f.username, $('username-status'));
  const keyForm = window.KeyForm.mount({
    chips: $('key-types'), field: $('f-key'), status: $('key-status'),
    initialType: profile.keyType, initialValue: profile.pixKey,
  });
  window.KeyForm.bankAutocomplete(f.bank);

  function updateLinkPreview() {
    const u = username.value();
    $('link-preview').textContent = u
      ? 'Seu link: ' + D.storeUrl(u).replace(/^https?:\/\//, '')
      : 'Sem nome de usuário a loja não pode ser publicada.';
  }
  f.username.addEventListener('input', updateLinkPreview);
  f.whatsapp.addEventListener('input', () => {
    const v = formatPhone(f.whatsapp.value);
    if (v !== f.whatsapp.value) f.whatsapp.value = v;
  });

  // Preenche depois que os campos existem
  await customElements.whenDefined('md-outlined-text-field');
  f.name.value = profile.name;
  f.bio.value = profile.bio || '';
  f.city.value = profile.city || '';
  f.whatsapp.value = profile.whatsapp ? formatPhone(profile.whatsapp) : '';
  f.instagram.value = D.instagramHandle(profile.instagram);
  f.username.value = profile.username || '';
  f.bank.value = profile.bank || '';
  avatar.set(profile.avatarDataUrl);
  $('btn-avatar-remove').hidden = !profile.avatarDataUrl;
  updateLinkPreview();
  if (location.hash === '#username') setTimeout(() => f.username.focus(), 200);

  function collect() {
    return {
      name: f.name.value.trim(),
      bio: f.bio.value.trim(),
      city: f.city.value.trim(),
      whatsapp: f.whatsapp.value.trim(),
      instagram: D.instagramHandle(f.instagram.value),
      username: username.value(),
      bank: f.bank.value.trim(),
      keyType: keyForm.type(),
      pixKey: keyForm.value(),
      avatarDataUrl: avatar.get(),
    };
  }
  const initial = JSON.stringify(collect());
  const isDirty = () => JSON.stringify(collect()) !== initial;

  async function save() {
    const data = collect();
    if (!data.name) { f.name.error = true; f.name.errorText = 'Informe o nome'; f.name.focus(); UI.snackbar('Informe o nome da loja'); return false; }
    if (data.whatsapp && D.whatsappNumber(data.whatsapp).length < 12) { UI.snackbar('Confira o número de WhatsApp'); f.whatsapp.focus(); return false; }
    if (!keyForm.isValid()) { keyForm.showErrors(); UI.snackbar('Confira a chave PIX'); return false; }
    if (!(await username.validate())) return false;

    const patch = { ...data };
    if (!data.username && profile.published) patch.published = false; // sem @ não há link público
    await D.profile.save(patch);
    location.replace('profile.html');
    return true;
  }
  $('btn-save').addEventListener('click', save);

  UI.setBeforeBack(async () => {
    if (!isDirty()) return true;
    const choice = await UI.dialog({
      icon: 'edit_note',
      title: 'Salvar alterações?',
      body: 'Você alterou o perfil e ainda não salvou.',
      actions: [
        { label: 'Descartar', value: 'discard' },
        { label: 'Salvar', value: 'save', variant: 'filled' },
      ],
    });
    if (choice === 'save') { await save(); return false; }
    return choice === 'discard';
  });
})();
