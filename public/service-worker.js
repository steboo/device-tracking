var CACHE_NAME = 'tracking';
var CACHE_VERSION = 1;

self.addEventListener('fetch', function (e) {
  e.respondWith(
    // TODO: could use caches.match maybe?
    caches.open(CACHE_NAME + '-v' + CACHE_VERSION).then(function (cache) {
      return cache.match(e.request).then(function (response) {
        if (response) {
          return response;
        }

        // Since each request object can only be used once,
        // you always have to clone the request
        return fetch(e.request.clone()).then(function (response) {
          // only cache good responses of type text/plain
          if (response.status < 400
              && response.headers.has('content-type')
              && response.headers.get('content-type').match(/^text\/plain/i)) {
            cache.put(e.request, response.clone());
          }

          return response;
        });
      }).catch(function (err) {
        throw error;
      });
    })
  );
});
