/* =================================================================
   data.js — camada de dados do QR PIX (window.QrData)
   -----------------------------------------------------------------
   Princípio: o app NUNCA fala direto com um backend. Ele fala com
   QrData, que tem duas partes:

   1. Local (fonte da verdade do vendedor) — IndexedDB no aparelho.
      Perfil e catálogo funcionam 100% offline.

   2. Remoto (publicação) — um "adaptador" trocável que implementa:
        isUsernameAvailable(username)          → Promise<boolean>
        publishStore({ profile, products, previousUsername })
        unpublishStore(username)
        fetchStore(username)                   → Promise<{profile, products}|null>
      Hoje: ./firebase.js. Para migrar de backend basta escrever outro
      arquivo com essas 4 funções e trocar REMOTE_ADAPTER abaixo.
      Veja docs/ARQUITETURA-DADOS.md.
================================================================= */
(function () {
  'use strict';

  const REMOTE_ADAPTER = './firebase.js';

  // ── IndexedDB mínimo (chave/valor) ──────────────────────────────
  const DB_NAME = 'qrpix';
  const STORE = 'kv';
  let dbPromise = null;

  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function kvGet(key) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const r = d.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function kvSet(key, value) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Eventos (telas reagem a mudanças) ───────────────────────────
  const emit = (type, detail) => window.dispatchEvent(new CustomEvent('qrdata:' + type, { detail }));

  // ── Modelos ─────────────────────────────────────────────────────
  const EMPTY_PROFILE = {
    name: '', city: '', bank: '', keyType: '', pixKey: '',
    username: '', avatarDataUrl: '', bio: '', whatsapp: '', instagram: '',
    published: false,          // vendedor quer a loja visível publicamente
    publishedUsername: '',     // último @ publicado (p/ remover se mudar)
    dirty: false,              // há alterações locais não publicadas
    lastSyncAt: null,
    updatedAt: null,
  };

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Migração: perfil antigo salvo em localStorage (v1.1.0)
  async function migrate() {
    if (await kvGet('profile')) return;
    try {
      const old = JSON.parse(localStorage.getItem('qrpix_profile'));
      if (old && old.name) await kvSet('profile', { ...EMPTY_PROFILE, ...old, dirty: !!old.username });
    } catch {}
  }
  const ready = migrate().catch(() => {});

  // ── Perfil ──────────────────────────────────────────────────────
  const profile = {
    async get() {
      await ready;
      const p = await kvGet('profile');
      return p ? { ...EMPTY_PROFILE, ...p } : null;
    },
    async save(partial) {
      const current = (await profile.get()) || { ...EMPTY_PROFILE };
      const next = { ...current, ...partial, dirty: true, updatedAt: Date.now() };
      await kvSet('profile', next);
      emit('change', { what: 'profile' });
      autoSync();
      return next;
    },
    async exists() { return !!(await profile.get())?.name; },
  };

  // ── Catálogo ────────────────────────────────────────────────────
  const products = {
    async all() { await ready; return (await kvGet('products')) || []; },
    async get(id) { return (await products.all()).find((p) => p.id === id) || null; },
    async save(item) {
      const list = await products.all();
      const now = Date.now();
      let saved;
      const i = list.findIndex((p) => p.id === item.id);
      if (i >= 0) { saved = { ...list[i], ...item, updatedAt: now }; list[i] = saved; }
      else { saved = { available: true, priceCents: 0, ...item, id: newId(), createdAt: now, updatedAt: now }; list.unshift(saved); }
      await kvSet('products', list);
      await markDirty();
      emit('change', { what: 'products' });
      return saved;
    },
    async remove(id) {
      await kvSet('products', (await products.all()).filter((p) => p.id !== id));
      await markDirty();
      emit('change', { what: 'products' });
    },
    async restore(item) {
      const list = await products.all();
      list.unshift(item);
      await kvSet('products', list);
      await markDirty();
      emit('change', { what: 'products' });
    },
  };

  async function markDirty() {
    const p = await profile.get();
    if (p) { await kvSet('profile', { ...p, dirty: true }); autoSync(); }
  }

  // ── Remoto ──────────────────────────────────────────────────────
  let adapterPromise = null;
  function remote() {
    if (!adapterPromise) adapterPromise = import(REMOTE_ADAPTER).catch((e) => { adapterPromise = null; throw e; });
    return adapterPromise;
  }

  // Campos que vão para a página pública (nunca o resto do perfil local)
  function publicProfile(p) {
    return {
      name: p.name, city: p.city, bio: p.bio, username: p.username.toLowerCase(),
      avatarDataUrl: p.avatarDataUrl || null,
      whatsapp: p.whatsapp || '', instagram: p.instagram || '',
      bank: p.bank, keyType: p.keyType, pixKey: p.pixKey,
    };
  }
  function publicProduct(x) {
    return {
      id: x.id, name: x.name, description: x.description || '',
      priceCents: x.priceCents || 0, imageDataUrl: x.imageDataUrl || null,
      available: x.available !== false, updatedAt: x.updatedAt || Date.now(),
    };
  }

  let syncing = null;
  async function sync() {
    if (syncing) return syncing;
    syncing = (async () => {
      const p = await profile.get();
      if (!p) return { ok: true, state: 'empty' };
      const api = await remote();

      // Loja despublicada (ou sem @): remove o que estiver online
      if (!p.published || !p.username) {
        if (p.publishedUsername) await api.unpublishStore(p.publishedUsername);
        await kvSet('profile', { ...p, publishedUsername: '', dirty: false, lastSyncAt: Date.now() });
        emit('sync', { state: 'local' });
        return { ok: true, state: 'local' };
      }

      const list = await products.all();
      await api.publishStore({
        profile: publicProfile(p),
        products: list.map(publicProduct),
        previousUsername: p.publishedUsername && p.publishedUsername !== p.username.toLowerCase() ? p.publishedUsername : '',
      });
      const fresh = await profile.get(); // pode ter mudado durante o envio
      await kvSet('profile', {
        ...fresh,
        publishedUsername: p.username.toLowerCase(),
        dirty: fresh.updatedAt !== p.updatedAt ? fresh.dirty : false,
        lastSyncAt: Date.now(),
      });
      emit('sync', { state: 'published' });
      return { ok: true, state: 'published' };
    })().catch((error) => {
      console.warn('[QrData] sync:', error);
      emit('sync', { state: 'error', error });
      return { ok: false, error };
    }).finally(() => { syncing = null; });
    return syncing;
  }

  // Publica em segundo plano depois de alterações (com pequeno atraso)
  let autoTimer = null;
  function autoSync() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(async () => {
      const p = await profile.get();
      if (p && p.dirty && (p.published || p.publishedUsername) && navigator.onLine) sync();
    }, 1500);
  }
  window.addEventListener('online', autoSync);
  // As telas navegam logo após salvar: ao abrir qualquer tela, retoma a
  // publicação pendente (o estado "dirty" fica salvo no IndexedDB).
  ready.then(autoSync);

  async function isUsernameAvailable(username) {
    const p = await profile.get();
    if (p && p.publishedUsername === username.toLowerCase()) return true; // já é meu
    return (await remote()).isUsernameAvailable(username);
  }

  async function fetchPublicStore(username) {
    return (await remote()).fetchStore(username.toLowerCase());
  }

  // ── Helpers de contato ──────────────────────────────────────────
  function whatsappNumber(raw) {
    let d = String(raw || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 11) d = '55' + d;
    return d;
  }
  function whatsappLink(raw, text) {
    const n = whatsappNumber(raw);
    return n ? `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}` : '';
  }
  function instagramHandle(raw) {
    return String(raw || '').trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/^@/, '').replace(/[/?#].*$/, '');
  }
  function instagramLink(raw) {
    const h = instagramHandle(raw);
    return h ? 'https://instagram.com/' + encodeURIComponent(h) : '';
  }
  // Link público da loja, relativo ao endereço onde o app está hospedado
  const storeUrl = (username) =>
    new URL('store.html?u=' + encodeURIComponent(String(username || '').toLowerCase()), location.href).href;

  // Restauração de backup (substitui os dados locais)
  async function importAll({ profile: p, products: list }) {
    if (p) await kvSet('profile', { ...EMPTY_PROFILE, ...p, dirty: true });
    if (list) await kvSet('products', list);
    emit('change', { what: 'all' });
    autoSync();
  }

  window.QrData = {
    importAll,
    profile, products, sync, autoSync, isUsernameAvailable, fetchPublicStore,
    whatsappNumber, whatsappLink, instagramHandle, instagramLink, storeUrl,
    EMPTY_PROFILE,
  };
})();
