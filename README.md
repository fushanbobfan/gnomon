# gnomon

A sundial and sun-path lab in the browser. A pin stands on level ground.
Pick a place, a date and a time and see where the sun stands in the sky,
where the pin's shadow falls, and the curves the shadow tip draws through
the day and through the year.

**Live demo:** https://fushanbobfan.github.io/gnomon/

A sundial and a clock rarely agree. The clock keeps the time of a zone
meridian that may be far east or west of you, and even on that meridian the
real sun runs up to about 16 minutes ahead of or 14 minutes behind its mean,
because the Earth's orbit is elliptical and its axis is tilted. Here you can
watch both effects: hold the clock at one hour all year and the sun traces a
figure eight (an analemma); hold the sundial at one hour and it stays on a
single line.

No build step and no dependencies. The solar model, the shadow geometry,
the places, the renderer and the share links are plain ES modules covered by
a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or later, no dependencies).

## The three views

- **Sky, seen from above.** A plan view of the sky dome with the zenith in
  the middle, north up and east right, the horizon on the outer circle and
  rings at 30° and 60° of altitude. It shows the selected day's path with
  hour marks, the paths on the solstices and equinoxes, and a faint line for
  each hour of the day across the whole year.
- **Ground around the pin.** The pin stands at the centre; rings mark one,
  two, three… pin heights. The shadow now, the curve the tip draws today, and
  the sundial's year: the hyperbolas the tip follows on the two solstices,
  the straight east–west line it follows at the equinoxes, and hour marks.
- **Daylight through the year, by the clock.** Every day's sunrise to sunset
  on the clock, with the solar noon line. Its wobble is the equation of time;
  its offset from 12:00 is the distance to the zone meridian. Click anywhere
  to jump to that date and time.

## What to try

- **Greenwich, clock hours.** The hour figures are long thin eights; the
  noon one sits on the meridian and the sundial reads up to a quarter hour
  off the clock.
- **Switch to sundial hours.** The eights collapse onto straight lines that
  all meet at one point on the equator side of the pin: where a polar-pointing style
  through the pin's tip would touch the ground. That is why a real sundial
  has a slanted gnomon.
- **Aswan at the June solstice, near 11:50.** The shadow is a few hundredths
  of the pin's height.
- **Kashgar or Singapore.** Both keep clocks set for 120° E. Solar noon is near 15:00 in Kashgar and near 13:00 in Singapore.
- **Tromsø, Run the year.** The daylight band closes into polar night in
  winter and opens into a full-height column of midnight sun in summer.
- **Sydney.** The noon sun is in the north and the shadow turns
  anticlockwise.

Each preset's note is checked against the model in `test/places.test.js`.

## Controls

| Control | Effect |
| --- | --- |
| Preset, latitude, longitude | Where you stand; north and east positive |
| Clock UTC offset | The clock you read; add an hour yourself for summer time |
| Date, day slider, season buttons | The day |
| Time | Clock time on that day |
| Run the day / Run the year | Animate the clock, or step the date two days per frame at a fixed clock time |
| Clock or sundial hours | Hour marks at fixed clock times or fixed apparent solar times |
| Atmospheric refraction | Lift the sun by the standard refraction near the horizon |
| Copy link, Save dial PNG | Share the current view; save the ground view |

Keys: ←/→ move the time by 10 minutes (Shift: an hour), ↑/↓ move the date by
a day, space runs the day.

## How it works

`src/solar.js` computes the sun's declination, the equation of time and the
Earth–sun distance with the low-precision series from Jean Meeus,
*Astronomical Algorithms* (chapters 25 and 28), the same series behind the
NOAA solar calculator. Altitude and azimuth follow from the hour angle;
refraction uses Sæmundsson's formula. Sunrise and sunset are the moments the
sun's upper limb meets the horizon (geometric altitude −0.833°), refined by
recomputing the sun's position at each event; a day with no crossing is
reported as polar day or polar night.

`src/dial.js` turns a sun direction into the shadow of the pin's tip on
level ground, samples day paths and year-long hour figures, and builds the
solstice and equinox curves and the straight sundial hour lines. On a
horizontal dial those lines make the angle θ with the noon line given by
tan θ = sin φ · tan H.

## Tests

`npm test` checks, among other things:

- Julian days, the equinox and solstice declinations, the obliquity, and the
  February and November extremes of the equation of time;
- London's midsummer and midwinter day lengths, equatorial equinox days,
  polar day and night at Tromsø, and that the sun sits at −0.833° at the
  computed sunrise and sunset;
- that the equinox shadow line is straight at tan φ north of the pin, that
  solar hour lines meet at the foot of the polar axis at the predicted
  angles, and that a fixed clock hour traces an analemma while a fixed solar
  hour does not;
- every place note, the share-link round trip and clamping, and that all
  three views draw finite geometry from the tropics to Antarctica.

Accuracy is about 0.01° in declination and a minute or so in sunrise times
for years near the present (real horizons and weather add more), which is
finer than a sundial can resolve.

## License

MIT
