// Accord Python / JavaScript (ARCHITECTURE § 3, TESTS-VALIDATION § 5) : tests/golden/body_state_cases.json.
// Les valeurs attendues viennent du pipeline Python, calculées DIRECTEMENT à chaque instant ; ici, JavaScript interpole les séries horaires
// exportées (bodyStateAt), lit le masque (horizonAt) et applique visibleFraction. Aucune des deux implémentations n'est copiée sur l'autre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { bodyStateAt, checkSite } from '../js/data.js';
import { horizonAt, visibleFraction } from '../js/visibility.js';

const GOLDEN_URL = new URL('../../tests/golden/body_state_cases.json', import.meta.url);
const present = existsSync(GOLDEN_URL);
const golden = present ? JSON.parse(readFileSync(GOLDEN_URL, 'utf8')) : null;
const site = present ? JSON.parse(readFileSync(new URL(`../../${golden.site_file}`, import.meta.url), 'utf8')) : null;

/** Écart angulaire en degrés sur le cercle (0° et 360° sont identiques). */
const circularDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('le fichier d\'or existe, porte synthetic: true et 20 cas', { skip: !present }, () => {
  assert.equal(golden.synthetic, true);
  assert.equal(golden.cases.length, 20);
  assert.deepEqual(checkSite(site), []);
  assert.equal(site.id, golden.site_id);
});

test('au moins un cas où l\'azimut du Soleil passe par 0° / 360° entre deux nœuds horaires', { skip: !present }, () => {
  assert.ok(golden.cases.some((c) => /359° à 0°/.test(c.motif)));
});

for (const [i, c] of (golden?.cases ?? []).entries()) {
  test(`cas ${i + 1} (${c.utc}) : ${c.motif}`, () => {
    const tMs = Date.parse(c.utc);
    for (const body of ['sun', 'earth']) {
      const s = bodyStateAt(site, body, tMs);
      assert.ok(circularDiff(s.azDeg, c[`${body}_az_deg`]) < golden.tolerance_angle_deg, `${body} azimut : ${s.azDeg} ≠ ${c[`${body}_az_deg`]}`);
      assert.ok(Math.abs(s.elDeg - c[`${body}_el_deg`]) < golden.tolerance_angle_deg, `${body} élévation : ${s.elDeg} ≠ ${c[`${body}_el_deg`]}`);
      assert.ok(Math.abs(s.radiusDeg - c[`${body}_radius_deg`]) < golden.tolerance_angle_deg, `${body} rayon : ${s.radiusDeg} ≠ ${c[`${body}_radius_deg`]}`);
      const h = horizonAt(site.horizon.elev_deg, s.azDeg);
      const f = visibleFraction(s.elDeg, s.radiusDeg, h);
      assert.ok(Math.abs(f - c[`f_${body}`]) < golden.tolerance_fraction, `${body} fraction : ${f} ≠ ${c[`f_${body}`]}`);
    }
  });
}
