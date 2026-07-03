const BASE = '/vault-chat/';
const CACHE_NAME = 'vault-chat-v4';
const STATIC_ASSETS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}src/styles/main.css`,
  `${BASE}src/app.js`,
  `${BASE}src/auth.js`,
  `${BASE}src/api.js`,
  `${BASE}src/utils/storage.js`,
  `${BASE}src/utils/markdown.js`,
  `${BASE}src/components/login-screen.js`,
  `${BASE}src/components/app-shell.js`,
  `${BASE}src/components/note-browser.js`,
  `${BASE}src/components/chat-panel.js`,
  `${BASE}src/components/settings.js`,
  `${BASE}manifest.json`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: network only
  if (url.hostname === 'api.github.com' || url.hostname === 'api.anthropic.com' || url.hostname === 'corsproxy.io') {
    return;
  }

  // Static assets: cache first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
