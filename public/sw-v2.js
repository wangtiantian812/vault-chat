// Service Worker v22 - aggressive update + no caching
var CACHE_NAME = 'vault-chat-v23';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.clients.matchAll();
    }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        clients[i].navigate(clients[i].url);
      }
    })
  );
});

self.addEventListener('fetch', function(event) {
  // For navigation requests (HTML pages), always fetch fresh
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return fetch(event.request);
      })
    );
    return;
  }
  // For all other requests, network first
  event.respondWith(fetch(event.request));
});
