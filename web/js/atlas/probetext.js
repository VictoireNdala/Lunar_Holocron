// Texte de la sonde au survol, partagé par la carte du pôle Sud et la vue 3D d'un site : mêmes mots, mêmes unités (altitude, pente, distance et cap depuis le site,
// horizon dans cette direction, Soleil et Terre visibles). Fonction pure : `t` et `fmt` sont injectés (i18n).

/** `p` : résultat de probeAt() ; renvoie le texte, ou null si p est nul. */
export function formatProbe(p, t, fmt) {
  if (!p) return null;
  const yn = (v) => t(v ? 'probe.yes' : 'probe.no');
  let text = t('probe.relief', { h: fmt(p.heightM, 0), s: fmt(p.slopeDeg ?? 0, 1) });
  if (p.distanceKm !== undefined) {
    text += ` · ${t('probe.site', { d: fmt(p.distanceKm, 1), az: fmt(p.azimuthDeg, 0), hz: fmt(p.horizonDeg, 1) })}`;
    if (p.visible) text += ` · ${t('probe.bodies', { sun: yn(p.visible.sun), earth: yn(p.visible.earth) })}`;
  }
  return text;
}
