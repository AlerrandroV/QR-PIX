// ─────────────────────────────────────────────────────────────────
//  Service Worker — QR PIX
//  Estratégia: NetworkFirst com fallback para cache.
//  Cache nomeado por versão — ao mudar APP_VERSION o cache antigo
//  é limpo automaticamente e todos os clientes recebem a versão nova.
// ─────────────────────────────────────────────────────────────────

importScripts('app-version.js');

const CACHE_NAME = `qr-pix-v${APP_VERSION}`;

// Arquivos que devem ser cacheados na instalação (shell do app)
const PRECACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './ui.js',
  './app.js',
  './app-version.js',
  './manifest.json',
  './qr-pix-icon.svg',
  './qr-pix-monochrome.svg',
];

// ── INSTALL: pré-cacheia o shell do app ────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Não chama skipWaiting aqui: espera o cliente decidir atualizar
  );
});

// ── ACTIVATE: limpa caches de versões antigas ────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => {
      // Assume controle de todas as abas abertas imediatamente
      self.clients.claim();
      // Avisa todas as abas que o app foi atualizado
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
        .then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: 'SW_UPDATED', version: APP_VERSION })
          );
        });
    })
  );
});

// ── SKIP_WAITING sob demanda (enviado pelo ui.js) ────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── FETCH: NetworkFirst com fallback para cache ──────────────────
self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET e cross-origin
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Salva cópia fresca no cache
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      })
      .catch(() => {
        // Offline: serve do cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Fallback para navegação: serve index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
