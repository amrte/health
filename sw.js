// Offline support. Network first, so the page, styles and scripts always come from
// the same version; the cache is the fallback when offline or the network is slow.
const CACHE = 'health-records-v21';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/main.js', 'js/dom.js', 'js/db.js', 'js/store.js', 'js/format.js', 'js/units.js', 'js/metrics.js',
  'js/parse.js', 'js/chart.js', 'js/ui.js', 'js/views.js', 'js/editor.js', 'js/vaccines.js', 'js/data.js', 'js/demo.js',
  'js/calc.js', 'js/evaluate.js', 'js/knowledge.js', 'js/insights.js', 'js/summary.js', 'js/discuss.js', 'js/schedules.js', 'js/zip.js', 'js/polar.js', 'js/fitness.js', 'js/fitness-eval.js', 'js/bp.js', 'js/bp-eval.js', 'js/genome.js', 'js/dna.js', 'js/dna-variants.js', 'js/dna-eval.js', 'js/search.js', 'js/dental.js', 'js/dental-data.js', 'js/more.js', 'js/heart.js', 'js/body.js', 'js/meds.js', 'js/meds-data.js', 'js/timeline.js', 'js/reminders.js', 'js/screening.js', 'js/score2.js', 'js/print.js', 'js/compare.js', 'js/bloodtype.js', 'js/sync.js', 'js/sync-core.js', 'js/sync-ui.js', 'js/leaves.js',
  'icons/icon.svg', 'icons/olive-branch.png', 'icons/logo.webp', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // 'reload' skips the browser's HTTP cache, which could otherwise mix old and new files.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const fresh = fetch(e.request, { cache: 'no-cache' }).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    e.waitUntil(fresh.catch(() => {}));
    const slow = new Promise((resolve) => setTimeout(resolve, 4000));
    try {
      const res = await Promise.race([fresh, slow]);
      if (res) return res;
    } catch { /* offline */ }
    return (await cache.match(e.request, { ignoreSearch: true })) ?? fresh;
  }));
});
