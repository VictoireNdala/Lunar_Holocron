// Verdicts, lectures et indicateurs d'un site (INTERFACE § 8, T-13, U-04). Fonctions PURES : aucun DOM.
// Aucun calcul nouveau : on assemble bodyStateAt, horizonAt et visibleFraction (mêmes formules que le pipeline) et on AFFICHE les `kpis` du contrat.
import { N_AZIMUTHS } from './constants.js';
import { bodyStateAt, siteTimeRange } from './data.js';
import { horizonAt, isVisible, visibleFraction } from './visibility.js';

/** État descriptif d'un corps, indépendant du seuil : masqué (f = 0), partiel (0 < f < 1), visible (f = 1). */
export function statusOf(fraction) {
  if (fraction <= 0) return 'hidden';
  return fraction >= 1 ? 'visible' : 'partial';
}

/** Vrai si le masque est tronqué (relief lointain non couvert) à l'un des deux azimuts qui encadrent `azDeg`. */
export function truncatedAt(truncated, azDeg) {
  const az = ((azDeg % 360) + 360) % 360;
  const i0 = Math.floor(az) % N_AZIMUTHS;
  return Boolean(truncated[i0] || truncated[(i0 + 1) % N_AZIMUTHS]);
}

/**
 * Lecture d'un corps à l'instant tMs : position, horizon à son azimut, marge signée (élévation − horizon, en degrés),
 * fraction visible, état descriptif, visibilité binaire selon le seuil (`mode` : 'strict' | 'any').
 */
export function bodyReading(site, body, tMs, mode) {
  const s = bodyStateAt(site, body, tMs);
  const horizonDeg = horizonAt(site.horizon.elev_deg, s.azDeg);
  const fraction = visibleFraction(s.elDeg, s.radiusDeg, horizonDeg);
  return {
    body,
    azDeg: s.azDeg,
    elDeg: s.elDeg,
    radiusDeg: s.radiusDeg,
    horizonDeg,
    marginDeg: s.elDeg - horizonDeg,
    fraction,
    status: statusOf(fraction),
    visible: isVisible(fraction, mode),
    truncated: truncatedAt(site.horizon.truncated, s.azDeg),
    inRange: s.inRange,
  };
}

/** Indicateurs du site pour un seuil, tels que dans le contrat (`kpis`) : valeurs inchangées, durées en heures. */
export function kpiCards(site, mode) {
  const k = site.kpis;
  return {
    sunPct: k.sun[mode].visible_pct,
    earthPct: k.earth[mode].visible_pct,
    bothPct: k.both[mode].visible_pct,
    longestSunGapH: k.sun[mode].longest_gap_h,
    longestEarthGapH: k.earth[mode].longest_gap_h,
    window: { startUtc: k.window.start_utc, endUtc: k.window.end_utc },
  };
}

/** Mois couverts avec leurs pourcentages (seuil strict, seul fourni par le contrat) et l'instant du 1er du mois, borné à la période. */
export function monthlyHeat(site) {
  const range = siteTimeRange(site);
  return site.monthly.map((m) => {
    const [y, mo] = m.ym.split('-').map(Number);
    const firstMs = Date.UTC(y, mo - 1, 1);
    return { ym: m.ym, sunPct: m.sun_strict_pct, earthPct: m.earth_strict_pct, bothPct: m.both_strict_pct, tMs: Math.min(Math.max(firstMs, range.startMs), range.endMs) };
  });
}

/** Mois (index dans `monthlyHeat`) qui contient tMs, ou -1. */
export function monthIndexAt(months, tMs) {
  const d = new Date(tMs);
  const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return months.findIndex((m) => m.ym === ym);
}
