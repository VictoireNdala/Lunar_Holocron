// Liens profonds vers Quickmap (LROC) et Moon Trek (NASA) : D-019, tâche S-05. Module PUR : aucun DOM, aucun réseau.
// Ces deux sites refusent l'iframe et les charger casserait « aucun réseau à l'exécution » : on ne propose que des liens,
// ouverts par un clic de l'utilisateur. Seul module de web/js/ autorisé à contenir des adresses https:// (test nonetwork).

export const QUICKMAP_URL = 'https://quickmap.lroc.im-ldi.com/';
export const TREK_URL = 'https://trek.nasa.gov/moon/';

// DECISION-PROVISOIRE (SITES-REELS § 9) : les paramètres d'URL qui centrent la carte sur une latitude/longitude n'ont PAS été
// confirmés en ouvrant les liens. `centered` reste donc faux : le lien ouvre la page d'accueil et le libellé le dit.

/** Longitude ramenée à [−180 ; 180] (accepte −180…360 comme les fichiers du pipeline) ; null si non finie ou hors plage. */
export function normalizeLon(lonDeg) {
  if (!Number.isFinite(lonDeg) || lonDeg < -180 || lonDeg > 360) return null;
  return lonDeg > 180 ? lonDeg - 360 : lonDeg;
}

/** Nombre au point décimal quelle que soit la langue du navigateur (pas de virgule, pas de séparateur de milliers). */
function decimal(value) {
  return value.toFixed(5);
}

/**
 * Liens profonds d'un site. Entrée : `{ lat_deg, lon_deg }` (centre du MNT source, SITES-REELS § 4).
 * Sortie : `{ lat_deg, lon_deg, coordsText, quickmap: { url, centered }, trek: { url, centered } }`, ou null si les coordonnées sont invalides.
 */
export function deepLinks(location) {
  const lat = location?.lat_deg;
  const lon = normalizeLon(location?.lon_deg);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || lon === null) return null;
  return {
    lat_deg: lat,
    lon_deg: lon,
    coordsText: `${decimal(lat)}, ${decimal(lon)}`,
    quickmap: { url: QUICKMAP_URL, centered: false },
    trek: { url: TREK_URL, centered: false },
  };
}
