// Raccord MNT 5 m / LDEM 80 m (M-062 CHAT, D-034) : sites dont l'écart maximal sur la couronne de contrôle (6,5 à 8 km du centre) dépasse 20 m.
// Valeurs de tests/reference/seam_5m_80m.json (vérifiées par web/tests/seam.test.js) ; publiées telles quelles, aucune donnée retouchée.
export const SEAM_THRESHOLD_M = 20;
export const SEAM_MAX_M = Object.freeze({
  'site20-leibnitz-beta-plateau': 22,
  'site23-malapert-massif': 21,
  'site42-de-gerlache-kocher-massif': 68,
  'dm1-amundsen-rim': 72,
  'npb-amundsen-1': 45,
});
