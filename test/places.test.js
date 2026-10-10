import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLACES, findPlace } from '../src/places.js';
import { dayEvents, dateFromDayOfYear, sunAt } from '../src/solar.js';

// Each place's note makes a claim about its sun; check it against the model.

function year(place) {
  const out = [];
  for (let n = 1; n <= 365; n++) out.push(dayEvents(place, dateFromDayOfYear(2026, n)));
  return out;
}
const meanNoon = (place) => year(place).reduce((a, e) => a + e.noon, 0) / 365;
const solstice = (month) => ({ year: 2026, month, day: 21 });

test('places have unique ids, sane coordinates and a note', () => {
  const ids = new Set(PLACES.map((p) => p.id));
  assert.equal(ids.size, PLACES.length);
  for (const p of PLACES) {
    assert.ok(Math.abs(p.lat) < 90 && Math.abs(p.lon) <= 180 && p.tz >= -12 && p.tz <= 14, p.id);
    assert.ok(p.note.length > 40, p.id);
  }
  assert.equal(findPlace('aswan').name, 'Aswan');
  assert.equal(findPlace('nowhere'), null);
});

test('Greenwich keeps mean solar noon at 12:00', () => {
  assert.ok(Math.abs(meanNoon(findPlace('greenwich')) - 720) < 1);
});

test('Los Angeles sees solar noon a few minutes before 12:00 on average', () => {
  const m = meanNoon(findPlace('los-angeles'));
  assert.ok(m > 710 && m < 718, String(m));
});

test('Aswan has an almost shadowless noon at the June solstice', () => {
  const e = dayEvents(findPlace('aswan'), solstice(6));
  assert.ok(e.noonAltitude > 89, String(e.noonAltitude));
});

test('Quito keeps near-twelve-hour days and its noon shadow changes side', () => {
  const q = findPlace('quito');
  for (const e of year(q)) assert.ok(Math.abs(e.dayLength - 720) < 15);
  const juneNoon = sunAt(q, solstice(6), dayEvents(q, solstice(6)).noon);
  const decNoon = sunAt(q, solstice(12), dayEvents(q, solstice(12)).noon);
  assert.ok(Math.abs(juneNoon.az) < 1 || Math.abs(juneNoon.az - 360) < 1, 'June sun in the north');
  assert.ok(Math.abs(decNoon.az - 180) < 1, 'December sun in the south');
});

test('Singapore, Kashgar and Reykjavík see solar noon long after 12:00', () => {
  assert.ok(Math.abs(meanNoon(findPlace('singapore')) - 780) < 10);
  assert.ok(Math.abs(meanNoon(findPlace('kashgar')) - 900) < 10);
  assert.ok(Math.abs(meanNoon(findPlace('reykjavik')) - 810) < 5);
  const dl = dayEvents(findPlace('reykjavik'), solstice(12)).dayLength;
  assert.ok(Math.abs(dl - 240) < 15, String(dl));
});

test('Tromsø has about ten weeks of midnight sun and seven of polar night', () => {
  const y = year(findPlace('tromso'));
  const days = y.filter((e) => e.polar === 'day').length;
  const nights = y.filter((e) => e.polar === 'night').length;
  assert.ok(days >= 63 && days <= 74, String(days));
  assert.ok(nights >= 45 && nights <= 52, String(nights));
});

test('Sydney sees the noon sun in the north', () => {
  const s = findPlace('sydney');
  const az = sunAt(s, solstice(3), dayEvents(s, solstice(3)).noon).az;
  assert.ok(az < 1 || az > 359, String(az));
});

test('McMurdo keeps the December sun between about 11° and 36° high', () => {
  const p = findPlace('mcmurdo');
  let lo = 90, hi = -90;
  for (let m = 0; m < 1440; m += 5) {
    const { alt } = sunAt(p, solstice(12), m);
    lo = Math.min(lo, alt);
    hi = Math.max(hi, alt);
  }
  assert.ok(lo > 10.5 && lo < 12, String(lo));
  assert.ok(hi > 35 && hi < 36.5, String(hi));
});
