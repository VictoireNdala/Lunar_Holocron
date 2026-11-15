// Raccord 5 m / 80 m (D-034) : la liste publiée dans l'application = les sites > 20 m de tests/reference/seam_5m_80m.json ; la fiche et la page méthode la disent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SEAM_MAX_M, SEAM_THRESHOLD_M } from '../js/seam.js';
import { siteSheet } from '../js/atlas/sitesheet.js';

test('SEAM_MAX_M = sites au-dessus de 20 m dans la mesure de référence (valeurs arrondies au mètre)', () => {
  const ref = JSON.parse(readFileSync(fileURLToPath(new URL('../../tests/reference/seam_5m_80m.json', import.meta.url)), 'utf8')).sites;
  const over = Object.fromEntries(ref.filter((s) => s.max_abs_m > SEAM_THRESHOLD_M).map((s) => [s.id, Math.round(s.max_abs_m)]));
  assert.deepEqual({ ...SEAM_MAX_M }, over);
});

test('la fiche d\'un de ces sites porte le raccord ; un autre site non', () => {
  const base = { terrain_real: true, terrain_modeled: true, terrain_tier: '5m', kind: 'lola_site', tier: 2 };
  assert.equal(siteSheet({ ...base, id: 'dm1-amundsen-rim' }).seamMaxM, 72);
  assert.equal(siteSheet({ ...base, id: 'site01-connecting-ridge' }).seamMaxM, null);
});
