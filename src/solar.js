// Where the sun stands. Low-precision solar coordinates after Jean Meeus,
// Astronomical Algorithms (2nd ed., ch. 25 and 28), the same series used by
// the NOAA solar calculator: about 0.01° in declination and a few seconds in
// the equation of time for dates within a few centuries of 2000.
//
// Conventions: latitude north positive, longitude east positive, time zone
// in hours east of UTC, azimuth in degrees clockwise from north, angles in
// degrees unless a name says otherwise.

export const DEG = Math.PI / 180;

const norm360 = (x) => ((x % 360) + 360) % 360;

// Altitude of the sun's upper limb touching the horizon, with standard
// refraction (34') and the solar semi-diameter (16').
export const SUNRISE_ALTITUDE = -0.833;

export function julianDay(utcMillis) {
  return utcMillis / 86400000 + 2440587.5;
}

// Clock reading on a civil date in a fixed-offset zone, as a UTC instant.
export function clockToUtc(year, month, day, minutes, tz) {
  return Date.UTC(year, month - 1, day) + (minutes - tz * 60) * 60000;
}

export function sunCoordinates(jd) {
  const T = (jd - 2451545) / 36525;
  const L0 = norm360(280.46646 + T * (36000.76983 + T * 0.0003032));
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * DEG;
  const C =
    Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) +
    Math.sin(3 * Mr) * 0.000289;
  const omega = (125.04 - 1934.136 * T) * DEG;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega);
  const declination = Math.asin(Math.sin(eps * DEG) * Math.sin(lambda * DEG)) / DEG;

  const y = Math.tan((eps * DEG) / 2) ** 2;
  const L0r = L0 * DEG;
  const eqTime =
    (4 / DEG) *
    (y * Math.sin(2 * L0r) -
      2 * e * Math.sin(Mr) +
      4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) -
      1.25 * e * e * Math.sin(2 * Mr));

  // Earth-sun distance in astronomical units.
  const nu = (M + C) * DEG;
  const distance = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(nu));

  return { declination, eqTime, longitude: norm360(lambda), obliquity: eps, distance };
}

// Apparent solar time in minutes after midnight for a clock reading.
export function solarMinutes(clockMinutes, eqTime, lon, tz) {
  return clockMinutes + eqTime + 4 * lon - 60 * tz;
}

export function hourAngleOf(solarMin) {
  let h = solarMin / 4 - 180;
  h = ((h + 180) % 360 + 360) % 360 - 180;
  return h;
}

// Geometric altitude and azimuth of the sun for a latitude, declination and
// hour angle (negative before solar noon).
export function horizontal(lat, decl, hourAngle) {
  const p = lat * DEG;
  const d = decl * DEG;
  const H = hourAngle * DEG;
  const sinAlt = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / DEG;
  const az = norm360(
    Math.atan2(-Math.sin(H), Math.tan(d) * Math.cos(p) - Math.sin(p) * Math.cos(H)) / DEG
  );
  return { alt, az };
}

// Atmospheric refraction in degrees for a geometric altitude, from
// Saemundsson's formula with the usual correction so it vanishes at zenith.
export function refraction(alt) {
  if (alt < -2) return 0;
  const a = Math.max(alt, -1.9);
  const R = 1.02 / Math.tan((a + 10.3 / (a + 5.11)) * DEG) / 60;
  return Math.max(0, R + 0.0019279);
}

// Unit vector toward the sun: x east, y north, z up.
export function sunVector(alt, az) {
  const c = Math.cos(alt * DEG);
  return [c * Math.sin(az * DEG), c * Math.cos(az * DEG), Math.sin(alt * DEG)];
}

// Everything about the sun at one moment and place.
// place: { lat, lon, tz }, date: { year, month, day }, minutes: clock time.
export function sunAt(place, date, minutes, { refract = true } = {}) {
  const jd = julianDay(clockToUtc(date.year, date.month, date.day, minutes, place.tz));
  const coords = sunCoordinates(jd);
  const solar = solarMinutes(minutes, coords.eqTime, place.lon, place.tz);
  const hourAngle = hourAngleOf(solar);
  const geo = horizontal(place.lat, coords.declination, hourAngle);
  const alt = refract ? geo.alt + refraction(geo.alt) : geo.alt;
  return { ...coords, jd, solar, hourAngle, alt, az: geo.az, geometricAlt: geo.alt };
}

// Clock minutes of solar noon, sunrise and sunset on a civil date, refined by
// re-evaluating the sun's coordinates at each event. A polar day or night
// has no rise or set; the flag says which.
export function dayEvents(place, date, { altitude = SUNRISE_ALTITUDE } = {}) {
  const coordsAt = (min) =>
    sunCoordinates(julianDay(clockToUtc(date.year, date.month, date.day, min, place.tz)));
  const noonFor = (eq) => 720 - 4 * place.lon - eq + 60 * place.tz;

  let noon = 720;
  for (let i = 0; i < 3; i++) noon = noonFor(coordsAt(noon).eqTime);

  const halfArc = (decl) => {
    const p = place.lat * DEG;
    const d = decl * DEG;
    const cosH = (Math.sin(altitude * DEG) - Math.sin(p) * Math.sin(d)) / (Math.cos(p) * Math.cos(d));
    if (cosH <= -1) return Infinity;
    if (cosH >= 1) return -Infinity;
    return Math.acos(cosH) / DEG;
  };

  const event = (sign) => {
    let t = noon;
    let H = 0;
    for (let i = 0; i < 4; i++) {
      const c = coordsAt(t);
      H = halfArc(c.declination);
      if (!Number.isFinite(H)) return { minutes: null, H };
      t = noonFor(c.eqTime) + sign * 4 * H;
    }
    return { minutes: t, H };
  };

  const noonCoords = coordsAt(noon);
  const noonAlt = horizontal(place.lat, noonCoords.declination, 0).alt;
  const rise = event(-1);
  const set = event(1);

  if (rise.minutes === null || set.minutes === null) {
    const H = rise.minutes === null ? rise.H : set.H;
    const polar = H === Infinity ? 'day' : 'night';
    return {
      noon,
      noonAltitude: noonAlt,
      sunrise: null,
      sunset: null,
      dayLength: polar === 'day' ? 1440 : 0,
      polar,
    };
  }
  return {
    noon,
    noonAltitude: noonAlt,
    sunrise: rise.minutes,
    sunset: set.minutes,
    dayLength: set.minutes - rise.minutes,
    polar: null,
  };
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

export function dayOfYear({ year, month, day }) {
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
}

export function dateFromDayOfYear(year, n) {
  const d = new Date(Date.UTC(year, 0, n));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function formatClock(minutes) {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  const m = Math.round(((minutes % 1440) + 1440) % 1440);
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatDuration(minutes) {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
