// Angles et repères (docs/ARCHITECTURE.md § 2) : azimut 0 = Nord, 90 = Est, sens horaire, dans [0, 360).
// Fonctions pures, sans DOM, testées par web/tests/geometry.test.js.

const FULL_TURN_DEG = 360;
const FULL_TURN_MDEG = 360000;
const HALF_TURN_MDEG = 180000;

/** Ramène un angle en degrés dans [0, 360). */
export function wrapDeg(deg) {
  const w = ((deg % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;
  return w >= FULL_TURN_DEG ? 0 : w;
}

/** Ramène un angle en millidegrés dans [0, 360000). */
export function wrapMdeg(mdeg) {
  const w = ((mdeg % FULL_TURN_MDEG) + FULL_TURN_MDEG) % FULL_TURN_MDEG;
  return w >= FULL_TURN_MDEG ? 0 : w;
}

/** Déroule `nextMdeg` par rapport à `prevMdeg` : ±360000 si l'écart dépasse 180000 (CONTRAT § 3, lecture côté application). */
export function unwrapAzMdeg(prevMdeg, nextMdeg) {
  const diff = nextMdeg - prevMdeg;
  if (diff > HALF_TURN_MDEG) return nextMdeg - FULL_TURN_MDEG;
  if (diff < -HALF_TURN_MDEG) return nextMdeg + FULL_TURN_MDEG;
  return nextMdeg;
}

/** Interpolation linéaire d'azimut (poids w dans [0, 1]) sur l'angle déroulé, résultat dans [0, 360000). */
export function lerpAzMdeg(a0Mdeg, a1Mdeg, w) {
  const a1 = unwrapAzMdeg(a0Mdeg, a1Mdeg);
  return wrapMdeg(a0Mdeg + w * (a1 - a0Mdeg));
}

/** Repère local ENU → repère Three.js : x = Est, y = Haut, z = −Nord (INTERFACE § 6). */
export function enuToThree(e, n, u) {
  return { x: e, y: u, z: -n };
}
