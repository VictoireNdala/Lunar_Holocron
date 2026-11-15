// Pyramide de tuiles du fond polaire (M-051 § 2.2) : décodage identique à Python sur des tuiles réelles, niveau selon le zoom, gradients sans couture
// entre tuiles, repli sur un niveau plus grossier (jamais de trou).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { createPyramid, inflateRaw, tileGradients, unpackTile, viewMetrics } from '../js/atlas/pyramid.js';
import { makeProjection } from '../js/atlas/maps2d.js';

const ROOT = new URL('../data/polar/', import.meta.url);
const PROBE = JSON.parse(readFileSync(new URL('../../tests/reference/polar_tile_probe.json', import.meta.url), 'utf8'));

test('décodage JavaScript = décodage Python sur 9 tuiles réelles (codes exacts, somme de contrôle)', async () => {
  const { z, stored_px: stored } = PROBE;
  const scale = (z.max_m - z.min_m) / z.max_code;
  for (const c of PROBE.cases) {
    const file = readFileSync(new URL(`tiles/${c.spacing_m}/${c.tx}_${c.ty}.bin`, ROOT));
    assert.equal(file.length, c.bytes);
    const heights = unpackTile(await inflateRaw(new Uint8Array(file)), stored, z);
    for (const [r, col, code] of c.samples) {
      const h = heights[r * stored + col];
      if (code === z.nodata_code) assert.ok(Number.isNaN(h));
      else assert.ok(Math.abs(Math.round((h - z.min_m) / scale) - code) <= 0, `${c.spacing_m} m ${c.tx}_${c.ty} [${r},${col}]`);
    }
    let sum = 0;
    for (let k = 0; k < heights.length; k += 1) sum += Number.isNaN(heights[k]) ? z.nodata_code : Math.round((heights[k] - z.min_m) / scale);
    assert.equal(sum, c.code_sum, `somme de contrôle ${c.spacing_m} m ${c.tx}_${c.ty}`);
  }
});

// ---- pyramide synthétique : plan incliné z = A·x + B·y (gradient exact connu), deux tuiles voisines ----
const CORE = 8; const BORDER = 2; const STORED = CORE + 2 * BORDER;
const Z = { min_m: -1000, max_m: 1000, nodata_code: 65535, max_code: 65534 };
const A = 0.02; const B = -0.01; // m par m
const lvl = (spacing, tiles) => ({ spacing_m: spacing, block_px: 1, x0_m: 0, y0_m: 0, n_rows: 4 * CORE, n_cols: 4 * CORE, window_half_km: 1, tiles, bytes: 0 });
const manifestOf = (levels) => ({ tile: { core_px: CORE, border_px: BORDER, stored_px: STORED }, z: Z, levels });
function packRamp(spacing, tx, ty) { // même codage que pipeline/polar_tiles.py
  const codes = new Int32Array(STORED * STORED);
  for (let r = 0; r < STORED; r += 1) for (let c = 0; c < STORED; c += 1) {
    const x = (tx * CORE + c - BORDER) * spacing; const y = -(ty * CORE + r - BORDER) * spacing;
    codes[r * STORED + c] = Math.round(((A * x + B * y) - Z.min_m) / (Z.max_m - Z.min_m) * Z.max_code);
  }
  const n = STORED * STORED; const bytes = new Uint8Array(2 * n);
  for (let r = 0; r < STORED; r += 1) for (let c = 0; c < STORED; c += 1) {
    const k = r * STORED + c; const d = (codes[k] - (c ? codes[k - 1] : 0)) & 0xFFFF;
    bytes[k] = d & 0xFF; bytes[n + k] = d >> 8;
  }
  return new Uint8Array(deflateRawSync(bytes, { level: 9 }));
}

test('gradients : plan incliné retrouvé à l\'intérieur d\'une tuile ET de part et d\'autre de la frontière entre deux tuiles (pas de couture)', async () => {
  const pyr = createPyramid(manifestOf([lvl(80, [[0, 0], [1, 0]])]), async (s, tx, ty) => packRamp(s, tx, ty));
  const level = await pyr.prepare({ xMin: 0, xMax: 2 * CORE * 80, yMin: -CORE * 80, yMax: 0 }, 1 / 80);
  assert.equal(level.spacing_m, 80);
  const tol = 0.001; // quantification de 2000 m / 65534 = 0,03 m sur 160 m : < 2e-4 ; marge
  for (const x of [100, 300, 8 * 80 - 20, 8 * 80 + 1, 8 * 80 + 40, 900]) {
    const g = pyr.gradientXY(x, -(3.5 * 80), level);
    assert.ok(Math.abs(g.gx - A) < tol && Math.abs(g.gy - B) < tol, `x=${x} : ${g.gx}, ${g.gy}`);
    assert.equal(g.spacingM, 80);
  }
});

