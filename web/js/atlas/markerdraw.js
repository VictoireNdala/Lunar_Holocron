// Dessin des marqueurs de l'Atlas sur une carte 2D (V2-03) : glyphes, empreintes réelles, groupes, étiquettes. Les décisions (forme, taille, regroupement,
// collision) viennent de markers.js ; ici on ne fait que tracer et renvoyer les zones cliquables.
import { CLUSTER_CELL_PX, clusterItems, footprintRadiusPx, glyphOf, markerSizePx, placeLabels, showsFootprint } from './markers.js';

const KM_PER_DEG = (Math.PI / 180) * 1737.4; // kilomètres par degré de latitude sur la sphère de référence
const OUTLINE = '#06080c';
const LABEL_ZOOM = 6; // au-delà, toutes les étiquettes sont candidates (sinon : niveau 1, sélectionné, survolé)
const FOOTPRINT_KM = { lola_site: 8 }; // demi-côté de l'emprise du MNT 5 m (carré de 16 km)

/** Trace un glyphe (centre x, y ; taille = rayon approximatif en px). `fill` : solid | hollow | cross. */
export function drawGlyph(ctx, shape, color, fill, x, y, size) {
  ctx.save();
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    if (shape === 'disc' || shape === 'ring') ctx.arc(x, y, size, 0, 2 * Math.PI);
    else if (shape === 'diamond') { ctx.moveTo(x, y - size * 1.2); ctx.lineTo(x + size * 1.2, y); ctx.lineTo(x, y + size * 1.2); ctx.lineTo(x - size * 1.2, y); ctx.closePath(); }
    else if (shape === 'triangle') { ctx.moveTo(x, y - size * 1.2); ctx.lineTo(x + size * 1.15, y + size * 0.9); ctx.lineTo(x - size * 1.15, y + size * 0.9); ctx.closePath(); }
    else if (shape === 'square') ctx.rect(x - size, y - size, size * 2, size * 2);
    else if (shape === 'star') { // étoile à quatre branches
      for (let i = 0; i < 8; i += 1) { const r = i % 2 === 0 ? size * 1.45 : size * 0.5; const a = (i * Math.PI) / 4 - Math.PI / 2; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
      ctx.closePath();
    }
  };
  path(); ctx.lineWidth = 3.5; ctx.strokeStyle = OUTLINE; ctx.stroke(); // contour sombre : lisibilité sur toute texture
  path();
  if (fill === 'solid' && shape !== 'ring') { ctx.fillStyle = color; ctx.fill(); } else { ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
  if (fill === 'cross') { ctx.beginPath(); ctx.moveTo(x - size * 0.6, y - size * 0.6); ctx.lineTo(x + size * 0.6, y + size * 0.6); ctx.moveTo(x + size * 0.6, y - size * 0.6); ctx.lineTo(x - size * 0.6, y + size * 0.6); ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke(); }
  ctx.restore();
}

/** Cercle d'empreinte au rayon réel ; pointillé si la position est approximative. */
function drawFootprint(ctx, x, y, radiusPx, color, dashed) {
  ctx.save();
  ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.globalAlpha = 0.9;
  if (dashed) ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.arc(x, y, radiusPx, 0, 2 * Math.PI); ctx.stroke();
  ctx.restore();
}

/** Pastille de groupe avec le nombre de sites. */
function drawCluster(ctx, x, y, count, text, bg, font) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, 11, 0, 2 * Math.PI); ctx.fillStyle = bg; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = text; ctx.stroke();
  ctx.fillStyle = text; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(count), x, y + 0.5);
  ctx.restore();
}

/**
 * Dessine tous les marqueurs et renvoie les zones d'interaction : [{ id, x, y, r, members? }] (un groupe porte `members`, dans l'ordre de priorité).
 * `zoom` : facteur de zoom de la carte ; `ids` : { selected, hovered, focused }.
 */
