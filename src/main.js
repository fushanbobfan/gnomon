import {
  sunAt,
  dayEvents,
  dayOfYear,
  dateFromDayOfYear,
  daysInYear,
  formatClock,
  formatDuration,
  sunCoordinates,
  julianDay,
} from './solar.js';
import { dayPath, yearAtHour, declinationCurve, solarHourLine, shadowTip, shadowRatio } from './dial.js';
import { drawSky, drawGround, drawYear, groundExtent, yearPick } from './render.js';
import { PLACES, findPlace } from './places.js';
import { encodeState, decodeState } from './share.js';

const $ = (id) => document.getElementById(id);

const state = decodeState(location.hash);

const els = {
  sky: $('sky'),
  ground: $('ground'),
  year: $('year'),
  place: $('place'),
  note: $('place-note'),
  lat: $('lat'),
  latRange: $('lat-range'),
  lon: $('lon'),
  lonRange: $('lon-range'),
  tz: $('tz'),
  date: $('date'),
  day: $('day'),
  time: $('time'),
  timeOut: $('time-out'),
  playDay: $('play-day'),
  playYear: $('play-year'),
  refract: $('refract'),
  status: $('status'),
};

for (const p of PLACES) {
  const opt = document.createElement('option');
  opt.value = p.id;
  opt.textContent = p.name;
  els.place.append(opt);
}

// Expensive, date-independent pieces are cached by the inputs they depend on.
let yearCache = { key: '', days: null, monthStarts: null };
let hourCache = { key: '', sky: null, ground: null };
let seasonCache = { key: '', seasons: null, declinations: null, extent: 3 };

const place = () => ({ lat: state.lat, lon: state.lon, tz: state.tz });
const date = () => ({ year: state.year, month: state.month, day: state.day });

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  const names = ['sky', 'ground', 'night', 'daylight', 'grid', 'axis', 'hour', 'today', 'june', 'december', 'equinox', 'sun', 'shadow', 'pin', 'noon', 'text', 'muted'];
  const out = {};
  for (const n of names) out[n] = cs.getPropertyValue(`--${n}`).trim();
  return out;
}
let colors = readColors();

function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(50, Math.round(rect.width));
  const h = Math.max(50, Math.round(rect.height));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function placeKey() {
  return `${state.lat}|${state.lon}|${state.tz}|${state.year}|${state.refract}`;
}

function yearData() {
  const key = placeKey();
  if (yearCache.key !== key) {
    const n = daysInYear(state.year);
    const days = [];
    for (let i = 1; i <= n; i++) days.push(dayEvents(place(), dateFromDayOfYear(state.year, i)));
    const monthStarts = Array.from({ length: 12 }, (_, m) => dayOfYear({ year: state.year, month: m + 1, day: 1 }) - 1);
    yearCache = { key, days, monthStarts };
  }
  return yearCache;
}

function seasonData() {
  const key = placeKey();
  if (seasonCache.key !== key) {
    const opts = { step: 4, refract: state.refract };
    const at = (month, day) => dayPath(place(), { year: state.year, month, day }, opts);
    const seasons = [
      { key: 'june', path: at(6, 21) },
      { key: 'equinox', path: at(3, 20) },
      { key: 'december', path: at(12, 21) },
    ];
    const noonAlt = (month) => dayEvents(place(), { year: state.year, month, day: 21 }).noonAltitude;
    const extent = groundExtent([noonAlt(6), 90 - Math.abs(state.lat), noonAlt(12)]);
    const eps = sunCoordinates(julianDay(Date.UTC(state.year, 5, 21))).obliquity;
    const maxLength = extent * 1.5;
    const declinations = [
      { key: 'june', curves: declinationCurve(state.lat, eps, { maxLength }) },
      { key: 'equinox', curves: declinationCurve(state.lat, 0, { maxLength }) },
      { key: 'december', curves: declinationCurve(state.lat, -eps, { maxLength }) },
    ];
    seasonCache = { key, seasons, declinations, extent, eps };
  }
  return seasonCache;
}

