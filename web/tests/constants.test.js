// Tests de web/js/constants.js et lecture du fichier d'or partagé (node --test, aucune dépendance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../js/constants.js';

test('les constantes numériques sont finies et positives quand elles doivent l\'être', () => {
  for (const name of ['R_REF_M', 'R_SUN_KM', 'R_EARTH_KM', 'TIME_STEP_S', 'AZ_STEP_DEG', 'N_AZIMUTHS', 'MDEG_PER_DEG']) {
    assert.ok(Number.isFinite(C[name]) && C[name] > 0, name);
  }
  assert.ok(C.LAT_MIN_DEG < C.LAT_MAX_DEG);
  assert.equal(C.N_AZIMUTHS * C.AZ_STEP_DEG, 360);
});

test('les modes de seuil sont figés et contiennent le seuil par défaut', () => {
  assert.ok(Object.isFrozen(C.THRESHOLD_MODES));
  assert.ok(C.THRESHOLD_MODES.includes(C.DEFAULT_THRESHOLD));
});

test('le fichier d\'or de la fraction visible est lisible et cohérent avec les seuils', () => {
  const golden = JSON.parse(readFileSync(new URL('../../tests/golden/visible_fraction.json', import.meta.url), 'utf8'));
  assert.equal(golden.radius_deg, 0.27);
  for (const c of golden.cases) {
    assert.equal(c.strict, c.f >= C.STRICT_MIN_FRACTION);
    assert.equal(c.any, c.f > 0);
  }
});
