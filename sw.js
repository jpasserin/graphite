/* Graphite service worker — offline cache */
const CACHE = "drawtrack-v165";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-maskable.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // the app shell (page navigations + index.html) is NETWORK-FIRST: when online, every reload gets the
  // latest build immediately; offline it falls back to the cached page. (Fixes the "reload twice" PWA lag.)
  const isShell = req.mode === "navigate" ||
    (url.origin === self.location.origin && /(^|\/)(index\.html)?$/.test(url.pathname));
  if (isShell) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }
  // everything else (icons, manifest, cross-origin images) stays CACHE-FIRST with a network fallback
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});

/* allow the page to trigger an immediate update */
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
