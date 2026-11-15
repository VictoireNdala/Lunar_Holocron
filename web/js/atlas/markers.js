// Marqueurs de sites de l'Atlas (V2-03, BUILD-V2 § 4) : fonctions PURES (glyphes, taille liée au zoom, empreinte réelle, regroupement, étiquettes sans chevauchement,
// navigation au clavier). Le dessin est dans markerdraw.js. Double codage forme + couleur ; palette sûre pour le daltonisme (Okabe-Ito), contrastes calculés.

export const BACKGROUND_HEX = '#06080c';
export const MIN_SIZE_PX = 5;
export const MAX_SIZE_PX = 16;
import { R_REF_M } from '../constants.js';

export const FOOTPRINT_MIN_PX = 14; // au-delà, on dessine le cercle au rayon réel plutôt qu'un glyphe
export const CLUSTER_CELL_PX = 28;

/** Famille → forme, couleur (Okabe-Ito), priorité d'affichage (0 = le plus important) et clé de texte. */
export const FAMILIES = Object.freeze({
  lola_site: { shape: 'disc', color: '#009E73', priority: 1, labelKey: 'marker.lola_site' },
  nasa_region: { shape: 'diamond', color: '#E69F00', priority: 2, labelKey: 'marker.nasa_region' },
  mission: { shape: 'triangle', color: '#CC79A7', priority: 3, labelKey: 'marker.mission' },
  feature: { shape: 'ring', color: '#56B4E9', priority: 4, labelKey: 'marker.feature' },
  apollo: { shape: 'star', color: '#F0E442', priority: 5, labelKey: 'marker.apollo' },
  fictional: { shape: 'square', color: '#FF9F43', priority: 6, labelKey: 'marker.fictional' }, // jamais livré ; garde-fou si un fichier `synthetic: true` était pointé
});

/** Glyphe d'une entrée de l'index : famille, forme, couleur, remplissage selon le statut, priorité (niveau 1 d'abord). */
export function glyphOf(entry) {
  const family = FAMILIES[entry.kind] ?? (entry.synthetic ? FAMILIES.fictional : FAMILIES.lola_site);
  let fill = 'solid';
  if (entry.kind === 'mission') fill = { landed: 'solid', planned: 'hollow', failed: 'cross' }[entry.status] ?? 'hollow';
  return { shape: family.shape, color: family.color, fill, priority: entry.tier === 1 ? 0 : family.priority, labelKey: family.labelKey };
}

/** Taille d'un glyphe à l'écran (px) : proportionnelle à √zoom, bornée. */
export function markerSizePx(zoom) {
  return Math.min(MAX_SIZE_PX, Math.max(MIN_SIZE_PX, MIN_SIZE_PX * Math.sqrt(zoom)));
}

/** Vrai si l'empreinte réelle (rayon en px) est assez grande pour être dessinée à la place du glyphe. */
export function showsFootprint(radiusPx) {
  return radiusPx > FOOTPRINT_MIN_PX;
}

/** Rayon en pixels d'une empreinte de `radiusKm` ; `pxPerKm` vient de la projection courante (mesurée localement). */
export function footprintRadiusPx(radiusKm, pxPerKm) {
  return radiusKm * pxPerKm;
}

/**
 * Regroupe par grille de `cellPx` : renvoie { singles: items isolés, clusters: [{ x, y, count, members }] }.
 * Un groupe = au moins 2 éléments dans la même cellule ; sa position est la moyenne ; ses membres gardent l'ordre d'entrée (priorité).
 * `items` : [{ id, x, y, priority }].
 */
