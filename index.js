var express = require('express'),
    cookieParser = require('cookie-parser'),
    redis = require('redis'),
    serveStatic = require('serve-static'),
    uuid = require('node-uuid');

const WEB_PORT = 21215;
const REDIS_PORT = 22982;

var app = express(),
    client = redis.createClient(REDIS_PORT);

app.use(cookieParser());

// Need /app_path to redirect to /app_path/. It wasn't an option to adjust the
// web server config on the current production host, so these gymnastics will
// do.
app.use(serveStatic('public', { 'index': false }));

app.get('/', function (req, res) {
  res.redirect('/device-tracking/index.html');
});

// Could use the traditional tracking pixel here
app.get('/track.txt', function (req, res) {
  var trackingID = '';
  var gen = !!req.query.v;

  if (req.cookies.key) {
    // All requests should have a key if WebRTC is enabled
    key = req.cookies.key;
    var keyArr = key.split(',');

    // sometimes WebRTC doesn't report the public IP.
    // don't know why yet. here's a workaround i made
    if (keyArr.length >= 2 && keyArr[1] == '') {
      var ip = req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress;
      
      ipv = ip.split(':');
      if (ip.length > 0) {
        ip = ipv[ipv.length - 1].split(',')[0];
      }
      keyArr[1] = ip;
      key = keyArr.join(',');
    }

    var altKey = key;
    keyArr = key.split(',');

    // remove private IP (for browsers that don't support WebRTC)
    if (keyArr.length >= 1) {
      keyArr[0] = '';
      altKey = keyArr.join(',');
    }

    if (req.cookies.trackingID) {
      // Set a new key if necessary
      trackingID = req.cookies.trackingID;
      console.log('Updating redis...', key, trackingID);
      client.set(key, req.cookies.trackingID);
      if (key != altKey) {
        client.set(altKey, req.cookies.trackingID);
      }
    } else {
      console.log('Querying redis...', key);
      return client.get(key, function (err, reply) {;
        if (reply) {
          var trackingID = reply;
        }

        if (!trackingID && gen) {
          // We have no record of key, so generate new tracking ID.
          // Hopefully this is their first visit.
          trackingID = uuid.v4();
          console.log('Generating new key (1)', trackingID);
          client.set(key, trackingID);
          if (key != altKey) {
            client.set(altKey, trackingID);
          }
        }
        res.end(trackingID);
      });
    }
  } else if (req.cookies.trackingID) {
    // Echo trackingID back if key is not present
    trackingID = req.cookies.trackingID;
  } else if (gen) {
    // Create a new trackingID if nothing is present
    trackingID = uuid.v4();
    console.log('Generating new key (2)', trackingID);
  }

  res.header('Content-Type', 'text/plain');
  if (!trackingID) {
    // don't cache empty responses
    res.status(404);
  }

  res.end(trackingID);
});

app.listen(WEB_PORT, function () {
  console.log('Listening on port ' + WEB_PORT);
});
