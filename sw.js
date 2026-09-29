const CACHE = 'apt-cost-v31';
// R29, Phase 4b: a cache write must never surface as an error — the response
// has already been returned to the page by the time this runs, so a rejected
// cache.put would otherwise become an unhandled promise rejection in the SW
// console for no user-visible benefit. Same discipline as the localStorage
// layer's read/write-never-throws rule.
function safePut(req, res) {
  caches.open(CACHE).then(c => c.put(req, res)).catch(() => {});
}
// calc.js must be precached — index.html loads it via <script src>, so without
// it here the whole app breaks offline, not just degrades. Phase 4 (R5) added
// the logo/manifest icons and the self-hosted font files here too, now that
// fonts are same-origin instead of a fonts.googleapis.com/gstatic.com request.
const ASSETS = [
  './', './index.html', './calc.js', './manifest.json',
  './dhanamlogo.png', './icon-512.png', './icon-512-maskable.png',
  './fonts/inter-latin.woff2', './fonts/inter-latinext.woff2',
  './fonts/playfair-display-latin.woff2', './fonts/playfair-display-latinext.woff2',
  './fonts/dm-mono-400-latin.woff2', './fonts/dm-mono-400-latinext.woff2',
  './fonts/dm-mono-500-latin.woff2', './fonts/dm-mono-500-latinext.woff2'
];

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
  // calc.js is shell code, not a static asset: index.html's inline <script>
  // is version-locked to calc.js's current API. A fresh (network-first) HTML
  // shell served against a stale (cache-first) calc.js breaks the app
  // outright — that skew is exactly how "Can't find variable:
  // calcLeaseMarginalRate" reached users right after the Phase 22 deploy
  // (bumping CACHE doesn't help: the old SW serves the stale calc.js before
  // the new SW ever activates). So calc.js gets the same network-first
  // treatment as the HTML shell, and the two can never skew across a deploy.
  const isCalcJs = new URL(req.url).pathname.replace(/\/+$/, '').endsWith('/calc.js');

  if (isHTML || isCalcJs) {
    // Network-first for the app shell so deploys appear immediately,
    // falling back to cache when offline.
    const key = isHTML ? './index.html' : './calc.js';
    e.respondWith(
      fetch(req)
        .then(res => {
          safePut(key, res.clone());
          return res;
        })
        .catch(() => caches.match(key))
    );
  } else {
    // Cache-first for static assets (manifest, fonts, etc.); a miss is
    // fetched and cached so anything not in the precache list (e.g. an
    // asset added later without a sw.js bump) still ends up offline-able
    // after its first successful fetch.
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        if (res.status === 200) safePut(req, res.clone());
        return res;
      }))
    );
  }
});
