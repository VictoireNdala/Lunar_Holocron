// Tests de la projection écran du panorama (T-10, INTERFACE § 5) : un corps à (az, el) connus tombe aux pixels attendus.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeView, toScreen, fromScreen, relativeAzDeg, compassTicks, verticalExaggeration, bodyRadiusPx } from '../js/panorama.js';

const V = makeView({ centerAzDeg: 0, widthDeg: 90, elMinDeg: -2, elMaxDeg: 14, widthPx: 900, heightPx: 160 });

test('relativeAzDeg : écart signé dans (−180, 180]', () => {
  assert.equal(relativeAzDeg(10, 0), 10);
  assert.equal(relativeAzDeg(350, 0), -10);
  assert.equal(relativeAzDeg(180, 0), 180);
  assert.equal(relativeAzDeg(0, 350), 10);
  assert.equal(relativeAzDeg(190, 10), 180);
});

test('toScreen : centre, bords, haut et bas', () => {
  assert.deepEqual(toScreen(V, 0, 6), { x: 450, y: 80, inView: true });
  assert.deepEqual(toScreen(V, 45, 14), { x: 900, y: 0, inView: true });
  assert.deepEqual(toScreen(V, -45 + 360, -2), { x: 0, y: 160, inView: true });
});

test('toScreen : bouclage autour du nord (centre 0°, azimut 350° à gauche)', () => {
  const p = toScreen(V, 350, 6);
  assert.equal(p.x, 350);
  assert.equal(p.inView, true);
});

test('toScreen : hors fenêtre signalé (côté donné par le signe de x − centre)', () => {
  const right = toScreen(V, 120, 6);
  assert.equal(right.inView, false);
  assert.ok(right.x > 900);
  const left = toScreen(V, 250, 6);
  assert.equal(left.inView, false);
  assert.ok(left.x < 0);
});

test('fromScreen est l\'inverse de toScreen', () => {
  for (const [az, el] of [[0, 6], [30, 1.5], [340, -1], [44.9, 13.9]]) {
    const p = toScreen(V, az, el);
    const back = fromScreen(V, p.x, p.y);
    assert.ok(Math.abs(relativeAzDeg(back.azDeg, az)) < 1e-9);
    assert.ok(Math.abs(back.elDeg - el) < 1e-9);
  }
});

test('vue 360° : tout azimut est dans la fenêtre', () => {
  const full = makeView({ centerAzDeg: 180, widthDeg: 360, elMinDeg: -2, elMaxDeg: 14, widthPx: 1440, heightPx: 160 });
  for (const az of [0, 90, 179.9, 359.9]) assert.equal(toScreen(full, az, 0).inView, true);
});

test('compassTicks : graduations tous les 10° et points intercardinaux tous les 45°, dans la fenêtre', () => {
  const ticks = compassTicks(V);
  assert.ok(ticks.every((t) => t.x >= 0 && t.x <= 900));
  const n = ticks.find((t) => t.azDeg === 0);
  assert.equal(n.cardinal, 'N');
  assert.equal(n.x, 450);
  assert.equal(ticks.find((t) => t.azDeg === 315).cardinal, 'NW');
  assert.equal(ticks.find((t) => t.azDeg === 315).x, 0);
  assert.equal(ticks.find((t) => t.azDeg === 45).cardinal, 'NE');
  assert.equal(ticks.find((t) => t.azDeg === 10).cardinal, null);
  assert.equal(ticks.length, 11); // −40 … +40 tous les 10° (9) + 315° et 45° (bords de la fenêtre)
});

test('verticalExaggeration : rapport des échelles verticale et horizontale', () => {
  // 160 px pour 16° → 10 px/° ; 900 px pour 90° → 10 px/° : ×1.
  assert.equal(verticalExaggeration(V), 1);
  const tall = makeView({ centerAzDeg: 0, widthDeg: 360, elMinDeg: -2, elMaxDeg: 14, widthPx: 720, heightPx: 160 });
  assert.equal(verticalExaggeration(tall), 5);
});

test('bodyRadiusPx : rayon réel à l\'échelle, élargi à 5 px au minimum et signalé', () => {
  assert.deepEqual(bodyRadiusPx(V, 0.95), { radiusPx: 9.5, enlarged: false });
  assert.deepEqual(bodyRadiusPx(V, 0.267), { radiusPx: 5, enlarged: true });
});
