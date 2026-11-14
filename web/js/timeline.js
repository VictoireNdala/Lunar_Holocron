// Frise temporelle (T-12, INTERFACE § 7) : fonctions PURES. Séries par échantillon (élévation, horizon à l'azimut du corps, fraction visible)
// calculées UNE fois par site avec les formules partagées, puis agrégées par colonne de pixels (min / max) pour garder les extrêmes.
import { MDEG_PER_DEG } from './constants.js';
import { siteTimeRange } from './data.js';
import { horizonAt, isVisible, visibleFraction } from './visibility.js';

const DAY_MS = 86_400_000;
export const WINDOWS = Object.freeze([7, 30, 365, 'all']);

/**
 * Séries d'un site pour la frise : pour chaque corps, élévation, horizon à l'azimut du corps et fraction visible (Float32Array de `count` valeurs).
 * Aucun calcul nouveau : mêmes `horizonAt` et `visibleFraction` que la carte de lectures ; l'azimut est lu à chaque échantillon horaire.
 */
export function buildSeries(site) {
  const { startMs, stepMs, count } = siteTimeRange(site);
  const out = { startMs, stepMs, count };
  for (const body of ['sun', 'earth']) {
    const b = site.bodies[body];
    const el = new Float32Array(count);
    const horizon = new Float32Array(count);
    const fraction = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const elDeg = b.el_mdeg[i] / MDEG_PER_DEG;
      const h = horizonAt(site.horizon.elev_deg, b.az_mdeg[i] / MDEG_PER_DEG);
      el[i] = elDeg;
      horizon[i] = h;
      fraction[i] = visibleFraction(elDeg, b.radius_mdeg[i] / MDEG_PER_DEG, h);
    }
    out[body] = { el, horizon, fraction };
  }
  return out;
}

/** Fenêtre affichée : `windowDays` jours (ou toute la période) centrés sur tMs, décalés pour rester dans la période couverte. */
export function windowRange(tMs, windowDays, range) {
  if (windowDays === 'all') return { startMs: range.startMs, endMs: range.endMs };
  const span = Math.min(windowDays * DAY_MS, range.endMs - range.startMs);
  const startMs = Math.min(Math.max(tMs - span / 2, range.startMs), range.endMs - span);
  return { startMs, endMs: startMs + span };
}

/**
 * Agrège la fenêtre en `width` colonnes. Chaque échantillon appartient à une seule colonne ; une colonne sans échantillon (fenêtre plus
 * courte que la largeur) est vide (`n = 0`). Par corps : min / max / moyenne de l'élévation, de l'horizon, et part des échantillons visibles
 * selon `mode` ; `both` : part des échantillons où Soleil ET Terre sont visibles.
 */
export function aggregate(series, startMs, endMs, width, mode) {
  const first = Math.max(0, Math.ceil((startMs - series.startMs) / series.stepMs));
  const last = Math.min(series.count - 1, Math.floor((endMs - series.startMs) / series.stepMs));
  const cols = Array.from({ length: width }, () => ({ n: 0, sun: null, earth: null, both: 0 }));
  const span = endMs - startMs;
  for (let i = first; i <= last; i += 1) {
    const x = Math.min(width - 1, Math.floor(((series.startMs + i * series.stepMs - startMs) / span) * width));
    const col = cols[x];
    const vis = {};
    for (const body of ['sun', 'earth']) {
      const s = series[body];
      const el = s.el[i];
      const h = s.horizon[i];
      let c = col[body];
      if (!c) { c = { elMin: el, elMax: el, elSum: 0, hMin: h, hMax: h, hSum: 0, visible: 0 }; col[body] = c; }
      c.elMin = Math.min(c.elMin, el); c.elMax = Math.max(c.elMax, el); c.elSum += el;
      c.hMin = Math.min(c.hMin, h); c.hMax = Math.max(c.hMax, h); c.hSum += h;
      vis[body] = isVisible(s.fraction[i], mode);
      if (vis[body]) c.visible += 1;
    }
    if (vis.sun && vis.earth) col.both += 1;
    col.n += 1;
  }
  return cols.map((c) => (c.n === 0 ? c : {
    n: c.n,
    sun: { ...c.sun, elMid: c.sun.elSum / c.n, hMid: c.sun.hSum / c.n, visibleShare: c.sun.visible / c.n },
    earth: { ...c.earth, elMid: c.earth.elSum / c.n, hMid: c.earth.hSum / c.n, visibleShare: c.earth.visible / c.n },
    bothShare: c.both / c.n,
  }));
}

/**
 * Bornes verticales (degrés) d'une fenêtre agrégée : extrêmes des ÉLÉVATIONS des corps, avec une marge, toujours autour de 0°.
 * L'horizon n'y entre pas : un massif de 30° ne doit pas écraser des courbes qui varient de quelques degrés ; sa ligne est simplement
 * coupée par le cadre (elle sort du dessin quand le relief dépasse largement le corps, ce qui veut dire « masqué »).
 */
export function elevationBounds(columns, marginDeg = 0.6) {
  let lo = 0;
  let hi = 0;
  for (const c of columns) {
    if (c.n === 0) continue;
    for (const b of [c.sun, c.earth]) { lo = Math.min(lo, b.elMin); hi = Math.max(hi, b.elMax); }
  }
  return { minDeg: lo - marginDeg, maxDeg: hi + marginDeg };
}

/** Instant (ms) correspondant à une abscisse en pixels, arrondi au pas du site (un clic tombe sur un échantillon). */
export function timeAtX(x, width, startMs, endMs, series) {
  const raw = startMs + (Math.min(Math.max(x, 0), width) / width) * (endMs - startMs);
  const i = Math.min(Math.max(Math.round((raw - series.startMs) / series.stepMs), 0), series.count - 1);
  return series.startMs + i * series.stepMs;
}

/** Abscisse en pixels d'un instant dans la fenêtre, ou null s'il est hors fenêtre. */
export function xAtTime(tMs, width, startMs, endMs) {
  if (tMs < startMs || tMs > endMs) return null;
  return ((tMs - startMs) / (endMs - startMs)) * width;
}

const TICK_DAYS = [1, 2, 5, 10, 30, 91, 182, 365, 730];

/** Graduations de temps de la fenêtre : au plus ~8, alignées sur des minuits UTC ; libellé « MM-JJ », « AAAA-MM » ou « AAAA » selon l'échelle. */
export function tickTimes(startMs, endMs) {
  const spanDays = (endMs - startMs) / DAY_MS;
  const stepDays = TICK_DAYS.find((d) => spanDays / d <= 8) ?? TICK_DAYS[TICK_DAYS.length - 1];
  const out = [];
  for (let ms = Math.ceil(startMs / (stepDays * DAY_MS)) * stepDays * DAY_MS; ms <= endMs; ms += stepDays * DAY_MS) {
    const iso = new Date(ms).toISOString();
    out.push({ tMs: ms, label: stepDays >= 365 ? iso.slice(0, 4) : stepDays >= 30 ? iso.slice(0, 7) : iso.slice(5, 10) });
  }
  return out;
}
