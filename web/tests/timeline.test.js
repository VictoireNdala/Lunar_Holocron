// Tests de web/js/timeline.js (T-12) : séries, fenêtre, agrégation min/max, clic, accord avec les indicateurs du contrat.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { aggregate, buildSeries, elevationBounds, timeAtX, windowRange, xAtTime } from '../js/timeline.js';
import { bodyReading } from '../js/verdicts.js';
import { siteTimeRange } from '../js/data.js';

const DAY = 86_400_000;
const T0 = Date.parse('2026-01-01T00:00:00Z');

/** Site de 10 jours horaires : Soleil monte de −1° à +4° puis redescend ; horizon 0° partout ; Terre fixe à 3°. */
function miniSite() {
  const n = 240;
  const sunEl = Array.from({ length: n }, (_, i) => Math.round(1000 * (-1 + 5 * Math.sin((Math.PI * i) / (n - 1)))));
  return {
    time: { start_utc: '2026-01-01T00:00:00Z', step_s: 3600, count: n },
    horizon: { elev_deg: new Array(360).fill(0), truncated: new Array(360).fill(false) },
    bodies: {
      sun: { az_mdeg: new Array(n).fill(90000), el_mdeg: sunEl, radius_mdeg: new Array(n).fill(267) },
      earth: { az_mdeg: new Array(n).fill(180000), el_mdeg: new Array(n).fill(3000), radius_mdeg: new Array(n).fill(950) },
    },
  };
}

test('séries : une valeur par échantillon, mêmes formules que la carte de lectures', () => {
  const site = miniSite();
  const s = buildSeries(site);
  assert.equal(s.sun.el.length, 240);
  for (const i of [0, 57, 120, 239]) {
    const t = T0 + i * 3600_000;
    const r = bodyReading(site, 'sun', t, 'strict');
    assert.ok(Math.abs(s.sun.fraction[i] - r.fraction) < 1e-6, `fraction ${i}`);
    assert.ok(Math.abs(s.sun.horizon[i] - r.horizonDeg) < 1e-6);
    assert.ok(Math.abs(s.sun.el[i] - r.elDeg) < 1e-6);
  }
});

test('fenêtre : centrée, décalée au bord, jamais hors période, « tout » = toute la période', () => {
  const range = { startMs: T0, endMs: T0 + 100 * DAY };
  assert.deepEqual(windowRange(T0 + 50 * DAY, 30, range), { startMs: T0 + 35 * DAY, endMs: T0 + 65 * DAY });
  assert.deepEqual(windowRange(T0 + 2 * DAY, 30, range), { startMs: T0, endMs: T0 + 30 * DAY });
  assert.deepEqual(windowRange(T0 + 99 * DAY, 30, range), { startMs: T0 + 70 * DAY, endMs: T0 + 100 * DAY });
  assert.deepEqual(windowRange(T0 + 50 * DAY, 'all', range), range);
  assert.deepEqual(windowRange(T0 + 50 * DAY, 365, range), range); // fenêtre plus longue que la période
});

test('agrégation : chaque échantillon dans une seule colonne, min ≤ moyenne ≤ max', () => {
  const site = miniSite();
  const series = buildSeries(site);
  const range = siteTimeRange(site);
  for (const width of [7, 100, 240, 600]) {
    const cols = aggregate(series, range.startMs, range.endMs, width, 'strict');
    assert.equal(cols.reduce((n, c) => n + c.n, 0), 240, `largeur ${width}`);
    for (const c of cols.filter((x) => x.n > 0)) {
      assert.ok(c.sun.elMin <= c.sun.elMid + 1e-6 && c.sun.elMid <= c.sun.elMax + 1e-6);
      assert.ok(c.sun.visibleShare >= 0 && c.sun.visibleShare <= 1 && c.bothShare <= Math.min(c.sun.visibleShare, c.earth.visibleShare) + 1e-9);
    }
  }
});

test('agrégation : les extrêmes sont conservés quand plusieurs échantillons partagent une colonne', () => {
  const site = miniSite();
  const series = buildSeries(site);
  const range = siteTimeRange(site);
  const wide = aggregate(series, range.startMs, range.endMs, 3, 'strict'); // 80 échantillons par colonne
  const maxOverall = Math.max(...series.sun.el);
  assert.ok(Math.abs(Math.max(...wide.map((c) => c.sun.elMax)) - maxOverall) < 1e-6);
  assert.ok(Math.abs(Math.min(...wide.map((c) => c.sun.elMin)) - Math.min(...series.sun.el)) < 1e-6);
});

