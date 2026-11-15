// Liaison et énergie (V2-05, BUILD-V2 § 7, D-028) : GÉOMÉTRIE seulement. Décompte avant lever / coucher, délai de propagation calculé, fenêtres et coupures.
// Fonctions PURES. Aucune éphéméride de relais, aucune station au sol, aucun bilan de liaison, aucune trajectoire : ces limites sont écrites sur chaque écran du module.
// Visible = au-dessus du masque d'horizon du site (+ « angle minimal utile », paramètre de l'utilisateur, non normatif) ; sans angle, c'est le seuil strict ou optimiste.
import { MDEG_PER_DEG, R_EARTH_KM } from './constants.js';
import { bodyStateAt, siteTimeRange } from './data.js';
import { horizonAt, isVisible, visibleFraction } from './visibility.js';

const DEG = Math.PI / 180;
export const C_KM_S = 299792.458; // vitesse de la lumière dans le vide (valeur exacte du SI)
export const MIN_ANGLE_MAX_DEG = 5;
const HOUR_MS = 3_600_000;
const BISECTION_TOLERANCE_MS = 500;

/** Ramène un écart d'azimut (millidegrés) dans ]−180000 ; 180000] pour dérouler l'azimut autour d'une référence. */
const wrapDelta = (d) => ((((d + 180000) % 360000) + 360000) % 360000) - 180000;

/** Marge au seuil (degrés) d'un état : élévation − horizon à l'azimut du corps, + rayon angulaire en mode optimiste ; ≥ 0 ⇔ visible (angle minimal nul). */
function thresholdMargin(elDeg, radiusDeg, horizonDeg, mode) {
  return elDeg - horizonDeg + (mode === 'any' ? radiusDeg : 0);
}

/**
 * État d'un corps à l'instant tMs par interpolation d'HERMITE cubique entre les deux échantillons horaires voisins (azimut déroulé, élévation, rayon),
 * dérivées par différences centrées. Plus précis que l'interpolation linéaire de `bodyStateAt` pour retrouver un lever ou un coucher à la minute.
 */
export function hermiteState(site, body, tMs) {
  const { startMs, stepMs, count } = siteTimeRange(site);
  const x = Math.min(Math.max((tMs - startMs) / stepMs, 0), count - 1);
  const i0 = Math.min(Math.floor(x), count - 2);
  const u = x - i0;
  const s = site.bodies[body];
  const idx = (k) => Math.min(Math.max(k, 0), count - 1);
  const az0 = s.az_mdeg[i0];
  const azAt = (k) => az0 + wrapDelta(s.az_mdeg[idx(k)] - az0);
  const cubic = (p0, p1, m0, m1) => {
    const u2 = u * u;
    const u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
  };
  const series = (get) => cubic(get(i0), get(i0 + 1), (get(i0 + 1) - get(i0 - 1)) / (i0 === 0 ? 1 : 2), (get(i0 + 2) - get(i0)) / (i0 + 2 > count - 1 ? 1 : 2));
  return {
    azDeg: ((((series(azAt) / MDEG_PER_DEG) % 360) + 360) % 360),
    elDeg: series((k) => s.el_mdeg[idx(k)]) / MDEG_PER_DEG,
    radiusDeg: series((k) => s.radius_mdeg[idx(k)]) / MDEG_PER_DEG,
  };
}

/** Marge continue (degrés) à tMs : positive = visible ; l'angle minimal utile est soustrait (0 = seuil du pipeline). */
export function continuousMargin(site, body, tMs, mode, minAngleDeg = 0) {
  const st = hermiteState(site, body, tMs);
  return thresholdMargin(st.elDeg, st.radiusDeg, horizonAt(site.horizon.elev_deg, st.azDeg), mode) - minAngleDeg;
}

/** Visibilité de chaque échantillon horaire (Uint8Array) : seuil du pipeline si l'angle minimal est nul (mêmes résultats que `kpis`), sinon marge ≥ angle. */
export function visibleSamples(site, body, mode, minAngleDeg = 0) {
  const { count } = siteTimeRange(site);
  const s = site.bodies[body];
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i += 1) {
    const el = s.el_mdeg[i] / MDEG_PER_DEG;
    const r = s.radius_mdeg[i] / MDEG_PER_DEG;
    const h = horizonAt(site.horizon.elev_deg, s.az_mdeg[i] / MDEG_PER_DEG);
    out[i] = minAngleDeg === 0 ? Number(isVisible(visibleFraction(el, r, h), mode)) : Number(thresholdMargin(el, r, h, mode) >= minAngleDeg);
  }
  return out;
}

