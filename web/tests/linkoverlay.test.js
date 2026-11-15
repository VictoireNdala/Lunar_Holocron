// Tests de atlas/linkoverlay.js (V2-05 § 7.4) : décodage des bitsets de l'index = visibilité calculée par JavaScript sur les séries, couleurs, parts de temps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { colorForPct, coveragePct, decodeBits, indexAt } from '../js/atlas/linkoverlay.js';
import { visibleSamples } from '../js/link.js';

const DATA = new URL('../data/', import.meta.url);
const present = existsSync(new URL('index.json', DATA));
const read = (path) => JSON.parse(readFileSync(new URL(path, DATA), 'utf8'));

test('décodage : bit 0 en poids faible, parts préfixes, n respecté (bits de bourrage ignorés)', () => {
  // octet 0b00000101 = échantillons 0 et 2 à 1 ; deuxième octet 0b00000001 = échantillon 8 à 1
  const b64 = Buffer.from([0b00000101, 0b00000001]).toString('base64');
  const d = decodeBits(b64, 9);
  assert.deepEqual([...d.flags], [1, 0, 1, 0, 0, 0, 0, 0, 1]);
  assert.equal(d.prefix[9], 3);
  assert.equal(decodeBits(b64, 3).prefix[3], 2);
});

test('part du temps sur une fenêtre : bornes inversées ou hors tableau ramenées, valeur exacte', () => {
  const d = decodeBits(Buffer.from([0b00001111]).toString('base64'), 8); // 4 bits à 1 puis 4 à 0
  assert.equal(coveragePct(d, 0, 7), 50);
  assert.equal(coveragePct(d, 0, 3), 100);
  assert.equal(coveragePct(d, 4, 7), 0);
  assert.equal(coveragePct(d, 7, 0), 50);
  assert.equal(coveragePct(d, -5, 100), 50);
});

test('indice d\'échantillon : arrondi à l\'heure, borné à [0 ; n − 1]', () => {
  assert.equal(indexAt(1000 + 3600_000 * 5.4, 1000, 3600_000, 100), 5);
  assert.equal(indexAt(1000 + 3600_000 * 5.6, 1000, 3600_000, 100), 6);
  assert.equal(indexAt(-1e12, 1000, 3600_000, 100), 0);
  assert.equal(indexAt(1e15, 1000, 3600_000, 100), 99);
});

test('échelle de couleurs : bornes, milieu, monotone en luminance, sans NaN', () => {
  assert.equal(colorForPct(0), '#440154');
  assert.equal(colorForPct(100), '#fde725');
  assert.equal(colorForPct(50), '#21908d');
  assert.equal(colorForPct(-20), colorForPct(0));
  assert.equal(colorForPct(500), colorForPct(100));
  const lum = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).reduce((s, v, k) => s + v * [0.2126, 0.7152, 0.0722][k], 0);
  let prev = -1;
  for (let p = 0; p <= 100; p += 5) { const l = lum(colorForPct(p)); assert.ok(l >= prev - 1e-9, `luminance non monotone à ${p} %`); prev = l; }
});

test('index réel : les bitsets décodés = visibilité STRICTE calculée par JavaScript sur les séries du site (échantillon par échantillon, 17 sites, Soleil et Terre)', { skip: !present }, () => {
  const index = read('index.json');
  assert.ok(index.sites.length >= 17);
  for (const entry of index.sites) {
    const site = read(entry.site_file);
    for (const body of ['sun', 'earth']) {
      const decoded = decodeBits(entry.link_bits[`${body}_strict`], entry.link_bits.n);
      const expected = visibleSamples(site, body, 'strict');
      assert.equal(decoded.n, expected.length);
      let bad = -1;
      for (let i = 0; i < expected.length; i += 1) if (decoded.flags[i] !== expected[i]) { bad = i; break; }
      assert.equal(bad, -1, `${entry.id} ${body} : premier écart à l'échantillon ${bad}`);
      assert.ok(Math.abs(coveragePct(decoded, 0, decoded.n - 1) - site.kpis[body].strict.visible_pct) < 1e-9);
    }
  }
});
