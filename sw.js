// 离线缓存：先用网络取最新版本，取不到（断网）时用缓存。
const CACHE = 'hd-public-v2';
const FILES = ['./', 'index.html', 'engine.js', 'saturn.js', 'bazi.js', 'localapi.js', 'channels.js', 'bodygraph.js', 'hdsummary.js',
  'hdcontent.js', 'hdcrosses.js', 'monthlayout.js', 'vendor/swisseph.js', 'vendor/swisseph-wasm.js',
  'icon-180.png', 'icon-512.png', 'manifest.json'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    if (r.ok) caches.open(CACHE).then(c => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
