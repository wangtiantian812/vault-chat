// Minimal SW - only for PWA install, no caching
var CACHE_NAME = 'vault-chat-v19';

self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Never cache anything, always fetch from network
  return;
});
