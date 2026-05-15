// Service Worker — QR PIX
// Baseado no template PWABuilder + Workbox 5.1.2
// Ajuste: fetch de navegação busca no cache pela URL sem query string
// para evitar 404 no GitHub Pages quando há parâmetros na URL.

const CACHE = "pwabuilder-offline-page";

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const offlineFallbackPage = "index.html";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', async (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(offlineFallbackPage))
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

workbox.routing.registerRoute(
  new RegExp('/*'),
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: CACHE
  })
);

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // 1. Tenta navigation preload (mais rápido quando suportado)
        const preloadResp = await event.preloadResponse;
        if (preloadResp) return preloadResp;

        // 2. Tenta buscar na rede normalmente
        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {
        // 3. Offline: busca no cache ignorando a query string
        //    Isso evita 404 quando a URL tem parâmetros (ex: set-value.html?key=...)
        //    pois o GitHub Pages não serve arquivos com query string no path.
        const cache = await caches.open(CACHE);

        // Tenta primeiro a URL sem query string
        const urlWithoutQuery = event.request.url.split('?')[0];
        const cachedByPath = await cache.match(urlWithoutQuery);
        if (cachedByPath) return cachedByPath;

        // Fallback final: index.html
        const cachedFallback = await cache.match(offlineFallbackPage);
        return cachedFallback;
      }
    })());
  }
});
