// Tests de web/js/verdicts.js (T-13, U-04) : lectures, états, marge, KPI affichés = contrat, recalcul indépendant sur données réelles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { bodyReading, kpiCards, monthIndexAt, monthlyHeat, statusOf, truncatedAt } from '../js/verdicts.js';
import { checkSite, siteTimeRange } from '../js/data.js';
import { horizonAt, isVisible, visibleFraction } from '../js/visibility.js';

const load = (path) => JSON.parse(readFileSync(new URL(`../data/${path}`, import.meta.url), 'utf8'));
const T0 = Date.parse('2026-01-01T00:00:00Z');

/** Site minimal : 3 échantillons horaires, horizon à 1° sauf aux azimuts 90 et 91 (3°), Soleil fixe plein est. */
function miniSite(sunEl) {
  const elev = new Array(360).fill(1);
  elev[90] = 3; elev[91] = 3;
  const trunc = new Array(360).fill(false);
  trunc[200] = true;
  const body = (el) => ({ az_mdeg: [90000, 90000, 90000], el_mdeg: [el, el, el].map((v) => Math.round(v * 1000)), radius_mdeg: [270, 270, 270] });
  const gap = (a, b) => ({ visible_pct: a, longest_gap_h: b, n_gaps: 1 });
  return {
    time: { start_utc: '2026-01-01T00:00:00Z', step_s: 3600, count: 3 },
    horizon: { elev_deg: elev, truncated: trunc },
    bodies: { sun: body(sunEl), earth: body(5) },
    kpis: {
      window: { start_utc: 'a', end_utc: 'b' },
      sun: { strict: gap(1, 2), any: gap(3, 4) },
      earth: { strict: gap(5, 6), any: gap(7, 8) },
      both: { strict: gap(9, 10), any: gap(11, 12) },
    },
    monthly: [
      { ym: '2025-12', sun_strict_pct: 1, earth_strict_pct: 2, both_strict_pct: 3 },
      { ym: '2026-01', sun_strict_pct: 4, earth_strict_pct: 5, both_strict_pct: 6 },
    ],
  };
}

test('états descriptifs, indépendants du seuil : masqué / partiel / visible', () => {
  assert.equal(statusOf(0), 'hidden');
  assert.equal(statusOf(0.0001), 'partial');
  assert.equal(statusOf(0.9999), 'partial');
  assert.equal(statusOf(1), 'visible');
});

test('Soleil nettement sous / sur / à cheval sur l\'horizon (3° à l\'azimut 90°)', () => {
  const below = bodyReading(miniSite(1), 'sun', T0, 'strict');
  assert.equal(below.status, 'hidden');
  assert.ok(Math.abs(below.marginDeg - (1 - 3)) < 1e-9, 'marge signée négative : élévation − horizon');
  const above = bodyReading(miniSite(10), 'sun', T0, 'strict');
  assert.equal(above.status, 'visible');
  assert.ok(Math.abs(above.marginDeg - 7) < 1e-9);
  const half = bodyReading(miniSite(3), 'sun', T0, 'strict'); // centre exactement à l'horizon : f = 0,5
  assert.equal(half.status, 'partial');
  assert.ok(Math.abs(half.fraction - 0.5) < 1e-9);
  assert.equal(half.visible, true, 'strict : f ≥ 0,5');
});

test('le seuil ne change que le binaire, jamais l\'état descriptif', () => {
  const site = miniSite(3 - 0.1); // f < 0,5 mais > 0
  const strict = bodyReading(site, 'sun', T0, 'strict');
  const any = bodyReading(site, 'sun', T0, 'any');
  assert.equal(strict.status, 'partial');
  assert.equal(any.status, 'partial');
  assert.equal(strict.visible, false);
  assert.equal(any.visible, true);
  assert.equal(strict.fraction, any.fraction);
});

test('masque tronqué : détecté aux deux azimuts qui encadrent le corps, avec bouclage', () => {
  const trunc = new Array(360).fill(false);
  trunc[359] = true;
  assert.equal(truncatedAt(trunc, 359.5), true);
  assert.equal(truncatedAt(trunc, 0.2), false);
  assert.equal(truncatedAt(trunc, 358.5), true); // entre 358 et 359
  assert.equal(truncatedAt(trunc, -0.5), true); // = 359,5
  assert.equal(truncatedAt(trunc, 100), false);
});

test('hors période : valeur bornée et inRange faux', () => {
  assert.equal(bodyReading(miniSite(5), 'sun', T0 + 10 * 3600_000, 'strict').inRange, false);
  assert.equal(bodyReading(miniSite(5), 'sun', T0, 'strict').inRange, true);
});

test('les cartes d\'indicateurs reprennent le contrat sans transformation', () => {
  const site = miniSite(5);
  const win = { startUtc: 'a', endUtc: 'b' };
  assert.deepEqual(kpiCards(site, 'strict'), { sunPct: 1, earthPct: 5, bothPct: 9, longestSunGapH: 2, longestEarthGapH: 6, window: win });
  assert.deepEqual(kpiCards(site, 'any'), { sunPct: 3, earthPct: 7, bothPct: 11, longestSunGapH: 4, longestEarthGapH: 8, window: win });
});

test('mois : instant du 1er du mois borné à la période, mois courant retrouvé', () => {
  const months = monthlyHeat(miniSite(5));
  assert.equal(months[0].tMs, T0); // 2025-12-01 est avant le début : borné
  assert.equal(months[1].tMs, T0);
  assert.equal(monthIndexAt(months, T0 + 3600_000), 1);
  assert.equal(monthIndexAt(months, Date.parse('2030-05-05T00:00:00Z')), -1);
});

for (const id of ['site04-shackleton-rim', 'site01-connecting-ridge']) {
  const path = `sites/${id}.json`;
  const present = existsSync(new URL(`../data/${path}`, import.meta.url));
  test(`${id} (données réelles) : KPI affichés = contrat et recalcul indépendant des pourcentages`, { skip: !present }, () => {
    const site = load(path);
    assert.deepEqual(checkSite(site), []);
    // Recalcul JS direct sur les séries exportées : doit retrouver les `kpis` du pipeline à la quantification (millidegré) près.
    const n = site.time.count;
    for (const mode of ['strict', 'any']) {
      let sun = 0; let earth = 0; let both = 0;
      for (let i = 0; i < n; i += 1) {
        const vis = (body) => {
          const b = site.bodies[body];
          const h = horizonAt(site.horizon.elev_deg, b.az_mdeg[i] / 1000);
          return isVisible(visibleFraction(b.el_mdeg[i] / 1000, b.radius_mdeg[i] / 1000, h), mode);
        };
        const s = vis('sun');
        const e = vis('earth');
        if (s) sun += 1;
        if (e) earth += 1;
        if (s && e) both += 1;
      }
      const cards = kpiCards(site, mode);
      for (const [got, expected, label] of [[sun, cards.sunPct, 'Soleil'], [earth, cards.earthPct, 'Terre'], [both, cards.bothPct, 'les deux']]) {
        const pct = (100 * got) / n;
        assert.ok(Math.abs(pct - expected) < 0.05, `${id} ${mode} ${label} : recalcul ${pct.toFixed(4)} % ≠ contrat ${expected.toFixed(4)} %`);
      }
    }
    assert.equal(siteTimeRange(site).count, n);
  });
}
