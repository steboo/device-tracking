(function () {
  var fixedDevice = [
    'screen.height', screen.height,
    'screen.width', screen.width,
    'screen.colorDepth', screen.colorDepth, // not actually always 24
    'screen.pixelDepth', screen.pixelDepth // probably not actually always 24
  ];

  var variableDevice = [
    'screen.brightness', screen.brightness,
    'screen.mozBrightness', screen.mozBrightness,
    'screen.orientation', screen.orientation ? (screen.orientation.type || screen.mozOrientation) : undefined,
    'screen.top', screen.top,
    'screen.left', screen.left
  ];

  /*
   * Very browser specific indicators
   *
   * navigator
   *    - appCodeName
   *    - appName
   *    - appVersion
   *    - buildID
   *    - mimeTypes
   *    - plugins
   *    - product
   *    - productSub
   *
   * Browser settings
   *
   * navigator
   *    - cookieEnabled
   *    - doNotTrack
   *    - language
   *    - languages
   *
   * navigator
   *    - battery || mozBattery
   *    - geolocation
   *    - oscpu
   *    - platform
   *    - userAgent
   *    - vibrate || mozVibrate
   * window
   *    - DeviceMotionEvent
   *    - DeviceOrientationEvent
   *    - orientation
   *
   *
   * What?
   *
   * navigator
   *    - mediaDevices
   *    - mozContacts
   *    - permissions
   *    - serviceWorker
   */
  var navProps = [
    'navigator.userAgent', navigator.userAgent,
    'navigator.battery', navigator.battery,
    'navigator.mozBattery', navigator.mozBattery,
    'navigator.vibrate', navigator.vibrate,
    'navigator.mozVibrate', navigator.mozVibrate,
    'navigator.connection', navigator.connection,
    'navigator.geolocation', navigator.geolocation,
    'navigator.language', navigator.language,
    'navigator.languages', navigator.languages,
    'navigator.oscpu', navigator.oscpu,
    'navigator.platform', navigator.platform,
    'window.DeviceMotionEvent', window.DeviceMotionEvent,
    'window.DeviceOrientationEvent', window.DeviceOrientationEvent
  ];

  var dt, dd, dl = document.createElement('dl');
  for (var i = 0; i < fixedDevice.length; i += 2) {
    dt = document.createElement('dt');
    dt.textContent = fixedDevice[i];
    dd = document.createElement('dd');
    dd.textContent = fixedDevice[i+1];
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  document.getElementsByTagName('main')[0].appendChild(dl);

  dl = document.createElement('dl');
  for (var i = 0; i < variableDevice.length; i += 2) {
    dt = document.createElement('dt');
    dt.textContent = variableDevice[i];
    dd = document.createElement('dd');
    dd.textContent = variableDevice[i+1];
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  document.getElementsByTagName('main')[0].appendChild(dl);

  dl = document.createElement('dl');
  for (var i = 0; i < navProps.length; i += 2) {
    dt = document.createElement('dt');
    dt.textContent = navProps[i];
    dd = document.createElement('dd');
    dd.textContent = navProps[i+1];
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  document.getElementsByTagName('main')[0].appendChild(dl);

  function writeCookie(key, value) {
    var date = new Date();
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

    // If not found, return undefined.
  }

  function deleteCookie(key) {
    // hah!
    document.cookie = key + '=;expires=Thu, 01 Jan 1970 00:00:01 GMT';
  }

  var support = {
  };

  function storageAvailable(type) {
    try {
      var storage = window[type],
        x = '__test__';
      storage.setItem(x, x);
      storage.removeItem(x);
      return true;
    } catch (e) {
      return false;
    }
  }

  support.localStorage = storageAvailable('localStorage');
  support.sessionStorage = storageAvailable('sessionStorage');
  support.fileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
  support.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  support.flash = document.SharedObjects || window.SharedObjects;

  function writeStorage(type, key, value) {
    if (support[type]) {
      window[type].setItem(key, value);
    }
  }

  function readStorage(type, key, value) {
    if (support[type]) {
      return window[type].getItem(key);
    }
  }

  function fileErrorHandler(fileErr) {
      console.error('Error', fileErr);
  }

  function writeFile(key, value) {
    if (support.fileSystem) {
      var rfs = support.fileSystem;
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
      console.error('Error', fileErr);
      cb(null);
    }

    if (support.fileSystem) {
      var rfs = support.fileSystem;
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
    if (support.indexedDB) {
      var indexedDB = support.indexedDB;
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
          e.currentTarget.result.createObjectStore(that.db_store_name, { keyPath: 'key' });
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
    if (support.indexedDB) {
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
    if (support.indexedDB) {
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
  var silverlightReady = false;
  window.silverlightLoaded = function (sender, args) {
    silverlight = sender.getHost();
    silverlightReady = true;
  };

  window.silverlightError = function (sender, args) {
    var appSource = '';

    if (sender) {
      appSource = sender.getHost().Source;
    }

    var errorType = args.ErrorType;
    var errorCode = args.ErrorCode;

    if (errorType == "ImageError" || 
      errorType == "MediaError") {
      return;
    }

    var errMsg = "Unhandled Error in Silverlight Application " 
      + appSource + "\n";

    errMsg += "Code: " + errorCode + "    \n";
    errMsg += "Category: " + errorType + "       \n";
    errMsg += "Message: " + args.ErrorMessage + "     \n";

    if (errorType == "ParserError") {
      errMsg += "File: " + args.xamlFile + "     \n";
      errMsg += "Line: " + args.lineNumber + "     \n";
      errMsg += "Position: " + args.charPosition + "     \n";
    } else if (errorType == "RuntimeError") {
      if (args.lineNumber != 0) {
        errMsg += "Line: " + args.lineNumber + "     \n";
        errMsg += "Position: " + args.charPosition + 
        "     \n";
      }
      errMsg += "MethodName: " + args.methodName + "     \n";
    }

  };


  function readFlashSharedObject(key, count, cb) {
    if (arguments.length == 2) {
      cb = count;
      count = 0;
    }

    if (support.flash) {
      if (!support.flash.read) {
        if (count++ > 20) {
          return cb();
        }

        setTimeout(readFlashSharedObject.bind(this, key, count, cb), 100);
      } else {
        var val = support.flash.read(key);
        cb(val);
      }
    } else {
      cb();
    }
  }

  function writeFlashSharedObject(key, value, cb) {
    if (support.flash) {
      if (!support.flash.write) {
        setTimeout(writeFlashSharedObject.bind(this, key, value, cb), 100);
      } else {
        support.flash.write(key, value);
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

          readFlashSharedObject(key, cb);
        });
      });
    });
  }

  function writeAllTheThings(key, value, cb) {
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

  var browserIdentifier = 'tracking_time';
  var dlEl, ddEl, dtEl;

  dlEl = document.createElement('dl');

  dtEl = document.createElement('dt');
  dtEl.textContent = 'Cookie';
  dlEl.appendChild(dtEl);
  ddEl = document.createElement('dd');
  var cookieVal = readCookie(browserIdentifier);
  ddEl.textContent = cookieVal ? cookieVal : '';
  dlEl.appendChild(ddEl);

  dtEl = document.createElement('dt');
  dtEl.textContent = 'LocalStorage';
  dlEl.appendChild(dtEl);
  ddEl = document.createElement('dd');
  ddEl.textContent = readStorage('localStorage', browserIdentifier);
  dlEl.appendChild(ddEl);

  dtEl = document.createElement('dt');
  dtEl.textContent = 'SessionStorage';
  dlEl.appendChild(dtEl);
  ddEl = document.createElement('dd');
  ddEl.textContent = readStorage('sessionStorage', browserIdentifier);
  dlEl.appendChild(ddEl);


  readFile(browserIdentifier, function (val) {
    var dtEl = document.createElement('dt');
    dtEl.textContent = 'File';
    dlEl.appendChild(dtEl);
    var ddEl = document.createElement('dd');
    ddEl.textContent = val;
    dlEl.appendChild(ddEl);
  });

  readIndexedDB(browserIdentifier, function (val) {
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
        ddEl.textContent = silverlight.Content.Storage.ReadIsolatedStorage(browserIdentifier);
      } catch (e) {
        console.error(e);
      }
      dlEl.appendChild(ddEl);
    }
  }

  readFlashSharedObject(browserIdentifier, function (val) {
    var dtEl = document.createElement('dt');
    dtEl.textContent = 'Flash Shared Object';
    dlEl.appendChild(dtEl);
    var ddEl = document.createElement('dd');
    ddEl.textContent = val;
    dlEl.appendChild(ddEl);
  });

  displaySilverlightValue();

  document.getElementsByTagName('main')[0].appendChild(dlEl);

  var trackingValue;

  readAllTheThings(browserIdentifier, function (val) {
    console.log('Read values', val);
    if (!val) {
      var today = new Date();
      val = today.toISOString(); 
    }

    trackingValue = val;

    var pEl = document.createElement('p');
    pEl.textContent = 'Your device ID is ' + val;
    document.getElementsByTagName('main')[0].appendChild(pEl);

    writeAllTheThings(browserIdentifier, val, function () {});
  });

  window.addEventListener('ipready', function (e) {
    console.log(e.detail);
  }, false);

  // Better close this window before clearing cookies ;)
  var unload = function () {
    if (trackingValue) {
      writeCookie(browserIdentifier, trackingValue);
    }
  };

  window.addEventListener('beforeunload', unload, false);
  window.addEventListener('unload', unload, false);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).then(function () {
      if (navigator.serviceWorker.controller) {
        // cached
      }
    }).catch(function (err) {
      // TODO: https????
      console.warn(err);
    });
  } else {
    var pEl = document.createElement('p');
    pEl.textContent = 'Service workers are not supported in this browser.';
  }
  
})();
