/* =================================================================
   key-form.js — campo de chave PIX reutilizável
   (chips de tipo + máscara + validação + sugestões de e-mail)
   e autocomplete de banco. Usado em Nova chave e Perfil.
   Depende de ui.js (QrUI) e pix-utils.js (PixUtils).
================================================================= */
(function () {
  'use strict';
  const { KEY_TYPES, searchBanks, emailCompletions } = window.PixUtils;
  const UI = window.QrUI;

  /**
   * @param {{chips:HTMLElement, field:HTMLElement, status:HTMLElement,
   *          initialType?:string, initialValue?:string, onChange?:Function}} opts
   */
  function mount({ chips, field, status, initialType = '', initialValue = '', onChange }) {
    let type = '';
    let valid = false;

    chips.innerHTML = Object.entries(KEY_TYPES).map(([id, cfg]) =>
      `<md-filter-chip data-type="${id}" label="${cfg.label === 'Chave aleatória' ? 'Aleatória' : cfg.label}"></md-filter-chip>`
    ).join('');
    const chipEls = [...chips.querySelectorAll('md-filter-chip')];

    function setStatus(state) {
      status.className = 'field__status' + (state === true ? ' is-valid' : state === false ? ' is-invalid' : '');
      status.innerHTML = state === null ? '' : `<span class="icon icon--filled">${state ? 'check_circle' : 'error'}</span>`;
    }

    function validate() {
      const cfg = KEY_TYPES[type];
      const val = (field.value || '').trim();
      if (!cfg || !val) {
        valid = false;
        field.error = false;
        field.supportingText = cfg ? `Ex.: ${cfg.placeholder}` : ' ';
        setStatus(null);
      } else {
        valid = cfg.validate(val);
        field.error = false; // erro só aparece ao sair do campo (menos ruído)
        field.supportingText = valid ? 'Chave válida' : `Ex.: ${cfg.placeholder}`;
        setStatus(valid ? true : null);
      }
      onChange && onChange();
    }

    function showErrorIfInvalid() {
      const val = (field.value || '').trim();
      if (type && val && !valid) {
        field.error = true;
        field.errorText = `${KEY_TYPES[type].label} inválido`;
        setStatus(false);
      }
    }

    function selectType(t, keepValue = false) {
      type = t;
      chipEls.forEach((c) => { c.selected = c.dataset.type === t; });
      const cfg = KEY_TYPES[t];
      field.disabled = false;
      field.label = cfg.label;
      field.placeholder = cfg.placeholder;
      field.type = cfg.type;
      field.setAttribute('inputmode', cfg.inputMode);
      if (!keepValue) field.value = '';
      validate();
    }

    chipEls.forEach((chip) => {
      chip.addEventListener('click', () => {
        // Seleção única: o chip clicado fica sempre selecionado
        selectType(chip.dataset.type);
        setTimeout(() => field.focus(), 60);
      });
    });

    field.addEventListener('input', () => {
      const cfg = KEY_TYPES[type];
      if (!cfg) return;
      const formatted = cfg.format(field.value);
      if (formatted !== field.value) field.value = formatted;
      validate();
    });
    field.addEventListener('blur', showErrorIfInvalid);

    UI.attachSuggestions(
      field,
      (v) => (type === 'email' ? emailCompletions(v).map((e) => ({ label: e, value: e, icon: 'alternate_email' })) : []),
      (it) => { field.value = it.value; validate(); }
    );

    if (initialType && KEY_TYPES[initialType]) {
      customElements.whenDefined('md-outlined-text-field').then(() => {
        selectType(initialType, true);
        field.value = initialValue;
        validate();
      });
    }

    return {
      type: () => type,
      value: () => (field.value || '').trim(),
      isValid: () => valid,
      showErrors: showErrorIfInvalid,
    };
  }

  function bankAutocomplete(field, onChange) {
    UI.attachSuggestions(
      field,
      (v) => searchBanks(v).filter((b) => b !== v).map((b) => ({ label: b, value: b, icon: 'account_balance' })),
      (it) => { field.value = it.value; onChange && onChange(); }
    );
    field.addEventListener('input', () => onChange && onChange());
  }

  window.KeyForm = { mount, bankAutocomplete };
})();