function hourData(extent, eps) {
  const key = `${placeKey()}|${state.hours}`;
  if (hourCache.key !== key) {
    const sky = [];
    const ground = [];
    const maxLength = extent * 1.5;
    for (let hour = 0; hour < 24; hour++) {
      const points = yearAtHour(place(), state.year, hour * 60, { mode: state.hours, step: 4, refract: state.refract });
      sky.push({ hour, points });
      if (state.hours === 'solar') {
        ground.push({ hour, curves: solarHourLine(state.lat, hour * 15 - 180, eps, { maxLength }) });
      } else {
        const tips = points.map((p) => shadowTip(p.alt, p.az, 1, maxLength));
        const curves = [];
        let cur = [];
        for (const t of tips) {
          if (t) cur.push(t);
          else if (cur.length) {
            curves.push(cur);
            cur = [];
          }
        }
        if (cur.length) curves.push(cur);
        // The figure closes on itself across New Year.
        if (curves.length > 1 && tips[0] && tips[tips.length - 1]) {
          const last = curves.pop();
          curves[0] = last.concat(curves[0]);
        } else if (curves.length === 1 && tips[0] && tips[tips.length - 1]) {
          curves[0].push(curves[0][0]);
        }
        ground.push({ hour, curves });
      }
    }
    hourCache = { key, sky, ground };
  }
  return hourCache;
}

const fmtDeg = (v) => `${v.toFixed(1)}°`;
const compass = (az) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(az / 45) % 8];

function updateReadout(sun, events) {
  $('s-alt').textContent = sun.alt > 0 ? fmtDeg(sun.alt) : `${fmtDeg(sun.alt)} (below horizon)`;
  $('s-az').textContent = `${fmtDeg(sun.az)} ${compass(sun.az)}`;
  const ratio = shadowRatio(sun.alt);
  $('s-shadow').textContent = Number.isFinite(ratio)
    ? `${ratio < 100 ? ratio.toFixed(2) : '>100'} × pin, toward ${compass((sun.az + 180) % 360)}`
    : 'none';
  $('s-solar').textContent = sun.alt > 0 ? formatClock(sun.solar) : `${formatClock(sun.solar)} (no shadow)`;
  const polarText = events.polar === 'day' ? 'sun up all day' : 'sun down all day';
  $('s-rise').textContent = events.polar ? polarText : formatClock(events.sunrise);
  $('s-set').textContent = events.polar ? polarText : formatClock(events.sunset);
  $('s-noon').textContent = `${formatClock(events.noon)} (${events.noonAltitude.toFixed(1)}° high)`;
  $('s-length').textContent = formatDuration(events.dayLength);
  $('s-decl').textContent = `${sun.declination >= 0 ? '+' : ''}${sun.declination.toFixed(2)}°`;
  const e = sun.eqTime;
  const m = Math.floor(Math.abs(e));
  const s = Math.round((Math.abs(e) - m) * 60);
  $('s-eot').textContent = `${e >= 0 ? '+' : '−'}${m} min ${String(s === 60 ? 0 : s).padStart(2, '0')} s`;
  $('s-eot').title = e >= 0 ? 'The sundial runs ahead of mean solar time' : 'The sundial runs behind mean solar time';
}

