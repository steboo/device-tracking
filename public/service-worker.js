self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open('tracking-v1').then(function(cache) {
      return cache.addAll([
        '/device-tracking/track.txt'
      ]);
    })
  );
});

self.addEventListener('fetch', function (e) {
  console.log('event fetch ->', e.request.url);
  e.respondWith(
    // could use caches.match maybe?
    caches.open('tracking-v1').then(function (cache) {
      return cache.match(e.request).then(function (response) {
        if (response) {
          console.log('Found response in cache for ' + e.request.url, response);
          return response;
        }

        console.log('No response for ' + e.request.url + ' found in cache.');

        // Since each request object can only be used once,
        // you always have to clone the request
        return fetch(e.request.clone()).then(function (response) {
          console.log('response for ' + e.request.url + ' is', response);
          if (response.status < 400) {
            console.log('Would have cached the response to', e.request.url);
            //cache.put(e.request, response.clone());
          }

          return response;
        });
      }).catch(function (err) {
        console.error('error in fetch', err);
        throw error;
      });
    })
  );
});
