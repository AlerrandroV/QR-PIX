/* =================================================================
   keys-list.js — lista de chaves PIX salvas (componente reutilizável).
   Usado na Início (recentes) e em Cobrar (lista completa + busca).
   Depende de ui.js (QrUI) e pix-utils.js (PixUtils).
================================================================= */
(function () {
  'use strict';
  const { keys, tx, KEY_TYPES, initials } = window.PixUtils;
  const esc = window.QrUI.escapeHtml;

  function startCharge(k) {
    keys.touch(k.id);
    tx.set({ bank: k.bank, name: k.name, keyType: k.keyType, key: k.key, city: k.city });
    location.href = 'set-value.html';
  }

  function matches(k, q) {
    if (!q) return true;
    const n = q.toLowerCase();
    return [k.name, k.bank, k.key].some((v) => String(v || '').toLowerCase().includes(n));
  }

  function mount(container, opts = {}) {
    const { limit = Infinity, compact = false, onRender } = opts;
    let query = '';

    function emptyHtml() {
      if (query) {
        return `<div class="empty">
          <span class="empty__icon"><span class="icon">search_off</span></span>
          <p class="empty__title">Nenhuma chave encontrada</p>
          <p class="empty__text">Nada corresponde a “${esc(query)}”.</p>
        </div>`;
      }
      return `<div class="empty">
        <span class="empty__icon"><span class="icon">key</span></span>
        <p class="empty__title">Nenhuma chave cadastrada</p>
        <p class="empty__text">Cadastre uma chave PIX para começar a gerar cobranças.</p>
        ${compact ? '<md-filled-tonal-button href="new-key.html"><md-icon slot="icon">add</md-icon>Cadastrar chave</md-filled-tonal-button>' : ''}
      </div>`;
    }

    function render() {
      const all = keys.all();
      const list = all.filter((k) => matches(k, query)).slice(0, limit);
      container.classList.toggle('card--list', list.length > 0);

      if (!list.length) {
        container.innerHTML = emptyHtml();
      } else {
        container.innerHTML = list.map((k) => `
          <div class="list-item list-item--action list-item--two-line" role="button" tabindex="0" data-id="${esc(k.id)}">
            <span class="list-item__leading list-item__leading--primary list-item__leading--avatar">${esc(initials(k.name))}</span>
            <span class="list-item__content">
              <span class="list-item__headline">${esc(k.name)}</span>
              <span class="list-item__supporting">${esc(k.bank)} · ${esc(KEY_TYPES[k.keyType]?.label || k.keyType)}</span>
              ${compact ? '' : `<span class="list-item__supporting mono">${esc(k.key)}</span>`}
            </span>
            <span class="list-item__trailing">
              ${compact
                ? '<span class="icon">chevron_right</span>'
                : '<md-icon-button data-delete aria-label="Excluir chave"><md-icon>delete</md-icon></md-icon-button>'}
            </span>
          </div>`).join('');

        container.querySelectorAll('[data-id]').forEach((row) => {
          const k = all.find((x) => x.id === row.dataset.id);
          row.addEventListener('click', (e) => {
            if (e.target.closest('[data-delete]')) return;
            startCharge(k);
          });
          row.addEventListener('keydown', (e) => {
            if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startCharge(k); }
          });
          row.querySelector('[data-delete]')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const ok = await window.QrUI.confirm({
              icon: 'delete',
              title: 'Excluir chave?',
              body: `${k.name} — ${k.key}`,
              confirmLabel: 'Excluir',
              danger: true,
            });
            if (!ok) return;
            keys.remove(k.id);
            render();
            window.QrUI.snackbar('Chave excluída', {
              action: 'Desfazer',
              onAction: () => { keys.save([k, ...keys.all()]); render(); },
            });
          });
        });
      }
      onRender && onRender(all.length, list.length);
    }

    render();
    return {
      render,
      search(q) { query = q.trim(); render(); },
    };
  }

  window.KeysList = { mount, startCharge };
})();
