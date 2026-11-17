const CACHE_NAME = '__CACHE_VERSION__' === '__CACHE_' + 'VERSION__' ? 'arixon-shell-dev-v2' : '__CACHE_VERSION__';

const DEV_FALLBACK_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-192x192.png',
  '/favicon-512x512.png',
  '/apple-touch-icon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

const INJECTED_PRECACHE_ASSETS = [/*__PRECACHE_MANIFEST__*/];
const PRECACHE_ASSETS = Array.isArray(INJECTED_PRECACHE_ASSETS) && INJECTED_PRECACHE_ASSETS.length > 0
  ? INJECTED_PRECACHE_ASSETS
  : DEV_FALLBACK_ASSETS;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        PRECACHE_ASSETS.map((assetUrl) =>
          cache.add(new Request(assetUrl, { cache: 'reload' })).catch((err) => {
            console.warn('[SW] Precache skip for', assetUrl, err?.message || err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key.startsWith('arixon-')) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'arixon-offline-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          try {
            client.postMessage({ type: 'ARIXON_TRIGGER_SYNC' });
          } catch (_) {}
        });
      })
    );
  }
});

function shouldBypassRequest(request, url) {
  if (request.method !== 'GET') return true;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;

  // Allow ONLY Google Fonts stylesheets & font binaries from external hosts
  const isGoogleFont =
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (url.origin !== self.location.origin && !isGoogleFont) {
    return true;
  }

  // Strictly bypass API routes, Firebase Auth routes, Firestore, IdentityToolkit, or dynamic endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/__/') ||
    url.pathname === '/sw.js' ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    (url.hostname.includes('googleapis.com') && !isGoogleFont)
  ) {
    return true;
  }

  return false;
}

function isShellAsset(url) {
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return true;
  }
  return (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(js|css|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf|webmanifest|json)$/i.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (shouldBypassRequest(event.request, url)) {
    return;
  }

  // App-shell navigation: Serve fresh when online and fall back cleanly to cached index.html when offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        try {
          const networkRes = await fetch(event.request);
          if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
            cache.put('/index.html', networkRes.clone()).catch(() => {});
          }
          return networkRes;
        } catch {
          const cachedExact = await cache.match(event.request);
          if (cachedExact) return cachedExact;
          const cachedIndex = await cache.match('/index.html');
          if (cachedIndex) return cachedIndex;
          const cachedRoot = await cache.match('/');
          if (cachedRoot) return cachedRoot;
          return new Response('أنت غير متصل بالإنترنت ولا توجد نسخة محفوظة محلياً.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      })
    );
    return;
  }

  // App shell static assets (hashed JS/CSS, icons, fonts): Stale-While-Revalidate
  if (isShellAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkPromise = fetch(event.request)
          .then((networkRes) => {
            if (
              networkRes &&
              (networkRes.status === 200 || networkRes.type === 'opaque')
            ) {
              cache.put(event.request, networkRes.clone()).catch(() => {});
            }
            return networkRes;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }

        const fresh = await networkPromise;
        if (fresh) return fresh;
        return new Response('', { status: 504 });
      })
    );
  }
});
