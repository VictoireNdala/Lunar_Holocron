// Tests de web/js/link.js (V2-05) : coupures = kpis du pipeline (égalité exacte), levers et couchers à la minute contre SPICE, délai de propagation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { bothSamples, continuousMargin, formatDuration, hermiteState, lightDelay, nextEvent, outageStats, runsOf, runsToCsv, visibleSamples, C_KM_S } from '../js/link.js';
import { bodyStateAt, siteTimeRange } from '../js/data.js';

const DATA = new URL('../data/', import.meta.url);
const SITES = ['site01-connecting-ridge', 'site04-shackleton-rim', 'site07-peak-near-shackleton', 'site11-de-gerlache-rim'];
const present = SITES.every((id) => existsSync(new URL(`sites/${id}.json`, DATA)));
const TRUTH_URL = new URL('../../tests/reference/crossings_spice.json', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, DATA), 'utf8'));

test('formatDuration : minutes sous 2 jours, jours au-delà', () => {
  assert.equal(formatDuration(3 * 3600_000 + 12 * 60_000), '3 h 12 min');
  assert.equal(formatDuration(41 * 3600_000), '41 h');
  assert.equal(formatDuration(25 * 60_000), '25 min');
  assert.equal(formatDuration(100 * 3600_000), '4 j 4 h');
  assert.equal(formatDuration(-5), '0 min');
});

test('runsOf / outageStats : cas construit (bords comptés, durée = échantillons × pas)', () => {
  const site = { time: { start_utc: '2027-01-01T00:00:00Z', step_s: 3600, count: 8 } };
  const flags = Uint8Array.from([0, 0, 1, 1, 1, 0, 1, 0]);
  const runs = runsOf(flags, site, Date.parse('2027-01-01T00:00:00Z'), Date.parse('2027-01-01T07:00:00Z'));
  assert.deepEqual(runs.map((r) => [r.visible, r.hours]), [[false, 2], [true, 3], [false, 1], [true, 1], [false, 1]]);
  assert.equal(runs[0].startsAtEdge, true);
  assert.equal(runs[4].endsAtEdge, true);
  assert.equal(runs[1].startsAtEdge, false);
  assert.deepEqual(outageStats(runs), { longestGapH: 2, nGaps: 3, coveredPct: 50 });
  assert.deepEqual(outageStats([]), { longestGapH: 0, nGaps: 0, coveredPct: 0 });
  const csv = runsToCsv(runs);
  assert.match(csv, /^start_utc;end_utc;duration_h;state;truncated_at_window_edge\n2027-01-01T00:00:00Z;2027-01-01T02:00:00Z;2;absent;yes\n/);
  assert.equal(csv.trim().split('\n').length, 6);
});

test('bothSamples : ET logique', () => {
  assert.deepEqual([...bothSamples(Uint8Array.from([1, 1, 0, 0]), Uint8Array.from([1, 0, 1, 0]))], [1, 0, 0, 0]);
});

for (const id of SITES) {
  test(`${id} : plus longue coupure, nombre de coupures et % couvert = kpis du pipeline (égalité exacte, strict et optimiste, Soleil, Terre, les deux)`, { skip: !present }, () => {
    const site = read(`sites/${id}.json`);
    const { startMs, endMs } = siteTimeRange(site);
    for (const mode of ['strict', 'any']) {
      const sun = visibleSamples(site, 'sun', mode);
      const earth = visibleSamples(site, 'earth', mode);
      for (const [key, flags] of [['sun', sun], ['earth', earth], ['both', bothSamples(sun, earth)]]) {
        const stats = outageStats(runsOf(flags, site, startMs, endMs));
        const k = site.kpis[key][mode];
        assert.equal(stats.longestGapH, k.longest_gap_h, `${id} ${mode} ${key} plus longue coupure`);
        assert.equal(stats.nGaps, k.n_gaps, `${id} ${mode} ${key} nombre de coupures`);
        assert.ok(Math.abs(stats.coveredPct - k.visible_pct) < 1e-9, `${id} ${mode} ${key} % couvert`);
      }
    }
  });

  test(`${id} : Hermite = échantillon exact aux nœuds ; erreur d'élévation entre nœuds bien inférieure à l'interpolation linéaire`, { skip: !present }, () => {
    const site = read(`sites/${id}.json`);
    const { startMs, stepMs } = siteTimeRange(site);
    const i = 1000;
    const node = hermiteState(site, 'earth', startMs + i * stepMs);
    assert.ok(Math.abs(node.elDeg - site.bodies.earth.el_mdeg[i] / 1000) < 1e-9);
    // test d'ordre : le milieu d'un intervalle est mieux prédit par Hermite que par la droite (courbure de la courbe d'élévation de la Terre)
    let hermiteErr = 0; let linearErr = 0;
    for (let k = 500; k < 1500; k += 7) {
      const mid = startMs + (k + 0.5) * stepMs;
      const truthLike = (site.bodies.earth.el_mdeg[k - 1] + 9 * site.bodies.earth.el_mdeg[k] + 9 * site.bodies.earth.el_mdeg[k + 1] + site.bodies.earth.el_mdeg[k + 2]) / 16 / 1000 - 0; // cubique de Lagrange à 4 points au milieu
      hermiteErr += Math.abs(hermiteState(site, 'earth', mid).elDeg - truthLike);
      linearErr += Math.abs(bodyStateAt(site, 'earth', mid).elDeg - truthLike);
    }
    assert.ok(hermiteErr < linearErr, `Hermite ${hermiteErr} contre linéaire ${linearErr}`);
  });
}

