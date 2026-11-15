// Empreinte réelle des sites 5 m sur les cartes (M-051 § 2.1) : contour du carré, seuil de dessin, tracé effectif selon le zoom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOOTPRINT_MIN_PX, footprintOutline } from '../js/atlas/markers.js';
import { drawSites } from '../js/atlas/markerdraw.js';
import { makeProjection } from '../js/atlas/maps2d.js';
import { R_REF_M } from '../js/constants.js';

const DEG = Math.PI / 180;
const plane = (latDeg, lonDeg) => { const rho = 2 * R_REF_M * Math.tan((latDeg * DEG + Math.PI / 2) / 2); return [rho * Math.sin(lonDeg * DEG), rho * Math.cos(lonDeg * DEG)]; };

test('contour de l\'empreinte : carré aligné sur le plan polaire, de demi-côté exact (écart < 1 mm)', () => {
  const lat = -89.4632; const lon = -137.4896; const half = 8;
  const pts = footprintOutline(lat, lon, half);
  assert.equal(pts.length, 32);
  const [x0, y0] = plane(lat, lon);
  for (const p of pts) {
    const [x, y] = plane(p.latDeg, p.lonDeg);
    const dx = Math.abs(x - x0); const dy = Math.abs(y - y0);
    assert.ok(Math.max(dx, dy) - half * 1000 < 1e-3 && Math.max(dx, dy) - half * 1000 > -1e-3, `Chebyshev ${Math.max(dx, dy)}`);
  }
  const xs = pts.map((p) => plane(p.latDeg, p.lonDeg)[0]);
  assert.ok(Math.abs(Math.min(...xs) - (x0 - 8000)) < 1e-3 && Math.abs(Math.max(...xs) - (x0 + 8000)) < 1e-3, 'extrêmes en x : x0 ± 8 km');
});

/** Contexte de dessin enregistreur : compte les tracés (stroke) et les lignes (lineTo) du contour carré. */
function recorder() {
  const log = { strokes: 0, lineTo: 0, arcs: [] };
  const noop = () => {};
  return Object.assign(new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } }),
    { stroke() { log.strokes += 1; }, lineTo() { log.lineTo += 1; }, arc(x, y, r) { log.arcs.push(r); }, measureText: () => ({ width: 40 }), log });
}
const site = { id: 's', name: 'S', latDeg: -89.4632, lonDeg: -137.4896, tier: 1, kind: 'lola_site', footprint_half_km: 8, terrain_tier: '5m' };
const style = { text: '#fff' };

test('empreinte 5 m : le carré réel est tracé dès que sa taille dépasse FOOTPRINT_MIN_PX, et pas avant', () => {
  const small = recorder();
  drawSites(small, makeProjection('south', 600, 600, undefined, { zoom: 1, panX: 0, panY: 0 }), [site], 1, style);
  assert.equal(small.log.lineTo, 0, 'zoom 1 : glyphe seulement');
  const big = recorder();
  const proj = makeProjection('south', 600, 600, undefined, { zoom: 40, panX: 0, panY: 0 });
  drawSites(big, proj, [site], 40, style);
  assert.ok(big.log.lineTo >= 31, `contour tracé (${big.log.lineTo} segments)`);
  const q = proj.toPixel(site.latDeg, site.lonDeg);
  const q2 = proj.toPixel(site.latDeg + 1 / ((Math.PI / 180) * 1737.4), site.lonDeg);
  assert.ok(8 * Math.hypot(q2.x - q.x, q2.y - q.y) > FOOTPRINT_MIN_PX, 'le zoom de ce test donne une empreinte plus grande que le seuil');
});

test('entité nommée : cercle au rayon de l\'entité (pas de carré) ; site 5 m sans footprint_half_km : repli en cercle de 8 km', () => {
  const proj = makeProjection('south', 600, 600, undefined, { zoom: 40, panX: 0, panY: 0 });
  const feature = recorder();
  drawSites(feature, proj, [{ ...site, kind: 'feature', footprint_half_km: undefined, position_uncertainty_km: 8 }], 40, style);
  assert.equal(feature.log.lineTo, 0);
  assert.ok(feature.log.arcs.some((r) => r > FOOTPRINT_MIN_PX));
  const fallback = recorder();
  drawSites(fallback, proj, [{ ...site, footprint_half_km: undefined }], 40, style);
  assert.equal(fallback.log.lineTo, 0);
  assert.ok(fallback.log.arcs.some((r) => r > FOOTPRINT_MIN_PX));
});
