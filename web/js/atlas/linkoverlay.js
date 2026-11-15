// Couche « Liaison » de l'Atlas (V2-05 § 7.4) : état de la liaison directe de chaque site à l'instant t, ou part du temps couvert sur une fenêtre.
// Les données viennent des bitsets de l'index (visibilité STRICTE de la Terre, une heure par bit) : aucun fichier de site à charger.
// C'est un ÉCHANTILLONNAGE PAR SITES (les sites sont les points de mesure), pas une carte continue ; géométrie seulement.

/** Décode un bitset (base64, bit 0 = premier échantillon) en indicateurs et sommes préfixes pour des parts de temps en O(1). */
export function decodeBits(base64, n) {
  const raw = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const flags = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) flags[i] = (raw.charCodeAt(i >> 3) >> (i & 7)) & 1;
  const prefix = new Int32Array(n + 1);
  for (let i = 0; i < n; i += 1) prefix[i + 1] = prefix[i] + flags[i];
  return { flags, prefix, n };
}

/** Indice d'échantillon pour un instant (arrondi à l'heure la plus proche, borné). */
export function indexAt(tMs, startMs, stepMs, n) {
  return Math.min(Math.max(Math.round((tMs - startMs) / stepMs), 0), n - 1);
}

/** Part du temps (%) où le bit vaut 1 sur [i0, i1] inclus. */
export function coveragePct(decoded, i0, i1) {
  const a = Math.max(0, Math.min(i0, i1));
  const b = Math.min(decoded.n - 1, Math.max(i0, i1));
  return (100 * (decoded.prefix[b + 1] - decoded.prefix[a])) / (b - a + 1);
}

const STOPS = [[0, [68, 1, 84]], [0.5, [33, 144, 141]], [1, [253, 231, 37]]]; // échelle séquentielle (viridis, sûre pour le daltonisme)

/** Couleur « #rrggbb » d'une part de temps (0–100 %) sur l'échelle séquentielle ; bornée. */
export function colorForPct(pct) {
  const x = Math.min(1, Math.max(0, pct / 100));
  const k = x <= 0.5 ? 0 : 1;
  const [x0, c0] = STOPS[k];
  const [x1, c1] = STOPS[k + 1];
  const w = (x - x0) / (x1 - x0);
  return `#${c0.map((v, i) => Math.round(v + (c1[i] - v) * w).toString(16).padStart(2, '0')).join('')}`;
}
