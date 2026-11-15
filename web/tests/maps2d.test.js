// Tests de web/js/atlas/maps2d.js (A-05) : projections des cartes, aller-retour, fond rééchantillonné, ombre de nuit, sélection de site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProjection, buildBase, shadePixels, siteAtPixel } from '../js/atlas/maps2d.js';
import { latLonToVector } from '../js/atlas/sphere.js';

const lonDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} au lieu de ${b}`);

test('carte du monde : centre = (0°, 0°), coins, aller-retour, hors carte → null', () => {
  const p = makeProjection('world', 1024, 512);
  const c = p.toPixel(0, 0);
  near(c.x, 512, 1e-9, 'x'); near(c.y, 256, 1e-9, 'y');
  const nw = p.toPixel(90, -180);
  near(nw.x, 0, 1e-9, 'x'); near(nw.y, 0, 1e-9, 'y');
  for (const [lat, lon] of [[-43.3, -11.4], [30, 120], [-80, 170]]) {
    const q = p.toPixel(lat, lon);
    const back = p.fromPixel(q.x, q.y);
    near(back.latDeg, lat, 1e-9, 'lat'); assert.ok(lonDiff(back.lonDeg, lon) < 1e-9);
  }
  assert.equal(p.fromPixel(-1, 10), null);
});

test('pôle Sud : le pôle est au centre, lon 0° vers le HAUT, lon 90° E vers la droite ; aller-retour', () => {
  const p = makeProjection('south', 600, 600);
  const pole = p.toPixel(-90, 0);
  near(pole.x, 300, 1e-9, 'x'); near(pole.y, 300, 1e-9, 'y');
  const a = p.toPixel(-80, 0);
  assert.ok(a.y < 300 && Math.abs(a.x - 300) < 1e-9, 'lon 0° vers le haut');
  const b = p.toPixel(-80, 90);
  assert.ok(b.x > 300 && Math.abs(b.y - 300) < 1e-9, 'lon 90° vers la droite');
  for (const [lat, lon] of [[-89, 10], [-75, -120], [-61, 179]]) {
    const q = p.toPixel(lat, lon);
    assert.equal(q.ok, true);
    const back = p.fromPixel(q.x, q.y);
    near(back.latDeg, lat, 1e-9, 'lat'); assert.ok(lonDiff(back.lonDeg, lon) < 1e-9);
  }
});

test('pôle Nord : lon 0° vers le BAS (convention de la carte), lon 90° E vers la droite ; aller-retour', () => {
  const p = makeProjection('north', 600, 600);
  const a = p.toPixel(80, 0);
  assert.ok(a.y > 300 && Math.abs(a.x - 300) < 1e-9, 'lon 0° vers le bas');
  const b = p.toPixel(80, 90);
  assert.ok(b.x > 300 && Math.abs(b.y - 300) < 1e-9, 'lon 90° vers la droite');
  const back = p.fromPixel(...Object.values(p.toPixel(70, -45)).slice(0, 2));
  near(back.latDeg, 70, 1e-9, 'lat'); assert.ok(lonDiff(back.lonDeg, -45) < 1e-9);
});

test('cartes polaires : la limite de latitude borne le disque ; hors disque ou hors latitude → ok faux / null', () => {
  const s = makeProjection('south', 600, 600, 60);
  near(Math.hypot(s.toPixel(-60, 33).x - 300, s.toPixel(-60, 33).y - 300), s.radiusPx, 1e-6, 'rayon à la limite');
  assert.equal(s.toPixel(-50, 0).ok, false);
  assert.equal(s.toPixel(-60, 0).ok, true);
  assert.equal(s.fromPixel(0, 0), null);
  const n = makeProjection('north', 600, 600, 60);
  assert.equal(n.toPixel(50, 0).ok, false);
  assert.equal(n.toPixel(89, 0).ok, true);
});

test('buildBase : pixels valides = disque ; couleur de la texture respectée ; vecteurs unitaires', () => {
  const tex = { width: 4, height: 2, data: new Uint8ClampedArray(4 * 2 * 4).fill(200) };
  const p = makeProjection('south', 40, 40);
  const base = buildBase(p, tex);
  const centre = 20 * 40 + 20;
  assert.equal(base.valid[centre], 1);
  assert.equal(base.valid[0], 0); // coin du carré : hors disque
  assert.equal(base.rgb[4 * centre], 200);
  const k = 3 * centre;
  near(Math.hypot(base.normals[k], base.normals[k + 1], base.normals[k + 2]), 1, 1e-6, 'norme');
  assert.ok(base.normals[k + 1] < -0.99, 'le centre de la carte du Sud pointe vers −y (pôle Sud)');
});

test('shadePixels : plein jour au point sub-solaire, nuit marquée à l\'antipode, transition au terminateur', () => {
  const p = makeProjection('world', 72, 36);
  const base = buildBase(p, { width: 2, height: 2, data: new Uint8ClampedArray(16).fill(240) });
  const sun = { latDeg: 0, lonDeg: 0 };
  const out = shadePixels(base, sun);
  const at = (lat, lon) => { const q = p.toPixel(lat, lon); return out[4 * (Math.floor(q.y) * 72 + Math.floor(q.x))]; };
  assert.equal(at(0, 0), 240, 'jour plein');
  assert.ok(at(0, 175) < 240 * 0.45, 'nuit à l\'antipode');
  assert.ok(at(0, 100) < at(0, 80), 'plus sombre de l\'autre côté du terminateur (±90°)');
  assert.ok(at(0, 90) > 240 * (1 - 0.62) && at(0, 90) < 240, 'teinte intermédiaire au terminateur');
  void latLonToVector;
});

test('siteAtPixel : site le plus proche dans le rayon, niveau 1 prioritaire à distance égale ; rien hors rayon', () => {
  const p = makeProjection('world', 1024, 512);
  const sites = [{ id: 'a', latDeg: 0, lonDeg: 0, tier: 99 }, { id: 'b', latDeg: 0, lonDeg: 0.5, tier: 1 }, { id: 'c', latDeg: 50, lonDeg: 90, tier: 1 }];
  const q = p.toPixel(0, 0.25);
  assert.equal(siteAtPixel(p, sites, q.x, q.y).id, 'b');
  assert.equal(siteAtPixel(p, sites, 5, 5), null);
  assert.equal(siteAtPixel(p, sites, p.toPixel(50, 90).x, p.toPixel(50, 90).y).id, 'c');
});

test('vue (zoom, panoramique) : toPixel et fromPixel restent inverses ; le point sous le zoom reste fixe ; le disque polaire grandit avec le zoom', () => {
  const base = makeProjection('south', 800, 600);
  for (const view of [{ zoom: 1, panX: 0, panY: 0 }, { zoom: 4, panX: 30, panY: -50 }, { zoom: 16, panX: -200, panY: 120 }]) {
    const p = makeProjection('south', 800, 600, 60, view);
    const q = p.toPixel(-86, 40);
    const back = p.fromPixel(q.x, q.y);
    assert.ok(back && Math.abs(back.latDeg + 86) < 1e-6 && Math.abs(back.lonDeg - 40) < 1e-6, JSON.stringify(view));
  }
  const z = makeProjection('south', 800, 600, 60, { zoom: 4, panX: 0, panY: 0 });
  assert.ok(Math.abs(z.radiusPx - base.radiusPx * 4) < 1e-9);
  const qb = base.toPixel(-89, 10);
  const qz = z.toPixel(-89, 10);
  assert.ok(Math.abs((qz.x - 400) - (qb.x - 400) * 4) < 1e-9, 'positions relatives au centre multipliées par le zoom');
  const world = makeProjection('world', 1000, 500, 60, { zoom: 2, panX: 0, panY: 0 });
  const w = world.toPixel(0, 0);
  assert.ok(Math.abs(w.x - 500) < 1e-9 && Math.abs(w.y - 250) < 1e-9);
  const edge = world.toPixel(0, 120);
  assert.equal(edge.ok, false); // hors cadre à ×2
  assert.deepEqual(world.fromPixel(0, 250) && Math.round(world.fromPixel(0, 250).lonDeg), -90);
});