test('levers et couchers (strict) : instants du navigateur contre SPICE à la minute, 4 sites, 61 jours', { skip: !(present && existsSync(TRUTH_URL)) }, () => {
  const truth = JSON.parse(readFileSync(TRUTH_URL, 'utf8'));
  const errorsS = [];
  for (const [id, events] of Object.entries(truth.sites)) {
    const site = read(`sites/${id}.json`);
    for (const ev of events) {
      const tTruth = Date.parse(ev.t_utc);
      const found = nextEvent(site, ev.body, tTruth - 5 * 60_000, 'strict'); // 5 min avant : les frôlements de moins de 10 min sont retirés de la vérité, l'événement est le premier à venir
      assert.equal(found.type, ev.type, `${id} ${ev.body} ${ev.t_utc} : type`);
      errorsS.push(Math.abs(found.tMs - tTruth) / 1000); // vérité = première minute du nouvel état : l'écart attendu est entre 0 et 60 s
    }
  }
  const sorted = [...errorsS].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = sorted[sorted.length - 1];
  assert.ok(errorsS.length >= 60, `${errorsS.length} événements`);
  // Mesuré le 2026-11-15 (voir docs/VALIDATION-RESULTATS.md) : médiane et maximum publiés ; bornes de BUILD-V2 § 8 : médiane < 1 min.
  assert.ok(median < 60, `médiane ${median.toFixed(1)} s`);
  assert.ok(max < 180, `maximum ${max.toFixed(1)} s`);
});

test('nextEvent : cohérent (la marge change de signe à l\'événement), minAngle repousse le lever et avance le coucher, période finie respectée', { skip: !present }, () => {
  const site = read('sites/site01-connecting-ridge.json');
  const { startMs, endMs } = siteTimeRange(site);
  const t = Date.parse('2027-03-14T06:00:00Z');
  for (const body of ['sun', 'earth']) {
    const ev = nextEvent(site, body, t, 'strict');
    assert.ok(ev.type === 'set' || ev.type === 'rise');
    assert.ok(ev.tMs > t);
    const before = continuousMargin(site, body, ev.tMs - 60_000, 'strict');
    const after = continuousMargin(site, body, ev.tMs + 60_000, 'strict');
    assert.ok((before >= 0) !== (after >= 0), 'changement de signe de la marge');
  }
  const earthNow = nextEvent(site, 'earth', t, 'strict', 0);
  const earthLimited = nextEvent(site, 'earth', t, 'strict', 3);
  if (earthNow.visibleNow && earthLimited.visibleNow) assert.ok(earthLimited.tMs <= earthNow.tMs, 'un angle minimal avance le coucher');
  const last = nextEvent(site, 'sun', endMs - 60_000, 'strict');
  assert.ok(last.type === null || last.tMs <= endMs);
  assert.equal(nextEvent(site, 'sun', startMs, 'strict').visibleNow, continuousMargin(site, 'sun', startMs, 'strict') >= 0);
});

test('angle minimal utile : plus il est grand, moins le temps de liaison (monotone), 0° = kpis', { skip: !present }, () => {
  const site = read('sites/site11-de-gerlache-rim.json');
  const { startMs, endMs } = siteTimeRange(site);
  const cover = (a) => outageStats(runsOf(visibleSamples(site, 'earth', 'strict', a), site, startMs, endMs)).coveredPct;
  const c = [0, 1, 2, 5].map(cover);
  assert.ok(c[0] >= c[1] && c[1] >= c[2] && c[2] >= c[3], JSON.stringify(c));
  assert.ok(Math.abs(c[0] - site.kpis.earth.strict.visible_pct) < 1e-9);
});

test('délai de propagation : calculé depuis la distance oblique, entre 1,18 s et 1,37 s (aller simple), aller-retour = 2 × aller', { skip: !present }, () => {
  const site = read('sites/site01-connecting-ridge.json');
  const { startMs, endMs } = siteTimeRange(site);
  let min = Infinity; let max = -Infinity;
  for (let t = startMs; t <= endMs; t += 5 * 24 * 3600_000) {
    const d = lightDelay(site, t);
    assert.ok(Math.abs(d.roundTripS - 2 * d.oneWayS) < 1e-12);
    assert.ok(Math.abs(d.oneWayS - d.distanceKm / C_KM_S) < 1e-12);
    min = Math.min(min, d.oneWayS); max = Math.max(max, d.oneWayS);
  }
  assert.ok(min > 1.18 && max < 1.37, `[${min} ; ${max}] s`);
});
