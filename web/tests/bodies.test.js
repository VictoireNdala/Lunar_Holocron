// Tests de web/js/bodies.js (V2-04) : assombrissement centre-bord, phase de la Terre, rayon à l'écran, schématique déterministe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BODY_SCALES, LIMB_DARKENING_U, MIN_BODY_RADIUS_PX, discRadiusPx, earthPhase, earthSurface, limbIntensity, quantizePhase } from '../js/bodies.js';

test('assombrissement centre-bord : 1 au centre, 1 − u au bord, strictement décroissant, borné', () => {
  assert.equal(limbIntensity(0), 1);
  assert.ok(Math.abs(limbIntensity(1) - (1 - LIMB_DARKENING_U)) < 1e-12);
  let prev = 2;
  for (let r = 0; r <= 1.0001; r += 0.05) { const v = limbIntensity(r); assert.ok(v < prev + 1e-12); prev = v; }
  assert.equal(limbIntensity(-3), 1);
  assert.equal(limbIntensity(5), limbIntensity(1));
  assert.ok(Math.abs(limbIntensity(0.5, 0) - 1) < 1e-12, 'sans assombrissement (u = 0) : disque uniforme');
});

test('phase de la Terre : pleine quand le Soleil est à l\'opposé (ψ = 180°), nouvelle quand il est dans la même direction, moitié à 90°', () => {
  const earth = { azDeg: 130, elDeg: 6 };
  assert.ok(Math.abs(earthPhase({ azDeg: 130, elDeg: 6 }, earth).k) < 1e-12);
  assert.ok(Math.abs(earthPhase({ azDeg: 310, elDeg: -6 }, earth).k - 1) < 1e-9);
  assert.ok(Math.abs(earthPhase({ azDeg: 130, elDeg: 96 }, earth).k - 0.5) < 1e-9); // 90° d'écart en élévation
  assert.ok(Math.abs(earthPhase({ azDeg: 40, elDeg: 0 }, { azDeg: 130, elDeg: 0 }).psiDeg - 90) < 1e-9);
});

test('angle de position : Soleil à droite de la Terre = 90°, à gauche = 270°, au-dessus (zénith) = 0°, en dessous = 180°', () => {
  const e = { azDeg: 100, elDeg: 0 };
  assert.ok(Math.abs(earthPhase({ azDeg: 130, elDeg: 0 }, e).paDeg - 90) < 1e-6);
  assert.ok(Math.abs(earthPhase({ azDeg: 70, elDeg: 0 }, e).paDeg - 270) < 1e-6);
  assert.ok(Math.abs(earthPhase({ azDeg: 100, elDeg: 30 }, e).paDeg - 0) < 1e-6);
  assert.ok(Math.abs(earthPhase({ azDeg: 100, elDeg: -30 }, e).paDeg - 180) < 1e-6);
});

test('phase quantifiée : au 1/32 et à 10°, bouclage de l\'angle à 360°', () => {
  assert.deepEqual(quantizePhase({ k: 0.5, paDeg: 94 }), { k: 0.5, paDeg: 90 });
  assert.deepEqual(quantizePhase({ k: 0.3, paDeg: 358 }), { k: 0.3125, paDeg: 0 });
  assert.equal(quantizePhase({ k: 1, paDeg: 0 }).k, 1);
});

test('rayon à l\'écran = rayon angulaire × px/° (taille réelle) ; plancher de lisibilité signalé ; agrandissement illustratif signalé', () => {
  assert.deepEqual(discRadiusPx(0.95, 10, 1), { radiusPx: 9.5, enlarged: false, scale: 1 });
  assert.deepEqual(discRadiusPx(0.95, 10, 4), { radiusPx: 38, enlarged: true, scale: 4 });
  const small = discRadiusPx(0.267, 5, 1); // 1,3 px réels
  assert.equal(small.radiusPx, MIN_BODY_RADIUS_PX);
  assert.equal(small.enlarged, true);
  assert.ok(small.scale > 1);
  assert.deepEqual([...BODY_SCALES], [1, 4, 8]);
});

test('Terre schématique : déterministe (mêmes entrées, mêmes valeurs), continents et océans présents', () => {
  assert.deepEqual(earthSurface(0.2, -0.3), earthSurface(0.2, -0.3));
  let land = 0; let ocean = 0;
  for (let x = -0.9; x <= 0.9; x += 0.1) for (let y = -0.9; y <= 0.9; y += 0.1) { if (x * x + y * y > 0.8) continue; if (earthSurface(x, y).land) land += 1; else ocean += 1; }
  assert.ok(land > 5 && ocean > 5, `${land} terres, ${ocean} océans`);
});
