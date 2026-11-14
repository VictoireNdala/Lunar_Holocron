// Lecture animée de l'horloge commune (ATLAS § 4) : le temps simulé suit le TEMPS RÉEL mesuré, pas le nombre d'images.
// Les fonctions pures sont testées sans navigateur ; le contrôleur reçoit une horloge et un planificateur injectables.

/** Vitesses proposées : secondes simulées par seconde réelle. */
export const SPEEDS = Object.freeze([1, 60, 3600, 86400]);

/** Intervalle minimal entre deux mises à jour de l'état (ms réelles) : ~10 images/s suffisent pour des panneaux de lecture. */
export const TICK_MS = 100;

/** Écart réel maximal pris en compte par pas (ms) : après un onglet en veille, on ne saute pas de jours d'un coup. */
export const MAX_DT_MS = 2000;

/**
 * Avance l'instant simulé de `dtMs` (ms réelles) à la vitesse `speed`. Renvoie le nouvel instant et `ended`
 * si une borne de la période est atteinte (l'instant est alors borné, jamais extrapolé).
 */
export function advance(tMs, dtMs, speed, range) {
  const next = tMs + Math.min(Math.max(dtMs, 0), MAX_DT_MS) * speed;
  if (!range) return { tMs: next, ended: false };
  if (next >= range.endMs) return { tMs: range.endMs, ended: true };
  return { tMs: next, ended: false };
}

/** « Maintenant » : l'instant réel s'il est dans la période, sinon `outside`. Arrondi à la minute (précision de l'URL). */
export function snapNow(nowMs, range) {
  const tMs = Math.floor(nowMs / 60000) * 60000;
  if (range && (tMs < range.startMs || tMs > range.endMs)) return { outside: true };
  return { tMs, outside: false };
}

/**
 * Contrôleur de lecture. `store` : état commun (tMs, playing, speed) ; `getRange` : période couverte ou null ;
 * `clock` : ms réelles monotones ; `schedule(fn)` / `cancel(handle)` : planificateur (requestAnimationFrame dans le navigateur).
 */
export function createPlayback({ store, getRange, clock, schedule, cancel }) {
  let handle = null;
  let last = 0;
  let sinceTick = 0;

  function frame() {
    handle = null;
    const now = clock();
    sinceTick += now - last;
    last = now;
    if (sinceTick >= TICK_MS) {
      const { tMs, ended } = advance(store.get().tMs, sinceTick, store.get().speed, getRange());
      sinceTick = 0;
      store.set(ended ? { tMs, playing: false } : { tMs });
    }
    if (store.get().playing) handle = schedule(frame);
  }

  function play() {
    const range = getRange();
    if (range && store.get().tMs >= range.endMs) store.set({ tMs: range.startMs }); // fin de période : on repart du début
    last = clock();
    sinceTick = 0;
    store.set({ playing: true });
    if (handle === null) handle = schedule(frame);
  }

  function pause() {
    if (store.get().playing) {
      // On rend le temps réel écoulé depuis la dernière mise à jour : une pause ne « perd » pas la fin de l'intervalle en cours.
      const { tMs } = advance(store.get().tMs, sinceTick + (clock() - last), store.get().speed, getRange());
      store.set({ tMs, playing: false });
    }
    store.set({ playing: false });
    if (handle !== null) { cancel(handle); handle = null; }
  }

  return {
    play, pause,
    toggle: () => (store.get().playing ? pause() : play()),
    setSpeed(speed) { if (SPEEDS.includes(speed)) store.set({ speed }); },
  };
}
