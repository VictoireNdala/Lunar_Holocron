// Tests de web/js/geometry.js : angles, déroulement d'azimut, passage ENU → Three.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapDeg, unwrapAzMdeg, lerpAzMdeg, enuToThree } from '../js/geometry.js';

test('wrapDeg ramène dans [0, 360)', () => {
  assert.equal(wrapDeg(0), 0);
  assert.equal(wrapDeg(-1), 359);
  assert.equal(wrapDeg(360), 0);
  assert.equal(wrapDeg(725), 5);
  assert.equal(wrapDeg(-720), 0);
  const tiny = wrapDeg(-1e-14);
  assert.ok(tiny >= 0 && tiny < 360);
});

test('unwrapAzMdeg : saut 359° → 1° et 1° → 359°', () => {
  assert.equal(unwrapAzMdeg(359000, 1000), 361000);
  assert.equal(unwrapAzMdeg(1000, 359000), -1000);
  assert.equal(unwrapAzMdeg(100000, 200000), 200000);
  assert.equal(unwrapAzMdeg(0, 180000), 180000); // écart de 180° exactement : pas de déroulement
});

test('lerpAzMdeg interpole sur l\'angle déroulé et ramène dans [0, 360000)', () => {
  assert.equal(lerpAzMdeg(359000, 1000, 0.5), 0);
  assert.equal(lerpAzMdeg(359000, 1000, 0.25), 359500);
  assert.equal(lerpAzMdeg(1000, 359000, 0.5), 0);
  assert.equal(lerpAzMdeg(10000, 20000, 0.5), 15000);
  assert.equal(lerpAzMdeg(10000, 20000, 0), 10000);
  assert.equal(lerpAzMdeg(10000, 20000, 1), 20000);
});

test('enuToThree : x = Est, y = Haut, z = −Nord (regarder au nord = regarder vers −z)', () => {
  assert.deepEqual(enuToThree(1, 2, 3), { x: 1, y: 3, z: -2 });
  assert.deepEqual(enuToThree(0, 1, 0), { x: 0, y: 0, z: -1 });
});
