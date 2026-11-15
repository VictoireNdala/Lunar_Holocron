// Tests de atlas/sitesheet.js (fiche, visite) et preload.js (S-03, S-04).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizeContractText, localizeSourceLabel, siteSheet, tourOrder, tourPosition } from '../js/atlas/sitesheet.js';
import { preloadTier1 } from '../js/preload.js';

const REAL = { id: 'site04', tier: 1, terrain_real: true, ephemeris_synthetic: false, synthetic: false, verified: false, lat_deg: -89.7668, lon_deg: -171.8699, nasa_2024_region: null, pgda_id: 'Site04' };
const DEMO = { id: 'demo-a', terrain_real: false, ephemeris_synthetic: true, synthetic: true, verified: true, lat_deg: -89, lon_deg: 0 };
const ENTRIES = [REAL, DEMO, { ...REAL, id: 'site01' }, { ...REAL, id: 'x2', tier: 2 }, { ...REAL, id: 'site07' }];

test('fiche d\'un site réel : niveau 1, relief réel, coordonnées NON vérifiées, pas de région inventée', () => {
  const s = siteSheet(REAL);
  assert.equal(s.tierKey, 'sheet.tier1');
  assert.equal(s.reliefKey, 'sheet.reliefReal');
  assert.equal(s.ephemerisKey, 'sheet.ephemerisReal');
  assert.equal(s.coordsKey, 'sheet.coordsUnverified');
  assert.equal(s.region, null);
  assert.equal(s.pgdaId, 'Site04');
});

test('fiche d\'un site de démonstration : fictif, jamais présenté comme réel', () => {
  const s = siteSheet(DEMO);
  assert.equal(s.tierKey, 'sheet.tierDemo');
  assert.equal(s.reliefKey, 'sheet.reliefSynthetic');
  assert.equal(s.ephemerisKey, 'sheet.ephemerisDemo');
  assert.equal(s.coordsKey, 'sheet.coordsFictitious');
  assert.equal(s.synthetic, true);
});

test('région du rapport NASA : affichée seulement si renseignée ; niveau 2 reconnu', () => {
  assert.equal(siteSheet({ ...REAL, nasa_2024_region: 'Shackleton–de Gerlache' }).region, 'Shackleton–de Gerlache');
  assert.equal(siteSheet({ ...REAL, nasa_2024_region: '' }).region, null);
  assert.equal(siteSheet({ ...REAL, tier: 2 }).tierKey, 'sheet.tier2');
});

test('visite guidée : seulement le niveau 1, dans l\'ordre de l\'index', () => {
  assert.deepEqual(tourOrder(ENTRIES), ['site04', 'site01', 'site07']);
  assert.deepEqual(tourOrder([DEMO]), []);
});

test('position dans la visite : précédent / suivant, bornes, site hors visite', () => {
  const order = tourOrder(ENTRIES);
  assert.deepEqual(tourPosition(order, 'site04'), { index: 0, total: 3, previousId: null, nextId: 'site01' });
  assert.deepEqual(tourPosition(order, 'site07'), { index: 2, total: 3, previousId: 'site01', nextId: null });
  assert.equal(tourPosition(order, 'demo-a'), null);
});

test('préchargement : niveau 1 seulement, terrain puis site, séquentiel, une erreur n\'arrête pas la suite', async () => {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const op = (kind) => async (id) => {
    active += 1; maxActive = Math.max(maxActive, active);
    calls.push(`${kind}:${id}`);
    await Promise.resolve();
    active -= 1;
    if (id === 'site01' && kind === 'site') throw new Error('absent');
  };
  const done = await preloadTier1({ loadTerrain: op('terrain'), loadSite: op('site') }, ENTRIES, { wait: async () => {} });
  assert.deepEqual(calls, ['terrain:site04', 'site:site04', 'terrain:site01', 'site:site01', 'terrain:site07', 'site:site07']);
  assert.deepEqual(done, ['site04', 'site07']);
  assert.equal(maxActive, 1);
});

test('préchargement : rend la main entre les étapes et peut être annulé', async () => {
  let waits = 0;
  let cancelled = false;
  const calls = [];
  const source = { loadTerrain: async (id) => { calls.push(id); }, loadSite: async () => { cancelled = true; } };
  const done = await preloadTier1(source, ENTRIES, { wait: async () => { waits += 1; }, isCancelled: () => cancelled });
  assert.ok(waits >= 2);
  assert.deepEqual(calls, ['site04']); // annulé pendant le premier site : plus aucun autre site n'est lancé
  assert.deepEqual(done, ['site04']);  // le site en cours s'est bien chargé
});