function syncControls() {
  els.lat.value = state.lat;
  els.latRange.value = state.lat;
  els.lon.value = state.lon;
  els.lonRange.value = state.lon;
  els.tz.value = state.tz;
  els.date.value = `${state.year}-${String(state.month).padStart(2, '0')}-${String(state.day).padStart(2, '0')}`;
  els.day.max = daysInYear(state.year);
  els.day.value = dayOfYear(date());
  els.time.value = state.minutes;
  els.timeOut.textContent = formatClock(state.minutes);
  els.refract.checked = state.refract;
  for (const r of document.querySelectorAll('input[name="hours"]')) r.checked = r.value === state.hours;
  const match = PLACES.find((p) => p.lat === state.lat && p.lon === state.lon && p.tz === state.tz);
  els.place.value = match ? match.id : '';
  els.note.textContent = match ? match.note : '';
  const solar = state.hours === 'solar';
  $('sky-hour-legend').textContent = solar ? 'same sundial hour all year' : 'same clock hour all year';
  $('ground-hour-legend').textContent = solar
    ? 'sundial hour lines'
    : 'tip at each clock hour through the year';
}

let frame = 0;
function render() {
  frame = 0;
  const seasons = seasonData();
  const hours = hourData(seasons.extent, seasons.eps);
  const today = dayPath(place(), date(), { step: 5, refract: state.refract });
  const sun = sunAt(place(), date(), state.minutes, { refract: state.refract });
  const events = dayEvents(place(), date());

  const sky = fitCanvas(els.sky);
  drawSky(sky.ctx, sky.w, sky.h, { today, seasons: seasons.seasons, hours: hours.sky, sun }, colors);

  const ground = fitCanvas(els.ground);
  drawGround(
    ground.ctx,
    ground.w,
    ground.h,
    { extent: seasons.extent, declinations: seasons.declinations, hourLines: hours.ground, today, sun },
    colors
  );

  const yd = yearData();
  const yr = fitCanvas(els.year);
  drawYear(
    yr.ctx,
    yr.w,
    yr.h,
    { days: yd.days, monthStarts: yd.monthStarts, dayIndex: dayOfYear(date()) - 1, minutes: state.minutes },
    colors
  );

  updateReadout(sun, events);
  els.sky.setAttribute(
    'aria-label',
    `Sun-path chart. The sun is at altitude ${sun.alt.toFixed(1)} degrees, azimuth ${sun.az.toFixed(0)} degrees.`
  );
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(render);
}

let hashTimer = 0;
function changed() {
  syncControls();
  schedule();
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => history.replaceState(null, '', '#' + encodeState(state)), 250);
}

function setDate(d) {
  Object.assign(state, d);
  changed();
}

function shiftDay(delta) {
  const n = daysInYear(state.year);
  let d = dayOfYear(date()) + delta;
  d = ((d - 1 + n) % n) + 1;
  setDate(dateFromDayOfYear(state.year, d));
}

function setNumber(key, value, lo, hi) {
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  state[key] = Math.min(hi, Math.max(lo, v));
  changed();
}

els.place.addEventListener('change', () => {
  const p = findPlace(els.place.value);
  if (!p) return;
  Object.assign(state, { lat: p.lat, lon: p.lon, tz: p.tz });
  changed();
});
els.lat.addEventListener('change', () => setNumber('lat', els.lat.value, -89.9, 89.9));
els.latRange.addEventListener('input', () => setNumber('lat', els.latRange.value, -89.9, 89.9));
els.lon.addEventListener('change', () => setNumber('lon', els.lon.value, -180, 180));
els.lonRange.addEventListener('input', () => setNumber('lon', els.lonRange.value, -180, 180));
els.tz.addEventListener('change', () => setNumber('tz', els.tz.value, -12, 14));

els.date.addEventListener('change', () => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(els.date.value);
  if (!m) return;
  const year = Math.min(2100, Math.max(1900, Number(m[1])));
  setDate({ year, month: Number(m[2]), day: Number(m[3]) });
});
els.day.addEventListener('input', () => setDate(dateFromDayOfYear(state.year, Number(els.day.value))));
for (const b of document.querySelectorAll('[data-date]')) {
  b.addEventListener('click', () => {
    const [month, day] = b.dataset.date.split('-').map(Number);
    setDate({ month, day });
  });
}
els.time.addEventListener('input', () => {
  state.minutes = Number(els.time.value);
  changed();
});

