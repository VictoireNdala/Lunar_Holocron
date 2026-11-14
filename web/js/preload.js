// Préchargement en tâche de fond du terrain et de la série des sites prioritaires (S-04, SITES-REELS § 6.4).
// Séquentiel, interrompu par aucune erreur, jamais bloquant : chaque étape rend la main au navigateur.

/**
 * Charge dans l'ordre le terrain puis le site de chaque entrée de niveau 1. `source` : { loadTerrain(id), loadSite(id) }
 * (le cache est celui de la source). `wait(ms)` rend la main entre deux étapes. Renvoie les identifiants chargés avec succès.
 */
export async function preloadTier1(source, entries, { wait = (ms) => new Promise((r) => setTimeout(r, ms)), pauseMs = 150, isCancelled = () => false } = {}) {
  const done = [];
  for (const entry of entries.filter((e) => e.tier === 1)) {
    if (isCancelled()) break;
    try {
      await source.loadTerrain(entry.id);
      await wait(pauseMs);
      if (isCancelled()) break;
      await source.loadSite(entry.id);
      done.push(entry.id);
    } catch {
      // Un site absent ou illisible n'empêche pas le préchargement des suivants ; l'erreur s'affichera à l'ouverture du site.
    }
    await wait(pauseMs);
  }
  return done;
}
