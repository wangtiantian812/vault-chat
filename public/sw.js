var CACHE_NAME = 'vault-chat-v9';
var BASE = '/vault-chat/';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  // API requests: network only, no cache
  if (url.hostname === 'api.github.com' || url.hostname === 'api.anthropic.com' ||
      url.hostname === 'corsproxy.io' || url.hostname === 'next.ke.com') {
    return;
  }
  // Everything else: network first, cache fallback
  event.respondWith(
    fetch(event.request).then(function(response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
      return response;
    }).catch(function() {
      return caches.match(event.request);
    })
  );
});