$('now').addEventListener('click', () => {
  const now = new Date(Date.now() + state.tz * 3600000);
  Object.assign(state, {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
    minutes: now.getUTCHours() * 60 + now.getUTCMinutes(),
  });
  changed();
});

for (const r of document.querySelectorAll('input[name="hours"]')) {
  r.addEventListener('change', () => {
    if (r.checked) {
      state.hours = r.value;
      changed();
    }
  });
}
els.refract.addEventListener('change', () => {
  state.refract = els.refract.checked;
  changed();
});

// Playback: the day runs at about 4 clock minutes per frame, the year at
// two days per frame with the clock time held fixed.
let playing = null;
let last = 0;
function tick(t) {
  if (!playing) return;
  const dt = last ? Math.min(100, t - last) : 16;
  last = t;
  if (playing === 'day') {
    state.minutes = (state.minutes + dt * 0.25) % 1440;
    syncControls();
    render();
  } else {
    playing.acc = (playing.acc ?? 0) + dt / 16;
    const steps = Math.floor(playing.acc / 1);
    if (steps > 0) {
      playing.acc -= steps;
      const n = daysInYear(state.year);
      const d = ((dayOfYear(date()) - 1 + steps * 2) % n) + 1;
      Object.assign(state, dateFromDayOfYear(state.year, d));
      syncControls();
      render();
    }
  }
  requestAnimationFrame(tick);
}
function play(kind) {
  const was = playing && (playing === 'day' ? 'day' : 'year');
  playing = null;
  if (was !== kind) {
    playing = kind === 'day' ? 'day' : { acc: 0 };
    last = 0;
    requestAnimationFrame(tick);
  }
  const now = playing && (playing === 'day' ? 'day' : 'year');
  els.playDay.setAttribute('aria-pressed', String(now === 'day'));
  els.playYear.setAttribute('aria-pressed', String(now === 'year'));
  els.playDay.textContent = now === 'day' ? 'Pause' : 'Run the day';
  els.playYear.textContent = now === 'year' ? 'Pause' : 'Run the year';
  if (!playing) {
    state.minutes = Math.round(state.minutes);
    changed();
  }
}
els.playDay.addEventListener('click', () => play('day'));
els.playYear.addEventListener('click', () => play('year'));

els.year.addEventListener('click', (e) => {
  const rect = els.year.getBoundingClientRect();
  const pick = yearPick(rect.width, rect.height, e.clientX - rect.left, e.clientY - rect.top, daysInYear(state.year));
  if (!pick) return;
  Object.assign(state, dateFromDayOfYear(state.year, pick.dayIndex + 1), { minutes: pick.minutes });
  changed();
});

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const step = e.shiftKey ? 60 : 10;
    state.minutes = (Math.round(state.minutes) + (e.key === 'ArrowRight' ? step : -step) + 1440) % 1440;
    changed();
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    shiftDay(e.key === 'ArrowUp' ? 1 : -1);
  } else if (e.key === ' ' && !e.target.closest('button')) {
    play('day');
  } else return;
  e.preventDefault();
});

$('share').addEventListener('click', async () => {
  history.replaceState(null, '', '#' + encodeState(state));
  try {
    await navigator.clipboard.writeText(location.href);
    els.status.textContent = 'Link copied.';
  } catch {
    els.status.textContent = 'Copy the address bar to share this view.';
  }
});

$('png').addEventListener('click', () => {
  render();
  const a = document.createElement('a');
  const d = els.date.value;
  a.download = `gnomon-${state.lat.toFixed(2)}-${state.lon.toFixed(2)}-${d}.png`;
  a.href = els.ground.toDataURL('image/png');
  a.click();
});

window.addEventListener('hashchange', () => {
  if (location.hash.slice(1) === encodeState(state)) return;
  Object.assign(state, decodeState(location.hash));
  changed();
});
window.addEventListener('resize', schedule);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  colors = readColors();
  schedule();
});

syncControls();
render();
