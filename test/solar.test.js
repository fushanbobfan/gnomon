import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  julianDay,
  clockToUtc,
  sunCoordinates,
  horizontal,
  refraction,
  sunAt,
  dayEvents,
  dayOfYear,
  dateFromDayOfYear,
  daysInYear,
  formatClock,
  formatDuration,
  hourAngleOf,
} from '../src/solar.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected} ± ${tol}, got ${actual}`);

test('J2000.0 is Julian day 2451545', () => {
  assert.equal(julianDay(Date.UTC(2000, 0, 1, 12)), 2451545);
});

test('clock time converts to UTC through the zone offset', () => {
  assert.equal(clockToUtc(2026, 3, 1, 9 * 60, -8), Date.UTC(2026, 2, 1, 17));
  assert.equal(clockToUtc(2026, 3, 1, 30, 5.5), Date.UTC(2026, 1, 28, 19));
});

test('declination is near zero at the March equinox and near the obliquity at the June solstice', () => {
  // 2026 March equinox 14:46 UTC, June solstice 08:24 UTC.
  const eq = sunCoordinates(julianDay(Date.UTC(2026, 2, 20, 14, 46)));
  near(eq.declination, 0, 0.02, 'equinox declination');
  near(eq.longitude > 180 ? eq.longitude - 360 : eq.longitude, 0, 0.02, 'equinox longitude');
  const sol = sunCoordinates(julianDay(Date.UTC(2026, 5, 21, 8, 24)));
  near(sol.declination, sol.obliquity, 0.005, 'solstice declination');
  near(sol.obliquity, 23.436, 0.003, 'obliquity');
});

test('equation of time reaches its familiar extremes in mid-February and early November', () => {
  let min = { v: Infinity }, max = { v: -Infinity };
  for (let n = 1; n <= 365; n++) {
    const { month, day } = dateFromDayOfYear(2026, n);
    const { eqTime } = sunCoordinates(julianDay(Date.UTC(2026, month - 1, day, 12)));
    if (eqTime < min.v) min = { v: eqTime, month, day };
    if (eqTime > max.v) max = { v: eqTime, month, day };
  }
  near(min.v, -14.2, 0.2, 'February minimum');
  assert.equal(min.month, 2);
  assert.ok(min.day >= 10 && min.day <= 13, `minimum on Feb ${min.day}`);
  near(max.v, 16.4, 0.2, 'November maximum');
  assert.equal(max.month, 11);
  assert.ok(max.day >= 2 && max.day <= 4, `maximum on Nov ${max.day}`);
});

test('earth is nearest the sun in early January and farthest in early July', () => {
  near(sunCoordinates(julianDay(Date.UTC(2026, 0, 3))).distance, 0.9833, 0.0003);
  near(sunCoordinates(julianDay(Date.UTC(2026, 6, 6))).distance, 1.0167, 0.0003);
});

test('horizontal coordinates put the sun in the right quarter of the sky', () => {
  near(horizontal(0, 0, 0).alt, 90, 1e-9);
  const morning = horizontal(40, 0, -90);
  near(morning.alt, 0, 1e-9);
  near(morning.az, 90, 1e-9);
  const evening = horizontal(40, 0, 90);
  near(evening.az, 270, 1e-9);
  near(horizontal(40, 0, 0).az, 180, 1e-9, 'northern noon sun due south');
  near(horizontal(-35, 0, 0).az, 0, 1e-9, 'southern noon sun due north');
  near(horizontal(40, 10, 0).alt, 60, 1e-9, 'noon altitude 90 - lat + decl');
});

test('hour angles wrap into -180..180', () => {
  assert.equal(hourAngleOf(720), 0);
  assert.equal(hourAngleOf(0), -180);
  assert.equal(hourAngleOf(1440 + 60), -165);
});

test('refraction lifts a sun 34 arcminutes below the horizon onto it and vanishes overhead', () => {
  near(refraction(-0.57) * 60, 34.2, 0.5);
  near(refraction(0) * 60, 29, 0.5);
  near(refraction(90), 0, 0.002);
  assert.equal(refraction(-5), 0);
  assert.ok(refraction(10) < refraction(1));
});

test('London midsummer and midwinter day lengths', () => {
  const london = { lat: 51.4779, lon: -0.0015, tz: 0 };
  const summer = dayEvents(london, { year: 2026, month: 6, day: 21 });
  near(summer.dayLength, 16 * 60 + 38, 3, 'midsummer');
  near(summer.sunrise, 3 * 60 + 43, 3, 'sunrise UTC');
  const winter = dayEvents(london, { year: 2026, month: 12, day: 21 });
  near(winter.dayLength, 7 * 60 + 50, 3, 'midwinter');
  assert.equal(summer.polar, null);
});

test('solar noon moves with the equation of time and the longitude', () => {
  const greenwich = { lat: 51.48, lon: 0, tz: 0 };
  const nov = dayEvents(greenwich, { year: 2026, month: 11, day: 3 });
  near(nov.noon, 720 - 16.4, 0.3, 'early November noon');
  const west = dayEvents({ lat: 51.48, lon: -15, tz: 0 }, { year: 2026, month: 11, day: 3 });
  near(west.noon - nov.noon, 60, 0.1, 'fifteen degrees west is an hour later');
});

test('the equator has a little more than twelve hours of daylight at the equinox', () => {
  const ev = dayEvents({ lat: 0, lon: 0, tz: 0 }, { year: 2026, month: 3, day: 20 });
  near(ev.dayLength, 12 * 60 + 7, 2);
});

test('polar day and polar night above the Arctic Circle', () => {
  const tromso = { lat: 69.65, lon: 18.96, tz: 1 };
  const june = dayEvents(tromso, { year: 2026, month: 6, day: 21 });
  assert.equal(june.polar, 'day');
  assert.equal(june.sunrise, null);
  assert.equal(june.dayLength, 1440);
  const dec = dayEvents(tromso, { year: 2026, month: 12, day: 21 });
  assert.equal(dec.polar, 'night');
  assert.equal(dec.dayLength, 0);
});

test('sunAt agrees with dayEvents: the sun sits on the horizon at sunrise', () => {
  const place = { lat: 34.05, lon: -118.24, tz: -8 };
  const date = { year: 2026, month: 1, day: 15 };
  const ev = dayEvents(place, date);
  near(sunAt(place, date, ev.sunrise, { refract: false }).alt, -0.833, 0.02);
  near(sunAt(place, date, ev.sunset, { refract: false }).alt, -0.833, 0.02);
  const noon = sunAt(place, date, ev.noon);
  near(noon.hourAngle, 0, 0.01);
  near(noon.az, 180, 0.05);
});

test('calendar helpers', () => {
  assert.equal(dayOfYear({ year: 2026, month: 1, day: 1 }), 1);
  assert.equal(dayOfYear({ year: 2026, month: 12, day: 31 }), 365);
  assert.equal(dayOfYear({ year: 2028, month: 12, day: 31 }), 366);
  assert.deepEqual(dateFromDayOfYear(2028, 60), { year: 2028, month: 2, day: 29 });
  assert.equal(daysInYear(2100), 365);
  assert.equal(daysInYear(2000), 366);
  assert.equal(formatClock(7 * 60 + 5.4), '07:05');
  assert.equal(formatClock(-30), '23:30');
  assert.equal(formatClock(null), '—');
  assert.equal(formatDuration(16 * 60 + 38.2), '16 h 38 min');
});
