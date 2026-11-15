// Vue « Liaison » (V2-05 §§ 7.1, 7.2, 7.5) : état de la liaison à l'instant courant, décompte, délai, fenêtres et coupures, export CSV.
// GÉOMÉTRIE seulement (D-028) : relais, stations, puissance de liaison et trajectoire ne sont pas modélisés ; la pastille de limites reste visible.
import { siteTimeRange } from '../data.js';
import { formatNumber, formatUtc, t } from '../i18n.js';
import { bodyReading } from '../verdicts.js';
import { bothSamples, lightDelay, outageStats, runsOf, runsToCsv, visibleSamples, MIN_ANGLE_MAX_DEG } from '../link.js';
import { windowRange } from '../timeline.js';
import { createCountdown } from './countdown.js';

const $ = (id) => document.getElementById(id);
const MAX_ROWS = 300;
const DAY_MS = 86_400_000;

/** Crée la vue ; `render(site, state)` la met à jour (ne fait rien si la vue n'est pas affichée). */
export function createLinkPanel(store) {
  const countdown = createCountdown();
  let bodyKey = 'earth';
  let sortKey = 'start';
  let lastRuns = [];

  function flags(site, state, key) {
    const sun = () => visibleSamples(site, 'sun', state.threshold, state.minAngleDeg);
    const earth = () => visibleSamples(site, 'earth', state.threshold, state.minAngleDeg);
    if (key === 'sun') return sun();
    if (key === 'earth') return earth();
    return bothSamples(sun(), earth());
  }

  function renderNow(site, state) {
    const reading = bodyReading(site, 'earth', state.tMs, state.threshold);
    const margin = reading.marginDeg - state.minAngleDeg;
    const possible = margin >= 0;
    const chip = $('link-state');
    chip.textContent = `${possible ? '●' : '○'} ${t(possible ? 'link.state.possible' : 'link.state.blocked')}`;
    chip.dataset.possible = String(possible);
    $('link-margin').textContent = t('link.marginLine', { m: `${margin < 0 ? '−' : '+'}${formatNumber(Math.abs(margin), 2)}`, a: formatNumber(state.minAngleDeg, 1) });
    for (const body of ['earth', 'sun']) {
      const c = countdown.describe(site, body, state.tMs, state.threshold, state.minAngleDeg);
      const el = $(`link-count-${body}`);
      el.textContent = c.text;
      el.title = c.tip;
    }
    const d = lightDelay(site, state.tMs);
    $('link-distance').textContent = `${formatNumber(d.distanceKm, 0)} km`;
    $('link-oneway').textContent = `${formatNumber(d.oneWayS, 3)} s`;
    $('link-roundtrip').textContent = `${formatNumber(d.roundTripS, 3)} s`;
  }

  function renderOutages(site, state) {
    const range = siteTimeRange(site);
    const win = windowRange(state.tMs, state.windowDays, range);
    lastRuns = runsOf(flags(site, state, bodyKey), site, win.startMs, win.endMs);
    const stats = outageStats(lastRuns);
    $('link-stats').textContent = t('link.stats', {
      longest: `${formatNumber(stats.longestGapH, 0)} h (≈ ${formatNumber(stats.longestGapH / 24, 1)} j)`, n: formatNumber(stats.nGaps, 0), pct: formatNumber(stats.coveredPct, 1),
      start: formatUtc(win.startMs), end: formatUtc(win.endMs),
    });
    const rows = [...lastRuns];
    if (sortKey === 'duration') rows.sort((a, b) => b.hours - a.hours || a.startMs - b.startMs);
    const body = $('link-runs');
    body.replaceChildren(...rows.slice(0, MAX_ROWS).map((r) => {
      const tr = document.createElement('tr');
      tr.dataset.visible = String(r.visible);
      const state_ = document.createElement('td');
      state_.textContent = `${r.visible ? '●' : '○'} ${t(r.visible ? 'link.row.visible' : 'link.row.absent')}`;
      const cells = [formatUtc(r.startMs), formatUtc(r.endMs), `${formatNumber(r.hours, 0)} h`];
      tr.append(state_, ...cells.map((text) => { const td = document.createElement('td'); td.textContent = text; return td; }));
      const edge = document.createElement('td');
      edge.textContent = r.startsAtEdge || r.endsAtEdge ? t('link.row.truncated') : '';
      tr.append(edge);
      return tr;
    }));
    $('link-trunc').hidden = rows.length <= MAX_ROWS;
    if (rows.length > MAX_ROWS) $('link-trunc').textContent = t('link.truncNote', { n: MAX_ROWS, total: rows.length });
    for (const btn of document.querySelectorAll('.link-body')) btn.setAttribute('aria-pressed', String(btn.dataset.body === bodyKey));
    for (const btn of document.querySelectorAll('.link-sort')) btn.setAttribute('aria-pressed', String(btn.dataset.sort === sortKey));
    for (const btn of document.querySelectorAll('.win-btn')) btn.setAttribute('aria-pressed', String(String(state.windowDays) === btn.dataset.win));
  }

  function render(site, state) {
    if (document.body.dataset.view !== 'link') return;
    $('link-angle').value = String(state.minAngleDeg);
    for (const btn of document.querySelectorAll('.thr-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.threshold === state.threshold));
    renderNow(site, state);
    renderOutages(site, state);
  }

  $('link-angle').addEventListener('change', (e) => {
    const v = Number(String(e.target.value).replace(',', '.'));
    if (Number.isFinite(v)) store.set({ minAngleDeg: Math.min(Math.max(Math.round(v * 2) / 2, 0), MIN_ANGLE_MAX_DEG) });
    else e.target.value = String(store.get().minAngleDeg);
  });
  for (const btn of document.querySelectorAll('.link-body')) btn.addEventListener('click', () => { bodyKey = btn.dataset.body; renderFromStore(); });
  for (const btn of document.querySelectorAll('.link-sort')) btn.addEventListener('click', () => { sortKey = btn.dataset.sort; renderFromStore(); });
  $('link-csv').addEventListener('click', () => {
    const csv = runsToCsv(lastRuns, { visible: t('link.row.visible'), absent: t('link.row.absent') });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `liaison-${bodyKey}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  let siteRef = null;
  const renderFromStore = () => { if (siteRef) render(siteRef, store.get()); };
  return {
    render(site, state) { siteRef = site; render(site, state); },
    countdown,
  };
}
