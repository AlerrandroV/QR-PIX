/* =================================================================
   store.js — página pública da loja (visão do cliente)
     store.html?u=usuario   → loja publicada (busca no backend)
     store.html?preview=1   → pré-visualização local do vendedor
================================================================= */
(async function () {
  'use strict';
  const UI = window.QrUI;
  const D = window.QrData;
  const { formatCurrency } = window.PixUtils;
  const esc = UI.escapeHtml;
  const $ = (id) => document.getElementById(id);

  const qp = new URLSearchParams(location.search);
  const preview = qp.has('preview');
  const username = (qp.get('u') || '').trim();

  function showState(icon, title, text, action) {
    $('state').hidden = false;
    $('state').innerHTML = `<div class="empty">
      <span class="empty__icon"><span class="icon">${icon}</span></span>
      <p class="empty__title">${esc(title)}</p>
      ${text ? `<p class="empty__text">${esc(text)}</p>` : ''}
      ${action || ''}
    </div>`;
  }

  // ── Carregar dados ────────────────────────────────────────────
  let data = null;
  try {
    if (preview) {
      const profile = await D.profile.get();
      if (!profile?.name) {
        showState('storefront', 'Você ainda não tem uma loja', 'Crie seu perfil para montar o catálogo.',
          '<md-filled-tonal-button href="create-profile.html">Criar perfil</md-filled-tonal-button>');
        return;
      }
      data = { profile, products: await D.products.all() };
    } else if (username) {
      data = await D.fetchPublicStore(username);
    }
  } catch (err) {
    console.warn(err);
    showState('cloud_off', 'Não foi possível carregar a loja', 'Verifique sua conexão e tente novamente.',
      '<md-filled-tonal-button onclick="location.reload()">Tentar de novo</md-filled-tonal-button>');
    return;
  }
  if (!data) {
    showState('search_off', 'Loja não encontrada', username ? `Não existe uma loja publicada como @${username}.` : 'Link incompleto.');
    return;
  }

  const { profile: p, products } = data;
  const visible = products.filter((x) => preview || x.name);
  const whats = D.whatsappLink(p.whatsapp);
  const insta = D.instagramLink(p.instagram);
  const canPix = !!(p.pixKey && p.keyType);

  // ── Cabeçalho da loja ─────────────────────────────────────────
  document.title = `${p.name} — QR PIX`;
  $('state').hidden = true;
  $('hero').hidden = false;
  $('powered').hidden = preview;
  $('preview-banner').hidden = !preview;
  $('btn-back').hidden = !preview;
  $('brand').hidden = preview;
  $('preview-title').hidden = !preview;
  $('btn-share').hidden = preview && !p.published;

  $('s-avatar').innerHTML = p.avatarDataUrl ? `<img src="${esc(p.avatarDataUrl)}" alt="" />` : '<span class="icon">storefront</span>';
  $('s-name').textContent = p.name;
  $('s-username').textContent = p.username ? '@' + p.username : '';
  $('s-bio').hidden = !p.bio;
  $('s-bio').textContent = p.bio || '';
  $('s-city').hidden = !p.city;
  $('s-city').lastElementChild.textContent = p.city || '';
  $('s-contacts').innerHTML = [
    whats && `<md-filled-tonal-button href="${esc(whats)}" target="_blank"><md-icon slot="icon">chat</md-icon>WhatsApp</md-filled-tonal-button>`,
    insta && `<md-filled-tonal-button href="${esc(insta)}" target="_blank"><md-icon slot="icon">photo_camera</md-icon>Instagram</md-filled-tonal-button>`,
  ].filter(Boolean).join('');

  // ── Rodapé: ação principal = falar com o vendedor ─────────────
  $('footer').hidden = !(whats || insta || canPix);
  $('btn-contact').hidden = !(whats || insta);
  $('btn-contact-label').textContent = whats ? 'Chamar no WhatsApp' : 'Abrir Instagram';
  $('btn-contact-icon').textContent = whats ? 'chat' : 'photo_camera';
  $('btn-contact').addEventListener('click', () => window.open(whats || insta, '_blank'));
  $('btn-pix').hidden = !canPix;
  if (!(whats || insta)) $('btn-pix').classList.remove('app-footer__secondary');

  function payLink(cents) {
    const params = new URLSearchParams({
      bank: p.bank || '', name: p.name, keyType: p.keyType, key: p.pixKey,
      value: String(cents || 0), city: p.city || '', store: p.username || '',
    });
    return 'generate-qr-pix.html?' + params;
  }
  $('btn-pix').addEventListener('click', () => { location.href = payLink(0); });

  // ── Catálogo ──────────────────────────────────────────────────
  $('sec-products').hidden = false;
  $('s-count').textContent = visible.length ? `${visible.length} ${visible.length === 1 ? 'item' : 'itens'}` : '';
  const grid = $('grid');
  if (!visible.length) {
    grid.outerHTML = `<div class="card"><div class="empty">
      <span class="empty__icon"><span class="icon">inventory_2</span></span>
      <p class="empty__title">Catálogo em breve</p>
      <p class="empty__text">${whats || insta ? 'Fale com a loja para saber o que está disponível.' : ''}</p></div></div>`;
  } else {
    grid.innerHTML = visible.map((x, i) => {
      const off = x.available === false;
      return `<button class="product-card${off ? ' is-unavailable' : ''}" type="button" data-i="${i}">
        ${off ? '<span class="badge">Esgotado</span>' : ''}
        <span class="product-card__media">${x.imageDataUrl ? `<img src="${esc(x.imageDataUrl)}" alt="" loading="lazy" />` : '<span class="icon">image</span>'}</span>
        <span class="product-card__body">
          <span class="product-card__name">${esc(x.name)}</span>
          ${x.priceCents
            ? `<span class="product-card__price">${formatCurrency(x.priceCents)}</span>`
            : '<span class="product-card__price product-card__price--muted">Sob consulta</span>'}
        </span>
      </button>`;
    }).join('');
    grid.querySelectorAll('.product-card').forEach((el) => {
      el.addEventListener('click', () => openProduct(visible[+el.dataset.i]));
    });
  }

  // ── Detalhe do produto ────────────────────────────────────────
  function orderText(x) {
    return `Olá! Vi no seu catálogo e tenho interesse em: *${x.name}*` +
      (x.priceCents ? ` (${formatCurrency(x.priceCents)})` : '') + '. Está disponível?';
  }

  async function openProduct(x) {
    await customElements.whenDefined('md-dialog');
    const off = x.available === false;
    const dlg = document.createElement('md-dialog');
    dlg.innerHTML = `
      <div slot="headline">${esc(x.name)}</div>
      <div slot="content" class="form">
        ${x.imageDataUrl ? `<img class="dialog-media" src="${esc(x.imageDataUrl)}" alt="" />` : ''}
        <p class="product-card__price">${x.priceCents ? formatCurrency(x.priceCents) : 'Preço sob consulta'}${off ? ' · <span class="badge">Esgotado</span>' : ''}</p>
        ${x.description ? `<p class="body pre-line">${esc(x.description)}</p>` : ''}
      </div>
      <div slot="actions">
        <md-text-button data-act="close">Fechar</md-text-button>
        ${canPix && x.priceCents && !off ? '<md-text-button data-act="pix">Pagar com PIX</md-text-button>' : ''}
        ${whats ? `<md-filled-button data-act="order">${off ? 'Perguntar' : 'Pedir'}</md-filled-button>`
          : insta ? '<md-filled-button data-act="insta">Instagram</md-filled-button>' : ''}
      </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('closed', () => dlg.remove());
    dlg.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.act;
      if (act === 'order') window.open(D.whatsappLink(p.whatsapp, orderText(x)), '_blank');
      if (act === 'insta') window.open(insta, '_blank');
      if (act === 'pix') location.href = payLink(x.priceCents);
      dlg.close();
    }));
    dlg.show();
  }

  // ── Compartilhar ──────────────────────────────────────────────
  $('btn-share').addEventListener('click', async () => {
    const url = D.storeUrl(p.username);
    try {
      if (navigator.share) await navigator.share({ title: p.name, text: `Veja o catálogo de ${p.name}`, url });
      else { await navigator.clipboard.writeText(url); UI.snackbar('Link copiado'); }
    } catch (err) {
      if (err.name !== 'AbortError') UI.snackbar('Não foi possível compartilhar');
    }
  });
})();
