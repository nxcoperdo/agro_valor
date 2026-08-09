/**
 * Service worker de AgroValor.
 *
 * Pensado para conexiones malas del campo: la app abre siempre (aunque no haya
 * señal) y, si no logra consultar el servidor, muestra el último dato que alcanzó
 * a guardar. Eso es honesto porque cada respuesta trae su propia fecha y la
 * interfaz la muestra: el usuario ve si el precio es de hoy o de ayer.
 */

const VERSION = 'v1';
const SHELL_CACHE = `agrovalor-shell-${VERSION}`;
const DATA_CACHE = `agrovalor-data-${VERSION}`;

const SHELL_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './site.webmanifest',
  './img/logo-full.png',
  './img/logo-icon.png',
  './img/icon-192.png',
  './img/icon-512.png',
];

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);

  // addAll falla entero si un solo archivo falla; se agregan de a uno para ser tolerantes.
  const results = await Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset)));
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? `${SHELL_ASSETS[i]} (${r.reason})` : null))
    .filter(Boolean);

  if (failed.length) {
    console.warn('[AgroValor SW] No se pudieron guardar:', failed);
  }
  console.log(`[AgroValor SW] Shell guardado: ${results.length - failed.length}/${results.length}`);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    precacheShell()
      .catch((err) => console.warn('[AgroValor SW] Falló el precacheo:', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('agrovalor-') && key !== SHELL_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** La sesión y todo lo que modifica datos nunca se cachea. */
function isCacheableApi(request, url) {
  return (
    request.method === 'GET' &&
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth/')
  );
}

async function networkFirst(request) {
  const cache = await caches.open(DATA_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({ error: 'Sin conexión y sin datos guardados todavía.', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && new URL(request.url).origin === self.location.origin) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // La app usa rutas por hash, así que toda navegación resuelve al mismo index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    if (isCacheableApi(request, url)) {
      event.respondWith(networkFirst(request));
    }
    return;
  }

  event.respondWith(cacheFirst(request));
});