test('contrat 1.2 : relief 5 m / 80 m / non modélisé dits distinctement ; « non modélisé » n\'est ni réel ni fictif', () => {
  const base = { id: 'x', synthetic: false, ephemeris_synthetic: false, verified: false, lat_deg: -85, lon_deg: 10 };
  assert.equal(siteSheet({ ...base, tier: 1, terrain_real: true, terrain_modeled: true, terrain_tier: '5m', kind: 'lola_site', position_basis: 'dem_center' }).reliefKey, 'sheet.relief5');
  const feature = siteSheet({ ...base, tier: 3, terrain_real: true, terrain_modeled: true, terrain_tier: '80m', kind: 'feature', position_basis: 'feature_center' });
  assert.equal(feature.reliefKey, 'sheet.relief80');
  assert.equal(feature.tierKey, 'sheet.kindFeature');
  assert.equal(feature.coordsKey, 'sheet.coordsFeature');
  const apollo = siteSheet({ ...base, tier: 4, terrain_real: false, terrain_modeled: false, terrain_tier: 'flat', kind: 'apollo', position_basis: 'apollo_nssdc' });
  assert.equal(apollo.reliefKey, 'sheet.reliefFlat');
  assert.equal(apollo.relief, 'flat');
  assert.equal(apollo.synthetic, false);
  assert.equal(apollo.coordsKey, 'sheet.coordsApollo');
  assert.equal(apollo.tierKey, 'sheet.kindApollo');
});

test('fiche d\'une mission : famille « mission » (jamais « démonstration »), position lue sur LROC, zone visée distinguée, statut, texte localisé, sources', () => {
  const base = { synthetic: false, ephemeris_synthetic: false, terrain_real: true, terrain_modeled: true, terrain_tier: '80m', verified: false, tier: 4, lat_deg: -80.13, lon_deg: 1.44 };
  const landed = siteSheet({ ...base, id: 'mission-im1-odysseus', kind: 'mission', position_basis: 'mission_lroc', status: 'landed', approximate: false, sources: [{ label: 'LROC', url: 'https://lroc.im-ldi.com/images/1360', read_utc: '2026-11-15' }] });
  assert.equal(landed.tierKey, 'sheet.kindMission');
  assert.equal(landed.coordsKey, 'sheet.coordsMission');
  assert.equal(landed.statusKey, 'sheet.status.landed');
  assert.equal(landed.missionTextKey, 'mission.text.mission-im1-odysseus');
  assert.deepEqual(landed.sources, [{ label: 'LROC', url: 'https://lroc.im-ldi.com/images/1360', readUtc: '2026-11-15' }]);
  const target = siteSheet({ ...base, id: 'mission-im2-athena-cible', kind: 'mission', position_basis: 'mission_lroc', status: 'planned', approximate: true });
  assert.equal(target.coordsKey, 'sheet.coordsMissionTarget');
  assert.equal(target.statusKey, 'sheet.status.planned');
  assert.equal(siteSheet({ ...base, kind: 'feature', position_basis: 'feature_center', status: 'inconnu' }).statusKey, null, 'statut inconnu : rien d\'inventé');
});

test('libellés de source : texte tel quel en français, fragments connus traduits en anglais, texte inconnu laissé intact', () => {
  const fr = 'LROC, « Chandrayaan-3 Landing Site » : 69,3741° S ; 32,32° E, altitude 532 m (image NAC M1447750764LR)';
  assert.equal(localizeSourceLabel(fr, 'fr'), fr);
  assert.equal(localizeSourceLabel(fr, 'en'), 'LROC, “Chandrayaan-3 Landing Site” : 69.3741° S; 32.32° E, elevation 532 m (image NAC M1447750764LR)');
  assert.equal(localizeSourceLabel('IAU Gazetteer, Haworth (fiche et fichier de centres)', 'en'), 'IAU Gazetteer, Haworth (page and centre-points file)');
  assert.equal(localizeSourceLabel('NASA NSSDC, Apollo Landing Sites', 'en'), 'NASA NSSDC, Apollo Landing Sites');
});

test('provenance du contrat en anglais : fragments connus traduits, autre texte français signalé, texte anglais et français inchangés', () => {
  const lic = "aucune licence indiquée sur les pages PGDA (lues le 2026-11-14) ; citation demandée, voir SOURCES.md";
  assert.equal(localizeContractText(lic, 'fr'), lic);
  assert.equal(localizeContractText(lic, 'en'), 'no licence stated on the PGDA pages (read on 2026-11-14); citation requested, see SOURCES.md');
  assert.equal(localizeContractText("centre de l'emprise du GeoTIFF Site06_final_adj_5mpp_surf.tif (4000 px × 4000 px × 5 m), lu le 2026-11-15", 'en'),
    'centre of the GeoTIFF footprint Site06_final_adj_5mpp_surf.tif (4000 px × 4000 px × 5 m), read on 2026-11-15');
  assert.match(localizeContractText('texte inconnu écrit par le pipeline', 'en'), /\(source text in French\)$/);
  assert.equal(localizeContractText('n/a', 'en'), 'n/a');
  assert.equal(localizeContractText(undefined, 'en'), undefined);
});
