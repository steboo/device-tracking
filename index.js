'use strict';
const express = require('express');
const cookieParser = require('cookie-parser');
const redis = require('redis');
const serveStatic = require('serve-static');
const uuid = require('node-uuid');

const WEB_PORT = 21215;
const REDIS_PORT = 22982;

const app = express();
const client = redis.createClient(REDIS_PORT);

app.use(cookieParser());

// Need /app_path to redirect to /app_path/. It wasn't an option to adjust the
// web server config on the current production host, so these gymnastics will
// do.
app.use(serveStatic('public', { index: false }));

app.get('/', (req, res) => {
  res.redirect('/device-tracking/index.html');
});

// Could use the traditional tracking pixel here
app.get('/track.txt', (req, res) => {
  const gen = !!req.query.v;
  let trackingID = '';

  if (req.cookies.key) {
    // All requests should have a device key
    let deviceKey = req.cookies.key;
    let keyArr = deviceKey.split(',');
    let altKey;

    // sometimes WebRTC doesn't report the public IP.
    // don't know why yet. here's a workaround i made
    if (keyArr.length >= 2 && keyArr[1] === '') {
      let ip = req.headers['x-forwarded-for'] ||
         req.connection.remoteAddress;
      const ipv = ip.split(':');

      if (ip.length > 0) {
        ip = ipv[ipv.length - 1].split(',')[0];
      }

      keyArr[1] = ip;
      deviceKey = keyArr.join(',');
    }

    altKey = deviceKey;
    keyArr = deviceKey.split(',');

    // remove private IP (for browsers that don't support WebRTC)
    if (keyArr.length >= 1) {
      keyArr[0] = '';
      altKey = keyArr.join(',');
    }

    if (req.cookies.trackingID) {
      // Set a new key if necessary
      trackingID = req.cookies.trackingID;
      console.log('Updating redis...', deviceKey, trackingID);
      client.set(deviceKey, req.cookies.trackingID);
      if (deviceKey !== altKey) {
        client.set(altKey, req.cookies.trackingID);
      }
    } else {
      console.log('Querying redis...', deviceKey);
      return client.get(deviceKey, (err, reply) => {
        if (reply) {
          trackingID = reply;
        }

        if (!trackingID && gen) {
          // We have no record of key, so generate new tracking ID.
          // Hopefully this is their first visit.
          trackingID = uuid.v4();
          console.log('Generating new tracking ID (1)', trackingID);
          client.set(deviceKey, trackingID);
          if (deviceKey !== altKey) {
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
    console.log('Generating new tracking ID (2)', trackingID);
  }

  res.header('Content-Type', 'text/plain');
  if (!trackingID) {
    // don't cache empty responses
    res.status(404);
  }

  res.end(trackingID);
});

app.listen(WEB_PORT, () => {
  console.log('Listening on port ', WEB_PORT);
});
