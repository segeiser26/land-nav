/*
 * geo.js — WGS84 Lat/Lon <-> UTM <-> MGRS conversions, plus geodesic
 * distance/azimuth (Vincenty inverse).
 *
 * Implements the standard closed-form transverse Mercator series
 * (Snyder, "Map Projections — A Working Manual", USGS Professional
 * Paper 1395) for the LL<->UTM steps, and the standard MGRS 100,000-m
 * square identification scheme (NGA/USNG) for the UTM<->MGRS steps.
 * These are the same public formulas used by essentially every open
 * MGRS library; this is an independent implementation for this tool.
 *
 * No external dependencies. Exposes a single global: GEO
 */
(function (global) {
  'use strict';

  // ---- WGS84 ellipsoid constants ----------------------------------
  var A = 6378137.0;                // semi-major axis (m)
  var F = 1 / 298.257223563;        // flattening
  var ECC_SQ = F * (2 - F);         // first eccentricity squared
  var K0 = 0.9996;                  // UTM scale factor

  function toRad(d) { return (d * Math.PI) / 180; }
  function toDeg(r) { return (r * 180) / Math.PI; }

  // ---- UTM zone / latitude band helpers ----------------------------

  var LAT_BANDS = 'CDEFGHJKLMNPQRSTUVWX'; // no I or O, spans 80S..84N in 8deg bands (X is 12deg)

  function utmZoneNumber(lat, lon) {
    var zone = Math.floor((lon + 180) / 6) + 1;
    // Norway exception
    if (lat >= 56.0 && lat < 64.0 && lon >= 3.0 && lon < 12.0) zone = 32;
    // Svalbard exceptions
    if (lat >= 72.0 && lat < 84.0) {
      if (lon >= 0.0 && lon < 9.0) zone = 31;
      else if (lon >= 9.0 && lon < 21.0) zone = 33;
      else if (lon >= 21.0 && lon < 33.0) zone = 35;
      else if (lon >= 33.0 && lon < 42.0) zone = 37;
    }
    return zone;
  }

  function latBandLetter(lat) {
    if (lat < -80 || lat > 84) return null; // UPS polar regions, unsupported
    if (lat === 84) return 'X';
    var idx = Math.floor((lat + 80) / 8);
    if (idx < 0) idx = 0;
    if (idx > 19) idx = 19;
    return LAT_BANDS.charAt(idx);
  }

  // ---- Lat/Lon -> UTM ------------------------------------------------

  function llToUtm(lat, lon) {
    var latRad = toRad(lat);
    var lonRad = toRad(lon);
    var zone = utmZoneNumber(lat, lon);
    var lonOrigin = (zone - 1) * 6 - 180 + 3;
    var lonOriginRad = toRad(lonOrigin);

    var eccPrimeSq = ECC_SQ / (1 - ECC_SQ);

    var sinLat = Math.sin(latRad);
    var cosLat = Math.cos(latRad);
    var tanLat = Math.tan(latRad);

    var N = A / Math.sqrt(1 - ECC_SQ * sinLat * sinLat);
    var T = tanLat * tanLat;
    var C = eccPrimeSq * cosLat * cosLat;
    var Aterm = cosLat * (lonRad - lonOriginRad);

    var M = A * (
      (1 - ECC_SQ / 4 - 3 * ECC_SQ * ECC_SQ / 64 - 5 * Math.pow(ECC_SQ, 3) / 256) * latRad -
      (3 * ECC_SQ / 8 + 3 * ECC_SQ * ECC_SQ / 32 + 45 * Math.pow(ECC_SQ, 3) / 1024) * Math.sin(2 * latRad) +
      (15 * ECC_SQ * ECC_SQ / 256 + 45 * Math.pow(ECC_SQ, 3) / 1024) * Math.sin(4 * latRad) -
      (35 * Math.pow(ECC_SQ, 3) / 3072) * Math.sin(6 * latRad)
    );

    var easting = K0 * N * (
      Aterm + (1 - T + C) * Math.pow(Aterm, 3) / 6 +
      (5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSq) * Math.pow(Aterm, 5) / 120
    ) + 500000.0;

    var northing = K0 * (
      M + N * tanLat * (
        Aterm * Aterm / 2 +
        (5 - T + 9 * C + 4 * C * C) * Math.pow(Aterm, 4) / 24 +
        (61 - 58 * T + T * T + 600 * C - 330 * eccPrimeSq) * Math.pow(Aterm, 6) / 720
      )
    );

    if (lat < 0) northing += 10000000.0;

    return {
      zoneNumber: zone,
      zoneLetter: latBandLetter(lat),
      easting: easting,
      northing: northing,
      northernHemisphere: lat >= 0
    };
  }

  // ---- UTM -> Lat/Lon ------------------------------------------------

  function utmToLl(easting, northing, zoneNumber, northernHemisphere) {
    var eccPrimeSq = ECC_SQ / (1 - ECC_SQ);
    var e1 = (1 - Math.sqrt(1 - ECC_SQ)) / (1 + Math.sqrt(1 - ECC_SQ));

    var x = easting - 500000.0;
    var y = northing;
    if (!northernHemisphere) y -= 10000000.0;

    var lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;

    var M = y / K0;
    var mu = M / (A * (1 - ECC_SQ / 4 - 3 * ECC_SQ * ECC_SQ / 64 - 5 * Math.pow(ECC_SQ, 3) / 256));

    var phi1 = mu +
      (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32) * Math.sin(2 * mu) +
      (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32) * Math.sin(4 * mu) +
      (151 * Math.pow(e1, 3) / 96) * Math.sin(6 * mu) +
      (1097 * Math.pow(e1, 4) / 512) * Math.sin(8 * mu);

    var sinPhi1 = Math.sin(phi1);
    var cosPhi1 = Math.cos(phi1);
    var tanPhi1 = Math.tan(phi1);

    var N1 = A / Math.sqrt(1 - ECC_SQ * sinPhi1 * sinPhi1);
    var T1 = tanPhi1 * tanPhi1;
    var C1 = eccPrimeSq * cosPhi1 * cosPhi1;
    var R1 = A * (1 - ECC_SQ) / Math.pow(1 - ECC_SQ * sinPhi1 * sinPhi1, 1.5);
    var D = x / (N1 * K0);

    var lat = phi1 - (N1 * tanPhi1 / R1) * (
      D * D / 2 -
      (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSq) * Math.pow(D, 4) / 24 +
      (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * eccPrimeSq - 3 * C1 * C1) * Math.pow(D, 6) / 720
    );
    lat = toDeg(lat);

    var lon = (
      D -
      (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6 +
      (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * eccPrimeSq + 24 * T1 * T1) * Math.pow(D, 5) / 120
    ) / cosPhi1;
    lon = lonOrigin + toDeg(lon);

    return { lat: lat, lon: lon };
  }

  // ---- MGRS 100,000-m square identification --------------------------

  var COL_SETS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ']; // zone%3 == 1,2,0
  var ROW_SET_ODD = 'ABCDEFGHJKLMNPQRSTUV';
  var ROW_SET_EVEN = 'FGHJKLMNPQRSTUVABCDE';

  function get100kID(easting, northing, zoneNumber) {
    var colSet = COL_SETS[((zoneNumber - 1) % 3 + 3) % 3];
    var colIdx = Math.floor(easting / 100000) - 1;
    var colLetter = colSet.charAt(((colIdx % 8) + 8) % 8);

    var rowSet = (zoneNumber % 2 === 0) ? ROW_SET_EVEN : ROW_SET_ODD;
    var rowIdx = Math.floor(northing / 100000);
    var rowLetter = rowSet.charAt(((rowIdx % 20) + 20) % 20);

    return colLetter + rowLetter;
  }

  // Reverse lookup: given zone, 100k square letters, and an approximate
  // northing (to disambiguate the 2,000,000m row cycle), find the
  // easting/northing of the SW corner of that 100k square.
  function get100kOrigin(zoneNumber, colLetter, rowLetter, northernHemisphere) {
    var colSet = COL_SETS[((zoneNumber - 1) % 3 + 3) % 3];
    var colIdx = colSet.indexOf(colLetter);
    if (colIdx === -1) return null;
    var easting100k = (colIdx + 1) * 100000;

    var rowSet = (zoneNumber % 2 === 0) ? ROW_SET_EVEN : ROW_SET_ODD;
    var rowIdx = rowSet.indexOf(rowLetter);
    if (rowIdx === -1) return null;

    // Row letters repeat every 2,000,000m (20 rows * 100,000m). Find the
    // northing candidate(s) nearest the valid latitude band range by
    // testing multiples of 2,000,000 and picking the one that falls in a
    // sane range for the hemisphere.
    var minNorthing = northernHemisphere ? 0 : 0;
    var maxNorthing = northernHemisphere ? 9500000 : 10000000;

    var candidates = [];
    for (var n = -2000000; n <= 12000000; n += 2000000) {
      var north = n + rowIdx * 100000;
      if (north >= -100000 && north <= 10100000) candidates.push(north);
    }
    return { easting100k: easting100k, candidates: candidates };
  }

  // ---- Lat/Lon -> MGRS -------------------------------------------------

  function llToMgrs(lat, lon, precision) {
    precision = precision === undefined ? 5 : precision; // digits per axis: 5=1m,4=10m,3=100m
    var utm = llToUtm(lat, lon);
    if (!utm.zoneLetter) throw new Error('Latitude out of MGRS range (must be between 80S and 84N).');

    var sq = get100kID(utm.easting, utm.northing, utm.zoneNumber);

    var e = Math.floor(utm.easting % 100000);
    var n = Math.floor(utm.northing % 100000);

    // Clamp e/n rounding edge case where % gives 100000 due to fp error
    if (e >= 100000) e -= 100000;
    if (n >= 100000) n -= 100000;

    var scale = Math.pow(10, 5 - precision);
    var eStr = pad(Math.floor(e / scale), precision);
    var nStr = pad(Math.floor(n / scale), precision);

    return (
      String(utm.zoneNumber) + utm.zoneLetter + ' ' + sq + ' ' + eStr + ' ' + nStr
    );
  }

  function pad(num, len) {
    var s = String(Math.max(0, Math.min(num, Math.pow(10, len) - 1)));
    while (s.length < len) s = '0' + s;
    return s;
  }

  // ---- MGRS -> Lat/Lon -------------------------------------------------

  function parseMgrs(mgrsStr) {
    if (!mgrsStr) throw new Error('Empty MGRS string.');
    var s = mgrsStr.toUpperCase().replace(/\s+/g, '');

    var m = s.match(/^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z]{2})(\d+)$/);
    if (!m) throw new Error('Could not parse MGRS string: "' + mgrsStr + '"');

    var zoneNumber = parseInt(m[1], 10);
    var zoneLetter = m[2];
    var sq = m[3];
    var digits = m[4];

    if (digits.length % 2 !== 0) throw new Error('MGRS numeric part must have an even number of digits (e.g. 4, 6, 8, or 10).');
    var precision = digits.length / 2;
    if (precision > 5) throw new Error('MGRS numeric part is too long (max 10 digits / 1m precision).');

    var eDigits = digits.slice(0, precision);
    var nDigits = digits.slice(precision);
    var scale = Math.pow(10, 5 - precision);
    var eWithin = parseInt(eDigits, 10) * scale;
    var nWithin = parseInt(nDigits, 10) * scale;

    var northernHemisphere = zoneLetter >= 'N';

    var origin = get100kOrigin(zoneNumber, sq.charAt(0), sq.charAt(1), northernHemisphere);
    if (!origin) throw new Error('Invalid MGRS 100,000m square identifier "' + sq + '" for zone ' + zoneNumber + '.');

    // Latitude band gives an approximate northing range; pick the
    // candidate row-origin that falls within/near that band.
    var bandRange = latBandNorthingRange(zoneLetter, northernHemisphere);

    var best = null, bestDist = Infinity;
    origin.candidates.forEach(function (cand) {
      var mid = cand + 50000;
      var dist = Math.abs(mid - bandRange.mid);
      if (dist < bestDist) { bestDist = dist; best = cand; }
    });

    var easting = origin.easting100k + eWithin;
    var northing = best + nWithin;

    var ll = utmToLl(easting, northing, zoneNumber, northernHemisphere);
    return { lat: ll.lat, lon: ll.lon, precision: precision };
  }

  // Approximate northing (UTM, meters) at the vertical center of a given
  // latitude band letter, used only to disambiguate which 2,000,000m
  // row-letter cycle a 100k square belongs to.
  function latBandNorthingRange(zoneLetter, northernHemisphere) {
    var idx = LAT_BANDS.indexOf(zoneLetter);
    var bandMinLat = -80 + idx * 8;
    var bandMaxLat = (zoneLetter === 'X') ? 84 : bandMinLat + 8;
    var midLat = (bandMinLat + bandMaxLat) / 2;
    // rough northing at mid-band, mid-zone longitude offset ~0 (good enough
    // to pick the correct 2,000,000m cycle, error tolerance is huge)
    var approxNorthing = midLat >= 0 ? midLat * 110574 : (midLat * 110574) + 10000000;
    return { mid: approxNorthing };
  }

  // ---- Vincenty inverse: distance + azimuth between two lat/lon points --

  function vincentyInverse(lat1, lon1, lat2, lon2) {
    var a = A, f = F, b = (1 - f) * a;
    var L = toRad(lon2 - lon1);
    var U1 = Math.atan((1 - f) * Math.tan(toRad(lat1)));
    var U2 = Math.atan((1 - f) * Math.tan(toRad(lat2)));
    var sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
    var sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

    var lambda = L, lambdaP, iterLimit = 100;
    var cosSqAlpha, sinSigma, cos2SigmaM, cosSigma, sigma, sinLambda, cosLambda, sinAlpha;

    do {
      sinLambda = Math.sin(lambda);
      cosLambda = Math.cos(lambda);
      sinSigma = Math.sqrt(
        Math.pow(cosU2 * sinLambda, 2) +
        Math.pow(cosU1 * sinU2 - sinU1 * cosU2 * cosLambda, 2)
      );
      if (sinSigma === 0) return { distance: 0, azimuth: 0, azimuthBack: 0 }; // coincident points

      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
      sigma = Math.atan2(sinSigma, cosSigma);
      sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
      cosSqAlpha = 1 - sinAlpha * sinAlpha;
      cos2SigmaM = cosSqAlpha !== 0 ? (cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha) : 0; // equatorial line

      var C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
      lambdaP = lambda;
      lambda = L + (1 - C) * f * sinAlpha * (
        sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM))
      );
    } while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0);

    if (iterLimit === 0) throw new Error('Vincenty formula failed to converge.');

    var uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    var Aterm = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    var Bterm = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    var deltaSigma = Bterm * sinSigma * (
      cos2SigmaM + (Bterm / 4) * (
        cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
        (Bterm / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)
      )
    );

    var distance = b * Aterm * (sigma - deltaSigma);

    var fwdAz = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
    // atan2(...) here gives alpha2, the azimuth of the geodesic *continuing
    // past* point 2; adding 180 deg gives the back-azimuth from point 2
    // pointing back at point 1, which is what callers expect.
    var revAz = Math.atan2(cosU1 * sinLambda, -sinU1 * cosU2 + cosU1 * sinU2 * cosLambda);

    fwdAz = (toDeg(fwdAz) + 360) % 360;
    revAz = (toDeg(revAz) + 180 + 360) % 360;

    return { distance: distance, azimuth: fwdAz, azimuthBack: revAz };
  }

  // ---- Public API -----------------------------------------------------

  var GEO = {
    llToMgrs: llToMgrs,
    mgrsToLl: parseMgrs,
    llToUtm: llToUtm,
    utmToLl: utmToLl,
    vincentyInverse: vincentyInverse,

    // convenience: distance/azimuth between two MGRS strings
    mgrsDistanceAzimuth: function (mgrs1, mgrs2) {
      var p1 = parseMgrs(mgrs1);
      var p2 = parseMgrs(mgrs2);
      var r = vincentyInverse(p1.lat, p1.lon, p2.lat, p2.lon);
      return {
        distanceMeters: r.distance,
        azimuth: r.azimuth,
        azimuthBack: r.azimuthBack,
        point1: p1,
        point2: p2
      };
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GEO;
  } else {
    global.GEO = GEO;
  }
})(typeof window !== 'undefined' ? window : this);