export function clusterItems(items, cellPx = CLUSTER_CELL_PX) {
  const cells = new Map();
  for (const it of items) {
    const key = `${Math.floor(it.x / cellPx)},${Math.floor(it.y / cellPx)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(it);
  }
  const singles = [];
  const clusters = [];
  for (const members of cells.values()) {
    if (members.length === 1) { singles.push(members[0]); continue; }
    const sorted = [...members].sort((a, b) => a.priority - b.priority || String(a.id).localeCompare(String(b.id)));
    clusters.push({ x: sorted.reduce((s, m) => s + m.x, 0) / sorted.length, y: sorted.reduce((s, m) => s + m.y, 0) / sorted.length, count: sorted.length, members: sorted.map((m) => m.id) });
  }
  return { singles, clusters };
}

/** Rectangles qui se recouvrent (avec une marge). */
function overlaps(a, b, gap = 2) {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/**
 * Étiquettes sans chevauchement : on place par priorité croissante (0 d'abord) et on saute celles qui recouvrent une étiquette déjà placée.
 * `candidates` : [{ id, x, y, w, h, priority }] (x, y = coin haut-gauche). Renvoie les identifiants visibles.
 */
export function placeLabels(candidates, bounds = null) {
  const placed = [];
  for (const c of [...candidates].sort((a, b) => a.priority - b.priority || String(a.id).localeCompare(String(b.id)))) {
    if (bounds && (c.x < bounds.x || c.y < bounds.y || c.x + c.w > bounds.x + bounds.w || c.y + c.h > bounds.y + bounds.h)) continue;
    if (placed.some((p) => overlaps(p, c))) continue;
    placed.push(c);
  }
  return placed.map((p) => p.id);
}

/** Ordre de parcours au clavier (Tab) : priorité, puis identifiant (déterministe). */
export function keyboardOrder(items) {
  return [...items].sort((a, b) => a.priority - b.priority || String(a.id).localeCompare(String(b.id))).map((i) => i.id);
}

/** Marqueur voisin dans une direction (flèches) : parmi ceux dans un cône de ±60°, le plus proche ; null s'il n'y en a pas. `dir` : 'up' | 'down' | 'left' | 'right'. */
export function nearestInDirection(items, fromId, dir) {
  const from = items.find((i) => i.id === fromId);
  if (!from) return null;
  const axis = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best = null;
  let bestD = Infinity;
  for (const it of items) {
    if (it.id === fromId) continue;
    const dx = it.x - from.x;
    const dy = it.y - from.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) continue;
    const cos = (dx * axis[0] + dy * axis[1]) / d;
    if (cos < Math.cos(Math.PI / 3)) continue;
    if (d < bestD) { best = it; bestD = d; }
  }
  return best ? best.id : null;
}

/** Luminance relative WCAG d'une couleur « #rrggbb ». */
function luminance(hex) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

/** Rapport de contraste WCAG entre deux couleurs « #rrggbb ». */
export function contrastRatio(hexA, hexB) {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

const RAD = Math.PI / 180;

/**
 * Contour (lat, lon en degrés) du carré de demi-côté `halfKm` centré sur le site, aligné sur les axes du plan stéréographique polaire Sud (x = ρ sin λ, y = ρ cos λ,
 * ρ = 2R tan((φ + 90°)/2), comme pipeline/projection.py) ; chaque côté est subdivisé en `perSide` segments pour suivre la déformation de la carte.
 */
export function footprintOutline(latDeg, lonDeg, halfKm, perSide = 8) {
  const rho = 2 * R_REF_M * Math.tan((latDeg * RAD + Math.PI / 2) / 2);
  const x0 = rho * Math.sin(lonDeg * RAD);
  const y0 = rho * Math.cos(lonDeg * RAD);
  const h = halfKm * 1000;
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const points = [];
  for (let c = 0; c < 4; c += 1) {
    const [ax, ay] = corners[c];
    const [bx, by] = corners[(c + 1) % 4];
    for (let i = 0; i < perSide; i += 1) {
      const f = i / perSide;
      const x = x0 + ax + (bx - ax) * f;
      const y = y0 + ay + (by - ay) * f;
      points.push({ latDeg: (2 * Math.atan(Math.hypot(x, y) / (2 * R_REF_M)) - Math.PI / 2) / RAD, lonDeg: Math.atan2(x, y) / RAD });
    }
  }
  return points;
}
