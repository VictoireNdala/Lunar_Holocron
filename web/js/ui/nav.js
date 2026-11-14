// Navigation de la coque (UI-DESIGN § 5.2) : vues du rail, touches, détection de saisie. Fonctions pures.

/** Vues du rail, dans l'ordre d'affichage (fragment d'URL `view=`). */
export const VIEWS = Object.freeze(['atlas', 'world', 'south', 'north', 'site', 'method']);

/** Vues déjà construites ; les autres affichent un état « à venir » honnête. */
export const IMPLEMENTED_VIEWS = Object.freeze(['atlas', 'world', 'south', 'north', 'site', 'method']);

/** Vue par défaut tant que l'Atlas n'existe pas (ATLAS § 7 : l'Atlas deviendra la vue d'accueil sans site dans l'URL). */
export const DEFAULT_VIEW = 'site';

/** Index de l'élément du rail à atteindre au clavier, ou null si la touche ne concerne pas le rail. */
export function railKeyTarget(index, key, count) {
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight': return (index + 1) % count;
    case 'ArrowUp':
    case 'ArrowLeft': return (index - 1 + count) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}

/** Vrai si l'utilisateur est en train de taper (les raccourcis clavier sont alors ignorés, UI-DESIGN § 3.6). */
export function isTypingTarget(el) {
  if (!el) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || Boolean(el.isContentEditable);
}
