// Running the sundial backwards: a noon shadow and the date give the
// latitude, and two noon shadows a known distance apart on one meridian give
// the size of the Earth, as Eratosthenes worked it out.

import { DEG } from './solar.js';

// Zenith angle of the noon sun from a pin's height and its noon shadow.
export function noonZenith(height, shadow) {
  if (!(height > 0) || !(shadow >= 0)) return null;
  return Math.atan2(shadow, height) / DEG;
}

// Latitude from a noon shadow. `points` is the direction the shadow points:
// 'north' when the sun stands to the south, 'south' when it stands to the
// north. A zero-length shadow puts the sun overhead, so latitude equals the
// declination.
export function latitudeFromNoonShadow(height, shadow, points, declination) {
  const z = noonZenith(height, shadow);
  if (z === null) return null;
  const lat = points === 'south' ? declination - z : declination + z;
  if (Math.abs(lat) > 90) return null;
  return lat;
}

// Circumference of the Earth from two noon shadows measured the same day at
// places a known distance apart along a meridian. Shadows are signed by the
// direction they point so places on either side of the subsolar point work.
export function circumferenceFromShadows(a, b, distance) {
  const za = noonZenith(a.height, a.shadow);
  const zb = noonZenith(b.height, b.shadow);
  if (za === null || zb === null || !(distance > 0)) return null;
  const sa = a.points === 'south' ? -za : za;
  const sb = b.points === 'south' ? -zb : zb;
  const angle = Math.abs(sa - sb);
  if (angle < 1e-6) return null;
  return { angle, circumference: (distance * 360) / angle, radius: (distance * 180) / (angle * Math.PI) };
}