/**
 * Prochain changement d'état (coucher si visible, lever sinon) après tMs, à la seconde près (bissection sur la marge d'Hermite). Renvoie
 * `{ type: 'set' | 'rise', tMs, visibleNow }` ou `{ type: null, visibleNow }` s'il n'y en a pas avant la fin de la période. Un double franchissement
 * à l'intérieur d'une même heure n'est pas vu (échantillonnage horaire).
 */
export function nextEvent(site, body, tMs, mode, minAngleDeg = 0) {
  const { startMs, stepMs, endMs } = siteTimeRange(site);
  const g = (t) => continuousMargin(site, body, t, mode, minAngleDeg);
  const visibleNow = g(tMs) >= 0;
  let a = tMs;
  let ga = g(a);
  let hourEnd = startMs + (Math.floor((tMs - startMs) / stepMs) + 1) * stepMs;
  while (a < endMs) {
    const b = Math.min(hourEnd, endMs);
    const gb = g(b);
    if ((ga >= 0) !== (gb >= 0)) {
      let lo = a;
      let hi = b;
      while (hi - lo > BISECTION_TOLERANCE_MS) {
        const mid = (lo + hi) / 2;
        if ((g(mid) >= 0) === (ga >= 0)) lo = mid; else hi = mid;
      }
      return { type: visibleNow ? 'set' : 'rise', tMs: (lo + hi) / 2, visibleNow };
    }
    a = b;
    ga = gb;
    hourEnd += stepMs;
  }
  return { type: null, visibleNow };
}

/** Distance Terre – site (km) à tMs, déduite du rayon angulaire de la Terre vu du site : d = R_Terre / sin(rayon). */
export function earthDistanceKm(site, tMs) {
  return R_EARTH_KM / Math.sin(bodyStateAt(site, 'earth', tMs).radiusDeg * DEG);
}

/** Délai de propagation (s) : aller simple = distance / c, aller-retour = 2×. Calculé, jamais cité. */
export function lightDelay(site, tMs) {
  const distanceKm = earthDistanceKm(site, tMs);
  return { distanceKm, oneWayS: distanceKm / C_KM_S, roundTripS: (2 * distanceKm) / C_KM_S };
}

/**
 * Fenêtres « visible » et « absent » consécutives sur [startMs ; endMs] à partir des échantillons horaires (`flags`, Uint8Array).
 * Durée = nombre d'échantillons × pas (convention de `gap_stats`) ; `startsAtEdge` / `endsAtEdge` : l'intervalle touche le bord de la fenêtre (tronqué).
 */
export function runsOf(flags, site, startMs, endMs) {
  const { startMs: t0, stepMs, count } = siteTimeRange(site);
  const first = Math.max(0, Math.ceil((startMs - t0) / stepMs));
  const last = Math.min(count - 1, Math.floor((endMs - t0) / stepMs));
  const runs = [];
  let i = first;
  while (i <= last) {
    const state = flags[i] === 1;
    let j = i;
    while (j + 1 <= last && (flags[j + 1] === 1) === state) j += 1;
    runs.push({ visible: state, startMs: t0 + i * stepMs, endMs: t0 + (j + 1) * stepMs, hours: ((j - i + 1) * stepMs) / HOUR_MS, startsAtEdge: i === first, endsAtEdge: j === last });
    i = j + 1;
  }
  return runs;
}

/** Statistiques des coupures d'une liste de fenêtres : plus longue absence (h), nombre d'absences, part du temps visible (%). */
export function outageStats(runs) {
  const gaps = runs.filter((r) => !r.visible);
  const total = runs.reduce((s, r) => s + r.hours, 0);
  const visibleH = runs.filter((r) => r.visible).reduce((s, r) => s + r.hours, 0);
  return { longestGapH: gaps.reduce((m, r) => Math.max(m, r.hours), 0), nGaps: gaps.length, coveredPct: total ? (100 * visibleH) / total : 0 };
}

/** Échantillons où Soleil ET Terre sont visibles. */
export function bothSamples(sunFlags, earthFlags) {
  return Uint8Array.from(sunFlags, (v, i) => v & earthFlags[i]);
}

/** CSV (point-virgule, point décimal) d'une liste de fenêtres : début, fin, durée en heures, état, intervalle tronqué ; instants en UTC. */
export function runsToCsv(runs, labels = { visible: 'visible', absent: 'absent' }) {
  const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
  const lines = ['start_utc;end_utc;duration_h;state;truncated_at_window_edge'];
  for (const r of runs) lines.push([iso(r.startMs), iso(r.endMs), r.hours.toFixed(0), r.visible ? labels.visible : labels.absent, r.startsAtEdge || r.endsAtEdge ? 'yes' : 'no'].join(';'));
  return `${lines.join('\n')}\n`;
}

/** Durée lisible : « 3 h 12 min », « 41 h », « 12 j 4 h » (minutes seulement sous 48 h). */
export function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 48) return `${Math.floor(h / 24)} j ${h % 24} h`;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}