test('seuil : strict ≠ optimiste sur les colonnes, « les deux » = Soleil et Terre ensemble', () => {
  const site = miniSite();
  const series = buildSeries(site);
  const range = siteTimeRange(site);
  const strict = aggregate(series, range.startMs, range.endMs, 240, 'strict');
  const any = aggregate(series, range.startMs, range.endMs, 240, 'any');
  const total = (cols, key) => cols.reduce((n, c) => n + (key === 'both' ? c.bothShare : c.sun.visibleShare) * c.n, 0);
  assert.ok(total(any, 'sun') >= total(strict, 'sun'));
  // Terre toujours visible (3° au-dessus de 0°, rayon 0,95°) : « les deux » suit le Soleil
  assert.ok(Math.abs(total(strict, 'both') - total(strict, 'sun')) < 1e-6);
});

test('bornes verticales : englobent les élévations (pas l’horizon), contiennent 0°', () => {
  const site = miniSite();
  const series = buildSeries(site);
  const range = siteTimeRange(site);
  const b = elevationBounds(aggregate(series, range.startMs, range.endMs, 100, 'strict'));
  assert.ok(b.minDeg < -1 && b.maxDeg > 4);
  assert.ok(b.minDeg < 0 && b.maxDeg > 0);
});

test('clic : l\'abscisse tombe sur un échantillon horaire ; repère hors fenêtre → null', () => {
  const site = miniSite();
  const series = buildSeries(site);
  const range = siteTimeRange(site);
  const t = timeAtX(300.4, 600, range.startMs, range.endMs, series);
  assert.equal((t - series.startMs) % series.stepMs, 0);
  assert.equal(timeAtX(-50, 600, range.startMs, range.endMs, series), series.startMs);
  assert.equal(timeAtX(9999, 600, range.startMs, range.endMs, series), range.endMs);
  assert.equal(xAtTime(range.startMs - 1, 600, range.startMs, range.endMs), null);
  assert.equal(xAtTime(range.startMs + (range.endMs - range.startMs) / 2, 600, range.startMs, range.endMs), 300);
});

for (const id of ['site04-shackleton-rim', 'site01-connecting-ridge']) {
  const url = new URL(`../data/sites/${id}.json`, import.meta.url);
  test(`${id} (données réelles) : le total des échantillons visibles de la frise redonne les indicateurs du contrat`, { skip: !existsSync(url) }, () => {
    const site = JSON.parse(readFileSync(url, 'utf8'));
    const series = buildSeries(site);
    const range = siteTimeRange(site);
    for (const mode of ['strict', 'any']) {
      const cols = aggregate(series, range.startMs, range.endMs, 1000, mode);
      const n = cols.reduce((a, c) => a + c.n, 0);
      assert.equal(n, range.count);
      const pct = (key) => (100 * cols.reduce((a, c) => a + (c.n ? key(c) * c.n : 0), 0)) / n;
      assert.ok(Math.abs(pct((c) => c.sun.visibleShare) - site.kpis.sun[mode].visible_pct) < 0.05, `Soleil ${mode}`);
      assert.ok(Math.abs(pct((c) => c.earth.visibleShare) - site.kpis.earth[mode].visible_pct) < 0.05, `Terre ${mode}`);
      assert.ok(Math.abs(pct((c) => c.bothShare) - site.kpis.both[mode].visible_pct) < 0.05, `les deux ${mode}`);
    }
  });
}

import { tickTimes } from '../js/timeline.js';

test('graduations : au plus ~9, alignées sur des minuits UTC, libellés adaptés à l\'échelle', () => {
  const week = tickTimes(T0, T0 + 7 * DAY);
  assert.ok(week.length >= 2 && week.length <= 9);
  assert.ok(week.every((k) => k.tMs % DAY === 0 && /^\d\d-\d\d$/.test(k.label)));
  const year = tickTimes(T0, T0 + 365 * DAY);
  assert.ok(year.length <= 9 && year.every((k) => /^\d{4}-\d\d$/.test(k.label)));
  const all = tickTimes(T0, T0 + 5 * 365 * DAY);
  assert.ok(all.length <= 9 && all.every((k) => /^\d{4}$/.test(k.label)));
  assert.deepEqual(tickTimes(T0, T0 + 7 * DAY).map((k) => k.tMs), tickTimes(T0, T0 + 7 * DAY).map((k) => k.tMs)); // déterministe
});
