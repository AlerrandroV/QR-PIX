// ===== QR PIX — Service Worker =====
const APP_VERSION   = "1.0.38";
const APP_CACHE     = `qrpix-app-${APP_VERSION}`;
const FONT_CACHE    = "qrpix-fonts-v1";
const EXTERN_CACHE  = "qrpix-extern-v1";
const STATIC_CACHE_NAMES = [APP_CACHE, FONT_CACHE, EXTERN_CACHE];

const APP_ASSETS = [
  "./",
  "./index.html",
  "./settings.html",
  "./qr-customize.html",
  "./new-key.html",
  "./set-value.html",
  "./generate-qr-pix.html",
  "./termos.html",
  "./sobre.html",
  "./licencas.html",
  "./info-page.css",
  "./style.css",
  "./settings.css",
  "./qr-customize.css",
  "./new-key.css",
  "./set-value.css",
  "./generate-qr-pix.css",
  "./ui.js",
  "./app.js",
  "./settings.js",
  "./qr-customize.js",
  "./new-key.js",
  "./set-value.js",
  "./generate-qr-pix.js",
  "./pix-payload.js",
  "./qr-code-styling.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

const EXTERN_ORIGINS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "esm.run",
  "cdn.jsdelivr.net",
  "esm.sh",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await Promise.allSettled(
      APP_ASSETS.map((url) => cache.add(url).catch((err) => console.warn("[SW] Falha ao cachear:", url, err)))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => !STATIC_CACHE_NAMES.includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: "APP_UPDATED", version: APP_VERSION }));
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  if (EXTERN_ORIGINS.some((origin) => url.hostname.includes(origin))) {
    event.respondWith(staleWhileRevalidate(request, EXTERN_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      event.respondWith(handleNavigation(request));
      return;
    }

    event.respondWith(networkFirstAsset(request));
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});

async function handleNavigation(request) {
  const url = new URL(request.url);
  const normalizedPath = normalizePath(url.pathname);
  const cache = await caches.open(APP_CACHE);
  const cacheKey = new Request(normalizedPath);

  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.status === 200) {
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    const fallback = await cache.match(normalizedPath) || await cache.match("./index.html");
    return fallback || Response.error();
  }
}

async function networkFirstAsset(request) {
  const cache = await caches.open(APP_CACHE);
  const url = new URL(request.url);
  const cacheKey = new Request(normalizePath(url.pathname));

  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.status === 200) {
      cache.put(cacheKey, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey) || await cache.match(request);
    return cached || Response.error();
  }
}

function normalizePath(pathname) {
  const path = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return path ? `./${path}` : "./";
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}
