// Tests de web/js/data.js : lecture des séries (bodyStateAt), chargement avec un fetch simulé, erreurs claires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { bodyStateAt, siteTimeRange, createDataSource, checkSite, checkGlobal, globalSeries, DataError } from '../js/data.js';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
const FIXTURES_DIR = fileURLToPath(new URL('../../tests/fixtures/', import.meta.url)); // jeux FICTIFS de test (D-029) : jamais sous web/
const HOUR_MS = 3600 * 1000;

/** fetch simulé qui lit les fichiers sous web/ ; 404 si absent. */
function diskFetch(overrides = {}, base = WEB_DIR) {
  return async (url) => {
    if (url in overrides) return overrides[url];
    try {
      const buf = await readFile(base + url);
      return {
        ok: true, status: 200,
        json: async () => JSON.parse(buf.toString('utf8')),
        arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };
    } catch {
      return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
    }
  };
}

/** Site minimal de 4 échantillons dont l'azimut du Soleil passe 359° → 1°. */
function tinySite() {
  return {
    schema_version: '1.0',
    time: { start_utc: '2027-01-01T00:00:00Z', step_s: 3600, count: 4 },
    horizon: { elev_deg: new Array(360).fill(0), truncated: new Array(360).fill(false) },
    bodies: {
      sun: { az_mdeg: [358000, 359000, 1000, 2000], el_mdeg: [1000, 2000, 3000, 4000], radius_mdeg: [266, 266, 268, 268] },
      earth: { az_mdeg: [2000, 1000, 359000, 358000], el_mdeg: [-500, 0, 500, 1000], radius_mdeg: [950, 950, 950, 950] },
    },
  };
}

const T0 = Date.parse('2027-01-01T00:00:00Z');

test('siteTimeRange lit la période', () => {
  const r = siteTimeRange(tinySite());
  assert.equal(r.startMs, T0);
  assert.equal(r.endMs, T0 + 3 * HOUR_MS);
  assert.equal(r.stepMs, HOUR_MS);
  assert.equal(r.count, 4);
});

test('bodyStateAt : valeur exacte sur un échantillon', () => {
  const s = bodyStateAt(tinySite(), 'sun', T0);
  assert.deepEqual(s, { azDeg: 358, elDeg: 1, radiusDeg: 0.266, inRange: true });
});

test('bodyStateAt : interpolation linéaire et saut 359° → 1°', () => {
  const site = tinySite();
  const mid = bodyStateAt(site, 'sun', T0 + 1.5 * HOUR_MS);
  assert.equal(mid.azDeg, 0);
  assert.equal(mid.elDeg, 2.5);
  assert.ok(Math.abs(mid.radiusDeg - 0.267) < 1e-12);
  assert.equal(bodyStateAt(site, 'sun', T0 + 1.25 * HOUR_MS).azDeg, 359.5);
  assert.equal(bodyStateAt(site, 'earth', T0 + 1.5 * HOUR_MS).azDeg, 0);
  assert.equal(bodyStateAt(site, 'earth', T0 + 1.75 * HOUR_MS).azDeg, 359.5);
});

test('bodyStateAt : dernier échantillon dans la période, au-delà borné et signalé', () => {
  const site = tinySite();
  assert.equal(bodyStateAt(site, 'sun', T0 + 3 * HOUR_MS).inRange, true);
  const after = bodyStateAt(site, 'sun', T0 + 10 * HOUR_MS);
  assert.deepEqual([after.azDeg, after.elDeg, after.inRange], [2, 4, false]);
  const before = bodyStateAt(site, 'sun', T0 - HOUR_MS);
  assert.deepEqual([before.azDeg, before.elDeg, before.inRange], [358, 1, false]);
});

test('bodyStateAt refuse un instant non numérique ou un corps inconnu', () => {
  assert.throws(() => bodyStateAt(tinySite(), 'sun', Number.NaN), TypeError);
  assert.throws(() => bodyStateAt(tinySite(), 'moon', T0), TypeError);
});

