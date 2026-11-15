// Tests de web/js/visibility.js : MÊMES valeurs d'or que pipeline/tests/test_visibility.py (CLAUDE.md, principe 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { visibleFraction, horizonAt, isVisible } from '../js/visibility.js';

const golden = (name) => JSON.parse(readFileSync(new URL(`../../tests/golden/${name}`, import.meta.url), 'utf8'));
const FRACTION = golden('visible_fraction.json');
const HORIZON = golden('horizon_at.json');

test('visibleFraction : valeurs d\'or (tolérance 1e-6) et seuils', () => {
  for (const c of FRACTION.cases) {
    const f = visibleFraction(c.el_deg, FRACTION.radius_deg, c.horizon_deg);
    assert.ok(Math.abs(f - c.f) <= FRACTION.tolerance_abs, `el=${c.el_deg} h=${c.horizon_deg} : ${f} au lieu de ${c.f}`);
    assert.equal(isVisible(f, 'strict'), c.strict);
    assert.equal(isVisible(f, 'any'), c.any);
  }
});

test('horizonAt : valeurs d\'or, bouclage 359° → 0°', () => {
  const mask = Array.from({ length: 360 }, (_, i) => i / 100);
  for (const c of HORIZON.cases) {
    const h = horizonAt(mask, c.az_deg);
    assert.ok(Math.abs(h - c.h_deg) <= HORIZON.tolerance_abs, `az=${c.az_deg} : ${h} au lieu de ${c.h_deg}`);
  }
});

test('monotonie et symétrie f(d) + f(−d) = 1', () => {
  let prev = -1;
  for (let k = -1000; k <= 1000; k += 1) {
    const d = k * 0.0005;
    const f = visibleFraction(d, 0.27, 0);
    assert.ok(f >= prev);
    prev = f;
    assert.ok(Math.abs(f + visibleFraction(-d, 0.27, 0) - 1) < 1e-12);
  }
});

test('strict ⇔ d ≥ 0 ; any ⇔ d > −r', () => {
  const r = 0.27;
  for (const [d, strict, any] of [[0, true, true], [-1e-6, false, true], [-0.2699, false, true], [-0.27, false, false], [0.01, true, true]]) {
    const f = visibleFraction(d, r, 0);
    assert.equal(isVisible(f, 'strict'), strict, `strict d=${d}`);
    assert.equal(isVisible(f, 'any'), any, `any d=${d}`);
  }
});

test('rayon très petit : pas de NaN, marche nette', () => {
  assert.deepEqual([-1e-3, 0, 1e-3].map((d) => visibleFraction(d, 1e-9, 0)), [0, 0.5, 1]);
});

test('entrées invalides refusées', () => {
  assert.throws(() => visibleFraction(0, 0, 0), RangeError);
  assert.throws(() => isVisible(0.5, 'maybe'), RangeError);
  assert.throws(() => horizonAt(new Array(359).fill(0), 10), RangeError);
});

test('tolérance numérique D-031 : bruit d\'un ulp à la limite sans effet, vrai écart pris en compte', () => {
  assert.equal(isVisible(0.5 - 1e-12, 'strict'), true); // 0,5 écrit 0,4999999999990 : même cas
  assert.equal(isVisible(0.5 - 1e-6, 'strict'), false);
  assert.equal(isVisible(1e-12, 'any'), false); // bruit autour de 0 : le disque est tangent, pas visible
  assert.equal(isVisible(1e-6, 'any'), true);
  assert.equal(isVisible(0, 'any'), false);
});
