// Anneau de contexte de la vue 3D d'un site (M-051 § 2.3) : le terrain central (grille 20 × 20 km du site) n'est plus un carré flottant sur fond noir ;
// autour de lui, un maillage plus grossier (≈ 250 m) jusqu'à ±60 km, hauteurs lues dans la pyramide de tuiles (puis la grille 480 m), jonction sans fente (jupes),
// bord extérieur fondu vers le noir. Sans dépendance à three.js (testable). ILLUSTRATIF comme tout le rendu 3D : les verdicts viennent des masques.
// Repère et courbure : identiques à pipeline/terrain_grid.py : z = (R + h)·cos(d/R) − (R + h_site) ; nœud = (Est, Nord) posé à plat, azimut et distance au sol.
import { R_REF_M } from './constants.js';
import { destination } from './freepoint.js';
import { hypsoColor } from './terrainmesh.js';
import { enuToThree } from './geometry.js';

export const RING_HALF_M = 60_000; // demi-côté de l'anneau
export const RING_TARGET_SPACING_M = 250;
const FADE_START = 0.7; // le fondu vers le noir commence à 70 % du demi-côté
const SKIRT_DEPTH_M = 400;
const BLEND_M = 1500; // distance sur laquelle l'anneau se raccorde au terrain central (≥ 1 km, M-051 § 2.3)

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Interpolation bilinéaire de la grille centrale (n × n, ligne 0 = nord) au point (Est, Nord) ; NaN hors grille. */
export function gridZAt(meta, heightsM, east, north) {
  const { n, size_m: size } = meta.grid;
  const spacing = size / (n - 1);
  const col = (east + size / 2) / spacing;
  const row = (size / 2 - north) / spacing;
  const c0 = Math.min(Math.max(Math.floor(col), 0), n - 2);
  const r0 = Math.min(Math.max(Math.floor(row), 0), n - 2);
  const wc = Math.min(Math.max(col - c0, 0), 1);
  const wr = Math.min(Math.max(row - r0, 0), 1);
  const i = r0 * n + c0;
  return (1 - wr) * ((1 - wc) * heightsM[i] + wc * heightsM[i + 1]) + wr * ((1 - wc) * heightsM[i + n] + wc * heightsM[i + n + 1]);
}

/**
 * Maillage de l'anneau. `heightFn(latDeg, lonDeg)` → hauteur (m au-dessus de R_REF, NaN si inconnue). Renvoie { positions, colors, indices, stats } avec
 * exagération 1 (la vue applique `mesh.scale.y`), ou null si trop peu de hauteurs sont connues.
 * `stats` : { nodes, unknown, offsetM (recalage vertical sur le bord du terrain central), edgeStepRmsM (écart RMS ring/centre après recalage) }.
 */
