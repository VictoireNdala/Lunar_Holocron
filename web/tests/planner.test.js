// Tests de web/js/planner.js (V2-05 § 7.3) : séjour de la durée de la période = kpis, contraintes, classement, séparation, calendrier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DEFAULTS, dayHeat, evaluateCandidates, missionTimeline, rank, satisfies, topWindows } from '../js/planner.js';
import { siteTimeRange } from '../js/data.js';

const DATA = new URL('../data/', import.meta.url);
const present = existsSync(new URL('sites/site01-connecting-ridge.json', DATA));
const read = (path) => JSON.parse(readFileSync(new URL(path, DATA), 'utf8'));

/** Site de 10 jours horaires : Soleil visible les 3 premiers jours puis absent ; Terre visible sauf heures 100-110. Horizon 0°, rayon 0,27°. */
function miniSite() {
  const n = 240;
  const sunEl = Array.from({ length: n }, (_, i) => (i < 72 ? 2000 : -2000));
  const earthEl = Array.from({ length: n }, (_, i) => (i >= 100 && i < 110 ? -3000 : 4000));
  const body = (el, r) => ({ az_mdeg: new Array(n).fill(90000), el_mdeg: el, radius_mdeg: new Array(n).fill(r) });
  return {
    id: 'mini', time: { start_utc: '2027-01-01T00:00:00Z', step_s: 3600, count: n },
    horizon: { elev_deg: new Array(360).fill(0), truncated: new Array(360).fill(false) },
    bodies: { sun: body(sunEl, 267), earth: body(earthEl, 950) },
  };
}

test('par défaut : séjour de 7 jours, angle 0° (paramètres de l\'utilisateur, pas des chiffres de mission)', () => {
  assert.deepEqual({ ...DEFAULTS }, { stayDays: 7, minAngleDeg: 0 });
});

test('indicateurs d\'une fenêtre : parts, plus longues coupures, temps avant le premier coucher et la première perte de lien', () => {
  const site = miniSite();
  const { startMs } = siteTimeRange(site);
  const c = evaluateCandidates(site, { fromMs: startMs, toMs: startMs, stayDays: 5 })[0]; // 120 h à partir de t0
  assert.equal(c.stayH, 120);
  assert.equal(c.sunPct, 60); // 72 h sur 120
  assert.ok(Math.abs(c.earthPct - (100 * 110) / 120) < 1e-9);
  assert.equal(c.firstSunsetH, 72);
  assert.equal(c.firstLinkLossH, 100);
  assert.equal(c.earthGapH, 10);
  assert.equal(c.sunGapH, 48);
  assert.ok(Math.abs(c.bothPct - (100 * 72) / 120) < 1e-9);
});

test('séjour qui dépasse la fin de la période : aucun candidat ; candidats espacés de 6 h', () => {
  const site = miniSite();
  const { startMs, endMs } = siteTimeRange(site);
  const all = evaluateCandidates(site, { fromMs: startMs, toMs: endMs, stayDays: 2 });
  assert.ok(all.every((c) => c.t0Ms + c.stayH * 3_600_000 <= endMs + 3_600_000));
  assert.equal(all[1].t0Ms - all[0].t0Ms, 6 * 3_600_000);
  assert.equal(evaluateCandidates(site, { fromMs: startMs, toMs: endMs, stayDays: 30 }).length, 0);
});

