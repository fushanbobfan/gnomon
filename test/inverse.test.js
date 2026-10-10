import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noonZenith, latitudeFromNoonShadow, circumferenceFromShadows } from '../src/inverse.js';
import { sunAt, dayEvents, DEG } from '../src/solar.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);

// The noon shadow the model predicts for a place and date.
function noonShadow(place, date) {
  const ev = dayEvents(place, date);
  const sun = sunAt(place, date, ev.noon, { refract: false });
  const az = sun.az;
  return {
    height: 1,
    shadow: 1 / Math.tan(sun.alt * DEG),
    points: az > 90 && az < 270 ? 'north' : 'south',
    declination: sun.declination,
  };
}

test('noon zenith angle from a pin and its shadow', () => {
  near(noonZenith(1, 1), 45, 1e-12);
  assert.equal(noonZenith(2, 0), 0);
  assert.equal(noonZenith(0, 1), null);
  assert.equal(noonZenith(1, -1), null);
  assert.equal(noonZenith(1, NaN), null);
});

test('a noon shadow measured by the model gives back the latitude it came from', () => {
  for (const place of [
    { lat: 51.4779, lon: -0.0015, tz: 0 },
    { lat: 34.0522, lon: -118.2437, tz: -8 },
    { lat: -33.8688, lon: 151.2093, tz: 10 },
    { lat: -0.1807, lon: -78.4678, tz: -5 },
    { lat: 10, lon: 0, tz: 0 },
  ]) {
    for (const month of [3, 6, 12]) {
      const s = noonShadow(place, { year: 2026, month, day: 21 });
      near(latitudeFromNoonShadow(s.height, s.shadow, s.points, s.declination), place.lat, 0.01, `${place.lat} ${month}`);
    }
  }
});

test('no shadow means the sun is overhead; impossible readings give nothing', () => {
  assert.equal(latitudeFromNoonShadow(1, 0, 'north', 23.44), 23.44);
  assert.equal(latitudeFromNoonShadow(1, 1e6, 'north', 10), null, 'beyond the pole');
  assert.equal(latitudeFromNoonShadow(0, 1, 'north', 0), null);
});

test('Eratosthenes: Aswan and Alexandria on the June solstice give the size of the Earth', () => {
  const date = { year: 2026, month: 6, day: 21 };
  const aswan = noonShadow({ lat: 24.0889, lon: 32.8998, tz: 2 }, date);
  const alexandria = noonShadow({ lat: 31.2001, lon: 29.9187, tz: 2 }, date);
  const km = (31.2001 - 24.0889) * (40007.86 / 360);
  const r = circumferenceFromShadows(aswan, alexandria, km);
  near(r.angle, 31.2001 - 24.0889, 0.01);
  near(r.circumference, 40007.86, 60);
  near(r.radius, 40007.86 / (2 * Math.PI), 10);
});

test('shadows pointing opposite ways add their angles', () => {
  const north = { height: 1, shadow: Math.tan(10 * DEG), points: 'north' };
  const south = { height: 1, shadow: Math.tan(5 * DEG), points: 'south' };
  near(circumferenceFromShadows(north, south, 1665).angle, 15, 1e-9);
  near(circumferenceFromShadows(north, south, 1665).circumference, 39960, 1e-6);
  assert.equal(circumferenceFromShadows(north, north, 100), null, 'same shadow, no angle');
  assert.equal(circumferenceFromShadows(north, south, 0), null);
});
