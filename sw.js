// The build id is stamped in by the deploy workflow (see .github/workflows/
// deploy.yml). It is what makes this file's bytes change on every deploy, and
// a changed service worker script is the only thing that makes a browser look
// for new assets -- so never rely on editing it by hand.
const BUILD = '__BUILD__';
const CACHE = 'cologuess-' + BUILD;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './ggwave.js',
  './qrcode.js',
  './jsqr.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    // `cache: 'reload'` keeps the HTTP cache out of it: without it the browser
    // may hand us the very files we are trying to replace.
    c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))
  ));
  // No skipWaiting() here on purpose. A fresh worker waits until the page says
  // it is at a safe moment (see the SKIP_WAITING message below), so an update
  // never swaps the assets out from under a game in progress.
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit =>
      hit || fetch(req).then(resp => {
        // Only keep responses worth replaying offline: a cached 404 or an
        // opaque error would otherwise outlive the failure that produced it.
        if (resp.ok && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Promise.reject()))
    )
  );
});
