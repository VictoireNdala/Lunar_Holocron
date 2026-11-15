// Tests de web/js/urlstate.js : aller-retour état ⇄ fragment d'URL, valeurs invalides ignorées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode } from '../js/urlstate.js';

const T = Date.parse('2027-03-14T06:00:00Z');

test('encode produit le fragment documenté (INTERFACE § 3)', () => {
  const hash = encode({ siteIdA: 'demo-a', siteIdB: 'demo-b', compare: true, tMs: T, threshold: 'strict', lang: 'fr', windowDays: 30 });
  assert.equal(hash, '#a=demo-a&b=demo-b&t=2027-03-14T06:00Z&thr=strict&lang=fr&w=30');
});

test('encode omet b sans comparaison et tronque à la minute', () => {
  const hash = encode({ siteIdA: 'demo-a', siteIdB: 'demo-b', compare: false, tMs: T + 59_000, threshold: 'any', lang: 'en', windowDays: 'all' });
  assert.equal(hash, '#a=demo-a&t=2027-03-14T06:00Z&thr=any&lang=en&w=all');
});

test('aller-retour', () => {
  const state = { siteIdA: 'sample-a', siteIdB: 'demo-c', compare: true, tMs: T, threshold: 'any', lang: 'en', windowDays: 365 };
  assert.deepEqual(decode(encode(state)), state);
});

test('valeurs invalides ignorées sans erreur', () => {
  assert.deepEqual(decode('#a=BAD ID&t=garbage&thr=foo&lang=de&w=12'), {});
  assert.deepEqual(decode('#t=2027-13-45T99:00Z'), {});
  assert.deepEqual(decode(''), {});
  assert.deepEqual(decode('#'), {});
  assert.deepEqual(decode('#%E0%A4%A'), {}); // encodage cassé
});

test('les valeurs valides sont gardées même si d\'autres sont invalides', () => {
  assert.deepEqual(decode('#a=demo-a&thr=foo&w=7'), { siteIdA: 'demo-a', windowDays: 7 });
});

test('alias proj= (ATLAS § 4) : désigne la vue d\'Atlas ; view= l\'emporte ; valeur inconnue ignorée', () => {
  assert.deepEqual(decode('#proj=globe'), { view: 'atlas' });
  assert.deepEqual(decode('#proj=south&t=2027-03-14T06:00Z'), { view: 'south', tMs: T });
  assert.deepEqual(decode('#view=north&proj=world'), { view: 'north' });
  assert.deepEqual(decode('#proj=toString'), {});
  assert.deepEqual(decode('#proj=mars'), {});
});

test('point libre (D-027) : a=custom:lat,lon fait l\'aller-retour ; formes invalides ignorées', () => {
  const state = { siteIdA: 'custom:-85.3,53.3', tMs: T, threshold: 'strict', lang: 'fr', windowDays: 30 };
  assert.equal(encode(state), '#a=custom:-85.3,53.3&t=2027-03-14T06:00Z&thr=strict&lang=fr&w=30');
  assert.deepEqual(decode(encode(state)), state);
  assert.equal(decode('#a=custom:-85.3,53.3').siteIdA, 'custom:-85.3,53.3');
  for (const bad of ['custom:abc,1', 'custom:1', 'custom:1,2,3', 'custom:-85.3', 'custom:1234,5', 'custom:<script>,1']) {
    assert.deepEqual(decode(`#a=${bad}`), {}, bad);
  }
});
