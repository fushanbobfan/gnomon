// Geometry of shadows and sun paths. Ground coordinates have x east and y
// north in units of the gnomon's height; the sky chart is a plan view with
// north up, east right and the zenith at the centre.

import {
  DEG,
  horizontal,
  sunAt,
  sunCoordinates,
  julianDay,
  clockToUtc,
  dateFromDayOfYear,
  daysInYear,
  sunVector,
} from './solar.js';

// Shadow cast on level ground by the tip of a vertical pin of the given
// height standing at the origin. No shadow when the sun is down; a very low
// sun is cut off at maxLength so the tip stays finite.
export function shadowTip(alt, az, height = 1, maxLength = Infinity) {
  if (alt <= 0) return null;
  const [sx, sy, sz] = sunVector(alt, az);
  const k = height / sz;
  const x = -sx * k;
  const y = -sy * k;
  const len = Math.hypot(x, y);
  if (len > maxLength) return null;
  return { x, y, length: len };
}

// Shadow length relative to the gnomon height for a solar altitude.
export function shadowRatio(alt) {
  return alt > 0 ? 1 / Math.tan(alt * DEG) : Infinity;
}

// Plan-view projection of a point on the sky: azimuthal equidistant, horizon
// on a circle of the given radius.
export function skyPoint(alt, az, radius) {
  const r = (radius * (90 - alt)) / 90;
  return { x: r * Math.sin(az * DEG), y: -r * Math.cos(az * DEG) };
}

// The sun through one civil day, sampled every `step` clock minutes.
export function dayPath(place, date, { step = 5, refract = true } = {}) {
  const out = [];
  for (let m = 0; m <= 1440; m += step) {
    const s = sunAt(place, date, m, { refract });
    out.push({ minutes: m, alt: s.alt, az: s.az });
  }
  return out;
}

// Split a sampled path into runs where `keep` holds, so a path that dips
// below the horizon is drawn as separate arcs instead of a chord.
export function runs(points, keep) {
  const out = [];
  let cur = [];
  for (const p of points) {
    if (keep(p)) cur.push(p);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

// Clock reading at which the sun reaches a given apparent solar time on a date.
export function clockForSolar(place, date, solarMin) {
  let clock = solarMin - 4 * place.lon + 60 * place.tz;
  for (let i = 0; i < 2; i++) {
    const jd = julianDay(clockToUtc(date.year, date.month, date.day, clock, place.tz));
    clock = solarMin - sunCoordinates(jd).eqTime - 4 * place.lon + 60 * place.tz;
  }
  return clock;
}

// Where the sun stands at the same time of day on every day of a year. With
// mode 'clock' the time is a fixed clock reading and the points trace an
// analemma; with mode 'solar' it is a fixed apparent solar time and the
// points fall on one hour circle.
export function yearAtHour(place, year, minutes, { mode = 'clock', step = 3, refract = true } = {}) {
  const n = daysInYear(year);
  const out = [];
  for (let d = 1; d <= n; d += step) {
    const date = dateFromDayOfYear(year, d);
    const clock = mode === 'solar' ? clockForSolar(place, date, minutes) : minutes;
    const s = sunAt(place, date, clock, { refract });
    out.push({ day: d, date, alt: s.alt, az: s.az, declination: s.declination, eqTime: s.eqTime });
  }
  return out;
}

// Shadow-tip curve for a fixed declination: the line the tip follows on a
// day when the sun keeps that declination. Solstice and equinox days give the
// classic declination lines of a sundial (hyperbolas, and a straight line at
// the equinox).
export function declinationCurve(lat, decl, { step = 2, maxLength = 6 } = {}) {
  const pts = [];
  for (let H = -180; H <= 180; H += step) {
    const { alt, az } = horizontal(lat, decl, H);
    const tip = shadowTip(alt, az, 1, maxLength);
    pts.push(tip ? { H, ...tip } : null);
  }
  return runs(pts, (p) => p !== null);
}

// Shadow-tip line for one hour of apparent solar time across the range of
// declinations: on a level dial with a pin gnomon these are straight lines.
export function solarHourLine(lat, hourAngle, obliquity = 23.44, { steps = 24, maxLength = 6 } = {}) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const d = -obliquity + (2 * obliquity * i) / steps;
    const { alt, az } = horizontal(lat, d, hourAngle);
    const tip = shadowTip(alt, az, 1, maxLength);
    pts.push(tip ? { decl: d, ...tip } : null);
  }
  return runs(pts, (p) => p !== null);
}

// Angle of a solar hour line on a horizontal dial with a polar style, measured
// from the noon line toward the afternoon side: tan θ = sin φ · tan H.
export function horizontalDialAngle(lat, hourAngle) {
  const H = hourAngle * DEG;
  const t = Math.atan2(Math.sin(lat * DEG) * Math.sin(H), Math.cos(H));
  return t / DEG;
}
