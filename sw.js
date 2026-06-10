// Focus Timer service worker — offline shell + sounds.
//
// Strategy:
//  - Navigations → NETWORK-FIRST, falling back to the cached index.html.
//    The whole app is one unhashed file, so cache-first would pin users to
//    a stale build forever; network-first picks up deploys on the next
//    online refresh with no version bump needed.
//  - Same-origin static (sounds, icons, manifest) → cache-first (precached).
//  - Font/CDN origins (Google Fonts, jsdelivr/supabase-js) → stale-while-
//    revalidate in a runtime cache. Offline before first cache → graceful:
//    fonts fall back via display=swap, sync code already tolerates a
//    missing supabase-js (`sb` null guard).
//  - Everything else (notably *.supabase.co API/realtime) is NEVER
//    intercepted; non-GET requests pass straight through.

const CACHE = 'focus-timer-v1';
const RUNTIME = 'focus-timer-runtime-v1';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './sounds/Start.mp3',
  './sounds/clap.mp3',
  './sounds/punch.mp3',
  './sounds/finish%20ring.mp3',
];
const SWR_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // Supabase upserts etc. — hands off
  const url = new URL(req.url);
  if (url.hostname.endsWith('.supabase.co')) return; // sync/realtime — never cache

  // App shell: network-first so deploys propagate.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // CDN assets: stale-while-revalidate.
  if (SWR_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(RUNTIME).then(async (c) => {
        const cached = await c.match(req);
        const refresh = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
        return cached || refresh.then((res) => res || Response.error());
      })
    );
    return;
  }

  // Same-origin static: cache-first.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
