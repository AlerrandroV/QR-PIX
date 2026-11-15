/* =================================================================
   profile.js — aba Perfil (ver a loja + publicação)
================================================================= */
(function () {
  'use strict';
  const UI = window.QrUI;
  const D = window.QrData;
  const { KEY_TYPES } = window.PixUtils;
  const esc = UI.escapeHtml;
  const $ = (id) => document.getElementById(id);

  let profile = null;

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'agora mesmo';
    if (s < 3600) return `há ${Math.round(s / 60)} min`;
    if (s < 86400) return `há ${Math.round(s / 3600)} h`;
    return new Date(ts).toLocaleDateString('pt-BR');
  }

  function contactsHtml(p) {
    const wa = D.whatsappLink(p.whatsapp);
    const ig = D.instagramLink(p.instagram);
    return [
      wa && `<md-filled-tonal-button href="${esc(wa)}" target="_blank"><md-icon slot="icon">chat</md-icon>WhatsApp</md-filled-tonal-button>`,
      ig && `<md-filled-tonal-button href="${esc(ig)}" target="_blank"><md-icon slot="icon">photo_camera</md-icon>Instagram</md-filled-tonal-button>`,
    ].filter(Boolean).join('');
  }

  function renderSync(state) {
    const p = profile;
    const icon = $('sync-icon');
    const btn = $('btn-sync');
    icon.classList.remove('spin');
    btn.hidden = true;

    let title, text, ic;
    if (state === 'syncing') {
      [title, text, ic] = ['Publicando…', 'Enviando perfil e catálogo', 'progress_activity'];
      icon.classList.add('spin');
    } else if (!p.published) {
      [title, text, ic] = ['Somente neste aparelho', 'Seus clientes ainda não veem a loja', 'smartphone'];
    } else if (state === 'error' || (p.dirty && !navigator.onLine)) {
      [title, text, ic] = ['Não publicado', navigator.onLine ? 'Falha ao enviar. Tente de novo.' : 'Sem conexão — publicamos quando voltar', 'cloud_off'];
      btn.hidden = !navigator.onLine;
    } else if (p.dirty) {
      [title, text, ic] = ['Alterações pendentes', 'Publique para os clientes verem', 'cloud_upload'];
      btn.hidden = false;
    } else {
      [title, text, ic] = ['Loja no ar', 'Atualizada ' + timeAgo(p.lastSyncAt), 'cloud_done'];
    }
    $('sync-title').textContent = title;
    $('sync-text').textContent = text;
    icon.textContent = ic;
  }

  async function render(syncState) {
    profile = await D.profile.get();
    const has = !!profile?.name;
    $('empty').hidden = has;
    ['hero', 'sec-public', 'sec-business'].forEach((id) => { $(id).hidden = !has; });
    $('btn-main').setAttribute('href', has ? 'profile-edit.html' : 'create-profile.html');
    $('btn-main-label').textContent = has ? 'Editar perfil' : 'Criar perfil';
    $('btn-main-icon').textContent = has ? 'edit' : 'add';
    if (!has) return;

    const p = profile;
    $('p-avatar').innerHTML = p.avatarDataUrl ? `<img src="${esc(p.avatarDataUrl)}" alt="" />` : '<span class="icon">storefront</span>';
    $('p-name').textContent = p.name;
    $('p-username').textContent = p.username ? '@' + p.username : 'Sem nome de usuário';
    $('p-bio').hidden = !p.bio;
    $('p-bio').textContent = p.bio || '';
    $('p-city').hidden = !p.city;
    $('p-city').textContent = p.city || '';
    $('p-contacts').innerHTML = contactsHtml(p);

    $('pub-switch').selected = !!p.published;
    $('pub-hint').textContent = p.username
      ? D.storeUrl(p.username).replace(/^https?:\/\//, '')
      : 'Defina um nome de usuário (@) para ter um link próprio';
    $('btn-share').hidden = !p.published || !p.username;
    $('sync-row').hidden = false;
    renderSync(syncState);

    const items = await D.products.all();
    const avail = items.filter((x) => x.available !== false).length;
    $('p-products').textContent = items.length
      ? `${items.length} produto(s) · ${avail} disponível(is)`
      : 'Nenhum produto ainda';
    $('p-key-type').textContent = 'Chave PIX · ' + (KEY_TYPES[p.keyType]?.label || '');
    $('p-key').textContent = p.pixKey || '—';
    $('p-bank').textContent = p.bank || '';
  }

  async function publishNow() {
    renderSync('syncing');
    const res = await D.sync();
    await render(res.ok ? undefined : 'error');
    if (!res.ok) UI.snackbar('Não foi possível publicar agora');
    else if (res.state === 'published') UI.snackbar('Loja publicada');
    return res;
  }

  // Liga/desliga a publicação
  $('pub-switch').addEventListener('change', async (e) => {
    const sw = e.target;
    if (sw.selected && !profile.username) {
      sw.selected = false;
      const go = await UI.confirm({
        icon: 'alternate_email',
        title: 'Escolha um nome de usuário',
        body: 'Ele forma o link da sua loja, por exemplo qrpix.site/store.html?u=doces.da.maria',
        confirmLabel: 'Definir agora',
      });
      if (go) location.href = 'profile-edit.html#username';
      return;
    }
    if (!sw.selected) {
      const ok = await UI.confirm({
        icon: 'public_off',
        title: 'Tirar a loja do ar?',
        body: 'O link deixa de funcionar para os clientes. Seu perfil e catálogo continuam salvos neste aparelho.',
        confirmLabel: 'Tirar do ar',
        danger: true,
      });
      if (!ok) { sw.selected = true; return; }
    }
    await D.profile.save({ published: sw.selected });
    await publishNow();
  });

  $('btn-sync').addEventListener('click', publishNow);

  $('btn-share').addEventListener('click', async () => {
    const url = D.storeUrl(profile.username);
    const text = `Conheça a ${profile.name}! Veja o catálogo:`;
    try {
      if (navigator.share) await navigator.share({ title: profile.name, text, url });
      else { await navigator.clipboard.writeText(url); UI.snackbar('Link copiado'); }
    } catch (err) {
      if (err.name !== 'AbortError') UI.snackbar('Não foi possível compartilhar');
    }
  });

  window.addEventListener('qrdata:sync', (e) => render(e.detail.state === 'error' ? 'error' : undefined));
  window.addEventListener('online', () => render());
  window.addEventListener('offline', () => render());
  customElements.whenDefined('md-switch').then(() => render());
  render();
})();
