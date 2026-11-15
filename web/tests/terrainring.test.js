// Anneau de contexte de la vue 3D (M-051 § 2.3) : jonction avec le terrain central, trou, jupes, fondu extérieur, hauteurs inconnues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RING_HALF_M, buildRingArrays, gridZAt } from '../js/terrainring.js';
import { R_REF_M } from '../js/constants.js';

const DEG = Math.PI / 180;
// Terrain central synthétique : 20 × 20 km, 41 × 41 nœuds, hauteur absolue h(e, n) = 100 + 0,05·e (pente vers l'est) sur la sphère, courbure incluse
const N = 41; const SIZE = 20000;
const absH = (e, n) => 100 + 0.05 * e + 0 * n;
const meta = { grid: { n: N, size_m: SIZE, spacing_m: SIZE / (N - 1) }, z: { min_m: -2000, max_m: 2000 } };
const siteH = absH(0, 0);
const heights = new Float32Array(N * N);
for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) {
  const e = -SIZE / 2 + c * (SIZE / (N - 1)); const n = SIZE / 2 - r * (SIZE / (N - 1));
  heights[r * N + c] = (R_REF_M + absH(e, n)) * Math.cos(Math.hypot(e, n) / R_REF_M) - (R_REF_M + siteH);
}
// Hauteur de l'anneau au point (lat, lon) : on inverse destination() en cherchant (e, n) ; plus simple : le site est à (−89,5 ; 0) et on retrouve e, n par distance et cap
const lat0 = -89.5; const lon0 = 20;
function enOf(lat, lon) { // cap et distance depuis le site (formules sphériques)
  const p0 = lat0 * DEG; const p1 = lat * DEG; const dl = (lon - lon0) * DEG;
  const hav = Math.sin((p1 - p0) / 2) ** 2 + Math.cos(p0) * Math.cos(p1) * Math.sin(dl / 2) ** 2;
  const d = 2 * R_REF_M * Math.asin(Math.sqrt(hav));
  const az = Math.atan2(Math.sin(dl) * Math.cos(p1), Math.cos(p0) * Math.sin(p1) - Math.sin(p0) * Math.cos(p1) * Math.cos(dl));
  return { e: d * Math.sin(az), n: d * Math.cos(az) };
}
const heightFn = (lat, lon) => { const { e, n } = enOf(lat, lon); return absH(e, n); };

test('anneau : recalage vertical = −hauteur du site, écart résiduel au bord du terrain central < 1 m sur un relief exactement représentable', () => {
  const ring = buildRingArrays(meta, heights, lat0, lon0, heightFn);
  assert.ok(Math.abs(ring.stats.offsetM + siteH) < 0.5, `recalage ${ring.stats.offsetM} (attendu ${-siteH})`);
  assert.ok(ring.stats.edgeStepRmsM < 1, `écart RMS au bord ${ring.stats.edgeStepRmsM}`);
  assert.equal(ring.stats.unknown, 0);
});

test('anneau : aucun triangle de surface dans le carré central, sommets et indices cohérents, jupes présentes', () => {
  const ring = buildRingArrays(meta, heights, lat0, lon0, heightFn);
  const { positions, indices, colors } = ring;
  assert.equal(positions.length, colors.length);
  let maxIndex = 0;
  for (let k = 0; k < indices.length; k += 1) if (indices[k] > maxIndex) maxIndex = indices[k];
  assert.ok(indices.length % 3 === 0 && maxIndex < positions.length / 3);
  const half = SIZE / 2;
  let insideSurface = 0; let skirtTriangles = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const ys = [0, 1, 2].map((q) => positions[3 * indices[t + q] + 1]);
    const xs = [0, 1, 2].map((q) => positions[3 * indices[t + q]]);
    const zs = [0, 1, 2].map((q) => positions[3 * indices[t + q] + 2]);
    const cx = (xs[0] + xs[1] + xs[2]) / 3; const cz = (zs[0] + zs[1] + zs[2]) / 3;
    const isSkirt = Math.max(...ys) - Math.min(...ys) > 300;
    if (isSkirt) skirtTriangles += 1;
    else if (Math.abs(cx) < half - 1 && Math.abs(cz) < half - 1) insideSurface += 1;
  }
  assert.equal(insideSurface, 0, 'le carré central est laissé au terrain 5 m');
  assert.ok(skirtTriangles >= 2 * 4 * 80, `jupes : ${skirtTriangles} triangles`); // anneau (4 × 80 segments) et bord central (4 × 40) : ≥ 2 triangles chacun
});

