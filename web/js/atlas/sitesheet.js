// Fiche d'un site sur l'Atlas et visite guidée (S-03, S-04) : fonctions PURES, testées sans navigateur.
// La fiche ne dit que ce que l'index.json sait : aucune résolution ni aucun verdict inventés ici.

/** Libellé du relief : niveau 5 m / 80 m (réel), « non modélisé » (horizon plat, ni réel ni fictif), ou fictif (jeu de test, jamais livré). */
function reliefKeyOf(entry, real) {
  if (entry.terrain_modeled === false) return 'sheet.reliefFlat';
  if (!real) return 'sheet.reliefSynthetic';
  return entry.terrain_tier === '80m' ? 'sheet.relief80' : (entry.terrain_tier === '5m' ? 'sheet.relief5' : 'sheet.reliefReal');
}

/** Statut de la position : base de la coordonnée (centre d'emprise, entité IAU, module Apollo) ; jamais « vérifiée » sans le dire. */
function coordsKeyOf(entry, real) {
  if (entry.synthetic && !real && entry.terrain_modeled !== false) return 'sheet.coordsFictitious';
  if (entry.position_basis === 'feature_center') return 'sheet.coordsFeature';
  if (entry.position_basis === 'apollo_nssdc') return 'sheet.coordsApollo';
  return entry.verified === true ? 'sheet.coordsVerified' : 'sheet.coordsUnverified';
}

/** Clés de texte (i18n) et valeurs de la fiche d'une entrée de l'index. */
export function siteSheet(entry) {
  const real = entry.terrain_real === true;
  let tierKey = 'sheet.tierDemo';
  if (entry.tier === 1) tierKey = 'sheet.tier1';
  else if (entry.tier === 2) tierKey = 'sheet.tier2';
  else if (entry.kind === 'feature') tierKey = 'sheet.kindFeature';
  else if (entry.kind === 'apollo') tierKey = 'sheet.kindApollo';
  return {
    id: entry.id,
    tierKey,
    reliefKey: reliefKeyOf(entry, real),
    ephemerisKey: entry.ephemeris_synthetic ? 'sheet.ephemerisDemo' : 'sheet.ephemerisReal',
    coordsKey: coordsKeyOf(entry, real),
    terrainTier: entry.terrain_tier ?? null,
    relief: entry.terrain_modeled === false ? 'flat' : (entry.synthetic ? 'synthetic' : 'real'),
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
