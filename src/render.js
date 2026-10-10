// Canvas drawing for the three views. Everything here takes a 2D context,
// a size in CSS pixels and precomputed data, so it can run against a stub
// context in tests.

import { skyPoint, shadowTip, runs } from './dial.js';
import { formatClock } from './solar.js';

const TAU = Math.PI * 2;

function polyline(ctx, pts) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

function dot(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function skyLayout(width, height) {
  const R = Math.max(10, Math.min(width, height) / 2 - 22);
  return { cx: width / 2, cy: height / 2, R };
}

// Sky chart: plan view of the sky dome with the selected day's path, the
// solstice and equinox paths, the hour figures and the sun.
// data: { today, seasons: [{ path, key }], hours: [{ hour, points }], sun }
export function drawSky(ctx, width, height, data, colors) {
  const { cx, cy, R } = skyLayout(width, height);
  const P = (alt, az) => {
    const p = skyPoint(alt, az, R);
    return { x: cx + p.x, y: cy + p.y };
  };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.sky;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const alt of [30, 60]) {
    ctx.beginPath();
    ctx.arc(cx, cy, (R * (90 - alt)) / 90, 0, TAU);
    ctx.stroke();
  }
  for (let az = 0; az < 360; az += 45) polyline(ctx, [P(0, az), P(90, az)]);
  ctx.strokeStyle = colors.axis;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [label, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
    const p = skyPoint(0, az, R + 11);
    ctx.fillText(label, cx + p.x, cy + p.y);
  }
  ctx.fillStyle = colors.muted;
  ctx.font = '10px system-ui, sans-serif';
  for (const alt of [30, 60]) {
    const p = P(alt, 135);
    ctx.fillText(`${alt}°`, p.x + 10, p.y);
  }

  const above = (p) => p.alt > 0;

  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.hour;
  for (const h of data.hours) {
    for (const run of runs(h.points, above)) polyline(ctx, run.map((p) => P(p.alt, p.az)));
  }

  ctx.lineWidth = 1.5;
  for (const s of data.seasons) {
    ctx.strokeStyle = colors[s.key];
    ctx.setLineDash(s.key === 'equinox' ? [4, 4] : []);
    for (const run of runs(s.path, above)) polyline(ctx, run.map((p) => P(p.alt, p.az)));
  }
  ctx.setLineDash([]);

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = colors.today;
  for (const run of runs(data.today, above)) polyline(ctx, run.map((p) => P(p.alt, p.az)));

  ctx.fillStyle = colors.today;
  ctx.font = '10px system-ui, sans-serif';
  for (const p of data.today) {
    if (p.minutes % 60 !== 0 || p.alt <= 2 || p.minutes >= 1440) continue;
    const q = P(p.alt, p.az);
    dot(ctx, q.x, q.y, 2);
    ctx.fillText(String(p.minutes / 60), q.x, q.y - 9);
  }

  const sun = data.sun;
  if (sun.alt > -18) {
    const q = P(Math.max(sun.alt, -10), sun.az);
    ctx.fillStyle = sun.alt > 0 ? colors.sun : colors.muted;
    dot(ctx, q.x, q.y, 7);
    ctx.strokeStyle = colors.sky;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(q.x, q.y, 7, 0, TAU);
    ctx.stroke();
  }
}

// Ground extent in gnomon heights: room for the longest of the given noon
// shadows (solstices and equinox), within limits that keep a low winter sun
// from shrinking the dial to a dot.
export function groundExtent(noonAltitudes) {
  const lens = noonAltitudes.filter((a) => a > 1).map((a) => 1 / Math.tan((a * Math.PI) / 180));
  const longest = lens.length ? Math.max(...lens) : 3;
  return Math.min(6, Math.max(1.5, longest * 1.25 + 0.3));
}

export function groundLayout(width, height, extent) {
  const half = Math.min(width, height) / 2 - 16;
  return { cx: width / 2, cy: height / 2, scale: Math.max(1, half / extent) };
}

