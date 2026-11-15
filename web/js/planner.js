// Planificateur de fenêtres d'alunissage (V2-05 § 7.3, D-028) : « quand atterrir ici ? ». Fonctions PURES, GÉOMÉTRIE seulement.
// Entrées SAISIES par l'utilisateur : durée de séjour, contraintes, durée de transfert : l'application n'invente ni trajectoire ni durée de mission.
// Pour chaque instant d'alunissage candidat t0 (pas de 6 h), on mesure le Soleil et la Terre sur [t0, t0 + durée de séjour] à partir des échantillons horaires.
import { siteTimeRange } from './data.js';
import { bothSamples, visibleSamples } from './link.js';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const CANDIDATE_STEP_H = 6;
export const MIN_SEPARATION_H = 24; // deux fenêtres retenues dans le classement sont distantes d'au moins un jour
export const DEFAULTS = Object.freeze({ stayDays: 7, minAngleDeg: 0 }); // 7 j : valeur par défaut d'un PARAMÈTRE UTILISATEUR (Q-016), pas un chiffre de mission

/** Plus longue suite de zéros dans flags[i0, i1[ (heures consécutives sans visibilité). */
function longestZeroRun(flags, i0, i1) {
  let best = 0;
  let run = 0;
  for (let i = i0; i < i1; i += 1) {
    if (flags[i] === 0) { run += 1; if (run > best) best = run; } else run = 0;
  }
  return best;
}

/** Heures avant le premier échantillon non visible dans [i0, i1[ (0 si le corps n'est déjà plus visible à t0 ; durée du séjour s'il reste visible). */
function hoursUntilFirstAbsence(flags, i0, i1) {
  for (let i = i0; i < i1; i += 1) if (flags[i] === 0) return i - i0;
  return i1 - i0;
}

/**
 * Évalue tous les instants candidats de [fromMs ; toMs] (pas de 6 h) dont le séjour tient dans la période couverte.
 * Renvoie la liste { t0Ms, sunPct, earthPct, bothPct, sunGapH, earthGapH, firstSunsetH, firstLinkLossH, stayH } dans l'ordre chronologique.
 */
export function evaluateCandidates(site, { fromMs, toMs, stayDays = DEFAULTS.stayDays, mode = 'strict', minAngleDeg = 0 }) {
  const { startMs, stepMs, count, endMs } = siteTimeRange(site);
  const stayN = Math.max(1, Math.round((stayDays * DAY_MS) / stepMs));
  const sun = visibleSamples(site, 'sun', mode, minAngleDeg);
  const earth = visibleSamples(site, 'earth', mode, minAngleDeg);
  const both = bothSamples(sun, earth);
  const prefix = (flags) => { const p = new Int32Array(count + 1); for (let i = 0; i < count; i += 1) p[i + 1] = p[i] + flags[i]; return p; };
  const [ps, pe, pb] = [prefix(sun), prefix(earth), prefix(both)];
  const stepN = Math.max(1, Math.round((CANDIDATE_STEP_H * HOUR_MS) / stepMs));
  const first = Math.max(0, Math.ceil((Math.max(fromMs, startMs) - startMs) / stepMs));
  const last = Math.min(count - stayN, Math.floor((Math.min(toMs, endMs) - startMs) / stepMs));
  const out = [];
  for (let i = first; i <= last; i += stepN) {
    const j = i + stayN;
    out.push({
      t0Ms: startMs + i * stepMs, stayH: (stayN * stepMs) / HOUR_MS,
      sunPct: (100 * (ps[j] - ps[i])) / stayN, earthPct: (100 * (pe[j] - pe[i])) / stayN, bothPct: (100 * (pb[j] - pb[i])) / stayN,
      sunGapH: (longestZeroRun(sun, i, j) * stepMs) / HOUR_MS, earthGapH: (longestZeroRun(earth, i, j) * stepMs) / HOUR_MS,
      firstSunsetH: (hoursUntilFirstAbsence(sun, i, j) * stepMs) / HOUR_MS, firstLinkLossH: (hoursUntilFirstAbsence(earth, i, j) * stepMs) / HOUR_MS,
    });
  }
  return out;
}

/** Une fenêtre respecte-t-elle les contraintes saisies ? (contrainte absente ou nulle = ignorée). */
export function satisfies(c, constraints = {}) {
  const { sunMinPct, earthMinPct, maxEarthGapH, sunsetNotBeforeH } = constraints;
  if (Number.isFinite(sunMinPct) && c.sunPct < sunMinPct) return false;
  if (Number.isFinite(earthMinPct) && c.earthPct < earthMinPct) return false;
  if (Number.isFinite(maxEarthGapH) && c.earthGapH > maxEarthGapH) return false;
  if (Number.isFinite(sunsetNotBeforeH) && c.firstSunsetH < sunsetNotBeforeH) return false;
  return true;
}

/**
 * Classement : (1) fenêtres qui respectent TOUTES les contraintes avant les autres ; (2) part du temps « Soleil et Terre ensemble » décroissante ;
 * (3) plus longue coupure de la Terre croissante ; (4) date croissante. Formule affichée à l'écran : pas de score opaque.
 */
export function rank(candidates, constraints = {}) {
  return candidates.map((c) => ({ ...c, feasible: satisfies(c, constraints) }))
    .sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.bothPct - a.bothPct || a.earthGapH - b.earthGapH || a.t0Ms - b.t0Ms);
}

/** Meilleures fenêtres distinctes (≥ 24 h d'écart entre deux retenues) parmi un classement. */
export function topWindows(ranked, n = 10) {
  const picked = [];
  for (const c of ranked) {
    if (picked.length >= n) break;
    if (picked.every((p) => Math.abs(p.t0Ms - c.t0Ms) >= MIN_SEPARATION_H * HOUR_MS)) picked.push(c);
  }
  return picked;
}

/** Carte de chaleur calendaire : pour chaque jour UTC, la meilleure part « les deux » parmi les instants candidats de ce jour. */
export function dayHeat(candidates) {
  const days = new Map();
  for (const c of candidates) {
    const key = new Date(c.t0Ms).toISOString().slice(0, 10);
    const cur = days.get(key);
    if (!cur || c.bothPct > cur.bothPct) days.set(key, { day: key, bothPct: c.bothPct, t0Ms: c.t0Ms });
  }
  return [...days.values()];
}

/** Calendrier de mission à décalage SAISI : lancement = alunissage − durée de transfert (null si le transfert n'est pas saisi), fin de séjour = alunissage + séjour. */
export function missionTimeline(c, transferDays) {
  return {
    launchMs: Number.isFinite(transferDays) && transferDays > 0 ? c.t0Ms - transferDays * DAY_MS : null,
    landingMs: c.t0Ms,
    endOfStayMs: c.t0Ms + c.stayH * HOUR_MS,
  };
}
