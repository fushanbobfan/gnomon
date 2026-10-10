// Share links: the place, date, time and view settings in the URL hash.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const DEFAULTS = {
  lat: 51.4779,
  lon: -0.0015,
  tz: 0,
  year: 2026,
  month: 6,
  day: 21,
  minutes: 9 * 60,
  hours: 'clock',
  refract: true,
};

const round = (v, digits) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export function encodeState(s) {
  const p = new URLSearchParams();
  p.set('lat', String(round(s.lat, 4)));
  p.set('lon', String(round(s.lon, 4)));
  p.set('tz', String(round(s.tz, 2)));
  p.set(
    'd',
    `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`
  );
  p.set('t', String(Math.round(s.minutes)));
  if (s.hours !== DEFAULTS.hours) p.set('hours', s.hours);
  if (!s.refract) p.set('refract', '0');
  return p.toString();
}

function num(params, key, fallback, lo, hi) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
}

export function decodeState(hash) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const s = { ...DEFAULTS };
  // Latitudes of exactly ±90 make azimuth undefined; stop just short.
  s.lat = num(params, 'lat', s.lat, -89.9, 89.9);
  s.lon = num(params, 'lon', s.lon, -180, 180);
  s.tz = num(params, 'tz', s.tz, -12, 14);
  s.minutes = Math.round(num(params, 't', s.minutes, 0, 1439));

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(params.get('d') ?? '');
  if (m) {
    const year = clamp(Number(m[1]), 1900, 2100);
    const month = clamp(Number(m[2]), 1, 12);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = clamp(Number(m[3]), 1, last);
    Object.assign(s, { year, month, day });
  }
  const hours = params.get('hours');
  if (hours === 'clock' || hours === 'solar') s.hours = hours;
  if (params.get('refract') === '0') s.refract = false;
  return s;
}
