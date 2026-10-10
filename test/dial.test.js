import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shadowTip,
  shadowRatio,
  skyPoint,
  runs,
  dayPath,
  clockForSolar,
  yearAtHour,
  declinationCurve,
  solarHourLine,
  horizontalDialAngle,
} from '../src/dial.js';
import { sunAt, DEG } from '../src/solar.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);

test('a pin casts its shadow away from the sun, as long as the sun is up', () => {
  const tip = shadowTip(45, 180, 1);
  near(tip.x, 0, 1e-12);
  near(tip.y, 1, 1e-12);
  near(tip.length, 1, 1e-12);
  const evening = shadowTip(30, 270, 2);
  near(evening.x, 2 / Math.tan(30 * DEG), 1e-9);
  near(evening.y, 0, 1e-9);
  assert.equal(shadowTip(0, 90), null);
  assert.equal(shadowTip(-3, 90), null);
  assert.equal(shadowTip(1, 90, 1, 10), null, 'beyond the length cap');
  near(shadowRatio(45), 1, 1e-12);
  assert.equal(shadowRatio(-1), Infinity);
});

test('the sky chart puts the zenith in the middle, north up and east right', () => {
  const z = skyPoint(90, 123, 100);
  near(z.x, 0, 1e-12);
  near(z.y, 0, 1e-12);
  const east = skyPoint(0, 90, 100);
  near(east.x, 100, 1e-9);
  near(east.y, 0, 1e-9);
  near(skyPoint(0, 0, 100).y, -100, 1e-9);
  near(skyPoint(45, 180, 100).y, 50, 1e-9);
});

test('runs split a path where it leaves the kept set', () => {
  const pts = [-1, 2, 3, -4, -5, 6, 7, 8, -9].map((v) => ({ v }));
  const r = runs(pts, (p) => p.v > 0);
  assert.deepEqual(r.map((run) => run.map((p) => p.v)), [[2, 3], [6, 7, 8]]);
  assert.deepEqual(runs([], () => true), []);
});

test('a day path spans the whole day and peaks near solar noon', () => {
  const place = { lat: 34.05, lon: -118.24, tz: -8 };
  const date = { year: 2026, month: 6, day: 21 };
  const path = dayPath(place, date, { step: 10 });
  assert.equal(path.length, 145);
  const top = path.reduce((a, b) => (b.alt > a.alt ? b : a));
  near(top.alt, 90 - 34.05 + 23.44, 0.6);
  near(top.minutes, 720 + 4 * 118.24 - 480 + 1.7, 10);
});

test('clockForSolar finds the clock reading of a given apparent solar time', () => {
  const place = { lat: 51.5, lon: -0.12, tz: 0 };
  for (const [month, day] of [[2, 11], [11, 3], [6, 21]]) {
    const date = { year: 2026, month, day };
    const clock = clockForSolar(place, date, 720);
    near(sunAt(place, date, clock).hourAngle, 0, 0.001, `${month}/${day}`);
  }
});

test('a fixed solar hour keeps the sun on one meridian; a fixed clock hour traces an analemma', () => {
  const place = { lat: 40, lon: -75, tz: -5 };
  const solar = yearAtHour(place, 2026, 720, { mode: 'solar', step: 7 });
  for (const p of solar) near(p.az, 180, 0.01);
  const clock = yearAtHour(place, 2026, 720, { mode: 'clock', step: 7 });
  const azs = clock.map((p) => p.az);
  assert.ok(Math.max(...azs) - Math.min(...azs) > 7, 'east-west spread of the clock-noon analemma');
  const alts = clock.map((p) => p.alt);
  near(Math.max(...alts) - Math.min(...alts), 2 * 23.44, 0.8);
});

test('the equinox line is straight, due east-west, tan(latitude) north of the pin', () => {
  for (const lat of [20, 40, 55]) {
    const [line] = declinationCurve(lat, 0, { maxLength: 20 });
    assert.ok(line.length > 30);
    for (const p of line) near(p.y, Math.tan(lat * DEG), 1e-9, `lat ${lat}`);
  }
});

test('solstice curves bend away from the equinox line on either side', () => {
  const lat = 40;
  const summer = declinationCurve(lat, 23.44).flat();
  const winter = declinationCurve(lat, -23.44).flat();
  const eq = Math.tan(lat * DEG);
  for (const p of summer) assert.ok(p.y < eq);
  for (const p of winter) assert.ok(p.y > eq);
  const noonSummer = summer.find((p) => p.H === 0);
  near(noonSummer.y, 1 / Math.tan((90 - lat + 23.44) * DEG), 1e-9);
});

test('solar hour lines are straight and meet where the polar axis through the tip hits the ground', () => {
  for (const lat of [30, 51.5]) {
    const foot = -1 / Math.tan(lat * DEG);
    for (const H of [-60, -15, 30, 75]) {
      const pts = solarHourLine(lat, H).flat();
      assert.ok(pts.length >= 10);
      const expected = horizontalDialAngle(lat, H);
      for (const p of pts) {
        near(Math.atan2(p.x, p.y - foot) / DEG, expected, 1e-6, `lat ${lat} H ${H}`);
      }
    }
  }
});

test('horizontal dial hour angles follow tan θ = sin φ tan H', () => {
  near(horizontalDialAngle(90, 15), 15, 1e-9, 'at the pole the dial is a clock face');
  near(horizontalDialAngle(0, 45), 0, 1e-9);
  near(horizontalDialAngle(40, 90), 90, 1e-9, 'six o’clock lines run east-west');
  near(horizontalDialAngle(40, -30), -Math.atan(Math.sin(40 * DEG) * Math.tan(30 * DEG)) / DEG, 1e-9);
});
