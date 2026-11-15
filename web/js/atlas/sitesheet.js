// Fiche d'un site sur l'Atlas et visite guidée (S-03, S-04) : fonctions PURES, testées sans navigateur.
// La fiche ne dit que ce que l'index.json sait : aucune résolution ni aucun verdict inventés ici.
import { SEAM_MAX_M } from '../seam.js';

const SHEET_STATUSES = ['landed', 'planned', 'failed', 'candidate', 'reference'];

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
  if (entry.position_basis === 'mission_lroc') return entry.approximate ? 'sheet.coordsMissionTarget' : 'sheet.coordsMission';
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
  else if (entry.kind === 'mission') tierKey = 'sheet.kindMission';
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
    seamMaxM: SEAM_MAX_M[entry.id] ?? null, // raccord 5 m / 80 m > 20 m : dit sur la fiche
    statusKey: typeof entry.status === 'string' && SHEET_STATUSES.includes(entry.status) ? `sheet.status.${entry.status}` : null,
    missionTextKey: entry.kind === 'mission' ? `mission.text.${entry.id}` : null, // texte localisé de la mission (le texte du contrat est en français)
    sources: Array.isArray(entry.sources) ? entry.sources.map((s) => ({ label: s.label, url: s.url, readUtc: s.read_utc })) : [],
  };
}

/** Libellé d'une source du contrat en anglais : le contrat est écrit en français, on traduit les fragments connus (l'affichage français est le texte tel quel). */
export function localizeSourceLabel(label, lang) {
  if (lang !== 'en') return label;
  const pairs = [
    ['fiche et fichier de centres', 'page and centre-points file'], ['fichier de points centraux', 'centre-points file'],
    ['champs center_lat, center_lon, diameter ; lu le', 'fields center_lat, center_lon, diameter; read on'],
    ['lecture partielle (page tronquée), premier bloc verbatim', 'partial reading (truncated page), first block verbatim'],
    ['Odysseus au repos à 80,13° S ; 1,44° E, altitude 2 579 m', 'Odysseus at rest at 80.13° S; 1.44° E, elevation 2,579 m'],
    ['69,3741° S ; 32,32° E, altitude 532 m', '69.3741° S; 32.32° E, elevation 532 m'],
    ['site d\'alunissage visé (−84,78° ; 29,13° E), à 160 km du pôle Sud', 'intended landing site (−84.78°; 29.13° E), 160 km from the south pole'],
    ['« ', '“'], [' »', '”'],
  ];
  return pairs.reduce((s, [fr, en]) => s.replace(fr, en), label);
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

/**
 * Texte de provenance du contrat (écrit en français) pour l'affichage anglais : fragments connus traduits ; tout autre texte français est suivi de « (source text in French) »
 * (jamais de traduction inventée). En français : tel quel.
 */
export function localizeContractText(text, lang) {
  if (lang !== 'en' || typeof text !== 'string') return text;
  const known = text
    .replace('aucune licence indiquée sur les pages PGDA (lues le 2026-11-14) ; citation demandée, voir SOURCES.md', 'no licence stated on the PGDA pages (read on 2026-11-14); citation requested, see SOURCES.md')
    .replace(/^centre de l'emprise du GeoTIFF (\S+) \((.+?)\), lu le (\S+)$/, 'centre of the GeoTIFF footprint $1 ($2), read on $3');
  if (known !== text) return known;
  return /[àâçéèêëîïôùûœ]|(le|la|les|du|des|lu|lus|sur|pas|aucune|centre de)/i.test(text) ? `${text} (source text in French)` : text;
}