test('anneau : étendue ±60 km, bord extérieur noir (pas de bord net sur le fond), couleurs normales près du terrain central, site à z = 0', () => {
  const ring = buildRingArrays(meta, heights, lat0, lon0, heightFn);
  const { positions, colors } = ring;
  let maxAbs = 0; let brightAtEdge = 0; let darkAtOuter = true;
  for (let v = 0; v < positions.length / 3; v += 1) {
    const x = positions[3 * v]; const z = positions[3 * v + 2];
    const r = Math.max(Math.abs(x), Math.abs(z));
    maxAbs = Math.max(maxAbs, r);
    const lum = colors[3 * v] + colors[3 * v + 1] + colors[3 * v + 2];
    if (r >= RING_HALF_M - 1 && lum > 1e-6) darkAtOuter = false;
    if (r > SIZE / 2 - 1 && r < SIZE / 2 + 300 && lum > 0.2) brightAtEdge += 1;
  }
  assert.ok(maxAbs <= RING_HALF_M + 1e-6);
  assert.ok(darkAtOuter, 'le bord extérieur est noir (pas de bord net sur le fond)');
  assert.ok(brightAtEdge > 100, 'les couleurs près du terrain central ne sont pas atténuées');
  assert.ok(Math.abs(gridZAt(meta, heights, 0, 0)) < 1e-3, 'le site est à z = 0');
});

test('anneau : hauteurs inconnues complétées sur la ligne ; plus de la moitié inconnue → null (pas d\'anneau faux)', () => {
  const holes = (lat, lon) => { const { e } = enOf(lat, lon); return e > 40000 ? NaN : absH(0, 0) + 0.05 * e; };
  const ring = buildRingArrays(meta, heights, lat0, lon0, holes);
  assert.ok(ring && ring.stats.unknown > 0);
  assert.ok([...ring.positions].every(Number.isFinite));
  assert.equal(buildRingArrays(meta, heights, lat0, lon0, () => NaN), null);
});

test("raccord : un biais de 25 m de l'anneau près du bord est absorbé : les nœuds du bord du trou coïncident avec le terrain central (< 1 mm)", () => {
  const biased = (lat, lon) => { const { e, n } = enOf(lat, lon); const out = Math.max(Math.abs(e), Math.abs(n)) - SIZE / 2; return absH(e, n) + (out < 3000 ? 25 : 0); };
  const ring = buildRingArrays(meta, heights, lat0, lon0, biased);
  const { positions } = ring;
  let checked = 0; let maxErr = 0;
  for (let v = 0; v < positions.length / 3; v += 1) {
    const x = positions[3 * v]; const y = positions[3 * v + 1]; const z = positions[3 * v + 2];
    if (Math.abs(Math.abs(x) - SIZE / 2) < 1e-6 && Math.abs(z) < SIZE / 2 && Math.abs(Math.round(z / 250) * 250 - z) < 1e-6) {
      const g = gridZAt(meta, heights, x, -z);
      if (Math.abs(y - g) < 100) { maxErr = Math.max(maxErr, Math.abs(y - g)); checked += 1; } // exclut les sommets de jupe (400 m plus bas)
    }
  }
  assert.ok(checked >= 40, `${checked} nœuds de bord vérifiés`);
  assert.ok(maxErr < 1e-3, `écart maximal au bord ${maxErr}`);
});
