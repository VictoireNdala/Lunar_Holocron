// Tests de web/js/playback.js : la lecture suit le temps réel mesuré (ATLAS § 4), bornes, « maintenant ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, createPlayback, snapNow, SPEEDS, TICK_MS } from '../js/playback.js';
import { createStore } from '../js/store.js';

const T0 = Date.parse('2027-03-14T06:00:00Z');
const RANGE = { startMs: Date.parse('2026-01-01T00:00:00Z'), endMs: Date.parse('2030-12-31T00:00:00Z') };

/** Horloge et planificateur simulés : `run(ms, frameMs)` fait avancer le temps réel image par image. */
function fakeEnv() {
  let now = 1000;
  let pending = null;
  return {
    clock: () => now,
    schedule: (fn) => { pending = fn; return 1; },
    cancel: () => { pending = null; },
    run(ms, frameMs) {
      for (let elapsed = 0; elapsed < ms && pending; elapsed += frameMs) {
        now += frameMs;
        const fn = pending; pending = null; fn();
      }
    },
    hasPending: () => pending !== null,
  };
}

test('10 s réelles à ×3600 donnent +10 h simulées à ±1 % (images à 60 Hz)', () => {
  const env = fakeEnv();
  const store = createStore({ tMs: T0, speed: 3600 });
  createPlayback({ store, getRange: () => RANGE, ...env }).play();
  env.run(10_000, 1000 / 60);
  const simulatedH = (store.get().tMs - T0) / 3_600_000;
  assert.ok(Math.abs(simulatedH - 10) < 0.1, `attendu 10 h ±1 %, obtenu ${simulatedH}`);
});

test('le résultat ne dépend pas du nombre d\'images : 10 s à ×3600 avec des images à 5 Hz', () => {
  const env = fakeEnv();
  const store = createStore({ tMs: T0, speed: 3600 });
  createPlayback({ store, getRange: () => RANGE, ...env }).play();
  env.run(10_000, 200);
  assert.ok(Math.abs((store.get().tMs - T0) / 3_600_000 - 10) < 0.1);
});

test('toutes les vitesses proposées : 20 s réelles = 20 × vitesse secondes simulées (±1 %, retard < 1 pas de mise à jour)', () => {
  for (const speed of SPEEDS) {
    const env = fakeEnv();
    const store = createStore({ tMs: T0, speed });
    createPlayback({ store, getRange: () => null, ...env }).play();
    env.run(20_000, 16);
    const got = (store.get().tMs - T0) / 1000; // le retard maximal est un pas de mise à jour (TICK_MS), soit 0,5 % de 20 s
    assert.ok(Math.abs(got / (20 * speed) - 1) < 0.01, `×${speed} : ${got} s`);
  }
});

test('pause : l\'horloge s\'arrête et plus aucune image n\'est planifiée', () => {
  const env = fakeEnv();
  const store = createStore({ tMs: T0, speed: 60 });
  const pb = createPlayback({ store, getRange: () => RANGE, ...env });
  pb.play();
  env.run(1000, 16);
  pb.pause();
  const frozen = store.get().tMs;
  env.run(2000, 16);
  assert.equal(store.get().tMs, frozen);
  assert.equal(store.get().playing, false);
  assert.equal(env.hasPending(), false);
});

test('fin de période : l\'instant est borné (pas d\'extrapolation) et la lecture s\'arrête', () => {
  const env = fakeEnv();
  const store = createStore({ tMs: RANGE.endMs - 3_600_000, speed: 86400 });
  createPlayback({ store, getRange: () => RANGE, ...env }).play();
  env.run(2000, 16);
  assert.equal(store.get().tMs, RANGE.endMs);
  assert.equal(store.get().playing, false);
});

test('advance : un grand écart réel (onglet en veille) est plafonné', () => {
  const { tMs } = advance(T0, 60_000, 3600, null);
  assert.equal(tMs, T0 + 2000 * 3600);
  assert.equal(advance(T0, -500, 60, null).tMs, T0); // jamais en arrière
});

test('setSpeed refuse une vitesse inconnue', () => {
  const store = createStore({ speed: 60 });
  const pb = createPlayback({ store, getRange: () => null, ...fakeEnv() });
  pb.setSpeed(7);
  assert.equal(store.get().speed, 60);
  pb.setSpeed(86400);
  assert.equal(store.get().speed, 86400);
});

test('snapNow : dans la période → minute courante ; hors période → outside', () => {
  const inside = snapNow(Date.parse('2026-11-14T21:30:45Z'), RANGE);
  assert.deepEqual(inside, { tMs: Date.parse('2026-11-14T21:30:00Z'), outside: false });
  assert.deepEqual(snapNow(Date.parse('2035-01-01T00:00:00Z'), RANGE), { outside: true });
  assert.equal(TICK_MS > 0, true);
});

test('pause : le temps réel écoulé depuis la dernière mise à jour est compté (pas de retard à l’arrêt)', () => {
  const env = fakeEnv();
  const store = createStore({ tMs: T0, speed: 3600 });
  const pb = createPlayback({ store, getRange: () => RANGE, ...env });
  pb.play();
  env.run(50, 50); // une image à +50 ms : moins que TICK_MS, donc pas encore de mise à jour
  assert.equal(store.get().tMs, T0);
  pb.pause();
  assert.equal(store.get().tMs, T0 + 50 * 3600);
});
