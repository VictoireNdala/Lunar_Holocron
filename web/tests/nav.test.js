// Tests de web/js/ui/nav.js (fonctions pures de la coque, U-02) et du paramètre view= de l'URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEWS, IMPLEMENTED_VIEWS, railKeyTarget, isTypingTarget } from '../js/ui/nav.js';
import { encode, decode } from '../js/urlstate.js';

test('vues du rail : moins de sept destinations, la vue de site en fait partie', () => {
  assert.ok(VIEWS.length < 7);
  assert.ok(VIEWS.includes('site'));
  assert.ok(IMPLEMENTED_VIEWS.every((v) => VIEWS.includes(v)));
});

test('railKeyTarget : flèches avec bouclage, Début et Fin, autres touches ignorées', () => {
  assert.equal(railKeyTarget(0, 'ArrowDown', 5), 1);
  assert.equal(railKeyTarget(4, 'ArrowDown', 5), 0);
  assert.equal(railKeyTarget(0, 'ArrowUp', 5), 4);
  assert.equal(railKeyTarget(2, 'ArrowRight', 5), 3);
  assert.equal(railKeyTarget(2, 'ArrowLeft', 5), 1);
  assert.equal(railKeyTarget(3, 'Home', 5), 0);
  assert.equal(railKeyTarget(1, 'End', 5), 4);
  assert.equal(railKeyTarget(1, 'a', 5), null);
  assert.equal(railKeyTarget(1, 'Enter', 5), null);
});

test('isTypingTarget : champs de saisie et zones éditables', () => {
  assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
  assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
  assert.equal(isTypingTarget({ tagName: 'SELECT' }), true);
  assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false);
  assert.equal(isTypingTarget(null), false);
});

test('view= dans l\'URL : aller-retour, valeur invalide ignorée, absent si non défini', () => {
  const T = Date.parse('2027-03-14T06:00:00Z');
  assert.equal(decode(encode({ view: 'atlas', siteIdA: 'demo-a', tMs: T })).view, 'atlas');
  assert.deepEqual(decode('#view=nowhere'), {});
  assert.ok(!encode({ siteIdA: 'demo-a' }).includes('view='));
});
