// Tests de web/js/terrainmesh.js : orientation du maillage (Nord vers −z), hauteurs, triangles, directions des corps, teintes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTerrainArrays, bodyDirection, hypsoColor, gridCenterHeight } from '../js/terrainmesh.js';

const META = { grid: { n: 3, size_m: 200, spacing_m: 100 }, z: { min_m: 0, max_m: 30 } };
// Ligne 0 = nord, colonne 0 = ouest (CONTRAT § 6).
const HEIGHTS = Float32Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]);

function vertex(arrays, k) {
  // « + 0 » ramène −0 (z = −Nord avec Nord = 0) à 0 pour la comparaison stricte.
  return Array.from(arrays.positions.slice(3 * k, 3 * k + 3), (v) => v + 0);
}

test('ligne 0 = nord (−z), colonne 0 = ouest (−x), centre = site à l\'origine', () => {
  const a = buildTerrainArrays(META, HEIGHTS, 1);
  assert.deepEqual(vertex(a, 0), [-100, 1, -100]); // nord-ouest
  assert.deepEqual(vertex(a, 2), [100, 3, -100]); // nord-est
  assert.deepEqual(vertex(a, 6), [-100, 7, 100]); // sud-ouest
  assert.deepEqual(vertex(a, 4), [0, 5, 0]); // centre = site
});

test('exagération verticale appliquée aux seules hauteurs', () => {
  const a = buildTerrainArrays(META, HEIGHTS, 3);
  assert.deepEqual(vertex(a, 8), [100, 27, 100]);
});

test('triangles : nombre attendu et normales vers le haut (+y)', () => {
  const a = buildTerrainArrays(META, new Float32Array(9), 1);
  assert.equal(a.indices.length, 2 * 2 * 2 * 3);
  for (let t = 0; t < a.indices.length; t += 3) {
    const [p, q, r] = [0, 1, 2].map((k) => vertex(a, a.indices[t + k]));
    const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const ny = u[2] * v[0] - u[0] * v[2];
    assert.ok(ny > 0, `triangle ${t / 3} orienté vers le bas`);
  }
});

test('couleurs : une par sommet, dans [0, 1]', () => {
  const a = buildTerrainArrays(META, HEIGHTS, 1);
  assert.equal(a.colors.length, 9 * 3);
  assert.ok(a.colors.every((c) => c >= 0 && c <= 1));
});

test('taille incohérente refusée', () => {
  assert.throws(() => buildTerrainArrays(META, new Float32Array(8), 1), RangeError);
});

test('gridCenterHeight : hauteur du nœud central (site)', () => {
  assert.equal(gridCenterHeight(META, HEIGHTS), 5);
});

test('bodyDirection : azimut 0 = nord (−z), 90 = est (+x), élévation vers +y', () => {
  const close = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-12);
  const d = (az, el) => { const v = bodyDirection(az, el); return [v.x, v.y, v.z]; };
  assert.ok(close(d(0, 0), [0, 0, -1]));
  assert.ok(close(d(90, 0), [1, 0, 0]));
  assert.ok(close(d(180, 0), [0, 0, 1]));
  assert.ok(close(d(270, 0), [-1, 0, 0]));
  assert.ok(close(d(123, 90), [0, 1, 0]));
  const v = bodyDirection(45, 30);
  assert.ok(Math.abs(Math.hypot(v.x, v.y, v.z) - 1) < 1e-12);
  assert.ok(Math.abs(v.y - 0.5) < 1e-12);
});

test('hypsoColor : bornes et bornage', () => {
  assert.deepEqual(hypsoColor(-1), hypsoColor(0));
  assert.deepEqual(hypsoColor(2), hypsoColor(1));
  assert.notDeepEqual(hypsoColor(0), hypsoColor(1));
  const mid = hypsoColor(0.5);
  assert.equal(mid.length, 3);
});