test('checkSite signale une série de mauvaise longueur et une version majeure inconnue', () => {
  const site = tinySite();
  site.bodies.earth.el_mdeg.pop();
  assert.match(checkSite(site).join('\n'), /bodies\.earth\.el_mdeg/);
  const v2 = tinySite();
  v2.schema_version = '2.0';
  assert.match(checkSite(v2).join('\n'), /schema_version/);
});

test('chargement du jeu d\'exemple : index, site, terrain', async () => {
  const src = createDataSource('sample/', diskFetch({}, FIXTURES_DIR));
  const index = await src.loadIndex();
  assert.equal(index.synthetic, true);
  assert.equal(index.sites[0].id, 'sample-a');
  const site = await src.loadSite('sample-a');
  assert.equal(site.time.count, 168);
  const s = bodyStateAt(site, 'sun', Date.parse(site.time.start_utc));
  assert.equal(s.azDeg, site.bodies.sun.az_mdeg[0] / 1000);
  assert.strictEqual(await src.loadSite('sample-a'), site, 'deuxième chargement servi par le cache');
  const terrain = await src.loadTerrain('sample-a');
  const n = terrain.meta.grid.n;
  assert.equal(terrain.heightsM.length, n * n);
  const step = (terrain.meta.z.max_m - terrain.meta.z.min_m) / 65535;
  assert.ok(Math.min(...terrain.heightsM) >= terrain.meta.z.min_m - step);
  assert.ok(Math.max(...terrain.heightsM) <= terrain.meta.z.max_m + step);
});

test('global.json : chargement, séries pour l\'interpolation, contrôle de longueur, absence signalée', async () => {
  const doc = {
    schema_version: '1.1', synthetic: true, time: { t0_utc: '2027-01-01T00:00:00Z', step_s: 3600, n: 3 },
    sun: { lat_mdeg: [0, 1000, 2000], lon_mdeg: [179000, 180000 - 1, -179000], radius_mdeg: [267, 267, 267] },
    earth: { lat_mdeg: [0, 0, 0], lon_mdeg: [0, 0, 0], radius_mdeg: [950, 950, 950] },
  };
  const ok = { ok: true, status: 200, json: async () => doc };
  const src = createDataSource('data/x/', diskFetch({ 'data/x/global.json': ok }));
  const g = await src.loadGlobal();
  assert.strictEqual(await src.loadGlobal(), g, 'servi par le cache');
  const s = globalSeries(g, 'sun');
  assert.deepEqual([s.t0Ms, s.stepMs, s.latMdeg.length], [Date.parse('2027-01-01T00:00:00Z'), 3600000, 3]);
  assert.match(checkGlobal({ ...doc, sun: { ...doc.sun, lat_mdeg: [0] } }).join('\n'), /sun\.lat_mdeg/);
  await assert.rejects(createDataSource('data/absent/', diskFetch()).loadGlobal(), (err) => err instanceof DataError && err.code === 'missing');
});

test('fichier manquant : DataError « missing » qui nomme le fichier', async () => {
  const src = createDataSource('data/absent/', diskFetch());
  await assert.rejects(src.loadIndex(), (err) => err instanceof DataError && err.code === 'missing' && err.url === 'data/absent/index.json' && err.status === 404);
});

test('serveur injoignable (ouverture en file://) : DataError « network »', async () => {
  const src = createDataSource('sample/', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(src.loadIndex(), (err) => err instanceof DataError && err.code === 'network');
});

test('version majeure inconnue dans l\'index : DataError « schema-version »', async () => {
  const bad = { ok: true, status: 200, json: async () => ({ schema_version: '2.0', synthetic: true, sites: [] }) };
  const src = createDataSource('data/x/', diskFetch({ 'data/x/index.json': bad }));
  await assert.rejects(src.loadIndex(), (err) => err instanceof DataError && err.code === 'schema-version');
});

test('site inconnu de l\'index : DataError « unknown-site »', async () => {
  const src = createDataSource('sample/', diskFetch({}, FIXTURES_DIR));
  await assert.rejects(src.loadSite('nope'), (err) => err instanceof DataError && err.code === 'unknown-site');
});
