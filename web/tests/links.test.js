// Tests de web/js/links.js (S-05, D-019) : liens profonds purs, coordonnées au point décimal, aucune API réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deepLinks, normalizeLon, QUICKMAP_URL, TREK_URL } from '../js/links.js';

test('site valide : deux liens https, jamais « centré » tant que non vérifié', () => {
  const r = deepLinks({ lat_deg: -89.7668, lon_deg: -171.8699 });
  assert.equal(r.quickmap.url, QUICKMAP_URL);
  assert.equal(r.trek.url, TREK_URL);
  assert.match(r.quickmap.url, /^https:\/\//);
  assert.match(r.trek.url, /^https:\/\//);
  assert.equal(r.quickmap.centered, false);
  assert.equal(r.trek.centered, false);
});

test('coordonnées au point décimal, jamais de virgule', () => {
  assert.equal(deepLinks({ lat_deg: -89.4632, lon_deg: -137.4896 }).coordsText, '-89.46320, -137.48960');
  assert.doesNotMatch(deepLinks({ lat_deg: -88.5, lon_deg: 10 }).coordsText, /\d,\d/);
});

test('longitude 0–360 ramenée à −180…180', () => {
  assert.equal(normalizeLon(123.6901), 123.6901);
  assert.equal(normalizeLon(190), -170);
  assert.equal(normalizeLon(360), 0);
  assert.equal(normalizeLon(-180), -180);
  assert.equal(deepLinks({ lat_deg: -80, lon_deg: 270 }).lon_deg, -90);
});

test('coordonnées hors plage ou invalides : null', () => {
  for (const bad of [{ lat_deg: 91, lon_deg: 0 }, { lat_deg: -90.1, lon_deg: 0 }, { lat_deg: 0, lon_deg: 361 }, { lat_deg: 0, lon_deg: -181 },
    { lat_deg: NaN, lon_deg: 0 }, { lat_deg: 0, lon_deg: Infinity }, { lat_deg: '1', lon_deg: 0 }, {}, null, undefined]) {
    assert.equal(deepLinks(bad), null, JSON.stringify(bad));
  }
  assert.notEqual(deepLinks({ lat_deg: -90, lon_deg: 360 }), null); // bornes incluses
});

test('le module n\'appelle aucune API réseau', () => {
  const text = readFileSync(new URL('../js/links.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(text, /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|import\s*\(|Image\s*\()/);
  assert.doesNotMatch(text, /\b(document|window|navigator)\b/);
});
