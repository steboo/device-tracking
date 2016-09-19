(function () {
  function writeCookie(key, value) {
    var date = new Date();
    // a year is as reasonable a date as any
    date.setDate(date.getYear() + 1);
    document.cookie = key + '=' + value + ';max-age=31536000;expires=' + date.toUTCString();
  }

  function readCookie(key) {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var tokens = cookies[i].split('=');
      if (tokens[0] == key) {
        return tokens[1];
      }
    }
  }

  function storageAvailable(type) {
    // Ugly try is necessary for some scenarios in Firefox
    try {
      var storage = window[type],
        x = '__test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return storage;
    } catch (e) {
    }
  }

  // Feature support table
  var feature = {
    localStorage: storageAvailable('localStorage'),
    sessionStorage: storageAvailable('sessionStorage'),
    fileSystem: window.requestFileSystem || window.webkitRequestFileSystem, // Chrome and FF 50+
    indexedDB: window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,
    flash: document.SharedObjects || window.SharedObjects,
    webRTC: window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection
  };

  var trackingID,
    key,
    readComplete = false,
    ipComplete = false;

  var ip = {
    ipv4_private: [],
    ipv4_public: [],
    ipv6: []
  };

  function getDeviceKey() {
    var keyArr = [
      '', // local ip(s)
      '', // public ip(s)
      '', // screen width
      '', // screen height
      ''  // os
    ];

    // I am having problems on Android getting consistent screen sizes.
    // This problem may be present across all mobile devices (not sure yet).
    if (!navigator.userAgent || !navigator.userAgent.match(/(?:Android|BlackBerry|IEMobile|iPhone|iPad|iPod|Kindle Fire|Opera Mini|WPDesktop)/i)) {
      keyArr[2] = String(screen.width);
      keyArr[3] = String(screen.height);
    }

    // These strings and regular expressions are from http://stackoverflow.com/a/18706818
    // OS adds a little more entropy
    var clientStrings = [
      {s:'Windows 10', r:/(Windows 10.0|Windows NT 10.0)/},
      {s:'Windows 8.1', r:/(Windows 8.1|Windows NT 6.3)/},
      {s:'Windows 8', r:/(Windows 8|Windows NT 6.2)/},
      {s:'Windows 7', r:/(Windows 7|Windows NT 6.1)/},
      {s:'Windows Vista', r:/Windows NT 6.0/},
      {s:'Windows Server 2003', r:/Windows NT 5.2/},
      {s:'Windows XP', r:/(Windows NT 5.1|Windows XP)/},
      {s:'Windows 2000', r:/(Windows NT 5.0|Windows 2000)/},
      {s:'Windows ME', r:/(Win 9x 4.90|Windows ME)/},
      {s:'Windows 98', r:/(Windows 98|Win98)/},
      {s:'Windows 95', r:/(Windows 95|Win95|Windows_95)/},
      {s:'Windows NT 4.0', r:/(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/},
      {s:'Windows CE', r:/Windows CE/},
      {s:'Windows 3.11', r:/Win16/},
      {s:'Android', r:/Android/},
      {s:'Open BSD', r:/OpenBSD/},
      {s:'Sun OS', r:/SunOS/},
      {s:'Linux', r:/(Linux|X11)/},
      {s:'iOS', r:/(iPhone|iPad|iPod)/},
      {s:'Mac OS X', r:/Mac OS X/},
      {s:'Mac OS', r:/(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/},
      {s:'QNX', r:/QNX/},
      {s:'UNIX', r:/UNIX/},
      {s:'BeOS', r:/BeOS/},
      {s:'OS/2', r:/OS\/2/}
    ];

    for (var i = 0; i < clientStrings.length; i++) {
      if (clientStrings[i].r.test(navigator.userAgent)) {
        keyArr[4] = clientStrings[i].s;
        break;
      }
    }

    // TODO: add fonts?

    function handleIPs(ip, keyArr) {
      // sort in case there are multiple Ps
      ip.ipv4_private.sort();
      ip.ipv4_public.sort();

      // uniq w/ side effect
      if (ip.ipv4_private.length > 1) {
        ip.ipv4_private.reduce(function (p, c, i, a) {
          if (p == c) {
            a.splice(i, 1);
          }
        });
      }

      if (ip.ipv4_public.length > 1) {
        ip.ipv4_public.reduce(function (p, c, i, a) {
          if (p == c) {
            a.splice(i, 1);
          }
        });
      }

      keyArr[0] = ip.ipv4_private.join('|');
      keyArr[1] = ip.ipv4_public.join('|');
      key = keyArr.join(',');
      ipComplete = true;

      if (readComplete) {
        sendUpdateRequest(key, trackingID);
      }
    }


    if (feature.webRTC) {
      var pc = new feature.webRTC({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' }
        ],
        iceTransportPolicy: 'all',
        rtcpMuxPolicy: 'require'
      }, {
        optional: [{
          RtpDataChannels: true
        }]
      });

      pc.onicecandidate = function (e) {
        if (e.candidate) {
          var matches = e.candidate.candidate.match(/(?:\d+\.){3}\d+/);
          if (matches) {
            // private IPs, including link-local addresses
            if (matches[0].match(/(?:10\.|172\.(?:1[6-9]|2\d|3[0-l])\.|192\.168\.|169\.254\.)/)) {
              // private
              ip.ipv4_private.push(matches[0]);
            } else {
              // public
              // Note: webRTC does not always return a public IP address
              ip.ipv4_public.push(matches[0]);
            }
          } else {
            matches = e.candidate.candidate.match(/\b(?:[a-f0-9]+\:)+[a-f0-9]+\b/gi);
            if (matches) {
              ip.ipv6.push(matches[0]);
            }
          }
        } else {
          // Done finding candidates
          if (!ipComplete) {
            ipComplete = true;
            handleIPs(ip, keyArr);
          }
        }
      };

      // Sometimes the done event is never fired.
      setTimeout(function() {
        if (!ipComplete) {
          ipComplete = true;
          handleIPs(ip, keyArr);
        }
      }, 2000);

      pc.createDataChannel('');

      pc.createOffer(function (result) {
        pc.setLocalDescription(result, function () {
        }, function (err) {
          console.warn('setLocalDescription error', err);
        });
      }, function (err) {
        console.warn('createOffer error', err);
      });
    } else {
      key = keyArr.join(',');
      ipComplete = true;
    }
  }

  getDeviceKey();

  function writeStorage(type, key, value) {
    if (feature[type]) {
      window[type].setItem(key, value);
    }
  }

  function readStorage(type, key, value) {
    if (feature[type]) {
      return window[type].getItem(key);
    }
  }

  function fileErrorHandler(fileErr) {
      console.error('Error', fileErr);
  }

  function writeFile(key, value) {
    if (feature.fileSystem) {
      var rfs = feature.fileSystem;
      // TEMPORARY doesn't prompt
      rfs(window.TEMPORARY, 256, function (fs) {
        fs.root.getFile(key + '.txt', { create: true }, function (fileEntry) {
          fileEntry.createWriter(function (fileWriter) {
            var blob = new Blob([value], { type: 'text/plain' });
            fileWriter.write(blob);
          }, fileErrorHandler);
        }, fileErrorHandler);
      }, fileErrorHandler);
    }
  }

  function readFile(key, cb) {
    function fileErrorHandler(fileErr) {
      if (!fileErr || fileErr.name != 'NotFoundError') {
        console.error('Error', fileErr);
      }

      cb(null);
    }

    if (feature.fileSystem) {
      var rfs = feature.fileSystem;
      rfs(window.TEMPORARY, 256, function (fs) {
        fs.root.getFile(key + '.txt', {}, function (fileEntry) {
          fileEntry.file(function (file) {
            var reader = new FileReader();

            reader.onloadend = function (e) {
              cb(this.result);
            };
              
            reader.readAsText(file);
          }, fileErrorHandler);
        }, fileErrorHandler);
      }, fileErrorHandler);
    } else {
      cb(null);
    }
  }

  function IDB(name, version, store_name) {
    this.db = null;
    this.db_name = name;
    this.db_version = version;
    this.db_store_name = store_name;
  }

  IDB.prototype.open = function(cb) {
    var that = this;
    if (feature.indexedDB) {
      var indexedDB = feature.indexedDB;
      var request = indexedDB.open(this.db_name, this.db_version);

      request.onsuccess = function (e) {
        that.db = this.result;
        cb(that.db);
      };
      
      request.onerror = function (e) {
        console.error(e);
        cb(null);
      };

      request.onupgradeneeded = function (e) {
        if (!e.target.result.objectStoreNames.contains(that.db_store_name)) {
          e.currentTarget.result.createObjectStore(that.db_store_name, {
            keyPath: 'key'
          });
        }
      };
    }
  };

  IDB.prototype.getObjectStore = function (mode) {
    if (this.db) {
      var transaction = this.db.transaction(this.db_store_name, mode);
      return transaction.objectStore(this.db_store_name);
    }
  };

  var idb = new IDB('tracking', 1, 'tracking');

  function readIndexedDB(key, cb) {
    if (feature.indexedDB) {
      idb.open(function (db) {
        if (!db) {
          return;
        }

        var store = idb.getObjectStore('readonly');
        var request = store.get(key);

        request.onsuccess = function (e) {
          var value = e.target.result;
          if (value) {
            cb(value.value);
          } else {
            cb(null);
          }
        };

        request.onerror = function (e) {
          console.error(e);
        };
      });
    }
  }

  function writeIndexedDB(key, value, cb) {
    if (feature.indexedDB) {
      idb.open(function (db) {
        if (!db) {
          return;
        }

        var store = idb.getObjectStore('readwrite');
        try {
          var request = store.put({
            key: key,
            value: value
          });

          request.onsuccess = function (e) {
            cb();
          };

          request.onerror = function (e) {
            console.error(e);
            cb();
          };
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  var silverlight = null;
  window.silverlightLoaded = function (sender, args) {
    silverlight = sender.getHost();
    // TODO: emit event
  };

  window.silverlightError = function (sender, args) {
    var errorType = args.ErrorType;
    var errorCode = args.ErrorCode;

    console.error('Silverlight error: ' + errorType + ', ' + errorCode);
  };


  function readFlashSharedObject(key, count, cb) {
    //statusEl.textContent = 'Please wait. Loading Flash shared objects...';
    statusEl.textContent = 'Please wait. Loading...';
    if (arguments.length == 2) {
      cb = count;
      count = 0;
    }

    if (feature.flash) {
      if (!feature.flash.read) {
        if (count++ > 20) {
          return cb();
        }

        setTimeout(readFlashSharedObject.bind(this, key, count, cb), 100);
      } else {
        var val = feature.flash.read(key);
        cb(val);
      }
    } else {
      cb();
    }
  }

  function writeFlashSharedObject(key, value, cb) {
    if (feature.flash) {
      if (!feature.flash.write) {
        setTimeout(writeFlashSharedObject.bind(this, key, value, cb), 100);
      } else {
        feature.flash.write(key, value);
        cb();
      }
    } else {
      cb();
    }
  }

  function readAllTheThings(key, cb) {
    var val;

    val = readCookie(key);
    if (val) {
      return cb(val);
    }

    val = readStorage('localStorage', key);
    if (val) {
      return cb(val);
    }

    val = readStorage('sessionStorage', key);
    if (val) {
      return cb(val);
    }

    function readIsolatedStorage(key, count, cb) {
      //statusEl.textContent = 'Please wait. Loading Silverlight Isolated Storage...';
      statusEl.textContent = 'Please wait. Loading...';
      if (arguments.length == 2) {
        cb = count;
        count = 0;
      }

      if (!silverlight) {
        if (count++ > 20) {
          return cb();
        }

        setTimeout(readIsolatedStorage.bind(this, key, count, cb), 100);
      } else {
        var val;
        try {
          val = silverlight.Content.Storage.ReadIsolatedStorage(key);
        } catch (e) {}
        cb(val);
      }
    }

    // sorry.
    readFile(key, function (val) {
      if (val) {
        return cb(val);
      }

      readIndexedDB(key, function (val) {
        if (val) {
          return cb(val);
        }

        readIsolatedStorage(key, function (val) {
          if (val) {
            return cb(val);
          }

          readFlashSharedObject(key, function (val) {
            if (val) {
              return cb(val);
            }

            readCacheableRequest(function (xhr, val) {
              return cb(val);
            });
          });
        });
      });
    });
  }

  function writeAllTheThings(key, value, cb) {
    if (!key || !value) {
      cb();
    }

    writeCookie(key, value);
    writeStorage('localStorage', key, value);
    writeStorage('sessionStorage', key, value);
    writeFile(key, value);

    function writeIsolatedStorage(key, value, count, cb) {
      if (arguments.length == 3) {
        cb = count;
        count = 0;
      }

      if (!silverlight) {
        if (count++ > 20) {
          return cb();
        }

        setTimeout(writeIsolatedStorage.bind(this, key, value, cb), 100);
      } else {
        var val = silverlight.Content.Storage.WriteIsolatedStorage(key, value);
        cb(val);
      }
    }

    writeIndexedDB(key, value, function () {
      writeFlashSharedObject(key, value, function () {
        writeIsolatedStorage(key, value, cb);
      });
    });
  }

  var mainEl = document.getElementsByTagName('main')[0];
  var statusEl = document.createElement('p');
  statusEl.classname = 'status';
  statusEl.textContent = 'Please wait. Loading...';
  mainEl.appendChild(statusEl);

  var trackName = 'trackingID';

  function debugPrint() {
    var dlEl, ddEl, dtEl;

    dlEl = document.createElement('dl');

    dtEl = document.createElement('dt');
    dtEl.textContent = 'Cookie';
    dlEl.appendChild(dtEl);
    ddEl = document.createElement('dd');
    var cookieVal = readCookie(trackName);
    ddEl.textContent = typeof cookieVal == 'string' ? cookieVal : '';
    dlEl.appendChild(ddEl);

    dtEl = document.createElement('dt');
    dtEl.textContent = 'LocalStorage';
    dlEl.appendChild(dtEl);
    ddEl = document.createElement('dd');
    ddEl.textContent = readStorage('localStorage', trackName);
    dlEl.appendChild(ddEl);

    dtEl = document.createElement('dt');
    dtEl.textContent = 'SessionStorage';
    dlEl.appendChild(dtEl);
    ddEl = document.createElement('dd');
    ddEl.textContent = readStorage('sessionStorage', trackName);
    dlEl.appendChild(ddEl);

    readFile(trackName, function (val) {
      var dtEl = document.createElement('dt');
      dtEl.textContent = 'File';
      dlEl.appendChild(dtEl);
      var ddEl = document.createElement('dd');
      ddEl.textContent = val;
      dlEl.appendChild(ddEl);
    });

    readIndexedDB(trackName, function (val) {
      var dtEl = document.createElement('dt');
      dtEl.textContent = 'IndexedDB';
      dlEl.appendChild(dtEl);
      var ddEl = document.createElement('dd');
      ddEl.textContent = val;
      dlEl.appendChild(ddEl);
    });

    function displaySilverlightValue(count) {
      if (!count) {
        count = 0;
      }

      if (!silverlight) {
        if (count++ > 20) {
          return;
        }
        setTimeout(displaySilverlightValue.bind(this, count), 100);
      } else {
        var dtEl = document.createElement('dt');
        dtEl.textContent = 'Silverlight Isolated Storage';
        dlEl.appendChild(dtEl);
        var ddEl = document.createElement('dd');
        try {
          ddEl.textContent = silverlight.Content.Storage.ReadIsolatedStorage(trackName);
        } catch (e) {
          console.error(e);
        }
        dlEl.appendChild(ddEl);
      }
    }

    readFlashSharedObject(trackName, function (val) {
      var dtEl = document.createElement('dt');
      dtEl.textContent = 'Flash Shared Object';
      dlEl.appendChild(dtEl);
      var ddEl = document.createElement('dd');
      ddEl.textContent = val;
      dlEl.appendChild(ddEl);
    });

    readCacheableRequest(function (xhr, val) {
      var dtEl = document.createElement('dt');
      dtEl.textContent = 'Cache';
      dlEl.appendChild(dtEl);
      var ddEl = document.createElement('dd');
      ddEl.textContent = val;
      dlEl.appendChild(ddEl);
    });

    displaySilverlightValue();

    mainEl.appendChild(dlEl);
  }

  //debugPrint();

  readAllTheThings(trackName, function (value) {
    readComplete = true;
    trackingID = value;
    console.log('According to the browser storage mechanisms, the trackingID is', trackingID);

    if (ipComplete) {
      sendUpdateRequest(key, trackingID);
    } else {
      //statusEl.textContent = 'Please wait. Loading WebRTC IP addresses...';
      statusEl.textContent = 'Please wait. Loading...';
    }
  });

  var trackingEl = document.createElement('p');
  trackingEl.classname = 'useful';
  mainEl.appendChild(trackingEl);

  function ajax(url, success, failure) {
    console.log('XHMHttpRequest with ' + url, key, trackingID);
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        if (xhr.status < 400) {
          success(xhr);
        } else {
          failure(xhr);
        }
      }
    };

    xhr.open('GET', url);
    xhr.send();
  }

  function readCacheableRequest(cb) {
    ajax('track.txt',
      function (xhr) {
        cb(xhr, xhr.responseText);
      },
      function (xhr) {
        console.warn('XMLHttpRequest error', xhr);
        cb(xhr);
      }
    );
  }

  function writeCacheableRequest(trackingID, cb) {
    // TODO: figure out how to bypass the service worker cache for one request
    if ('ApplicationCache' in window && window.ApplicationCache.swapCache) {
      ApplicationCache.swapCache();
    }

    ajax('track.txt',
      function (xhr) {
        cb(xhr, xhr.responseText);
      },
      function (xhr) {
        console.warn('XMLHttpRequest error', xhr);
        cb(xhr);
      }
    );
  }

  // We need to make one uncached request with data from the client JS every
  // page load in order to update the server-side database.
  function sendUpdateRequest(key, trackingID) {
    // no query params permitted due to app cache. Cookies instead.
    if (trackName && trackingID) {
      writeCookie(trackName, trackingID);
    }

    if (key) {
      writeCookie('key', key);
    }

    var today = new Date();
    ajax('track.txt?v=' + today.toISOString(),
      function (xhr) {
        if (xhr.responseText) {
          trackingID = xhr.responseText;
          trackingEl.textContent = 'Your device ID is ' + trackingID;
          writeCacheableRequest(trackingID, function () {});
        }

        statusEl.style = 'display: none;';
        writeAllTheThings(trackName, trackingID, function () {});
      },
      function (xhr) {
        console.error('XMLHttpRequest error', xhr);
        statusEl.textContent = 'Error.';
        writeAllTheThings(trackName, trackingID, function () {});
      }
    );
  }

  // Better close this tab before clearing cookies ;)
  var unload = function () {
    if (trackingID) {
      writeCookie(trackName, trackingID);
    }
  };

  window.addEventListener('beforeunload', unload, false);
  window.addEventListener('unload', unload, false);

  // Register service worker for caching
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then(function () {
      if (navigator.serviceWorker.controller) {
        // cached
      }
    }).catch(function (err) {
      console.warn(err);
    });
  }
})();