test('contraintes : filtrage, classement (faisables d\'abord, puis « les deux » décroissant, coupure croissante, date), formule déterministe', () => {
  const site = miniSite();
  const { startMs, endMs } = siteTimeRange(site);
  const cands = evaluateCandidates(site, { fromMs: startMs, toMs: endMs, stayDays: 2 });
  const free = rank(cands);
  assert.ok(free.every((c, i) => i === 0 || free[i - 1].bothPct >= c.bothPct - 1e-12 || !free[i - 1].feasible === false));
  const constrained = rank(cands, { sunMinPct: 100, earthMinPct: 100 });
  assert.ok(constrained[0].feasible && constrained[0].sunPct === 100 && constrained[0].earthPct === 100);
  const firstInfeasible = constrained.findIndex((c) => !c.feasible);
  assert.ok(firstInfeasible === -1 || constrained.slice(firstInfeasible).every((c) => !c.feasible), 'faisables toutes avant les autres');
  assert.equal(satisfies({ sunPct: 50, earthPct: 90, earthGapH: 5, firstSunsetH: 10 }, { sunMinPct: 60 }), false);
  assert.equal(satisfies({ sunPct: 50, earthPct: 90, earthGapH: 5, firstSunsetH: 10 }, { maxEarthGapH: 5, sunsetNotBeforeH: 10 }), true);
  assert.equal(satisfies({ sunPct: 50, earthPct: 90, earthGapH: 6, firstSunsetH: 10 }, { maxEarthGapH: 5 }), false);
  assert.deepEqual(rank(cands, { sunMinPct: 100 }).map((c) => c.t0Ms), rank(cands, { sunMinPct: 100 }).map((c) => c.t0Ms));
});

test('meilleures fenêtres : distinctes (≥ 24 h), au plus n ; calendrier : une valeur par jour = le meilleur candidat du jour', () => {
  const site = miniSite();
  const { startMs, endMs } = siteTimeRange(site);
  const cands = evaluateCandidates(site, { fromMs: startMs, toMs: endMs, stayDays: 2 });
  const top = topWindows(rank(cands), 5);
  assert.ok(top.length <= 5 && top.length > 1);
  for (let i = 0; i < top.length; i += 1) for (let j = i + 1; j < top.length; j += 1) assert.ok(Math.abs(top[i].t0Ms - top[j].t0Ms) >= 24 * 3_600_000);
  const heat = dayHeat(cands);
  assert.equal(heat.length, new Set(cands.map((c) => new Date(c.t0Ms).toISOString().slice(0, 10))).size);
  for (const d of heat) assert.equal(d.bothPct, Math.max(...cands.filter((c) => new Date(c.t0Ms).toISOString().slice(0, 10) === d.day).map((c) => c.bothPct)));
});

test('calendrier de mission : lancement seulement si un transfert est SAISI', () => {
  const c = { t0Ms: Date.parse('2028-03-01T00:00:00Z'), stayH: 168 };
  assert.equal(missionTimeline(c, NaN).launchMs, null);
  assert.equal(missionTimeline(c, 0).launchMs, null);
  assert.equal(missionTimeline(c, 4).launchMs, Date.parse('2028-02-26T00:00:00Z'));
  assert.equal(missionTimeline(c, 4).endOfStayMs, Date.parse('2028-03-08T00:00:00Z'));
});

for (const id of ['site01-connecting-ridge', 'site04-shackleton-rim', 'site11-de-gerlache-rim']) {
  test(`${id} (données réelles) : un séjour de toute la période redonne exactement les kpis (Soleil, Terre, les deux, plus longues coupures)`, { skip: !present }, () => {
    const site = read(`sites/${id}.json`);
    const { startMs, stepMs, count } = siteTimeRange(site);
    const [c] = evaluateCandidates(site, { fromMs: startMs, toMs: startMs, stayDays: (count * stepMs) / 86_400_000, mode: 'strict' });
    assert.ok(Math.abs(c.sunPct - site.kpis.sun.strict.visible_pct) < 1e-9);
    assert.ok(Math.abs(c.earthPct - site.kpis.earth.strict.visible_pct) < 1e-9);
    assert.ok(Math.abs(c.bothPct - site.kpis.both.strict.visible_pct) < 1e-9);
    assert.equal(c.sunGapH, site.kpis.sun.strict.longest_gap_h);
    assert.equal(c.earthGapH, site.kpis.earth.strict.longest_gap_h);
  });
}

test('site réel : le meilleur séjour de 7 jours de Site01 est au moins aussi bon que la moyenne sur toute la période', { skip: !present }, () => {
  const site = read('sites/site01-connecting-ridge.json');
  const { startMs, endMs } = siteTimeRange(site);
  const cands = evaluateCandidates(site, { fromMs: startMs, toMs: endMs, stayDays: 7 });
  const ranked = rank(cands);
  assert.ok(ranked[0].bothPct >= site.kpis.both.strict.visible_pct);
  assert.ok(cands.length > 7000);
});
