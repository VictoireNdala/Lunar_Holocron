// Tests de web/js/atlas/sphere.js (A-02, ATLAS § 6) contre tests/golden/atlas_sphere.json (calculé par des méthodes indépendantes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  latLonToVector, vectorToLatLon, angularDistanceDeg, terminatorCircle, terminatorLatitudeDeg,
  equirectPixel, equirectLatLon, southPolar, southPolarInverse, northPolar, northPolarInverse, interpolateSubPoint,
} from '../js/atlas/sphere.js';

const G = JSON.parse(readFileSync(new URL('../../tests/golden/atlas_sphere.json', import.meta.url), 'utf8'));
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} au lieu de ${b}`);
const lonDiff = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);

test('latLonToVector : valeurs d\'or et convention (lon +90° → −z, l\'Est à droite vu de l\'extérieur)', () => {
  for (const c of G.vectors) {
    const v = latLonToVector(c.lat_deg, c.lon_deg);
    near(v.x, c.v[0], G.tolerance_vector, `x (${c.lat_deg}, ${c.lon_deg})`);
    near(v.y, c.v[1], G.tolerance_vector, `y (${c.lat_deg}, ${c.lon_deg})`);
    near(v.z, c.v[2], G.tolerance_vector, `z (${c.lat_deg}, ${c.lon_deg})`);
  }
  assert.deepEqual(Object.values(latLonToVector(0, 0)).map((x) => x + 0), [1, 0, 0]);
});

test('vectorToLatLon : aller-retour sur 1 000 points, longitude dans [−180, 180)', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (let k = 0; k < 1000; k += 1) {
    const lat = -89.9 + rnd() * 179.8;
    const lon = -180 + rnd() * 360;
    const back = vectorToLatLon(latLonToVector(lat, lon));
    near(back.latDeg, lat, 1e-9, 'lat');
    assert.ok(lonDiff(back.lonDeg, lon) < 1e-9, `lon ${back.lonDeg} au lieu de ${lon}`);
    assert.ok(back.lonDeg >= -180 && back.lonDeg < 180);
  }
  const pole = vectorToLatLon({ x: 0, y: -1, z: 0 });
  near(pole.latDeg, -90, 1e-12, 'pôle sud');
});

test('angularDistanceDeg : valeurs d\'or (arccos du produit scalaire), symétrie, longitude ±180', () => {
  for (const c of G.distances) {
    near(angularDistanceDeg(c.a[0], c.a[1], c.b[0], c.b[1]), c.deg, G.tolerance_deg, `${c.a} → ${c.b}`);
    near(angularDistanceDeg(c.b[0], c.b[1], c.a[0], c.a[1]), c.deg, G.tolerance_deg, 'symétrie');
  }
});

test('terminateur : tout point du grand cercle est à 90° du point sub-solaire (Soleil à l\'horizon, sphère lisse)', () => {
  for (const t of G.terminators) {
    const circle = terminatorCircle(t.sub[0], t.sub[1], 8);
    assert.equal(circle.length, 8);
    for (const p of circle) near(angularDistanceDeg(t.sub[0], t.sub[1], p.latDeg, p.lonDeg), 90, 1e-9, `sub ${t.sub}`);
  }
  // sub-solaire (0°, 0°) ⇒ terminateur = méridiens ±90° ; sub-solaire (0°, 90°) ⇒ méridiens 0° et 180°.
  for (const p of terminatorCircle(0, 0, 360)) assert.ok(lonDiff(p.lonDeg, 90) < 1e-9 || lonDiff(p.lonDeg, -90) < 1e-9 || Math.abs(p.latDeg) > 89.9999, `${p.latDeg}, ${p.lonDeg}`);
  for (const p of terminatorCircle(0, 90, 360)) assert.ok(lonDiff(p.lonDeg, 0) < 1e-9 || lonDiff(p.lonDeg, 180) < 1e-9 || Math.abs(p.latDeg) > 89.9999, `${p.latDeg}, ${p.lonDeg}`);
});

test('terminatorLatitudeDeg : tan φ = −cos(λ−λ☉)/tan φ☉ ; points à 90° du sub-solaire ; cas φ☉ ≈ 0 traité', () => {
  for (const [subLat, subLon] of [[20, 40], [-60, -100], [5, 170], [-1.54, 0]]) {
    for (let lon = -180; lon < 180; lon += 15) {
      const lat = terminatorLatitudeDeg(lon, subLat, subLon);
      near(angularDistanceDeg(subLat, subLon, lat, lon), 90, 1e-9, `sub (${subLat}, ${subLon}) lon ${lon}`);
    }
  }
  // Soleil à l'équateur : le terminateur est vertical (méridiens ±90° de la longitude sub-solaire) : pas de latitude unique.
  assert.equal(terminatorLatitudeDeg(30, 0, 0), null);
  assert.equal(terminatorLatitudeDeg(90, 0, 0), null);
});

test('equirectPixel et inverse : valeurs d\'or et aller-retour', () => {
  const { width: w, height: h } = G.equirect;
  for (const c of G.equirect.cases) {
    const p = equirectPixel(c.lat_deg, c.lon_deg, w, h);
    near(p.x, c.x, 1e-9, 'x');
    near(p.y, c.y, 1e-9, 'y');
    const back = equirectLatLon(c.x, c.y, w, h);
    near(back.latDeg, c.lat_deg, 1e-9, 'lat');
    assert.ok(lonDiff(back.lonDeg, c.lon_deg) < 1e-9);
  }
});

test('pôle Sud : valeurs d\'or (PolarProjection, GDAL) et aller-retour ; ρ(−89°) = 30 324,1202 m', () => {
  for (const c of G.south_polar) {
    const p = southPolar(c.lat_deg, c.lon_deg, G.radius_m);
    near(p.x, c.x_m, G.tolerance_m, `x (${c.lat_deg}, ${c.lon_deg})`);
    near(p.y, c.y_m, G.tolerance_m, `y (${c.lat_deg}, ${c.lon_deg})`);
    if (c.lat_deg > -90) {
      const back = southPolarInverse(p.x, p.y, G.radius_m);
      near(back.latDeg, c.lat_deg, 1e-9, 'lat');
      assert.ok(lonDiff(back.lonDeg, c.lon_deg) < 1e-9);
    }
  }
  near(Math.hypot(southPolar(-89, 0, G.radius_m).x, southPolar(-89, 0, G.radius_m).y), 30324.1202, 1e-3, 'ρ(−89°)');
});

test('pôle Nord : valeurs d\'or (construction géométrique), aller-retour, symétrie avec le Sud, longitude 0° vers le bas', () => {
  for (const c of G.north_polar) {
    const p = northPolar(c.lat_deg, c.lon_deg, G.radius_m);
    near(p.x, c.x_m, G.tolerance_m, `x (${c.lat_deg}, ${c.lon_deg})`);
    near(p.y, c.y_m, G.tolerance_m, `y (${c.lat_deg}, ${c.lon_deg})`);
    if (c.lat_deg < 90) {
      const back = northPolarInverse(p.x, p.y, G.radius_m);
      near(back.latDeg, c.lat_deg, 1e-9, 'lat');
      assert.ok(lonDiff(back.lonDeg, c.lon_deg) < 1e-9);
    }
  }
  for (const lat of [89, 85, 70]) {
    const n = northPolar(lat, 25, G.radius_m);
    const s = southPolar(-lat, 25, G.radius_m);
    near(Math.hypot(n.x, n.y), Math.hypot(s.x, s.y), 1e-6, `ρ_nord(${lat}) = ρ_sud(−${lat})`);
  }
  const down = northPolar(80, 0, G.radius_m);
  assert.ok(down.y < 0 && Math.abs(down.x) < 1e-6, 'lon 0° vers le bas (y négatif)');
});

test('interpolateSubPoint : latitude linéaire, longitude sur le cercle (179,9° → −179,9° donne 180°, jamais 0°)', () => {
  const g = G.lon_interpolation;
  const series = { t0Ms: 0, stepMs: 3600000, latMdeg: g.series.lat_mdeg, lonMdeg: g.series.lon_mdeg };
  const mid = interpolateSubPoint(series, 1800000);
  near(mid.latDeg, g.lat_deg, 1e-12, 'lat');
  near(Math.abs(mid.lonDeg), g.lon_abs_deg, 1e-9, 'lon');
  const q = interpolateSubPoint(series, 900000);
  assert.ok(lonDiff(q.lonDeg, 179.95) < 1e-9, `lon ${q.lonDeg}`);
  assert.equal(interpolateSubPoint(series, 0).inRange, true);
  const after = interpolateSubPoint(series, 10 * 3600000);
  assert.equal(after.inRange, false);
  near(after.latDeg, 20, 1e-12, 'borné à la dernière valeur');
  assert.throws(() => interpolateSubPoint(series, Number.NaN), TypeError);
});
