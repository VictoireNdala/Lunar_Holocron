// Tests de web/js/freepoint.js (V2-02, D-027) : le point libre calculé dans le navigateur contre le pipeline, sur les 4 sites réels.
// Mesures publiées dans docs/VALIDATION-RESULTATS.md : Soleil et Terre < 0,01° (parallaxe incluse), horizon 500 m : RMS et maximum, test de cohérence de la NASA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildFreePointSite, buildLocalTerrain, bodySeries, computeHorizon, computeKpis, decodePolarGrid, flatHeight, gapStats, gridHeight, parseCoordinates } from '../js/freepoint.js';
import { checkSite } from '../js/data.js';

const DATA = new URL('../data/', import.meta.url);
const present = existsSync(new URL('polar/ldem_south_500m.bin', DATA)) && existsSync(new URL('global.json', DATA));
const read = (path) => JSON.parse(readFileSync(new URL(path, DATA), 'utf8'));
const SITES = ['site01-connecting-ridge', 'site04-shackleton-rim', 'site07-peak-near-shackleton', 'site11-de-gerlache-rim'];
const circ = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

let cache = null;
function load() {
  if (cache) return cache;
  const meta = read('polar/ldem_south_500m.json');
  const buf = readFileSync(new URL('polar/ldem_south_500m.bin', DATA));
  cache = { grid: decodePolarGrid(meta, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)), globalDoc: read('global.json') };
  return cache;
}

test('coordonnées saisies : validation (pôle exact refusé, longitude ramenée à ±180, texte vide refusé)', () => {
  assert.deepEqual(parseCoordinates('-85.3', '53.3'), { latDeg: -85.3, lonDeg: 53.3 });
  assert.deepEqual(parseCoordinates(-89.9, 270), { latDeg: -89.9, lonDeg: -90 });
  for (const [lat, lon] of [[-90, 0], [90, 0], [-89.995, 0], [0, -181], [0, 361], ['', '5'], ['5', ' '], ['abc', 1], [NaN, 0], [null, 0]]) {
    assert.equal(parseCoordinates(lat, lon), null, `${lat} ; ${lon}`);
  }
});

test('gapStats : même résultat que gap_stats de pipeline/kpi.py (bords comptés)', () => {
  assert.deepEqual(gapStats([true, true], 3600), { longestH: 0, nGaps: 0 });
  assert.deepEqual(gapStats([false, false, true, false, true, false, false, false], 3600), { longestH: 3, nGaps: 3 });
  assert.deepEqual(gapStats([], 3600), { longestH: 0, nGaps: 0 });
});

test('relief plat : l\'horizon est la seule courbure (≈ −0,09° pour un œil à 2 m) et jamais tronqué', () => {
  const h = computeHorizon(flatHeight, -30, 10, 2);
  assert.ok(h.elev_deg.every((v) => v > -0.12 && v < -0.06), `[${Math.min(...h.elev_deg)} ; ${Math.max(...h.elev_deg)}]`);
  assert.ok(h.truncated.every((v) => v === false));
});

test('site hors grille : horizon « aucune donnée » (−90°) et entièrement tronqué, pas de plantage', { skip: !present }, () => {
  const { grid } = load();
  const h = computeHorizon((a, b) => gridHeight(grid, a, b), -60, 10, 2);
  assert.ok(h.elev_deg.every((v) => v === -90) && h.truncated.every(Boolean));
});

