// Géométrie du terrain 3D, sans dépendance à three.js (testable par node --test).
// Repère (INTERFACE § 6) : x = Est, y = Haut, z = −Nord ; le site est à l'origine (centre de la grille).
// Grille (CONTRAT § 6) : ligne 0 = nord, colonne 0 = ouest ; z_m déjà corrigé de la courbure.
import { enuToThree } from './geometry.js';

const DEG = Math.PI / 180;

// Dégradé hypsométrique (bas → haut), couleurs sRGB dans [0, 1]. Choix esthétique, sans signification physique.
const HYPSO_STOPS = Object.freeze([
  [0.0, [0.16, 0.20, 0.32]],
  [0.25, [0.20, 0.38, 0.45]],
  [0.5, [0.45, 0.55, 0.45]],
  [0.75, [0.75, 0.68, 0.50]],
  [1.0, [0.95, 0.93, 0.88]],
]);

/** Couleur du dégradé pour t dans [0, 1] (borné). */
export function hypsoColor(t) {
  const x = Math.min(Math.max(t, 0), 1);
  for (let k = 1; k < HYPSO_STOPS.length; k += 1) {
    const [t1, c1] = HYPSO_STOPS[k];
    if (x <= t1) {
      const [t0, c0] = HYPSO_STOPS[k - 1];
      const w = (x - t0) / (t1 - t0);
      return [0, 1, 2].map((i) => c0[i] + w * (c1[i] - c0[i]));
    }
  }
  return [...HYPSO_STOPS[HYPSO_STOPS.length - 1][1]];
}

/** Stops du dégradé, pour dessiner la légende (CSS linear-gradient). */
export function hypsoStops() {
  return HYPSO_STOPS.map(([t, c]) => ({ t, rgb: c.map((v) => Math.round(v * 255)) }));
}

/** Hauteur (m) du nœud central de la grille, c'est-à-dire du site. */
export function gridCenterHeight(meta, heightsM) {
  const n = meta.grid.n;
  const mid = (n - 1) / 2;
  return heightsM[Math.floor(mid) * n + Math.floor(mid)];
}

/**
 * Tableaux du maillage : positions (x, y, z), indices des triangles (orientés vers +y), couleurs par sommet.
 * `exaggeration` multiplie seulement les hauteurs ; les couleurs suivent la hauteur réelle.
 */
export function buildTerrainArrays(meta, heightsM, exaggeration = 1) {
  const { n, spacing_m: spacing, size_m: size } = meta.grid;
  if (heightsM.length !== n * n) throw new RangeError(`hauteurs : ${heightsM.length} valeurs, attendu ${n * n}`);
  const half = size / 2;
  const { min_m: zMin, max_m: zMax } = meta.z;
  const span = zMax > zMin ? zMax - zMin : 1;
  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const k = row * n + col;
      const h = heightsM[k];
      // Est = −half + col·pas ; Nord = +half − row·pas ; puis ENU → Three.js.
      const p = enuToThree(-half + col * spacing, half - row * spacing, h * exaggeration);
      positions.set([p.x, p.y, p.z], 3 * k);
      colors.set(hypsoColor((h - zMin) / span), 3 * k);
    }
  }
  const indices = new Uint32Array((n - 1) * (n - 1) * 6);
  let t = 0;
  for (let row = 0; row < n - 1; row += 1) {
    for (let col = 0; col < n - 1; col += 1) {
      const a = row * n + col; // nord-ouest de la cellule
      const b = a + n; // sud-ouest
      const c = a + 1; // nord-est
      const d = b + 1; // sud-est
      indices.set([a, b, c, c, b, d], t);
      t += 6;
    }
  }
  return { positions, indices, colors };
}

/** Vecteur unitaire Three.js vers un corps d'azimut et d'élévation donnés (degrés). */
export function bodyDirection(azDeg, elDeg) {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  return enuToThree(Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el));
}
