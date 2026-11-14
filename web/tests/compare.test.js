// Tests de web/js/compare.js (T-14) : écarts B − A, mêmes valeurs que le contrat, lectures au même instant, restauration depuis l'URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { candidatesForB, instantRows, kpiRows, sameWindow } from '../js/compare.js';
import { bodyReading, kpiCards } from '../js/verdicts.js';
import { decode, encode } from '../js/urlstate.js';

const T = Date.parse('2027-03-14T06:00:00Z');

function miniSite(id, sunPct, sunEl, windowEnd = '2030-12-31T23:00:00Z') {
  const gap = (pct, h) => ({ visible_pct: pct, longest_gap_h: h, n_gaps: 1 });
  const body = (el) => ({ az_mdeg: [90000, 90000], el_mdeg: [el, el], radius_mdeg: [267, 267] });
  return {
    id,
    time: { start_utc: '2027-03-14T06:00:00Z', step_s: 3600, count: 2 },
    horizon: { elev_deg: new Array(360).fill(0), truncated: new Array(360).fill(false) },
    bodies: { sun: body(sunEl), earth: body(5000) },
    kpis: {
      window: { start_utc: '2026-01-01T00:00:00Z', end_utc: windowEnd },
      sun: { strict: gap(sunPct, 100), any: gap(sunPct + 5, 90) },
      earth: { strict: gap(20, 300), any: gap(25, 250) },
      both: { strict: gap(sunPct / 2, 400), any: gap(sunPct / 2 + 1, 350) },
    },
  };
}

test('écarts = B − A, valeurs du contrat inchangées, 5 lignes', () => {
  const a = miniSite('a', 40, 1000);
  const b = miniSite('b', 10, -1000);
  const rows = kpiRows(a, b, 'strict');
  assert.equal(rows.length, 5);
  const sun = rows.find((r) => r.key === 'sunPct');
  assert.deepEqual([sun.a, sun.b, sun.delta, sun.kind], [40, 10, -30, 'pct']);
  const cards = kpiCards(a, 'strict');
  for (const r of rows) assert.equal(r.a, cards[r.key]);
  assert.equal(rows.find((r) => r.key === 'longestSunGapH').kind, 'hours');
  assert.ok(rows.every((r) => Math.abs(r.delta - (r.b - r.a)) < 1e-12));
});

test('le seuil choisi s\'applique aux deux sites', () => {
  const a = miniSite('a', 40, 1000);
  const b = miniSite('b', 10, 1000);
  assert.equal(kpiRows(a, b, 'any').find((r) => r.key === 'sunPct').a, 45);
  assert.equal(kpiRows(a, b, 'any').find((r) => r.key === 'sunPct').b, 15);
});

test('lectures au même instant : mêmes fonctions que la carte de lectures, écart de marge B − A', () => {
  const a = miniSite('a', 40, 1000);
  const b = miniSite('b', 10, -1000);
  const rows = instantRows(a, b, T, 'strict');
  assert.deepEqual(rows.map((r) => r.body), ['sun', 'earth']);
  const sun = rows[0];
  assert.deepEqual(sun.a, bodyReading(a, 'sun', T, 'strict'));
  assert.equal(sun.a.status, 'visible');
  assert.equal(sun.b.status, 'hidden');
  assert.ok(Math.abs(sun.marginDelta - (-1 - 1)) < 1e-9);
});

test('périodes différentes détectées', () => {
  assert.equal(sameWindow(miniSite('a', 1, 0), miniSite('b', 1, 0)), true);
  assert.equal(sameWindow(miniSite('a', 1, 0), miniSite('b', 1, 0, '2029-12-31T23:00:00Z')), false);
});

test('candidats pour B : tous les sites sauf A', () => {
  const sites = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(candidatesForB(sites, 'b').map((s) => s.id), ['a', 'c']);
  assert.deepEqual(candidatesForB(sites, 'zzz').map((s) => s.id), ['a', 'b', 'c']);
});

test('l\'état A / B / date / seuil est restauré depuis l\'URL', () => {
  const state = { siteIdA: 'site01-connecting-ridge', siteIdB: 'site04-shackleton-rim', compare: true, tMs: T, threshold: 'any', lang: 'en', windowDays: 7 };
  const back = decode(encode(state));
  assert.deepEqual(back, { ...state });
});

for (const [idA, idB] of [['site01-connecting-ridge', 'site04-shackleton-rim']]) {
  const urlA = new URL(`../data/sites/${idA}.json`, import.meta.url);
  const urlB = new URL(`../data/sites/${idB}.json`, import.meta.url);
  test(`${idA} contre ${idB} (données réelles) : le tableau reprend exactement les kpis des deux fichiers`, { skip: !(existsSync(urlA) && existsSync(urlB)) }, () => {
    const a = JSON.parse(readFileSync(urlA, 'utf8'));
    const b = JSON.parse(readFileSync(urlB, 'utf8'));
    assert.equal(sameWindow(a, b), true);
    for (const mode of ['strict', 'any']) {
      const sun = kpiRows(a, b, mode).find((r) => r.key === 'sunPct');
      assert.equal(sun.a, a.kpis.sun[mode].visible_pct);
      assert.equal(sun.b, b.kpis.sun[mode].visible_pct);
    }
  });
}