for (const id of SITES) {
  test(`${id} : Soleil et Terre du navigateur (parallaxe) contre la série du pipeline, sur 5 ans, < 0,01°`, { skip: !present }, () => {
    const { globalDoc } = load();
    const site = read(`sites/${id}.json`);
    const { lat_deg: lat, lon_deg: lon, ground_height_m: ground, observer_height_m: eye } = site.location;
    for (const body of ['sun', 'earth']) {
      const s = bodySeries(globalDoc, body, lat, lon, ground + eye);
      let maxAz = 0; let maxEl = 0; let maxR = 0;
      for (let i = 0; i < site.time.count; i += 1) {
        maxAz = Math.max(maxAz, circ(s.az_mdeg[i], site.bodies[body].az_mdeg[i]) / 1000);
        maxEl = Math.max(maxEl, Math.abs(s.el_mdeg[i] - site.bodies[body].el_mdeg[i]) / 1000);
        maxR = Math.max(maxR, Math.abs(s.radius_mdeg[i] - site.bodies[body].radius_mdeg[i]) / 1000);
      }
      assert.ok(maxAz < 0.01 && maxEl < 0.01 && maxR < 0.01, `${body} : az ${maxAz}°, él ${maxEl}°, rayon ${maxR}°`);
    }
  });

  test(`${id} : indicateurs du port JavaScript = indicateurs du pipeline (égalité exacte, strict et optimiste, mensuel)`, { skip: !present }, () => {
    const site = read(`sites/${id}.json`);
    const k = computeKpis(site.horizon.elev_deg, site.bodies, site.time.start_utc, site.time.step_s);
    assert.deepEqual(k.kpis, site.kpis);
    assert.deepEqual(k.monthly, site.monthly);
  });

  test(`${id} : horizon approché (500 m) contre l'horizon du pipeline (5 m + 80 m) : écarts bornés, jamais au-dessus du dôme de la mesure`, { skip: !present }, () => {
    const { grid } = load();
    const site = read(`sites/${id}.json`);
    const { lat_deg: lat, lon_deg: lon, observer_height_m: eye } = site.location;
    const hz = computeHorizon((a, b) => gridHeight(grid, a, b), lat, lon, eye);
    const d = hz.elev_deg.map((v, i) => v - site.horizon.elev_deg[i]);
    const rms = Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);
    const max = Math.max(...d.map(Math.abs));
    // Valeurs mesurées le 2026-11-15 : RMS 0,37° à 1,93°, maximum 1,1° à 4,4° (voir docs/VALIDATION-RESULTATS.md). Bornes = environ 1,5 × le mesuré.
    assert.ok(rms < 3.0 && max < 6.5, `RMS ${rms.toFixed(3)}°, max ${max.toFixed(3)}°`);
    assert.equal(hz.truncated.filter(Boolean).length, 0);
  });
}

test('test de cohérence de la NASA : à −89,9° avec horizon plat, la Terre est au-dessus de 0° environ la moitié du temps (50 ± 5 %)', { skip: !present }, () => {
  const { globalDoc } = load();
  const { site, covered } = buildFreePointSite({ globalDoc, grid: null, latDeg: -89.9, lonDeg: 0 });
  assert.equal(covered, false);
  const pct = site.kpis.earth.strict.visible_pct;
  assert.ok(pct > 45 && pct < 55, `Terre visible ${pct} %`);
  assert.deepEqual(checkSite(site), []);
});

test('site complet d\'un point libre au sud de 80° S : contrat respecté, relief approché dit comme tel, calcul rapide', { skip: !present }, () => {
  const { grid, globalDoc } = load();
  const t0 = performance.now();
  const { site, terrain, covered } = buildFreePointSite({ globalDoc, grid, latDeg: -85.3, lonDeg: 53.3 });
  const ms = performance.now() - t0;
  assert.equal(covered, true);
  assert.deepEqual(checkSite(site), []);
  assert.equal(site.kind, 'custom');
  assert.equal(site.terrain_tier, 'approx500m');
  assert.equal(site.synthetic, false);
  assert.equal(site.id, 'custom:-85.3,53.3');
  assert.equal(site.horizon.elev_deg.length, 360);
  assert.equal(terrain.heightsM.length, 257 * 257);
  assert.ok(terrain.meta.z.max_m > terrain.meta.z.min_m);
  assert.ok(ms < 5000, `${ms.toFixed(0)} ms`);
});

test('terrain d\'un point libre plat : surface nulle sauf la courbure, gamme non dégénérée', () => {
  const t = buildLocalTerrain(flatHeight, -30, 10, 0, 'custom:test');
  assert.equal(t.heightsM[128 * 257 + 128], 0);
  assert.ok(t.heightsM[0] < 0, 'la courbure abaisse les coins');
  assert.ok(t.meta.z.max_m > t.meta.z.min_m);
});
