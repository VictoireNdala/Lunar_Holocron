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
