// Named places, each chosen for something its sun does. Time zones are the
// standard (winter) offsets; summer time is left to the clock offset control.

export const PLACES = [
  {
    id: 'greenwich',
    name: 'Greenwich',
    lat: 51.4779,
    lon: -0.0015,
    tz: 0,
    note: 'On the prime meridian, so clock noon and mean solar noon agree; only the equation of time separates the sundial from the clock.',
  },
  {
    id: 'los-angeles',
    name: 'Los Angeles',
    lat: 34.0522,
    lon: -118.2437,
    tz: -8,
    note: 'About 2° east of its zone meridian at 120° W, so the sun crosses the meridian a few minutes before 12:00 standard time on average.',
  },
  {
    id: 'aswan',
    name: 'Aswan',
    lat: 24.0889,
    lon: 32.8998,
    tz: 2,
    note: 'Just north of the Tropic of Cancer. At the June solstice the noon sun stands within a degree of the zenith and a pin casts almost no shadow, the observation Eratosthenes used to size the Earth.',
  },
  {
    id: 'quito',
    name: 'Quito',
    lat: -0.1807,
    lon: -78.4678,
    tz: -5,
    note: 'On the equator: days stay near twelve hours all year and the noon shadow swings from the south side of the pin to the north side and back.',
  },
  {
    id: 'singapore',
    name: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    tz: 8,
    note: 'Keeps a clock set for 120° E while it lies near 104° E, so solar noon comes around 13:00 by the clock.',
  },
  {
    id: 'kashgar',
    name: 'Kashgar',
    lat: 39.4704,
    lon: 75.9898,
    tz: 8,
    note: 'Officially on Beijing time, almost 44° of longitude east of it. The sun crosses the meridian near 15:00 by the clock.',
  },
  {
    id: 'reykjavik',
    name: 'Reykjavík',
    lat: 64.1466,
    lon: -21.9426,
    tz: 0,
    note: 'Keeps UTC year-round though it lies 22° west, so solar noon falls near 13:30. Midwinter days are about four hours long.',
  },
  {
    id: 'tromso',
    name: 'Tromsø',
    lat: 69.6492,
    lon: 18.9553,
    tz: 1,
    note: 'Inside the Arctic Circle: the sun stays up for about ten weeks around the June solstice and stays down for about seven weeks around the December one.',
  },
  {
    id: 'sydney',
    name: 'Sydney',
    lat: -33.8688,
    lon: 151.2093,
    tz: 10,
    note: 'In the southern hemisphere the noon sun stands in the north and shadows turn anticlockwise.',
  },
  {
    id: 'mcmurdo',
    name: 'McMurdo Station',
    lat: -77.8419,
    lon: 166.6863,
    tz: 12,
    note: 'Near 78° S: at the December solstice the sun circles the sky without setting, between about 11° and 36° high.',
  },
];

export function findPlace(id) {
  return PLACES.find((p) => p.id === id) ?? null;
}
