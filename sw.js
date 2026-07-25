const CACHE = 'apt-cost-v7';
// calc.js must be precached — index.html loads it via <script src>, so without
// it here the whole app breaks offline, not just degrades. (The rest of D9 —
// logo, fonts, cache-put for other assets — is still Phase 4.)
const ASSETS = ['./', './index.html', './calc.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first for the app shell so deploys appear immediately,
    // falling back to cache when offline.
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
  } else {
    // Cache-first for static assets (manifest, fonts, etc.).
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});
