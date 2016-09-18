self.addEventListener('fetch', function (e) {
  console.log('event fetch ->', e.request.url);
  e.respondWith(
    caches.open('tracking-v1').then(function (cache) {
      return cache.match(e.request).then(function (response) {
        if (response) {
          console.log('found response in cache', response);
          return response;
        }

        console.log('No response for ' + e.request.url + ' found in cache.');

        return fetch(e.request.clone()).then(function (response) {
          console.log('response for ' + e.request.url + ' is', response);
          if (response.status < 400) {
            //console.log('caching the response to', e.request.url);
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
