/* =================================================================
   profile-form.js — peças de formulário do perfil da loja,
   compartilhadas entre o assistente (create-profile) e a edição
   (profile-edit). Depende de ui.js, pix-utils.js e data.js.
================================================================= */
(function () {
  'use strict';
  const UI = window.QrUI;
  const USERNAME_RE = /^(?!\.)(?!.*\.\.)[a-zA-Z0-9_.]{3,20}(?<!\.)$/;
  const HINT = '3 a 20 caracteres: letras, números, ponto e _';

  /**
   * Campo de @usuário com verificação de disponibilidade.
   * Estados: idle | checking | available | taken | invalid | offline
   */
  function usernameField(field, status) {
    let state = 'idle';
    let timer = null;

    function set(s, text) {
      state = s;
      const icons = { checking: 'progress_activity', available: 'check_circle', taken: 'error', invalid: 'error', offline: 'cloud_off' };
      status.className = 'field__status' +
        (s === 'available' ? ' is-valid' : s === 'taken' || s === 'invalid' ? ' is-invalid' : '');
      status.innerHTML = icons[s] ? `<span class="icon icon--filled${s === 'checking' ? ' spin' : ''}">${icons[s]}</span>` : '';
      field.error = s === 'taken' || s === 'invalid';
      if (field.error) field.errorText = text;
      else field.supportingText = text || HINT;
    }

    const value = () => (field.value || '').trim().replace(/^@/, '').toLowerCase();

    async function check() {
      const val = value();
      if (!val) { set('idle'); return state; }
      if (!USERNAME_RE.test(val)) { set('invalid', 'Use 3 a 20 caracteres (sem ponto no início/fim)'); return state; }
      set('checking', 'Verificando disponibilidade…');
      try {
        const free = await window.QrData.isUsernameAvailable(val);
        if (value() !== val) return state; // usuário continuou digitando
        set(free ? 'available' : 'taken', free ? 'Disponível' : 'Este nome já está em uso');
      } catch {
        set('offline', 'Sem conexão para verificar agora');
      }
      return state;
    }

    field.addEventListener('input', () => {
      clearTimeout(timer);
      const val = value();
      if (!val) return set('idle');
      if (!USERNAME_RE.test(val)) return set('invalid', 'Use 3 a 20 caracteres (sem ponto no início/fim)');
      set('checking', 'Verificando disponibilidade…');
      timer = setTimeout(check, 600);
    });

    return {
      value,
      state: () => state,
      // Valida antes de salvar; true se pode prosseguir
      async validate() {
        const val = value();
        if (!val) return true;
        if (state === 'checking' || state === 'idle') { clearTimeout(timer); await check(); }
        if (state === 'invalid') { UI.snackbar('Nome de usuário inválido'); field.focus(); return false; }
        if (state === 'taken') { UI.snackbar('Este nome de usuário já está em uso'); field.focus(); return false; }
        return true;
      },
      reset() { set('idle'); },
    };
  }

  /** Botão + prévia de imagem quadrada (avatar). */
  function imagePicker({ trigger, preview, input, size = 256, onChange, placeholderIcon = 'add_a_photo' }) {
    let dataUrl = '';
    const render = () => {
      preview.innerHTML = dataUrl ? `<img src="${dataUrl}" alt="" />` : `<span class="icon">${placeholderIcon}</span>`;
    };
    [].concat(trigger).forEach((el) => el.addEventListener('click', () => input.click()));
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) return UI.snackbar('A imagem deve ter no máximo 8 MB');
      try {
        dataUrl = await window.PixUtils.imageToSquareDataUrl(file, size);
        render();
        onChange && onChange(dataUrl);
      } catch {
        UI.snackbar('Não foi possível ler esta imagem');
      }
    });
    return {
      get: () => dataUrl,
      set(v) { dataUrl = v || ''; render(); },
    };
  }

  window.ProfileForm = { usernameField, imagePicker, USERNAME_RE };
})();
