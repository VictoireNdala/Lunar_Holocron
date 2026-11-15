// Décompte avant coucher / lever du Soleil et de la Terre (V2-05 § 7.1) : texte prêt à afficher, avec cache (la lecture animée redessine 10 fois par seconde).
// Géométrie seulement : « visible » = au-dessus de l'horizon du site (+ angle minimal utile, paramètre de l'utilisateur).
import { formatDuration, nextEvent } from '../link.js';
import { siteTimeRange } from '../data.js';
import { formatUtc, t } from '../i18n.js';

/** Précision annoncée (minutes) : maximum mesuré contre SPICE à la minute sur 4 sites et 61 jours (docs/VALIDATION-RESULTATS.md § 4). */
export const COUNTDOWN_PRECISION_MIN = 2.5;

/** Crée un calculateur à cache : `describe(site, body, tMs, mode, minAngleDeg)` → { text, tip, event }. */
export function createCountdown() {
  const cache = new Map();

  function event(site, body, tMs, mode, minAngleDeg) {
    const key = `${site.id}|${body}|${mode}|${minAngleDeg}`;
    const hit = cache.get(key);
    if (hit && tMs >= hit.from && (hit.event.type === null ? tMs < hit.until : tMs < hit.event.tMs)) return hit.event;
    const found = nextEvent(site, body, tMs, mode, minAngleDeg);
    // Sans événement, le résultat reste valable jusqu'à la fin de la période (pas de nouveau calcul à chaque image).
    cache.set(key, { from: tMs, until: siteTimeRange(site).endMs, event: found });
    return found;
  }

  return {
    describe(site, body, tMs, mode, minAngleDeg = 0) {
      const found = event(site, body, tMs, mode, minAngleDeg);
      const name = t(`body.${body}`);
      const end = formatUtc(siteTimeRange(site).endMs);
      if (found.type === null) return { text: t('link.noEvent', { body: name, end }), tip: '', event: found };
      const d = formatDuration(found.tMs - tMs);
      return {
        text: t(found.type === 'set' ? 'link.sets' : 'link.rises', { body: name, d }),
        tip: t('link.eventAt', { time: formatUtc(found.tMs), p: COUNTDOWN_PRECISION_MIN }),
        event: found,
      };
    },
  };
}
