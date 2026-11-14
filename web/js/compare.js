// Comparaison de deux sites A / B (T-14, INTERFACE § 9) : fonctions PURES. Aucun calcul nouveau : on met côte à côte les `kpis` du contrat
// (inchangés) et les lectures de verdicts.js au même instant. Pas de note ni de classement : seulement A, B et l'écart signé B − A.
import { bodyReading, kpiCards } from './verdicts.js';

/** Lignes du tableau d'indicateurs : { key, kind: 'pct' | 'hours', a, b, delta } avec delta = B − A (points de pourcentage, ou heures). */
export function kpiRows(siteA, siteB, mode) {
  const a = kpiCards(siteA, mode);
  const b = kpiCards(siteB, mode);
  return [
    ['sunPct', 'pct'], ['earthPct', 'pct'], ['bothPct', 'pct'], ['longestSunGapH', 'hours'], ['longestEarthGapH', 'hours'],
  ].map(([key, kind]) => ({ key, kind, a: a[key], b: b[key], delta: b[key] - a[key] }));
}

/** Les deux sites couvrent-ils la même période ? Sinon les pourcentages ne sont pas comparables tels quels. */
export function sameWindow(siteA, siteB) {
  return siteA.kpis.window.start_utc === siteB.kpis.window.start_utc && siteA.kpis.window.end_utc === siteB.kpis.window.end_utc;
}

/** Lectures du Soleil et de la Terre aux deux sites au même instant : [{ body, a, b, marginDelta }] (marginDelta = marge B − marge A, degrés). */
export function instantRows(siteA, siteB, tMs, mode) {
  return ['sun', 'earth'].map((body) => {
    const a = bodyReading(siteA, body, tMs, mode);
    const b = bodyReading(siteB, body, tMs, mode);
    return { body, a, b, marginDelta: b.marginDeg - a.marginDeg };
  });
}

/** Sites proposés comme B : tous ceux de l'index sauf A. */
export function candidatesForB(indexSites, siteIdA) {
  return indexSites.filter((s) => s.id !== siteIdA);
}
