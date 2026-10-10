import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState, DEFAULTS } from '../src/share.js';

test('state survives a round trip through the hash', () => {
  const s = { lat: -33.86881, lon: 151.20929, tz: 10, year: 2026, month: 12, day: 3, minutes: 1001, hours: 'solar', refract: false };
  const back = decodeState('#' + encodeState(s));
  assert.deepEqual(back, { ...s, lat: -33.8688, lon: 151.2093 });
});

test('defaults are left out of the link', () => {
  const h = encodeState(DEFAULTS);
  assert.ok(!h.includes('hours') && !h.includes('refract'));
  assert.deepEqual(decodeState(h), DEFAULTS);
});

test('hostile or missing values fall back or clamp', () => {
  assert.deepEqual(decodeState(''), DEFAULTS);
  const s = decodeState('lat=120&lon=abc&tz=-30&t=99999&d=2026-02-31&hours=sideways');
  assert.equal(s.lat, 89.9);
  assert.equal(s.lon, DEFAULTS.lon);
  assert.equal(s.tz, -12);
  assert.equal(s.minutes, 1439);
  assert.deepEqual([s.year, s.month, s.day], [2026, 2, 28]);
  assert.equal(s.hours, 'clock');
  assert.equal(decodeState('d=1700-01-01').year, 1900);
  assert.equal(decodeState('d=2026-6-1').month, DEFAULTS.month, 'malformed date ignored');
  assert.equal(decodeState('lat=').lat, DEFAULTS.lat);
});
