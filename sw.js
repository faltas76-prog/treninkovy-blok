const CACHE_NAME = "treninkovy-blok-v3";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"
];

// Pre-warm the cache on install, but never let a failed fetch block install/activation.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) =>
          fetch(url, { mode: url.startsWith("http") ? "no-cors" : "same-origin", cache: "reload" })
            .then((res) => cache.put(url, res))
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Drop every cache that isn't the current version.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

const isOwnOrigin = (url) => url.origin === self.location.origin;

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (isOwnOrigin(url)) {
    // App shell (HTML/CSS/JS we wrote) — always prefer the network so a fix you upload
    // shows up immediately. Cache is only a fallback for when there's no connection.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // Third-party libraries (React/Babel from the CDN) barely ever change — cache-first is fine
  // and keeps things fast, with network as a fallback if it's somehow missing from cache.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      });
    })
  );
});
