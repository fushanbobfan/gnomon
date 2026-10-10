import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawSky, drawGround, drawYear, groundExtent, yearPick, yearLayout, skyLayout } from '../src/render.js';
import { dayPath, yearAtHour, declinationCurve } from '../src/dial.js';
import { sunAt, dayEvents, dateFromDayOfYear, dayOfYear } from '../src/solar.js';

function stubContext() {
  const calls = [];
  const record = (name) => (...args) => {
    for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a), `${name} got ${a}`);
    calls.push(name);
  };
  const ctx = new Proxy(
    { calls },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return record(String(prop));
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    }
  );
  return ctx;
}

const colors = new Proxy({}, { get: () => '#000' });

const scenes = [
  { lat: 51.4779, lon: -0.0015, tz: 0 },
  { lat: 69.6492, lon: 18.9553, tz: 1 },
  { lat: -77.8419, lon: 166.6863, tz: 12 },
  { lat: -0.1807, lon: -78.4678, tz: -5 },
];

for (const place of scenes) {
  test(`all three views draw finite geometry at latitude ${place.lat}`, () => {
    const date = { year: 2026, month: 12, day: 21 };
    const today = dayPath(place, date, { step: 15 });
    const sun = sunAt(place, date, 600);
    const seasons = [6, 12].map((month) => ({
      key: month === 6 ? 'june' : 'december',
      path: dayPath(place, { year: 2026, month, day: 21 }, { step: 30 }),
    }));
    const hours = [9, 12, 15].map((hour) => ({ hour, points: yearAtHour(place, 2026, hour * 60, { step: 30 }) }));

    const sky = stubContext();
    drawSky(sky, 400, 400, { today, seasons, hours, sun }, colors);
    assert.ok(sky.calls.filter((c) => c === 'lineTo').length > 50);

    const noons = [6, 12].map((month) => dayEvents(place, { year: 2026, month, day: 21 }).noonAltitude);
    const extent = groundExtent(noons);
    const ground = stubContext();
    drawGround(
      ground,
      400,
      400,
      {
        extent,
        declinations: [{ key: 'equinox', curves: declinationCurve(place.lat, 0, { maxLength: extent * 1.5 }) }],
        hourLines: [{ hour: 12, curves: [] }],
        today,
        sun,
      },
      colors
    );
    assert.ok(ground.calls.includes('arc'));

    const days = [];
    for (let n = 1; n <= 365; n += 1) days.push(dayEvents(place, dateFromDayOfYear(2026, n)));
    const monthStarts = Array.from({ length: 12 }, (_, m) => dayOfYear({ year: 2026, month: m + 1, day: 1 }) - 1);
    const year = stubContext();
    drawYear(year, 600, 200, { days, monthStarts, dayIndex: 354, minutes: 600 }, colors);
    assert.ok(year.calls.filter((c) => c === 'fillRect').length > 100);
  });
}

test('ground extent fits the longer solstice noon shadow within limits', () => {
  assert.equal(groundExtent([89, 60]), 1.5);
  const winter = 1 / Math.tan((15 * Math.PI) / 180);
  assert.ok(Math.abs(groundExtent([62, 15]) - Math.min(6, winter * 1.25 + 0.3)) < 1e-9);
  assert.equal(groundExtent([-11, -30]), 3 * 1.25 + 0.3);
  assert.equal(groundExtent([5, 30]), 6);
});

test('a click on the year chart maps back to a day and a clock time', () => {
  const L = yearLayout(600, 200);
  const pick = yearPick(600, 200, L.left + L.w * 0.5, L.top + L.h * 0.25, 365);
  assert.equal(pick.dayIndex, 182);
  assert.equal(pick.minutes, 360);
  assert.equal(yearPick(600, 200, 2, 50, 365), null);
  assert.equal(yearPick(600, 200, L.left + L.w, L.top + L.h, 365).dayIndex, 364);
});

test('the sky chart keeps its horizon inside the canvas', () => {
  const { cx, cy, R } = skyLayout(300, 500);
  assert.ok(cx - R >= 0 && cy - R >= 0 && R < 150);
});