test('repli : tuile absente → niveau plus grossier chargé, puis grille 480 m ; jamais de trou', async () => {
  const base = { gradientXY: () => ({ gx: 0.5, gy: 0.25 }) };
  const levels = [lvl(80, [[0, 0]]), lvl(240, [[0, 0], [1, 0]])];
  const pyr = createPyramid(manifestOf(levels), async (s, tx, ty) => packRamp(s, tx, ty), base);
  const fine = pyr.chooseLevel(1 / 80);
  await pyr.prepare({ xMin: 0, xMax: 600, yMin: -600, yMax: 0 }, 1 / 80);
  assert.equal(pyr.gradientXY(300, -300, fine).spacingM, 80); // tuile fine présente
  const outFine = pyr.gradientXY(1000, -300, fine); // hors de la tuile 80 m (col 12 ≥ 8) : repli sur le 240 m, qui n'a pas été préparé → grille 480 m
  assert.equal(outFine.spacingM, 480);
  assert.deepEqual([outFine.gx, outFine.gy], [0.5, 0.25]);
  await pyr.prepare({ xMin: 0, xMax: 3000, yMin: -1000, yMax: 0 }, 1 / 240); // charge le 240 m
  assert.equal(pyr.gradientXY(1000, -300, fine).spacingM, 240);
  const failing = createPyramid(manifestOf([lvl(80, [[0, 0]])]), async () => { throw new Error('réseau'); }, base);
  const lv = await failing.prepare({ xMin: 0, xMax: 600, yMin: -600, yMax: 0 }, 1 / 80);
  assert.equal(failing.gradientXY(300, -300, lv).spacingM, 480, 'échec de chargement : repli, pas d\'exception');
});

test('choix du niveau : 480 m suffit en vue d\'ensemble, pas fin selon le zoom, jamais plus fin que le niveau le plus fin', () => {
  const pyr = createPyramid(manifestOf([lvl(80, [[0, 0]]), lvl(160, [[0, 0]]), lvl(240, [[0, 0]])]), async () => new Uint8Array());
  assert.equal(pyr.chooseLevel(1 / 600), null); // 600 m par pixel : la grille 480 m suffit
  assert.equal(pyr.chooseLevel(1 / 480), null); // 480 m par pixel : 480 m suffit
  assert.equal(pyr.chooseLevel(1 / 300).spacing_m, 240);
  assert.equal(pyr.chooseLevel(1 / 200).spacing_m, 240); // 240 ≤ 1,25 × 200
  assert.equal(pyr.chooseLevel(1 / 150).spacing_m, 160);
  assert.equal(pyr.chooseLevel(1 / 100).spacing_m, 80);
  assert.equal(pyr.chooseLevel(1 / 5).spacing_m, 80);
});

test('gradients d\'une tuile : NaN si un voisin manque, valeur exacte sur un plan', () => {
  const heights = new Float32Array(STORED * STORED);
  for (let r = 0; r < STORED; r += 1) for (let c = 0; c < STORED; c += 1) heights[r * STORED + c] = 3 * c * 80 - 2 * r * 80; // z = 3x + 2y' (y vers le haut = lignes décroissantes)
  heights[5 * STORED + 5] = NaN;
  const { gx, gy } = tileGradients(heights, STORED, 80);
  assert.ok(Math.abs(gx[6 * STORED + 7] - 3) < 1e-6 && Math.abs(gy[6 * STORED + 7] - 2) < 1e-6);
  assert.ok(Number.isNaN(gx[5 * STORED + 6]) && Number.isNaN(gy[4 * STORED + 5]));
});

test('mesure de la vue polaire : pixels par mètre ∝ zoom, et la fenêtre visible fait la largeur du canvas / pxPerM (à 5 % près, plan courbe)', () => {
  const a = viewMetrics(makeProjection('south', 600, 600, undefined, { zoom: 1, panX: 0, panY: 0 }));
  const b = viewMetrics(makeProjection('south', 600, 600, undefined, { zoom: 40, panX: 0, panY: 0 }));
  assert.ok(b.pxPerM > 30 * a.pxPerM);
  assert.ok(Math.abs((b.bbox.xMax - b.bbox.xMin) * b.pxPerM / 600 - 1) < 0.05, `largeur ${(b.bbox.xMax - b.bbox.xMin) * b.pxPerM} px`);
  assert.ok(a.pxPerM > 0 && Number.isFinite(a.bbox.xMin));
});
