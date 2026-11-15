// Section « Planifier » de la vue Liaison (V2-05 § 7.3) : quand atterrir sur ce site ? Paramètres SAISIS par l'utilisateur, classement à formule affichée,
// carte de chaleur calendaire (mois × jour), 10 meilleures fenêtres distinctes. Géométrie seulement ; aucune trajectoire, aucune durée de mission inventée.
import { siteTimeRange } from '../data.js';
import { formatNumber, formatUtc, t } from '../i18n.js';
import { colorForPct } from '../atlas/linkoverlay.js';
import { dayHeat, evaluateCandidates, missionTimeline, rank, topWindows } from '../planner.js';

const $ = (id) => document.getElementById(id);
const CELL_W = 18;
const CELL_H = 12;
const LEFT = 62;

/** Lit un champ numérique facultatif : nombre, ou NaN si vide / invalide (= contrainte ignorée). */
function optional(id) {
  const raw = $(id).value.replace(',', '.').trim();
  return raw === '' ? NaN : Number(raw);
}

/** Crée la section ; `render(site, state)` mémorise le site (le calcul se fait au clic sur « Calculer »). */
export function createPlannerPanel(store) {
  let site = null;
  let days = [];
  let top = [];

  function params() {
    const stay = optional('plan-stay');
    return {
      stayDays: Number.isFinite(stay) && stay >= 1 && stay <= 60 ? stay : 7,
      constraints: { sunMinPct: optional('plan-sun'), earthMinPct: optional('plan-earth'), maxEarthGapH: optional('plan-gap'), sunsetNotBeforeH: optional('plan-sunset') },
      transferDays: optional('plan-transfer'),
      fromNow: $('plan-from').value === 'now',
    };
  }

  function drawHeat() {
    const canvas = $('plan-heat');
    const ctx = canvas.getContext('2d');
    const months = [...new Set(days.map((d) => d.day.slice(0, 7)))];
    const w = LEFT + 31 * CELL_W + 4;
    const h = months.length * CELL_H + 18;
    canvas.width = w; canvas.height = h;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    const byDay = new Map(days.map((d) => [d.day, d]));
    const text = getComputedStyle(document.documentElement).getPropertyValue('--text-2').trim() || '#aaa';
    months.forEach((ym, r) => {
      if (r % 3 === 0) { ctx.fillStyle = text; ctx.fillText(ym, 2, 18 + r * CELL_H + CELL_H / 2 - 4); }
      for (let d = 1; d <= 31; d += 1) {
        const key = `${ym}-${String(d).padStart(2, '0')}`;
        const cell = byDay.get(key);
        if (!cell) continue;
        ctx.fillStyle = colorForPct(cell.bothPct);
        ctx.fillRect(LEFT + (d - 1) * CELL_W, 14 + r * CELL_H, CELL_W - 1, CELL_H - 1);
      }
    });
    ctx.fillStyle = text;
    for (const d of [1, 5, 10, 15, 20, 25, 30]) ctx.fillText(String(d), LEFT + (d - 1) * CELL_W + 2, 6);
    canvas.dataset.months = JSON.stringify(months);
    canvas.setAttribute('aria-label', t('plan.heatAria', { n: days.length, best: formatNumber(Math.max(...days.map((d) => d.bothPct)), 1) }));
  }

  function renderTop() {
    const p = params();
    const body = $('plan-top');
    body.replaceChildren(...top.map((c, i) => {
      const tr = document.createElement('tr');
      const cells = [`${i + 1}`, formatUtc(c.t0Ms), `${formatNumber(c.bothPct, 1)} %`, `${formatNumber(c.sunPct, 1)} %`, `${formatNumber(c.earthPct, 1)} %`,
        `${formatNumber(c.earthGapH, 0)} h`, `${formatNumber(c.sunGapH, 0)} h`, `${formatNumber(c.firstSunsetH, 0)} h`, `${formatNumber(c.firstLinkLossH, 0)} h`, c.feasible ? t('plan.yes') : t('plan.no')];
      for (const text of cells) { const td = document.createElement('td'); td.textContent = text; tr.append(td); }
      const go = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn'; btn.textContent = t('plan.goto');
      btn.addEventListener('click', () => { store.set({ tMs: c.t0Ms }); showTimeline(c, p.transferDays); });
      go.append(btn); tr.append(go);
      return tr;
    }));
    if (top.length) showTimeline(top[0], p.transferDays);
  }

  function showTimeline(c, transferDays) {
    const m = missionTimeline(c, transferDays);
    const parts = [];
    if (m.launchMs !== null) parts.push(t('plan.launch', { time: formatUtc(m.launchMs) }));
    parts.push(t('plan.landing', { time: formatUtc(m.landingMs) }), t('plan.endStay', { time: formatUtc(m.endOfStayMs) }));
    $('plan-timeline').textContent = parts.join(' → ');
  }

  function compute() {
    if (!site) return;
    const p = params();
    const range = siteTimeRange(site);
    const fromMs = p.fromNow ? Math.max(range.startMs, Date.now()) : range.startMs;
    const { mode } = { mode: store.get().threshold };
    const candidates = evaluateCandidates(site, { fromMs, toMs: range.endMs, stayDays: p.stayDays, mode, minAngleDeg: store.get().minAngleDeg });
    $('plan-result').hidden = candidates.length === 0;
    $('plan-empty').hidden = candidates.length > 0;
    if (!candidates.length) return;
    const ranked = rank(candidates, p.constraints);
    const feasible = ranked.filter((c) => c.feasible).length;
    top = topWindows(ranked, 10);
    days = dayHeat(candidates);
    $('plan-count').textContent = t('plan.count', { n: formatNumber(candidates.length, 0), ok: formatNumber(feasible, 0), stay: formatNumber(p.stayDays, 0) });
    drawHeat();
    renderTop();
  }

  $('plan-go').addEventListener('click', compute);
  $('plan-heat').addEventListener('click', (e) => {
    const canvas = $('plan-heat');
    const months = JSON.parse(canvas.dataset.months ?? '[]');
    const r = canvas.getBoundingClientRect();
    const col = Math.floor(((e.clientX - r.left) * (canvas.width / r.width) - LEFT) / CELL_W) + 1;
    const row = Math.floor(((e.clientY - r.top) * (canvas.height / r.height) - 14) / CELL_H);
    const cell = days.find((d) => d.day === `${months[row]}-${String(col).padStart(2, '0')}`);
    if (cell) store.set({ tMs: cell.t0Ms });
  });

  return { render(nextSite) { if (nextSite?.id !== site?.id) { site = nextSite; $('plan-result').hidden = true; $('plan-empty').hidden = true; } else site = nextSite; } };
}
