// Source unique de l'état de l'application (INTERFACE § 3). Les composants s'abonnent ; ils ne se parlent pas entre eux.
import { DEFAULT_THRESHOLD } from './constants.js';

/** État par défaut (INTERFACE § 3). siteIdA est fixé au premier site de l'index au démarrage. */
export const DEFAULT_STATE = Object.freeze({
  view: 'site',             // vue de la coque (ui/nav.js), fragment `view=`
  siteIdA: null,
  siteIdB: null,
  compare: false,
  tMs: Date.parse('2027-03-14T06:00:00Z'),
  threshold: DEFAULT_THRESHOLD,
  windowDays: 30,
  lang: 'fr',
  playing: false,
  speed: 3600,
  panoramaCenterAz: 0,
  selectedSiteId: null,     // site dont la fiche est ouverte sur l'Atlas (pas dans l'URL)
});

/** Crée un store : get() renvoie un état figé ; set(patch) notifie les abonnés avec la liste des clés changées. */
export function createStore(initial = {}) {
  let state = Object.freeze({ ...DEFAULT_STATE, ...initial });
  const subscribers = new Set();
  return {
    get: () => state,
    set(patch) {
      const changed = Object.keys(patch).filter((k) => !Object.is(state[k], patch[k]));
      if (!changed.length) return;
      state = Object.freeze({ ...state, ...patch });
      for (const fn of subscribers) fn(state, changed);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}
