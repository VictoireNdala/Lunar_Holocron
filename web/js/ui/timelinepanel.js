// Carte « Frise temporelle » (T-12, INTERFACE § 7) : élévation du Soleil et de la Terre, horizon à l'azimut de chaque corps,
// bandes de visibilité selon le seuil, repère à l'instant courant. Clic ou flèches pour se déplacer. Calculs : web/js/timeline.js.
import { siteTimeRange } from '../data.js';
import { formatNumber, formatUtc, t } from '../i18n.js';
import { aggregate, buildSeries, elevationBounds, tickTimes, timeAtX, windowRange, xAtTime } from '../timeline.js';
import { bodyReading } from '../verdicts.js';

const $ = (id) => document.getElementById(id);
const MARGIN = { left: 38, right: 8, top: 8, bottom: 20 };
const BAND_H = 6;
const BAND_GAP = 2;
const HOUR_MS = 3_600_000;

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Crée la carte ; `render(site, state)` redessine, `bind()` branche les interactions. */
export function createTimelinePanel(store) {
  const canvas = $('tl-canvas');
  const ctx = canvas.getContext('2d');
  let site = null;
  let series = null;
  let seriesFor = null;
  let hoverMs = null;
  let layout = null;

  function ensureSeries(s) {
    if (seriesFor !== s.id) { series = buildSeries(s); seriesFor = s.id; }
  }

  function draw(state) {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (!site || !cssW || !cssH) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) { canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const range = siteTimeRange(site);
    const win = windowRange(state.tMs, state.windowDays, range);
    const plotW = Math.max(1, Math.floor(cssW - MARGIN.left - MARGIN.right));
    const bandsH = 3 * BAND_H + 2 * BAND_GAP;
    const plotH = cssH - MARGIN.top - MARGIN.bottom - bandsH - 4;
    const cols = aggregate(series, win.startMs, win.endMs, plotW, state.threshold);
    const bounds = elevationBounds(cols);
    const yOf = (deg) => MARGIN.top + ((bounds.maxDeg - deg) / (bounds.maxDeg - bounds.minDeg)) * plotH;
    layout = { win, plotW, range };
    const col = { sun: cssVar('--sun'), earth: cssVar('--earth'), both: cssVar('--ok'), text: cssVar('--text'), dim: cssVar('--text-2') };

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    // Axe vertical : 0° (horizon géométrique) et extrêmes
    ctx.fillStyle = col.dim;
    ctx.textAlign = 'right';
    for (const deg of new Set([0, Math.round(bounds.minDeg + 0.6), Math.round(bounds.maxDeg - 0.6)])) ctx.fillText(`${deg}°`, MARGIN.left - 6, yOf(deg));
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(MARGIN.left, yOf(0)); ctx.lineTo(MARGIN.left + plotW, yOf(0)); ctx.stroke();
    ctx.restore();

    const x = (i) => MARGIN.left + i + 0.5;
    ctx.save();
    ctx.beginPath(); ctx.rect(MARGIN.left, MARGIN.top, plotW, plotH); ctx.clip(); // les lignes d'horizon qui dépassent le cadre sont coupées
    for (const body of ['sun', 'earth']) {
      // Horizon du relief à l'azimut du corps (pointillé de la couleur du corps, atténué)
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = col[body];
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      let pen = false;
      cols.forEach((c, i) => { if (c.n === 0) { pen = false; return; } const y = yOf(c[body].hMid); if (pen) ctx.lineTo(x(i), y); else ctx.moveTo(x(i), y); pen = true; });
      ctx.stroke();
      ctx.restore();
      // Élévation : enveloppe min/max par colonne + ligne moyenne
      ctx.strokeStyle = col[body];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      pen = false;
      cols.forEach((c, i) => { if (c.n === 0) { pen = false; return; } const y = yOf(c[body].elMid); if (pen) ctx.lineTo(x(i), y); else ctx.moveTo(x(i), y); pen = true; });
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      cols.forEach((c, i) => { if (c.n > 1 && yOf(c[body].elMin) - yOf(c[body].elMax) > 1) { ctx.moveTo(x(i), yOf(c[body].elMax)); ctx.lineTo(x(i), yOf(c[body].elMin)); } });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // Bandes de visibilité : Soleil, Terre, les deux (opacité = part des échantillons visibles dans la colonne)
    const bandTop = MARGIN.top + plotH + 4;
    [['sun', (c) => c.sun.visibleShare, col.sun], ['earth', (c) => c.earth.visibleShare, col.earth], ['both', (c) => c.bothShare, col.both]].forEach(([, share, color], row) => {
      const y0 = bandTop + row * (BAND_H + BAND_GAP);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(MARGIN.left, y0, plotW, BAND_H);
      ctx.fillStyle = color;
      cols.forEach((c, i) => { if (c.n === 0) return; const a = share(c); if (a > 0) { ctx.globalAlpha = 0.25 + 0.75 * a; ctx.fillRect(MARGIN.left + i, y0, 1, BAND_H); } });
      ctx.globalAlpha = 1;
    });
    // Graduations de temps
    ctx.fillStyle = col.dim;
    ctx.textAlign = 'center';
    for (const tick of tickTimes(win.startMs, win.endMs)) {
      const px = xAtTime(tick.tMs, plotW, win.startMs, win.endMs);
      if (px === null || px < 10 || px > plotW - 10) continue;
      ctx.fillText(tick.label, MARGIN.left + px, cssH - 6);
    }
    // Repères : instant courant (plein) et survol (fin)
    for (const [ms, width, alpha] of [[hoverMs, 1, 0.5], [state.tMs, 2, 1]]) {
      if (ms === null) continue;
      const px = xAtTime(ms, plotW, win.startMs, win.endMs);
      if (px === null) continue;
      ctx.globalAlpha = alpha; ctx.strokeStyle = col.text; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(MARGIN.left + px, MARGIN.top); ctx.lineTo(MARGIN.left + px, bandTop + bandsH); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
  }

  function readout(state) {
    if (!site) return;
    const ms = hoverMs ?? state.tMs;
    const parts = ['sun', 'earth'].map((body) => {
      const r = bodyReading(site, body, ms, state.threshold);
      return `${t(`body.${body}`)} ${t(`status.${r.status}`)} (${t('timeline.margin')} ${r.marginDeg < 0 ? '−' : '+'}${formatNumber(Math.abs(r.marginDeg), 2)}°)`;
    });
    $('tl-readout').textContent = `${formatUtc(ms)} · ${parts.join(' · ')}`;
  }

  function render(nextSite, state) {
    site = nextSite;
    ensureSeries(site);
    for (const btn of document.querySelectorAll('.win-btn')) btn.setAttribute('aria-pressed', String(String(state.windowDays) === btn.dataset.win));
    draw(state);
    readout(state);
  }

  function pointerTime(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left - MARGIN.left;
    return timeAtX(x, layout.plotW, layout.win.startMs, layout.win.endMs, series);
  }

  function bind() {
    for (const btn of document.querySelectorAll('.win-btn')) btn.addEventListener('click', () => store.set({ windowDays: btn.dataset.win === 'all' ? 'all' : Number(btn.dataset.win) }));
    canvas.addEventListener('pointermove', (e) => { if (!site || !layout) return; hoverMs = pointerTime(e); draw(store.get()); readout(store.get()); });
    canvas.addEventListener('pointerleave', () => { hoverMs = null; if (site) { draw(store.get()); readout(store.get()); } });
    canvas.addEventListener('click', (e) => { if (site && layout) store.set({ tMs: pointerTime(e) }); });
    canvas.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!dir || !site) return;
      e.preventDefault();
      const range = siteTimeRange(site);
      const next = store.get().tMs + dir * (e.shiftKey ? 24 : 1) * HOUR_MS;
      store.set({ tMs: Math.min(Math.max(next, range.startMs), range.endMs) });
    });
    new ResizeObserver(() => { if (site) draw(store.get()); }).observe(canvas);
  }

  bind();
  return { render };
}
