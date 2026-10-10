// A printable horizontal sundial for one place: hour lines drawn for clock
// time (corrected for the distance to the zone meridian), a cut-out gnomon
// whose sloping edge points at the celestial pole, and a table of the
// equation-of-time correction from dial reading to clock time.

import { DEG, horizontal, sunCoordinates, julianDay } from './solar.js';

export const PAGE = { width: 200, height: 287 };
const PLATE = { left: 10, right: 190, top: 22, bottom: 190 };
export const FOOT = { x: 100, y: 172 };

// Hour angle at which the sun stands at a clock time, ignoring the equation
// of time: positive in the afternoon.
export function clockHourAngle(clockMinutes, lon, tz) {
  return (clockMinutes / 60 - 12) * 15 + (lon - 15 * tz);
}

// Direction of a dial hour line on the page, as a unit vector with y up. The
// noon line points up, toward the elevated pole; east is to the right on a
// northern dial and to the left on a southern one, as seen from above.
export function hourLineDirection(lat, hourAngle) {
  const s = Math.abs(Math.sin(lat * DEG));
  const H = hourAngle * DEG;
  const theta = Math.atan2(s * Math.sin(H), Math.cos(H));
  const mirror = lat < 0 ? -1 : 1;
  return { x: mirror * Math.sin(theta), y: Math.cos(theta), angle: theta / DEG };
}

// Whether the sun can be above the horizon at this hour angle on some day.
export function hourCanBeLit(lat, hourAngle, obliquity = 23.44) {
  for (let i = 0; i <= 8; i++) {
    const d = -obliquity + (2 * obliquity * i) / 8;
    if (horizontal(lat, d, hourAngle).alt > 0) return true;
  }
  return false;
}

// Distance from the foot along a page direction to the plate border.
function rayToPlate(dir, inset = 0) {
  const ts = [];
  const L = PLATE.left + inset, R = PLATE.right - inset, T = PLATE.top + inset, B = PLATE.bottom - inset;
  if (dir.x > 1e-9) ts.push((R - FOOT.x) / dir.x);
  if (dir.x < -1e-9) ts.push((L - FOOT.x) / dir.x);
  if (dir.y > 1e-9) ts.push((FOOT.y - T) / dir.y);
  if (dir.y < -1e-9) ts.push((FOOT.y - B) / dir.y);
  return Math.min(...ts);
}

// Hour and half-hour lines for whole clock hours from 0 to 24.
export function dialLines({ lat, lon, tz }) {
  const lines = [];
  for (let m = 0; m < 1440; m += 30) {
    const H = clockHourAngle(m, lon, tz);
    const wrapped = ((H + 540) % 360) - 180;
    if (!hourCanBeLit(lat, wrapped)) continue;
    const dir = hourLineDirection(lat, wrapped);
    const whole = m % 60 === 0;
    const len = rayToPlate(dir);
    lines.push({
      minutes: m,
      hour: m / 60,
      whole,
      hourAngle: wrapped,
      dir,
      start: whole ? 0 : len - 10,
      end: len,
      label: whole ? rayToPlate(dir, 7) : null,
    });
  }
  return lines;
}