export function buildRingArrays(meta, heightsM, siteLatDeg, siteLonDeg, heightFn, { halfM = RING_HALF_M, targetSpacingM = RING_TARGET_SPACING_M } = {}) {
  const innerHalf = meta.grid.size_m / 2;
  const k = Math.max(1, Math.round(innerHalf / targetSpacingM)); // nœuds entre le centre et le bord du terrain central : le trou tombe exactement sur des nœuds
  const spacing = innerHalf / k;
  const m = Math.round(halfM / spacing);
  const side = 2 * m + 1;
  const z0 = new Float32Array(side * side).fill(NaN);
  const hs = new Float32Array(side * side);
  let unknown = 0;
  for (let j = 0; j < side; j += 1) { // j : ligne, 0 = nord (Nord = (m − j)·pas)
    for (let i = 0; i < side; i += 1) {
      const east = (i - m) * spacing;
      const north = (m - j) * spacing;
      const dist = Math.hypot(east, north);
      const p = dist === 0 ? { latDeg: siteLatDeg, lonDeg: siteLonDeg } : destination(siteLatDeg, siteLonDeg, Math.atan2(east, north), dist / R_REF_M);
      const h = heightFn(p.latDeg, p.lonDeg);
      const idx = j * side + i;
      hs[idx] = h;
      if (!Number.isFinite(h)) unknown += 1;
      else z0[idx] = (R_REF_M + h) * Math.cos(dist / R_REF_M) - R_REF_M;
    }
  }
  if (unknown > 0.5 * side * side) return null;
  // Les nœuds sans hauteur reprennent la plus proche valeur connue sur la ligne (rare : hors de la grille 480 m).
  for (let j = 0; j < side; j += 1) {
    let last = NaN;
    for (let i = 0; i < side; i += 1) { const idx = j * side + i; if (Number.isFinite(z0[idx])) last = z0[idx]; else if (Number.isFinite(last)) z0[idx] = last; }
    last = NaN;
    for (let i = side - 1; i >= 0; i -= 1) { const idx = j * side + i; if (Number.isFinite(z0[idx])) last = z0[idx]; else if (Number.isFinite(last)) z0[idx] = last; }
  }
  // Recalage vertical : le site est pris en (0, 0) ; la différence moyenne ring − centre le long du bord du terrain central supprime le saut d'ensemble.
  const edge = [];
  for (let t = -k; t <= k; t += 1) edge.push([t * spacing, innerHalf], [t * spacing, -innerHalf], [innerHalf, t * spacing], [-innerHalf, t * spacing]);
  const idxOf = (e, n) => (m - Math.round(n / spacing)) * side + (Math.round(e / spacing) + m);
  let offset = 0;
  for (const [e, n] of edge) offset += gridZAt(meta, heightsM, e, n) - z0[idxOf(e, n)];
  offset /= edge.length;
  let rms = 0;
  for (const [e, n] of edge) rms += (gridZAt(meta, heightsM, e, n) - z0[idxOf(e, n)] - offset) ** 2;
  rms = Math.sqrt(rms / edge.length);

  // Fondu des hauteurs sur BLEND_M autour du trou : le résidu (centre − anneau) du point le plus proche du bord est reporté, puis s'éteint (lissé) : aucune marche au bord.
  const residual = new Map();
  for (const [e, n] of edge) { const idx = idxOf(e, n); residual.set(idx, gridZAt(meta, heightsM, e, n) - (z0[idx] + offset)); }
  const blended = (i, j) => {
    const ci = Math.min(Math.max(i - m, -k), k); const cj = Math.min(Math.max(j - m, -k), k); // projection sur le carré central (bord)
    const excess = Math.max(Math.abs(i - m) - k, Math.abs(j - m) - k, 0) * spacing;
    if (excess >= BLEND_M) return 0;
    const r = residual.get((m - cj) * side + (ci + m)) ?? 0;
    return r * (1 - smoothstep(0, BLEND_M, excess));
  };
  const { min_m: zMin, max_m: zMax } = meta.z;
  const span = zMax > zMin ? zMax - zMin : 1;
  const extra = []; // jupes
  const positions = []; const colors = [];
  const vertexOf = new Int32Array(side * side).fill(-1);
  const add = (i, j) => {
    const idx = j * side + i;
    if (vertexOf[idx] >= 0) return vertexOf[idx];
    const east = (i - m) * spacing; const north = (m - j) * spacing;
    const z = z0[idx] + offset + blended(i, j);
    const p = enuToThree(east, north, z);
    const fade = 1 - smoothstep(FADE_START * halfM, halfM, Math.max(Math.abs(east), Math.abs(north)));
    const c = hypsoColor((z - zMin) / span);
    positions.push(p.x, p.y, p.z); colors.push(c[0] * fade, c[1] * fade, c[2] * fade);
    vertexOf[idx] = positions.length / 3 - 1;
    return vertexOf[idx];
  };
  const indices = [];
  for (let j = 0; j < side - 1; j += 1) {
    for (let i = 0; i < side - 1; i += 1) {
      const insideHole = i - m >= -k && i + 1 - m <= k && j - m >= -k && j + 1 - m <= k; // cellule entièrement dans le carré central
      if (insideHole) continue;
      const a = add(i, j); const b = add(i, j + 1); const c = add(i + 1, j); const d = add(i + 1, j + 1);
      indices.push(a, b, c, c, b, d);
    }
  }
  const surfaceVertexCount = positions.length / 3;
  const surfaceIndexCount = indices.length;
  // Jupes sous le bord du trou (côté anneau) : évite toute fente entre l'anneau et le terrain central.
  const skirt = (i, j) => { const v = vertexOf[j * side + i]; if (v < 0) return -1; const o = v * 3; positions.push(positions[o], positions[o + 1] - SKIRT_DEPTH_M, positions[o + 2]); colors.push(colors[o], colors[o + 1], colors[o + 2]); return positions.length / 3 - 1; };
  const ring = [];
  for (let t = -k; t <= k; t += 1) ring.push([m + t, m - k]);
  for (let t = -k + 1; t <= k; t += 1) ring.push([m + k, m + t]);
  for (let t = k - 1; t >= -k; t -= 1) ring.push([m + t, m + k]);
  for (let t = k - 1; t > -k; t -= 1) ring.push([m - k, m + t]);
  const down = ring.map(([i, j]) => skirt(i, j));
  const top = ring.map(([i, j]) => vertexOf[j * side + i]);
  for (let q = 0; q < ring.length; q += 1) {
    const q2 = (q + 1) % ring.length;
    if (top[q] < 0 || top[q2] < 0 || down[q] < 0 || down[q2] < 0) continue;
    extra.push(top[q], down[q], top[q2], top[q2], down[q], down[q2]);
  }
  // Jupes sous le bord du terrain central (côté centre) : même but, pour les cas où l'anneau est plus bas que le bord du centre.
  const { n } = meta.grid;
  const sp = meta.grid.size_m / (n - 1);
  const borderNodes = [];
  for (let c = 0; c < n; c += 1) borderNodes.push([0, c]);
  for (let r = 1; r < n; r += 1) borderNodes.push([r, n - 1]);
  for (let c = n - 2; c >= 0; c -= 1) borderNodes.push([n - 1, c]);
  for (let r = n - 2; r > 0; r -= 1) borderNodes.push([r, 0]);
  const innerTop = []; const innerDown = [];
  for (const [r, c] of borderNodes) {
    const p = enuToThree(-innerHalf + c * sp, innerHalf - r * sp, heightsM[r * n + c]);
    const c0 = hypsoColor((heightsM[r * n + c] - zMin) / span);
    positions.push(p.x, p.y, p.z); colors.push(c0[0], c0[1], c0[2]); innerTop.push(positions.length / 3 - 1);
    positions.push(p.x, p.y - SKIRT_DEPTH_M, p.z); colors.push(c0[0], c0[1], c0[2]); innerDown.push(positions.length / 3 - 1);
  }
  for (let q = 0; q < innerTop.length; q += 1) {
    const q2 = (q + 1) % innerTop.length;
    extra.push(innerTop[q], innerDown[q], innerTop[q2], innerTop[q2], innerDown[q], innerDown[q2]);
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), indices: new Uint32Array([...indices, ...extra]), surfaceVertexCount, surfaceIndexCount, stats: { nodes: side * side, unknown, offsetM: offset, edgeStepRmsM: rms, spacingM: spacing, halfM } };
}
