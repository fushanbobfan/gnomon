import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clockHourAngle,
  hourLineDirection,
  hourCanBeLit,
  dialLines,
  dialNumerals,
  correctionTable,
  dialSvg,
  coordText,
  zoneText,
  FOOT,
  PAGE,
} from '../src/printable.js';
import { horizontalDialAngle, shadowTip } from '../src/dial.js';
import { sunAt, sunCoordinates, julianDay, DEG } from '../src/solar.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);

test('clock hour angles include the offset from the zone meridian', () => {
  assert.equal(clockHourAngle(720, 0, 0), 0);
  assert.equal(clockHourAngle(780, 0, 0), 15);
  near(clockHourAngle(720, -118.24, -8), 1.76, 1e-9, 'Los Angeles noon is just past the meridian');
  near(clockHourAngle(720, 75.99, 8), -44.01, 1e-9, 'Kashgar noon is three hours before solar noon');
});

test('hour line directions follow the horizontal dial formula and mirror in the south', () => {
  for (const H of [-75, -30, 0, 15, 60]) {
    const d = hourLineDirection(48, H);
    near(d.angle, horizontalDialAngle(48, H), 1e-9);
    near(Math.hypot(d.x, d.y), 1, 1e-12);
    const s = hourLineDirection(-48, H);
    near(s.x, -d.x, 1e-12);
    near(s.y, d.y, 1e-12);
  }
  assert.ok(hourLineDirection(40, 120).y < 0, 'hours beyond six o’clock point back past the foot');
});

test('the style shadow lies along the line for the dial reading, in both hemispheres', () => {
  for (const place of [
    { lat: 51.48, lon: -0.0015, tz: 0 },
    { lat: -33.87, lon: 151.21, tz: 10 },
    { lat: 34.05, lon: -118.24, tz: -8 },
  ]) {
    for (const month of [2, 6, 11]) {
      const date = { year: 2026, month, day: 10 };
      for (const clock of [8 * 60, 11 * 60 + 20, 15 * 60 + 45]) {
        const sun = sunAt(place, date, clock, { refract: false });
        if (sun.alt < 5) continue;
        // Where the polar axis through the pin's tip meets the ground.
        const foot = { x: 0, y: -1 / Math.tan(place.lat * DEG) };
        const tip = shadowTip(sun.alt, sun.az, 1);
        let dx = tip.x - foot.x;
        let dy = tip.y - foot.y;
        if (place.lat < 0) {
          dx = -dx;
          dy = -dy;
        }
        const reading = clock + sun.eqTime;
        const dir = hourLineDirection(place.lat, clockHourAngle(reading, place.lon, place.tz));
        const len = Math.hypot(dx, dy);
        near(dx / len, dir.x, 1e-6, `${place.lat} ${month} ${clock}`);
        near(dy / len, dir.y, 1e-6, `${place.lat} ${month} ${clock}`);
      }
    }
  }
});

test('hours when the sun is always down get no line', () => {
  assert.equal(hourCanBeLit(51.5, 180), false, 'no midnight sun in London');
  assert.equal(hourCanBeLit(69.65, 180), true, 'midnight sun in Tromsø');
  assert.equal(hourCanBeLit(0, 89), true);
  assert.equal(hourCanBeLit(0, 92), false);
  const hours = dialLines({ lat: 51.48, lon: 0, tz: 0 }).filter((l) => l.whole).map((l) => l.hour);
  assert.equal(hours[0], 4);
  assert.equal(hours[hours.length - 1], 20);
  assert.equal(dialLines({ lat: 69.65, lon: 18.96, tz: 1 }).filter((l) => l.whole).length, 24);
});

test('lines stay on the plate and half hours are short ticks', () => {
  for (const place of [{ lat: 51.48, lon: 0, tz: 0 }, { lat: -77.84, lon: 166.69, tz: 12 }, { lat: 5, lon: 103, tz: 8 }]) {
    for (const l of dialLines(place)) {
      const x = FOOT.x + l.dir.x * l.end;
      const y = FOOT.y - l.dir.y * l.end;
      assert.ok(x >= 9.99 && x <= 190.01 && y >= 21.99 && y <= 190.01, `${place.lat} ${l.minutes}`);
      if (!l.whole) near(l.end - l.start, 10, 1e-9);
      else assert.ok(l.label > l.end, 'numeral sits beyond the end of its line');
    }
  }
});

test('the correction table is the equation of time with its sign flipped', () => {
  const rows = correctionTable(2026);
  assert.equal(rows.length, 12);
  const feb = rows[1];
  assert.equal(feb.fifteenth, Math.round(-sunCoordinates(julianDay(Date.UTC(2026, 1, 15, 12))).eqTime));
  assert.equal(feb.fifteenth, 14, 'mid-February: add about 14 minutes');
  assert.equal(rows[10].first, -16, 'early November: subtract about 16');
});

test('the sheet is a self-contained SVG with finite numbers', () => {
  for (const place of [
    { lat: 51.4779, lon: -0.0015, tz: 0, name: 'Greenwich' },
    { lat: -33.8688, lon: 151.2093, tz: 10, name: 'Sydney & <harbour>' },
    { lat: 1.35, lon: 103.82, tz: 8 },
  ]) {
    const svg = dialSvg(place);
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(!/NaN|Infinity|undefined/.test(svg));
    assert.ok(svg.includes(`${PAGE.width}mm`));
    assert.equal((svg.match(/<text/g) || []).length, (svg.match(/<\/text>/g) || []).length);
  }
  assert.ok(dialSvg({ lat: -33.87, lon: 151.21, tz: 10, name: 'A & <B>' }).includes('A &amp; &lt;B&gt;'));
  assert.ok(dialSvg({ lat: 1.35, lon: 103.82, tz: 8 }).includes('crowd together'));
  assert.ok(!dialSvg({ lat: 40, lon: 0, tz: 0 }).includes('crowd together'));
});

test('coordinates and zones print the way people write them', () => {
  assert.equal(coordText(51.4779, -0.0015), '51.48° N, 0.00° W');
  assert.equal(coordText(-33.8688, 151.2093), '33.87° S, 151.21° E');
  assert.equal(zoneText(0), 'UTC+0');
  assert.equal(zoneText(5.5), 'UTC+5:30');
  assert.equal(zoneText(-8), 'UTC−8');
});

test('dial numerals never overprint, and daytime hours keep theirs', () => {
  for (const place of [{ lat: 68.44, lon: 151.21, tz: 10 }, { lat: 69.65, lon: 18.96, tz: 1 }, { lat: 51.48, lon: 0, tz: 0 }]) {
    const nums = dialNumerals(dialLines(place));
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        assert.ok(Math.hypot(nums[i].x - nums[j].x, nums[i].y - nums[j].y) >= 5, `${place.lat}: ${nums[i].hour} and ${nums[j].hour}`);
      }
    }
    const hours = new Set(nums.map((n) => n.hour));
    for (let h = 8; h <= 16; h++) assert.ok(hours.has(h), `${place.lat}: hour ${h}`);
  }
  const london = dialNumerals(dialLines({ lat: 51.48, lon: 0, tz: 0 }));
  assert.equal(london.length, 17, 'nothing dropped at a mid latitude');
});
