// Service worker v5 — met à jour l'app et évite de servir une ancienne version bloquée.
const CACHE = 'futs-v5';
const STATIC_HOSTS = ['cdn.jsdelivr.net','fonts.gstatic.com','fonts.googleapis.com'];

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => /^futs-v\d+$/.test(k) && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({type:'window'});
    await Promise.allSettled(clients.map(client => client.navigate(client.url)));
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // L'app, le manifest et le worker doivent toujours être repris au réseau.
  if (url.origin === location.origin && (/\/(app\.html|manifest\.json|sw\.js)$/.test(url.pathname) || req.mode === 'navigate')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, {cache:'no-store'});
        if (req.mode === 'navigate' || url.pathname.endsWith('/app.html')) {
          const cache = await caches.open(CACHE);
          cache.put('/app.html', fresh.clone());
        }
        return fresh;
      } catch {
        return caches.match('/app.html') || caches.match(req);
      }
    })());
    return;
  }

  // Libs CDN et polices : cache-first, avec rafraîchissement en arrière-plan.
  if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })());
  }
});