export function drawSites(ctx, proj, sites, zoom, style, ids = {}, overlayOf = null) {
  const size = markerSizePx(zoom);
  const items = [];
  for (const s of sites) {
    const q = proj.toPixel(s.latDeg, s.lonDeg);
    if (!q.ok) continue;
    const glyph = glyphOf(s);
    const radiusKm = s.position_uncertainty_km ?? FOOTPRINT_KM[s.kind] ?? 0;
    const q2 = radiusKm ? proj.toPixel(s.latDeg + 1 / KM_PER_DEG, s.lonDeg) : q;
    const pxPerKm = radiusKm ? Math.hypot(q2.x - q.x, q2.y - q.y) : 0;
    items.push({ s, glyph, x: q.x, y: q.y, priority: glyph.priority, id: s.id, footprintPx: radiusKm ? footprintRadiusPx(radiusKm, pxPerKm) : 0 });
  }
  const zones = [];
  // Empreintes réelles d'abord (sous les glyphes) ; le glyphe reste tracé au centre.
  for (const it of items) if (showsFootprint(it.footprintPx)) drawFootprint(ctx, it.x, it.y, it.footprintPx, it.glyph.color, Boolean(it.s.approximate));
  // Regroupement : seulement entre marqueurs dont l'empreinte n'est pas dessinée ; le sélectionné, le survolé et le focalisé sortent toujours du groupe.
  const pinned = new Set([ids.selected, ids.hovered, ids.focused]);
  const groupable = items.filter((it) => !pinned.has(it.id));
  const { singles, clusters } = clusterItems(groupable, CLUSTER_CELL_PX);
  const single = new Map(items.map((it) => [it.id, it]));
  const drawn = [...singles.map((it) => it), ...items.filter((it) => pinned.has(it.id))];
  for (const it of drawn) {
    const ov = overlayOf ? overlayOf(it.s) : null;
    if (ov) drawLinkHalo(ctx, it.x, it.y, size, ov);
    drawGlyph(ctx, it.glyph.shape, it.glyph.color, it.glyph.fill, it.x, it.y, size);
    if (it.id === ids.selected) { ctx.save(); ctx.lineWidth = 2.5; ctx.strokeStyle = style.text; ctx.beginPath(); ctx.arc(it.x, it.y, size + 6, 0, 2 * Math.PI); ctx.stroke(); ctx.restore(); }
    if (it.id === ids.focused) { ctx.save(); ctx.setLineDash([3, 3]); ctx.lineWidth = 2; ctx.strokeStyle = style.text; ctx.beginPath(); ctx.arc(it.x, it.y, size + 9, 0, 2 * Math.PI); ctx.stroke(); ctx.restore(); }
    zones.push({ id: it.id, x: it.x, y: it.y, r: Math.max(size + 5, 12) });
  }
  for (const c of clusters) {
    drawCluster(ctx, c.x, c.y, c.count, style.text, '#10151d', 'bold 11px "JetBrains Mono", monospace');
    zones.push({ id: `cluster:${c.members.join('|')}`, x: c.x, y: c.y, r: 13, members: c.members });
  }
  // Étiquettes : niveau 1, sélectionné, survolé, focalisé ; toutes si zoom ≥ seuil ; sans chevauchement.
  ctx.save();
  ctx.font = style.labelFont ?? '11px "Inter Variable", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const candidates = drawn.filter((it) => it.glyph.priority === 0 || pinned.has(it.id) || zoom >= LABEL_ZOOM).map((it) => {
    const w = ctx.measureText(it.s.name).width + 8;
    return { id: it.id, x: it.x + size + 5, y: it.y - 8, w, h: 16, priority: pinned.has(it.id) ? -1 : it.glyph.priority, text: it.s.name };
  });
  const visible = new Set(placeLabels(candidates, { x: 0, y: 0, w: proj.w, h: proj.h }));
  for (const c of candidates) {
    if (!visible.has(c.id)) continue;
    ctx.fillStyle = 'rgba(6,8,12,0.78)'; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = style.text; ctx.fillText(c.text, c.x + 4, c.y + c.h / 2 + 0.5);
  }
  ctx.restore();
  return { zones, single };
}

/** Halo de la couche « Liaison » : plein et vert = liaison possible, pointillé et orange = bloquée ; en couverture, trait épais coloré par la part du temps. */
function drawLinkHalo(ctx, x, y, size, ov) {
  ctx.save();
  ctx.lineWidth = ov.kind === 'coverage' ? 5 : 3;
  ctx.strokeStyle = ov.color;
  if (ov.kind === 'now' && !ov.possible) ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.arc(x, y, size + 5, 0, 2 * Math.PI); ctx.stroke();
  ctx.restore();
}

/** Zone cliquable la plus proche d'un pixel (rayon de sélection = rayon de la zone) ; null si aucune. */
export function zoneAt(zones, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const z of zones) {
    const d = Math.hypot(z.x - x, z.y - y);
    if (d <= z.r && d < bestD) { best = z; bestD = d; }
  }
  return best;
}