// Ground view: a pin of unit height at the centre, the curves its shadow tip
// draws on the solstices and equinoxes, hour marks, the selected day's trace
// and the shadow now.
// data: { extent, declinations: [{ key, curves }], hourLines: [{ hour, curves }],
//         today: [{ minutes, alt, az }], sun }
export function drawGround(ctx, width, height, data, colors) {
  const { cx, cy, scale } = groundLayout(width, height, data.extent);
  const G = (p) => ({ x: cx + p.x * scale, y: cy - p.y * scale });

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = colors.muted;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let r = 1; r <= Math.floor(data.extent); r++) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, TAU);
    ctx.stroke();
    ctx.fillText(`${r}×`, cx + r * scale * 0.71 + 3, cy - r * scale * 0.71);
  }
  polyline(ctx, [{ x: cx, y: 0 }, { x: cx, y: height }]);
  polyline(ctx, [{ x: 0, y: cy }, { x: width, y: cy }]);

  ctx.fillStyle = colors.text;
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, 10);
  ctx.fillText('S', cx, height - 10);
  ctx.fillText('E', width - 10, cy);
  ctx.fillText('W', 10, cy);

  ctx.strokeStyle = colors.hour;
  ctx.lineWidth = 1;
  for (const h of data.hourLines) {
    for (const c of h.curves) polyline(ctx, c.map(G));
  }
  ctx.fillStyle = colors.muted;
  ctx.font = '10px system-ui, sans-serif';
  for (const h of data.hourLines) {
    const all = h.curves.flat();
    if (!all.length) continue;
    const far = all.reduce((a, b) => (b.length > a.length ? b : a));
    const q = G(far);
    if (q.x > 8 && q.x < width - 8 && q.y > 8 && q.y < height - 8) ctx.fillText(String(h.hour), q.x, q.y);
  }

  ctx.lineWidth = 1.5;
  for (const d of data.declinations) {
    ctx.strokeStyle = colors[d.key];
    ctx.setLineDash(d.key === 'equinox' ? [4, 4] : []);
    for (const c of d.curves) polyline(ctx, c.map(G));
  }
  ctx.setLineDash([]);

  const maxLength = data.extent * 1.5;
  const tips = data.today.map((p) => {
    const t = shadowTip(p.alt, p.az, 1, maxLength);
    return t ? { ...t, minutes: p.minutes } : null;
  });
  ctx.strokeStyle = colors.today;
  ctx.lineWidth = 2.5;
  for (const run of runs(tips, (t) => t !== null)) polyline(ctx, run.map(G));

  const sun = data.sun;
  const tip = shadowTip(sun.alt, sun.az, 1, 1e6);
  if (tip) {
    const end = G(tip);
    ctx.strokeStyle = colors.shadow;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    polyline(ctx, [{ x: cx, y: cy }, end]);
    ctx.lineCap = 'butt';
    ctx.fillStyle = colors.shadow;
    dot(ctx, end.x, end.y, 4);
  }
  ctx.fillStyle = colors.pin;
  dot(ctx, cx, cy, 4.5);
}

export function yearLayout(width, height) {
  const left = 40, right = 10, top = 10, bottom = 24;
  return { left, top, w: Math.max(10, width - left - right), h: Math.max(10, height - top - bottom) };
}

// Year chart: daylight between sunrise and sunset by the clock for every day
// of the year, the solar noon line, and crosshairs at the selected date and
// time. days: [{ sunrise, sunset, noon, polar }] in clock minutes.
export function drawYear(ctx, width, height, data, colors) {
  const L = yearLayout(width, height);
  const n = data.days.length;
  const X = (i) => L.left + ((i + 0.5) / n) * L.w;
  const Y = (min) => L.top + (min / 1440) * L.h;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = colors.night;
  ctx.fillRect(L.left, L.top, L.w, L.h);

  // Whole-pixel columns, so neighbouring days meet without seams.
  ctx.fillStyle = colors.daylight;
  data.days.forEach((d, i) => {
    const x = Math.round(L.left + (i / n) * L.w);
    const colW = Math.round(L.left + ((i + 1) / n) * L.w) - x;
    if (d.polar === 'day') ctx.fillRect(x, L.top, colW, L.h);
    else if (d.polar === null) {
      const a = Math.max(0, d.sunrise);
      const b = Math.min(1440, d.sunset);
      if (b > a) ctx.fillRect(x, Y(a), colW, Y(b) - Y(a));
      if (d.sunrise < 0) ctx.fillRect(x, Y(1440 + d.sunrise), colW, Y(1440) - Y(1440 + d.sunrise));
      if (d.sunset > 1440) ctx.fillRect(x, Y(0), colW, Y(d.sunset - 1440) - Y(0));
    }
  });

  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = colors.muted;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let h = 0; h <= 24; h += 6) {
    polyline(ctx, [{ x: L.left, y: Y(h * 60) }, { x: L.left + L.w, y: Y(h * 60) }]);
    ctx.fillText(`${String(h).padStart(2, '0')}:00`, L.left - 4, Y(h * 60));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const months = 'JFMAMJJASOND';
  for (let m = 0; m < 12; m++) {
    const i = data.monthStarts[m];
    polyline(ctx, [{ x: L.left + (i / n) * L.w, y: L.top }, { x: L.left + (i / n) * L.w, y: L.top + L.h }]);
    const next = m < 11 ? data.monthStarts[m + 1] : n;
    ctx.fillText(months[m], L.left + (((i + next) / 2) / n) * L.w, L.top + L.h + 6);
  }

  ctx.strokeStyle = colors.noon;
  ctx.lineWidth = 1.5;
  const noonPts = data.days.map((d, i) => ({ x: X(i), y: Y(((d.noon % 1440) + 1440) % 1440) }));
  polyline(ctx, noonPts);

  ctx.strokeStyle = colors.today;
  ctx.lineWidth = 1.5;
  const cx = X(data.dayIndex);
  polyline(ctx, [{ x: cx, y: L.top }, { x: cx, y: L.top + L.h }]);
  polyline(ctx, [{ x: L.left, y: Y(data.minutes) }, { x: L.left + L.w, y: Y(data.minutes) }]);
  ctx.fillStyle = colors.today;
  dot(ctx, cx, Y(data.minutes), 4);
  ctx.textAlign = cx > L.left + L.w - 60 ? 'right' : 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(formatClock(data.minutes), cx + (ctx.textAlign === 'left' ? 6 : -6), Y(data.minutes) - 3);
}

// Map a click on the year chart to a day index and a clock time.
export function yearPick(width, height, x, y, days) {
  const L = yearLayout(width, height);
  const fx = (x - L.left) / L.w;
  const fy = (y - L.top) / L.h;
  if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
  return {
    dayIndex: Math.min(days - 1, Math.floor(fx * days)),
    minutes: Math.min(1439, Math.round(fy * 1440)),
  };
}
