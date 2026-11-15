// Carte « Verdict du site » (U-04, INTERFACE § 8) : grand chiffre, fenêtre écrite, indicateurs, carte de chaleur mensuelle, tableau équivalent.
// Aucun calcul nouveau : les pourcentages sont ceux du contrat (`kpis`, `monthly`). La carte de chaleur est reconstruite seulement quand le site change.
import { formatNumber, formatUtc, t } from '../i18n.js';
import { kpiCards, monthIndexAt, monthlyHeat } from '../verdicts.js';

const ROWS = [['sun', 'sunPct'], ['earth', 'earthPct'], ['both', 'bothPct']];
const $ = (id) => document.getElementById(id);

const pct = (v) => `${formatNumber(v, 1)} %`;

/** Durée en heures, avec les jours entre parenthèses au-delà de 48 h. */
function hours(h) {
  return h > 48 ? t('verdict.hoursDays', { h: formatNumber(h, 0), d: formatNumber(h / 24, 1) }) : t('verdict.hours', { h: formatNumber(h, 0) });
}

/** Crée la carte ; `render(site, state)` affiche ; `bind(store)` branche le seuil, la carte de chaleur et le tableau. */
export function createVerdictPanel(store) {
  let months = [];
  let builtFor = null;
  let currentCell = -1;

  const rowLabel = (key) => t(key === 'both' ? 'verdict.kpi.both' : `body.${key}`);

  function buildHeat(site) {
    months = monthlyHeat(site);
    const heat = $('heat');
    heat.replaceChildren(...ROWS.map(([key, field]) => {
      const row = document.createElement('div');
      row.className = 'heat-row';
      row.setAttribute('role', 'group');
      row.setAttribute('aria-label', rowLabel(key));
      const label = document.createElement('span');
      label.className = 'heat-label';
      label.textContent = rowLabel(key);
      row.append(label);
      months.forEach((m, i) => {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = `heat-cell heat-${key}`;
        cell.dataset.month = String(i);
        cell.tabIndex = i === 0 ? 0 : -1; // un seul arrêt de tabulation par rangée ; flèches pour parcourir
        cell.style.setProperty('--v', String(Math.min(Math.max(m[field] / 100, 0), 1)));
        const text = t('verdict.cell', { month: m.ym, body: rowLabel(key), pct: formatNumber(m[field], 1) });
        cell.setAttribute('aria-label', text);
        cell.title = text;
        row.append(cell);
      });
      return row;
    }));
    const body = $('verdict-table-body');
    body.replaceChildren(...months.map((m) => {
      const tr = document.createElement('tr');
      for (const text of [m.ym, pct(m.sunPct), pct(m.earthPct), pct(m.bothPct)]) {
        const td = document.createElement(text === m.ym ? 'th' : 'td');
        if (text === m.ym) td.scope = 'row';
        td.textContent = text;
        tr.append(td);
      }
      return tr;
    }));
    currentCell = -1;
  }

  function markCurrentMonth(tMs) {
    const index = monthIndexAt(months, tMs);
    if (index === currentCell) return;
    currentCell = index;
    for (const cell of document.querySelectorAll('.heat-cell')) {
      if (Number(cell.dataset.month) === index) cell.setAttribute('aria-current', 'date'); else cell.removeAttribute('aria-current');
    }
  }

  function render(site, state) {
    const key = `${site.id}|${state.lang}`;
    const k = kpiCards(site, state.threshold);
    $('big-sun').textContent = pct(k.sunPct);
    $('big-earth').textContent = pct(k.earthPct);
    $('verdict-window').textContent = t('verdict.window', { start: formatUtc(Date.parse(k.window.startUtc)), end: formatUtc(Date.parse(k.window.endUtc)) });
    $('kpi-both').textContent = pct(k.bothPct);
    $('kpi-sun-gap').textContent = hours(k.longestSunGapH);
    $('kpi-earth-gap').textContent = hours(k.longestEarthGapH);
    $('threshold-note').textContent = t(`verdict.threshold.${state.threshold}`);
    for (const btn of document.querySelectorAll('.thr-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.threshold === state.threshold));
    $('verdict-position').textContent = t(site.synthetic ? 'verdict.positionSynthetic' : (site.position_basis === 'user' ? `verdict.position.user.${site.terrain_tier}` : `verdict.position.${site.position_basis ?? 'dem_center'}`), { h: formatNumber(site.location.observer_height_m, 1) });
    for (const kpi of document.querySelectorAll('.kpi[data-tip]')) kpi.title = t(kpi.dataset.tip);
    $('verdict-table-toggle').textContent = t($('verdict-table').hidden ? 'verdict.showValues' : 'verdict.hideValues');
    if (builtFor !== key) { buildHeat(site); builtFor = key; }
    markCurrentMonth(state.tMs);
  }

  function bind() {
    for (const btn of document.querySelectorAll('.thr-btn')) btn.addEventListener('click', () => store.set({ threshold: btn.dataset.threshold }));
    $('heat').addEventListener('click', (e) => {
      const cell = e.target.closest('.heat-cell');
      if (cell) store.set({ tMs: months[Number(cell.dataset.month)].tMs });
    });
    $('heat').addEventListener('keydown', (e) => {
      const cell = e.target.closest('.heat-cell');
      if (!cell) return;
      const row = [...cell.parentElement.querySelectorAll('.heat-cell')];
      const i = row.indexOf(cell);
      const target = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: row.length - 1 }[e.key];
      if (target === undefined) return;
      e.preventDefault();
      const next = row[Math.min(Math.max(target, 0), row.length - 1)];
      for (const c of row) c.tabIndex = c === next ? 0 : -1;
      next.focus();
    });
    $('verdict-table-toggle').addEventListener('click', () => {
      const open = $('verdict-table').hidden;
      $('verdict-table').hidden = !open;
      $('verdict-table-toggle').setAttribute('aria-expanded', String(open));
      $('verdict-table-toggle').textContent = t(open ? 'verdict.hideValues' : 'verdict.showValues');
    });
  }

  bind();
  return { render };
}