// Equation-of-time correction on the 1st and 15th of each month, in whole
// minutes to add to the dial reading to get clock time.
export function correctionTable(year) {
  const rows = [];
  for (let month = 1; month <= 12; month++) {
    const at = (day) => -sunCoordinates(julianDay(Date.UTC(year, month - 1, day, 12))).eqTime;
    rows.push({ month, first: Math.round(at(1)), fifteenth: Math.round(at(15)) });
  }
  return rows;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const f = (v) => (Math.round(v * 100) / 100).toString();
const signed = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function coordText(lat, lon) {
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
}

export function zoneText(tz) {
  const sign = tz >= 0 ? '+' : '−';
  const a = Math.abs(tz);
  const h = Math.floor(a);
  const m = Math.round((a - h) * 60);
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

// The whole sheet as an SVG document sized for A4 paper (200 × 287 mm).
export function dialSvg({ lat, lon, tz, year = 2026, name = '' }) {
  const lines = dialLines({ lat, lon, tz });
  const pole = lat >= 0 ? 'N' : 'S';
  const P = (dir, t) => ({ x: FOOT.x + dir.x * t, y: FOOT.y - dir.y * t });
  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}mm" height="${PAGE.height}mm" viewBox="0 0 ${PAGE.width} ${PAGE.height}" font-family="Georgia, serif" fill="none" stroke="#222">`
  );
  out.push(`<rect x="0" y="0" width="${PAGE.width}" height="${PAGE.height}" fill="#fff" stroke="none"/>`);
  const title = name ? `${esc(name)} · ${coordText(lat, lon)}` : coordText(lat, lon);
  out.push(`<text x="100" y="12" text-anchor="middle" font-size="6" fill="#222" stroke="none">Horizontal sundial · ${title} · clock ${zoneText(tz)}</text>`);
  out.push(`<rect x="${PLATE.left}" y="${PLATE.top}" width="${PLATE.right - PLATE.left}" height="${PLATE.bottom - PLATE.top}" stroke-width="0.4"/>`);

  for (const l of lines) {
    const a = P(l.dir, l.start);
    const b = P(l.dir, l.end);
    out.push(`<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke-width="${l.whole ? (l.hour === 12 ? 0.8 : 0.5) : 0.3}"/>`);
    if (l.whole) {
      const c = P(l.dir, l.label);
      out.push(`<text x="${f(c.x)}" y="${f(c.y + 1.6)}" text-anchor="middle" font-size="4.5" fill="#222" stroke="none">${l.hour}</text>`);
    }
  }
  out.push(`<circle cx="${FOOT.x}" cy="${FOOT.y}" r="1" fill="#222" stroke="none"/>`);

  const eastX = lat >= 0 ? PLATE.right - 4 : PLATE.left + 4;
  const westX = lat >= 0 ? PLATE.left + 4 : PLATE.right - 4;
  out.push(`<text x="100" y="${PLATE.top + 5}" text-anchor="middle" font-size="4" fill="#666" stroke="none">${pole}</text>`);
  out.push(`<text x="${eastX}" y="${PLATE.bottom - 3}" text-anchor="middle" font-size="4" fill="#666" stroke="none">E</text>`);
  out.push(`<text x="${westX}" y="${PLATE.bottom - 3}" text-anchor="middle" font-size="4" fill="#666" stroke="none">W</text>`);

  // Gnomon template: a right triangle with the latitude angle at the foot.
  const phi = Math.abs(lat);
  const base = 60;
  const rise = Math.min(72, base * Math.tan(phi * DEG));
  const run = rise / Math.tan(Math.max(phi, 1) * DEG);
  const gx = 12, gy = 270;
  out.push(`<polygon points="${f(gx)},${f(gy)} ${f(gx + run)},${f(gy)} ${f(gx + run)},${f(gy - rise)}" stroke-width="0.4" stroke-dasharray="2 1.5"/>`);
  out.push(`<text x="${gx}" y="${gy + 6}" font-size="3.6" fill="#222" stroke="none">Gnomon: cut out and stand it on the noon line, the ${phi.toFixed(1)}° corner on the dot, tall edge toward ${pole}.</text>`);

  out.push(`<text x="104" y="203" font-size="4" fill="#222" stroke="none">Add to the dial reading for clock time (minutes)</text>`);
  const rows = correctionTable(year);
  rows.forEach((r, i) => {
    const y = 211 + i * 5.2;
    out.push(`<text x="108" y="${f(y)}" font-size="3.8" fill="#222" stroke="none">${MONTHS[r.month - 1]}</text>`);
    out.push(`<text x="148" y="${f(y)}" text-anchor="end" font-size="3.8" fill="#222" stroke="none">1st ${signed(r.first)}</text>`);
    out.push(`<text x="185" y="${f(y)}" text-anchor="end" font-size="3.8" fill="#222" stroke="none">15th ${signed(r.fifteenth)}</text>`);
  });
  out.push(`<text x="104" y="281" font-size="3.2" fill="#666" stroke="none">Set level, noon line toward the ${lat >= 0 ? 'north' : 'south'} (true, not magnetic). Add an hour in summer time.</text>`);
  if (Math.abs(lat) < 10) {
    out.push(`<text x="100" y="196" text-anchor="middle" font-size="3.4" fill="#a33" stroke="none">So close to the equator the hour lines crowd together; a vertical or equatorial dial reads better.</text>`);
  }
  out.push('</svg>');
  return out.join('\n');
}
