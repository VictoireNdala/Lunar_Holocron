// Formules de visibilité (docs/ARCHITECTURE.md § 3). Miroir exact de pipeline/visibility.py (mêmes valeurs d'or, tests/golden/).
// d = el − h ; x = clamp(d / r, −1, 1) ; f = 1 − (acos x − x·√(1 − x²)) / π.
import { N_AZIMUTHS, STRICT_MIN_FRACTION, THRESHOLD_MODES } from './constants.js';

/** Part du disque au-dessus de l'horizon, dans [0, 1] ; horizon lu au seul azimut du centre (approximation assumée). */
export function visibleFraction(elDeg, radiusDeg, horizonDeg) {
  if (!(radiusDeg > 0)) throw new RangeError('radiusDeg doit être > 0');
  const x = Math.min(Math.max((elDeg - horizonDeg) / radiusDeg, -1), 1);
  return 1 - (Math.acos(x) - x * Math.sqrt(1 - x * x)) / Math.PI;
}

/** Masque d'horizon interpolé linéairement à l'azimut donné, avec bouclage 359° → 0°. */
export function horizonAt(horizonElevDeg, azDeg) {
  if (horizonElevDeg.length !== N_AZIMUTHS) throw new RangeError(`masque de ${N_AZIMUTHS} valeurs attendu`);
  const az = ((azDeg % 360) + 360) % 360;
  const i0 = Math.floor(az) % N_AZIMUTHS;
  const w = az - Math.floor(az);
  return horizonElevDeg[i0] * (1 - w) + horizonElevDeg[(i0 + 1) % N_AZIMUTHS] * w;
}

/** Seuil binaire : 'strict' ⇒ f ≥ 0,5 ; 'any' ⇒ f > 0. */
export function isVisible(fraction, mode) {
  if (!THRESHOLD_MODES.includes(mode)) throw new RangeError(`mode inconnu : ${mode}`);
  return mode === 'strict' ? fraction >= STRICT_MIN_FRACTION : fraction > 0;
}
