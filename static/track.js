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
    'screen.orientation', screen.orientation.type || screen.mozOrientation,
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
    'navigator.connection', navigator.connection,
    'navigator.doNotTrack', navigator.doNotTrack,
    'navigator.geolocation', navigator.geolocation,
    'navigator.cookieEnabled', navigator.cookieEnabled,
    'navigator.language', navigator.language,
    'navigator.onLine', navigator.onLine,
    'navigator.platform', navigator.platform
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

  function createCookie(key, value) {
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

  var val = readCookie('tracking_time');

  if (!val) {
    var today = new Date();
    createCookie('tracking_time', today.toISOString()); 
  }

  window.addEventListener('ipready', function (e) {
    console.log(e.detail);
  }, false);

})();
