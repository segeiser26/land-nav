(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Theme (DAY / NVG)
  // ---------------------------------------------------------------
  var body = document.body;
  var btnDay = document.getElementById('btn-mode-day');
  var btnNvg = document.getElementById('btn-mode-nvg');

  function setTheme(theme) {
    body.setAttribute('data-theme', theme);
    btnDay.setAttribute('aria-pressed', String(theme === 'day'));
    btnNvg.setAttribute('aria-pressed', String(theme === 'nvg'));
    try { localStorage.setItem('landnav-theme', theme); } catch (e) { /* ignore */ }
  }

  btnDay.addEventListener('click', function () { setTheme('day'); });
  btnNvg.addEventListener('click', function () { setTheme('nvg'); });

  var savedTheme = null;
  try { savedTheme = localStorage.getItem('landnav-theme'); } catch (e) { /* ignore */ }
  if (savedTheme === 'day' || savedTheme === 'nvg') {
    setTheme(savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('nvg');
  }

  // ---------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------
  var tabButtons = document.querySelectorAll('.tab-btn');
  var tabPanels = {
    'tab-btn-convert': document.getElementById('tab-convert'),
    'tab-btn-raz': document.getElementById('tab-raz')
  };

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabButtons.forEach(function (b) { b.setAttribute('aria-selected', 'false'); });
      Object.keys(tabPanels).forEach(function (id) { tabPanels[id].classList.remove('active'); });
      btn.setAttribute('aria-selected', 'true');
      tabPanels[btn.id].classList.add('active');
    });
  });

  // ---------------------------------------------------------------
  // Grid precision segmented control (6-digit / 8-digit)
  // ---------------------------------------------------------------
  var precision = 4; // default 8-digit (4 digits per axis)
  var precisionBtns = document.querySelectorAll('.seg-btn[data-precision]');
  precisionBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      precisionBtns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      precision = parseInt(btn.getAttribute('data-precision'), 10);
    });
  });

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------

  function parseDecimal(str) {
    if (str === null || str === undefined) return NaN;
    var s = String(str).trim().replace(/[°]/g, '');
    return parseFloat(s);
  }

  // Renders an MGRS string into stenciled digit-cell groups:
  // ZONE+BAND | 100k SQUARE | EASTING digits | NORTHING digits
  function renderMgrsReadout(container, mgrsStr) {
    var parts = mgrsStr.split(' '); // [zoneBand, square, easting, northing]
    container.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'readout-cells';

    function group(text, cls) {
      var g = document.createElement('span');
      g.className = 'readout-group ' + cls;
      if (cls === 'zone' || cls === 'sq') {
        var cell = document.createElement('span');
        cell.className = 'readout-cell';
        cell.textContent = text;
        g.appendChild(cell);
      } else {
        text.split('').forEach(function (ch) {
          var cell = document.createElement('span');
          cell.className = 'readout-cell';
          cell.textContent = ch;
          g.appendChild(cell);
        });
      }
      return g;
    }

    wrap.appendChild(group(parts[0], 'zone'));
    wrap.appendChild(group(parts[1], 'sq'));
    wrap.appendChild(group(parts[2], 'e'));
    wrap.appendChild(group(parts[3], 'n'));
    container.appendChild(wrap);

    var copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-secondary';
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.style.padding = '6px 12px';
    copyBtn.style.fontSize = '11px';
    copyBtn.addEventListener('click', function () {
      var text = mgrsStr;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () { /* ignore */ });
      }
      copyBtn.textContent = 'Copied';
      setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1200);
    });
    container.appendChild(copyBtn);
  }

  // ---------------------------------------------------------------
  // Lat/Long -> MGRS
  // ---------------------------------------------------------------
  var llLat = document.getElementById('ll-lat');
  var llLon = document.getElementById('ll-lon');
  var llToMgrsReadout = document.getElementById('ll-to-mgrs-readout');
  var llToMgrsError = document.getElementById('ll-to-mgrs-error');

  function doLlToMgrs() {
    llToMgrsError.textContent = '';
    var lat = parseDecimal(llLat.value);
    var lon = parseDecimal(llLon.value);

    if (isNaN(lat) || isNaN(lon)) {
      llToMgrsError.textContent = 'Enter numeric latitude and longitude in decimal degrees.';
      return;
    }
    if (lat < -80 || lat > 84) {
      llToMgrsError.textContent = 'MGRS covers 80°S to 84°N. This latitude falls in the UPS polar region, which this tool does not support.';
      return;
    }
    if (lon < -180 || lon > 180) {
      llToMgrsError.textContent = 'Longitude must be between -180 and 180.';
      return;
    }

    try {
      var mgrs = GEO.llToMgrs(lat, lon, precision);
      renderMgrsReadout(llToMgrsReadout, mgrs);
    } catch (e) {
      llToMgrsError.textContent = e.message || 'Conversion failed.';
    }
  }

  document.getElementById('btn-ll-to-mgrs').addEventListener('click', doLlToMgrs);
  [llLat, llLon].forEach(function (el) {
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLlToMgrs(); });
  });

  // ---------------------------------------------------------------
  // MGRS -> Lat/Long
  // ---------------------------------------------------------------
  var mgrsIn = document.getElementById('mgrs-in');
  var mgrsToLlReadout = document.getElementById('mgrs-to-ll-readout');
  var mgrsOutLat = document.getElementById('mgrs-out-lat');
  var mgrsOutLon = document.getElementById('mgrs-out-lon');
  var mgrsToLlError = document.getElementById('mgrs-to-ll-error');

  function doMgrsToLl() {
    mgrsToLlError.textContent = '';
    mgrsToLlReadout.style.display = 'none';
    try {
      var ll = GEO.mgrsToLl(mgrsIn.value);
      mgrsOutLat.textContent = ll.lat.toFixed(6) + '°';
      mgrsOutLon.textContent = ll.lon.toFixed(6) + '°';
      mgrsToLlReadout.style.display = '';
    } catch (e) {
      mgrsToLlError.textContent = e.message || 'Could not parse that MGRS grid.';
    }
  }

  document.getElementById('btn-mgrs-to-ll').addEventListener('click', doMgrsToLl);
  mgrsIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') doMgrsToLl(); });

  // ---------------------------------------------------------------
  // Range & Azimuth
  // ---------------------------------------------------------------
  var razA = document.getElementById('raz-a');
  var razB = document.getElementById('raz-b');
  var razDecl = document.getElementById('raz-decl');
  var razError = document.getElementById('raz-error');
  var razResultsCard = document.getElementById('raz-results-card');
  var razDistanceEl = document.getElementById('raz-distance');
  var razAzimuthEl = document.getElementById('raz-azimuth');
  var razBackAzimuthEl = document.getElementById('raz-back-azimuth');
  var razMagBox = document.getElementById('raz-mag-box');
  var razMagBackBox = document.getElementById('raz-mag-back-box');
  var razMagAzimuthEl = document.getElementById('raz-mag-azimuth');
  var razMagBackAzimuthEl = document.getElementById('raz-mag-back-azimuth');
  var dialNeedle = document.getElementById('dial-needle');
  var dialNeedleMag = document.getElementById('dial-needle-mag');
  var dialAzValue = document.getElementById('dial-az-value');
  var dialLegend = document.getElementById('dial-legend');

  var MGRS_RE = /^\d{1,2}\s*[C-HJ-NP-X]\s*[A-HJ-NP-Z]{2}\s*\d+/i;

  function parsePoint(raw) {
    var str = (raw || '').trim();
    if (!str) throw new Error('Enter a coordinate.');

    if (MGRS_RE.test(str)) {
      return GEO.mgrsToLl(str);
    }

    // lat, lon (comma or whitespace separated decimal degrees)
    var pieces = str.split(/[,\s]+/).filter(Boolean);
    if (pieces.length === 2) {
      var lat = parseDecimal(pieces[0]);
      var lon = parseDecimal(pieces[1]);
      if (!isNaN(lat) && !isNaN(lon)) {
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          throw new Error('Latitude must be -90..90 and longitude -180..180.');
        }
        return { lat: lat, lon: lon };
      }
    }

    throw new Error('Could not read "' + raw + '" as an MGRS grid or "lat, lon" pair.');
  }

  var lastResult = null; // { distanceMeters, azimuth, azimuthBack }
  var distUnit = 'm';
  var azUnit = 'deg';

  function formatDistance(meters) {
    if (distUnit === 'km') return (meters / 1000).toFixed(3) + ' km';
    if (distUnit === 'mi') return (meters / 1609.344).toFixed(3) + ' mi';
    return meters.toFixed(1) + ' m';
  }

  function formatAzimuth(deg) {
    if (azUnit === 'mil') return Math.round(deg * (6400 / 360)) + ' mils';
    return deg.toFixed(1) + '°';
  }

  function norm360(deg) { return ((deg % 360) + 360) % 360; }

  function renderResults() {
    if (!lastResult) return;
    razDistanceEl.textContent = formatDistance(lastResult.distanceMeters);
    razAzimuthEl.textContent = formatAzimuth(lastResult.azimuth);
    razBackAzimuthEl.textContent = formatAzimuth(lastResult.azimuthBack);
    dialAzValue.textContent = formatAzimuth(lastResult.azimuth);
    dialNeedle.setAttribute('transform', 'rotate(' + lastResult.azimuth + ' 100 100)');

    var hasDecl = typeof lastResult.declination === 'number' && !isNaN(lastResult.declination);
    if (hasDecl) {
      // Magnetic azimuth = grid/true azimuth minus easterly declination
      // (a positive/East declination is subtracted; negative/West adds).
      var magAz = norm360(lastResult.azimuth - lastResult.declination);
      var magBackAz = norm360(lastResult.azimuthBack - lastResult.declination);
      razMagAzimuthEl.textContent = formatAzimuth(magAz);
      razMagBackAzimuthEl.textContent = formatAzimuth(magBackAz);
      razMagBox.style.display = '';
      razMagBackBox.style.display = '';
      dialNeedleMag.style.display = '';
      dialLegend.style.display = '';
      dialNeedleMag.setAttribute('transform', 'rotate(' + magAz + ' 100 100)');
    } else {
      razMagBox.style.display = 'none';
      razMagBackBox.style.display = 'none';
      dialNeedleMag.style.display = 'none';
      dialLegend.style.display = 'none';
    }
  }

  function doCalcRaz() {
    razError.textContent = '';
    try {
      var a = parsePoint(razA.value);
      var b = parsePoint(razB.value);
      var r = GEO.vincentyInverse(a.lat, a.lon, b.lat, b.lon);
      var declRaw = razDecl.value.trim();
      var decl = declRaw === '' ? NaN : parseDecimal(declRaw);
      if (declRaw !== '' && isNaN(decl)) {
        throw new Error('Declination must be a number (e.g. -8.5 or 6.2), or left blank.');
      }
      lastResult = { distanceMeters: r.distance, azimuth: r.azimuth, azimuthBack: r.azimuthBack, declination: decl };
      renderResults();
    } catch (e) {
      razError.textContent = e.message || 'Could not calculate range & azimuth.';
    }
  }

  document.getElementById('btn-calc-raz').addEventListener('click', doCalcRaz);
  [razA, razB, razDecl].forEach(function (el) {
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter') doCalcRaz(); });
  });
  razDecl.addEventListener('input', function () {
    if (!lastResult) return;
    var declRaw = razDecl.value.trim();
    lastResult.declination = declRaw === '' ? NaN : parseDecimal(declRaw);
    renderResults();
  });

  document.querySelectorAll('.seg-btn[data-dist-unit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.seg-btn[data-dist-unit]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      distUnit = btn.getAttribute('data-dist-unit');
      renderResults();
    });
  });

  document.querySelectorAll('.seg-btn[data-az-unit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.seg-btn[data-az-unit]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
      btn.setAttribute('aria-pressed', 'true');
      azUnit = btn.getAttribute('data-az-unit');
      renderResults();
    });
  });

})();
