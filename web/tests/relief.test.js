// Tests de atlas/relief.js (V2-06) : sonde contre Python (recalcul indépendant), fondu monotone, ombrage, gradients.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { decodePolarGrid } from '../js/freepoint.js';
import { GRID_EDGE_M, FADE_WIDTH_M, STUDY_SUN_ELEVATION_DEG, computeGradients, edgeAlpha, probeAt, reliefFactor, slopeDeg } from '../js/atlas/relief.js';
import { buildBase, makeProjection, shadePixels } from '../js/atlas/maps2d.js';

const DATA = new URL('../data/', import.meta.url);
const PROBE = new URL('../../tests/golden/probe_cases.json', import.meta.url);
const present = existsSync(new URL('polar/ldem_south_500m.bin', DATA)) && existsSync(PROBE);

let cache = null;
function load() {
  if (cache) return cache;
  const meta = JSON.parse(readFileSync(new URL('polar/ldem_south_500m.json', DATA), 'utf8'));
  const buf = readFileSync(new URL('polar/ldem_south_500m.bin', DATA));
  const grid = decodePolarGrid(meta, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  cache = { grid, grads: computeGradients(grid) };
  return cache;
}

test('fondu du bord : 1 au centre, 0 au-delà de la grille, monotone décroissant, largeur FADE_WIDTH_M, jamais de saut', () => {
  assert.equal(edgeAlpha(0), 1);
  assert.equal(edgeAlpha(GRID_EDGE_M - FADE_WIDTH_M), 1);
  assert.equal(edgeAlpha(GRID_EDGE_M), 0);
  assert.equal(edgeAlpha(400_000), 0);
  let prev = 1;
  let maxStep = 0;
  for (let r = GRID_EDGE_M - FADE_WIDTH_M; r <= GRID_EDGE_M; r += 500) {
    const a = edgeAlpha(r);
    assert.ok(a <= prev + 1e-12);
    maxStep = Math.max(maxStep, prev - a);
    prev = a;
  }
  assert.ok(maxStep < 0.03, `pas maximal ${maxStep}`);
});

test('ombrage : surface plane = 1 ; face au Soleil plus claire, face opposée plus sombre ; bornes ; NaN neutre', () => {
  assert.ok(Math.abs(reliefFactor(0, 0, 40) - 1) < 1e-12);
  // Soleil au méridien 0° : direction (0, 1) dans le plan ; un terrain qui descend vers +y est face au Soleil
  const facing = reliefFactor(0, -0.3, 0);
  const away = reliefFactor(0, 0.3, 0);
  assert.ok(facing > 1 && away < 1, `${facing} ${away}`);
  assert.ok(reliefFactor(0, 100, 0) >= 0.35 && reliefFactor(0, -100, 0) <= 1.6);
  assert.equal(reliefFactor(NaN, 0, 0), 1);
  assert.ok(reliefFactor(0, -0.3, 0) > reliefFactor(0, -0.3, 180)); // l'azimut tourne avec la longitude du Soleil
  assert.equal(STUDY_SUN_ELEVATION_DEG, 15);
  assert.ok(Math.abs(slopeDeg(1, 0) - 45) < 1e-9);
});

test('gradients : pente nulle sur une grille plane, pente connue sur un plan incliné', () => {
  const n = 6;
  const heights = new Float32Array(n * n);
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) heights[r * n + c] = 2 * c * 480; // monte de 2 m par m vers x croissant
  const grid = { nRows: n, nCols: n, spacingM: 480, heights };
  const g = computeGradients(grid);
  assert.ok(Math.abs(g.gx[2 * n + 2] - 2) < 1e-6 && Math.abs(g.gy[2 * n + 2]) < 1e-6);
  heights.fill(7);
  const flat = computeGradients(grid);
  assert.ok(flat.gx.every((v) => v === 0) && flat.gy.every((v) => v === 0));
});

test('sonde : altitude, pente, distance, cap et horizon = valeurs recalculées par Python (4 points)', { skip: !present }, () => {
  const { grid, grads } = load();
  const ref = JSON.parse(readFileSync(PROBE, 'utf8'));
  const site = JSON.parse(readFileSync(new URL(`sites/${ref.site_id}.json`, DATA), 'utf8'));
  for (const c of ref.cases) {
    const p = probeAt(grid, grads, c.lat_deg, c.lon_deg, site, null);
    assert.ok(Math.abs(p.heightM - c.height_m) < ref.tolerance.height_m, `altitude ${p.heightM} / ${c.height_m}`);
    assert.ok(Math.abs(p.slopeDeg - c.slope_deg) < ref.tolerance.slope_deg, `pente ${p.slopeDeg} / ${c.slope_deg}`);
    assert.ok(Math.abs(p.distanceKm - c.distance_km) < ref.tolerance.distance_km, `distance ${p.distanceKm} / ${c.distance_km}`);
    assert.ok(Math.abs(p.azimuthDeg - c.azimuth_deg) < ref.tolerance.azimuth_deg, `cap ${p.azimuthDeg} / ${c.azimuth_deg}`);
    assert.ok(Math.abs(p.horizonDeg - c.horizon_deg) < ref.tolerance.horizon_deg, `horizon ${p.horizonDeg} / ${c.horizon_deg}`);
  }
});

test('sonde : hors grille → null ; sans site → seulement altitude et pente ; état des corps transmis', { skip: !present }, () => {
  const { grid, grads } = load();
  assert.equal(probeAt(grid, grads, -60, 10, null), null);
  const p = probeAt(grid, grads, -89.2, 30, null);
  assert.ok(Number.isFinite(p.heightM) && p.distanceKm === undefined);
  const site = JSON.parse(readFileSync(new URL('sites/site04-shackleton-rim.json', DATA), 'utf8'));
  const withBodies = probeAt(grid, grads, -89.2, 30, site, (b) => b === 'sun');
  assert.deepEqual(withBodies.visible, { sun: true, earth: false });
});

test('fond de carte : zone pleine et zone en dégradé ; l\'ombrage change avec la longitude du Soleil ; pas de relief au Nord', { skip: !present }, () => {
  const { grid, grads } = load();
  const base = buildBase(makeProjection('south', 300, 300), null, { grid, grads });
  assert.ok(base.ra && base.ra.some((v) => v === 255) && base.ra.some((v) => v > 0 && v < 255));
  const a = shadePixels(base, { latDeg: 0, lonDeg: 0 });
  const b = shadePixels(base, { latDeg: 0, lonDeg: 180 });
  let diff = 0;
  for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]);
  assert.ok(diff > 0, 'la longitude du Soleil change l\'ombrage');
  assert.equal(buildBase(makeProjection('north', 100, 100), null, { grid, grads }).ra, null);
});
