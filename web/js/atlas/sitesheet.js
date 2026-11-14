// Fiche d'un site sur l'Atlas et visite guidée (S-03, S-04) : fonctions PURES, testées sans navigateur.
// La fiche ne dit que ce que l'index.json sait : aucune résolution ni aucun verdict inventés ici.

/** Clés de texte (i18n) et valeurs de la fiche d'une entrée de l'index. */
export function siteSheet(entry) {
  const real = entry.terrain_real === true;
  let tierKey = 'sheet.tierDemo';
  if (entry.tier === 1) tierKey = 'sheet.tier1';
  else if (entry.tier === 2) tierKey = 'sheet.tier2';
  return {
    id: entry.id,
    tierKey,
    reliefKey: real ? 'sheet.reliefReal' : 'sheet.reliefSynthetic',
    ephemerisKey: entry.ephemeris_synthetic ? 'sheet.ephemerisDemo' : 'sheet.ephemerisReal',
    coordsKey: entry.synthetic && !real ? 'sheet.coordsFictitious' : (entry.verified === true ? 'sheet.coordsVerified' : 'sheet.coordsUnverified'),
    latDeg: entry.lat_deg,
    lonDeg: entry.lon_deg,
    region: typeof entry.nasa_2024_region === 'string' && entry.nasa_2024_region ? entry.nasa_2024_region : null,
    pgdaId: typeof entry.pgda_id === 'string' && entry.pgda_id ? entry.pgda_id : null,
    synthetic: Boolean(entry.synthetic),
  };
}

/** Identifiants des sites prioritaires (niveau 1), dans l'ordre de l'index : parcours de la visite guidée. */
export function tourOrder(entries) {
  return entries.filter((e) => e.tier === 1).map((e) => e.id);
}

/** Position dans la visite : { index (0-based), total, previousId, nextId } ou null si le site n'en fait pas partie. */
export function tourPosition(order, currentId) {
  const index = order.indexOf(currentId);
  if (index < 0) return null;
  return { index, total: order.length, previousId: index > 0 ? order[index - 1] : null, nextId: index < order.length - 1 ? order[index + 1] : null };
}
