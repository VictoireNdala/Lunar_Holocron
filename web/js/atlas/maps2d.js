// Cartes 2D de l'Atlas (A-05, docs/ATLAS.md §§ 5.2-5.3) : monde (équirectangulaire), pôle Sud et pôle Nord (stéréographiques polaires).
// Canvas 2D, sans three.js : fonctionne même sans WebGL. Les projections viennent de sphere.js (testées contre tests/golden/atlas_sphere.json).
// Aucun verdict de visibilité : ombre de nuit = Soleil à l'horizon PLAT sur une sphère lisse ; la texture est illustrative.
import {
  angularDistanceDeg, equirectLatLon, equirectPixel, latLonToVector, northPolar, northPolarInverse, southPolar, southPolarInverse,
  terminatorCircle,
} from './sphere.js';
import { drawSites } from './markerdraw.js';
import { edgeAlpha, gradientAt, reliefFactor } from './relief.js';
import { R_REF_M } from '../constants.js';

const DEG = Math.PI / 180;
const R_UNIT = 1; // rayon de la sphère unité : les stéréographiques sont mises à l'échelle en pixels
const MARGIN_PX = 14;
const NIGHT_MAX_ALPHA = 0.62;
const NIGHT_SOFTNESS = 14; // largeur du crépuscule fictif (plus grand = transition plus nette) ; purement esthétique
const DEFAULT_LIMIT_DEG = 60; // la carte polaire va de 60° de latitude au pôle (ATLAS § 5.3)
export const MAP_KINDS = Object.freeze(['world', 'south', 'north']);

/** Projection d'une carte de w × h pixels : `toPixel(lat, lon)` → {x, y, ok}, `fromPixel(x, y)` → {latDeg, lonDeg} | null. */
export function makeProjection(kind, w, h, limitDeg = DEFAULT_LIMIT_DEG, view = { zoom: 1, panX: 0, panY: 0 }) {
  const { zoom, panX, panY } = view; // vue : zoom autour du centre du canvas puis décalage en pixels
  if (kind === 'world') {
    const cx0 = w / 2;
    const cy0 = h / 2;
    return {
      kind, w, h, zoom,
      toPixel: (lat, lon) => {
        const b = equirectPixel(lat, lon, w, h);
        const x = (b.x - cx0) * zoom + cx0 + panX;
        const y = (b.y - cy0) * zoom + cy0 + panY;
        return { x, y, ok: x >= -20 && x <= w + 20 && y >= -20 && y <= h + 20 };
      },
      fromPixel: (x, y) => {
        const bx = (x - panX - cx0) / zoom + cx0;
        const by = (y - panY - cy0) / zoom + cy0;
        return bx >= 0 && bx <= w && by >= 0 && by <= h ? equirectLatLon(bx, by, w, h) : null;
      },
    };
  }
  const south = kind === 'south';
  const polar = south ? southPolar : northPolar;
  const inverse = south ? southPolarInverse : northPolarInverse;
  const cx = w / 2 + panX;
  const cy = h / 2 + panY;
  const radiusPx = (Math.min(w, h) / 2 - MARGIN_PX) * zoom;
  const edge = polar(south ? -limitDeg : limitDeg, 0, R_UNIT); // la carte s'étend du pôle jusqu'à la latitude ±limitDeg
  const scale = radiusPx / Math.hypot(edge.x, edge.y);
  return {
    kind, w, h, cx, cy, radiusPx, limitDeg, zoom,
    toPixel(lat, lon) {
      const p = polar(lat, lon, R_UNIT);
      const x = cx + p.x * scale;
      const y = cy - p.y * scale;
      return { x, y, ok: (south ? lat <= -limitDeg : lat >= limitDeg) && Math.hypot(x - cx, y - cy) <= radiusPx + 0.5 };
    },
    fromPixel(x, y) {
      const dx = x - cx;
      const dy = cy - y;
      if (Math.hypot(dx, dy) > radiusPx) return null;
      return inverse(dx / scale, dy / scale, R_UNIT);
    },
  };
}

/** Pixels de la texture équirectangulaire (ImageData), pour l'échantillonnage. */
export function textureData(image) {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth || image.width;
  c.height = image.naturalHeight || image.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/** Couleur bilinéaire de la texture en (lat, lon) ; renvoie [r, g, b]. */
function sample(tex, latDeg, lonDeg) {
  const fx = ((lonDeg + 180) / 360) * tex.width - 0.5;
  const fy = ((90 - latDeg) / 180) * tex.height - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.max(0, Math.min(tex.height - 2, Math.floor(fy)));
  const wx = fx - x0;
  const wy = Math.max(0, Math.min(1, fy - y0));
  const px = (x, y) => ((((y * tex.width) + (((x % tex.width) + tex.width) % tex.width)) * 4));
  const d = tex.data;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c += 1) {
    const a = d[px(x0, y0) + c] * (1 - wx) + d[px(x0 + 1, y0) + c] * wx;
    const b = d[px(x0, y0 + 1) + c] * (1 - wx) + d[px(x0 + 1, y0 + 1) + c] * wx;
    out[c] = a * (1 - wy) + b * wy;
  }
  return out;
}

/** Fond de carte : texture rééchantillonnée dans la projection + vecteur unitaire de chaque pixel (pour l'ombre de nuit). */
export function buildBase(proj, tex, relief = null) {
  const { w, h } = proj;
  const rgb = new Uint8ClampedArray(w * h * 4);
  const normals = new Float32Array(w * h * 3);
  const valid = new Uint8Array(w * h);
  const useRelief = relief !== null && proj.kind === 'south'; // relief LOLA 480 m : pôle Sud seulement
  const gx = useRelief ? new Float32Array(w * h) : null;
  const gy = useRelief ? new Float32Array(w * h) : null;
  const ra = useRelief ? new Uint8Array(w * h) : null;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const ll = proj.fromPixel(x + 0.5, y + 0.5);
      const k = y * w + x;
      if (!ll) continue;
      valid[k] = 1;
      const v = latLonToVector(ll.latDeg, ll.lonDeg);
      normals.set([v.x, v.y, v.z], 3 * k);
      const c = tex ? sample(tex, ll.latDeg, ll.lonDeg) : [96, 96, 96];
      rgb.set([c[0], c[1], c[2], 255], 4 * k);
      if (useRelief) {
        const p = southPolar(ll.latDeg, ll.lonDeg, R_REF_M);
        const a = edgeAlpha(Math.hypot(p.x, p.y)); // fondu : jamais de bord net à la limite de la grille
        if (a > 0) {
          const g = relief.gradientXY ? relief.gradientXY(p.x, p.y) : gradientAt(relief.grid, relief.grads, ll.latDeg, ll.lonDeg); // pyramide de tuiles si fournie
          if (Number.isFinite(g.gx)) { gx[k] = g.gx; gy[k] = g.gy; ra[k] = Math.round(a * 255); }
        }
      }
    }
  }
  return { rgb, normals, valid, w, h, gx, gy, ra };
}

/** Pixels du fond assombris la nuit (Soleil à l'horizon plat au point sub-solaire donné) ; fonction pure, testée. */
export function shadePixels(base, sun) {
  const s = latLonToVector(sun.latDeg, sun.lonDeg);
  const out = new Uint8ClampedArray(base.rgb);
  const n = base.normals;
  for (let k = 0; k < base.valid.length; k += 1) {
    if (!base.valid[k]) continue;
    const sinEl = n[3 * k] * s.x + n[3 * k + 1] * s.y + n[3 * k + 2] * s.z;
    const night = Math.min(1, Math.max(0, 0.5 - sinEl * NIGHT_SOFTNESS * 0.5)); // 0 de jour, 1 de nuit, transition fine au terminateur
    let f = 1 - NIGHT_MAX_ALPHA * night;
    if (base.ra && base.ra[k]) { const a = base.ra[k] / 255; f *= 1 - a + a * reliefFactor(base.gx[k], base.gy[k], sun.lonDeg); } // ombrage par incidence locale (illustratif, sans ombres portées)
    out[4 * k] *= f; out[4 * k + 1] *= f; out[4 * k + 2] *= f;
  }
  return out;
}

/** Image finale (ImageData) pour le canvas. */
export function shade(base, sun) {
  return new ImageData(shadePixels(base, sun), base.w, base.h);
}

/** Polyligne en coupant aux sauts (carte du monde : |Δx| > w/2 ; polaires : points hors du disque). */
function strokePoints(ctx, proj, pts, jumpPx = Infinity) {
  let prev = null;
  ctx.beginPath();
  for (const p of pts) {
    const q = proj.toPixel(p.latDeg, p.lonDeg);
    if (!q.ok) { prev = null; continue; }
    if (prev && Math.abs(q.x - prev.x) < jumpPx && Math.abs(q.y - prev.y) < jumpPx) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
    prev = q;
  }
  ctx.stroke();
}

function graticule(ctx, proj, style, labels) {
  ctx.strokeStyle = style.grid; ctx.fillStyle = style.text; ctx.lineWidth = 1; ctx.font = style.font; ctx.textAlign = 'center';
  const jump = proj.kind === 'world' ? proj.w / 2 : Infinity;
  const step = proj.kind === 'world' ? 30 : 10;
  const sign = proj.kind === 'south' ? -1 : 1;
  const lats = proj.kind === 'world' ? [-60, -30, 0, 30, 60] : Array.from({ length: Math.ceil((90 - proj.limitDeg) / 10) }, (_, k) => sign * (proj.limitDeg + 10 * k));
  for (const lat of lats) {
    strokePoints(ctx, proj, Array.from({ length: 361 }, (_, k) => ({ latDeg: lat, lonDeg: -180 + k })), jump);
    const q = proj.kind === 'world' ? proj.toPixel(lat, -170) : proj.toPixel(lat, proj.kind === 'south' ? 180 : 0);
    if (q.ok) ctx.fillText(`${lat}°`, q.x, q.y - 3);
  }
  for (let lon = -180; lon < 180; lon += step === 10 ? 30 : step) {
    const lat0 = proj.kind === 'world' ? -90 : (proj.kind === 'south' ? -90 : 90);
    const lat1 = proj.kind === 'world' ? 90 : (proj.kind === 'south' ? -proj.limitDeg : proj.limitDeg);
    strokePoints(ctx, proj, Array.from({ length: 91 }, (_, k) => ({ latDeg: lat0 + ((lat1 - lat0) * k) / 90, lonDeg: lon })), jump);
    if (proj.kind !== 'world') {
      const e = proj.toPixel(lat1, lon);
      if (e.ok) ctx.fillText(`${lon}°`, e.x + (e.x - proj.cx) * 0.06, e.y + (e.y - proj.cy) * 0.06 + 4);
    }
  }
  void labels; // réservé aux libellés localisés (boussole) : les étiquettes de longitude suffisent pour l'instant
}

/**
 * Dessine la carte : image ombrée, graticule, terminateur, zone « Terre au-dessus de l'horizon plat », points sub-solaire et sub-terrestre, sites.
 * `state` : { image (ImageData ombrée), sun, earth, sites, layers {terminator, earthZone, graticule, sites} }.
 */
export function drawMap(ctx, proj, state, style, labels) {
  ctx.clearRect(0, 0, proj.w, proj.h);
  ctx.fillStyle = style.bg; ctx.fillRect(0, 0, proj.w, proj.h);
  if (state.backdrop) {
    const { canvas, k, e, f } = state.backdrop; // fond mis à l'échelle : permet de zoomer sans attendre le rééchantillonnage
    ctx.save(); ctx.setTransform(k, 0, 0, k, e, f); ctx.drawImage(canvas, 0, 0); ctx.restore();
  } else if (state.image) ctx.putImageData(state.image, 0, 0);
  if (proj.kind !== 'world') {
    ctx.strokeStyle = style.edge; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(proj.cx, proj.cy, proj.radiusPx, 0, 2 * Math.PI); ctx.stroke();
  }
  if (state.layers.graticule) graticule(ctx, proj, style, labels);
  const jump = proj.kind === 'world' ? proj.w / 2 : Infinity;
  ctx.lineWidth = 2;
  if (state.layers.terminator) { ctx.strokeStyle = style.sun; strokePoints(ctx, proj, [...terminatorCircle(state.sun.latDeg, state.sun.lonDeg, 720), terminatorCircle(state.sun.latDeg, state.sun.lonDeg, 720)[0]], jump); }
  if (state.layers.earthZone) { ctx.strokeStyle = style.earth; strokePoints(ctx, proj, [...terminatorCircle(state.earth.latDeg, state.earth.lonDeg, 720), terminatorCircle(state.earth.latDeg, state.earth.lonDeg, 720)[0]], jump); }
  for (const [pt, color, ring] of [[state.sun, style.sun, false], [state.earth, style.earth, true]]) {
    const q = proj.toPixel(pt.latDeg, pt.lonDeg);
    if (!q.ok) continue;
    ctx.beginPath(); ctx.arc(q.x, q.y, 7, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill();
    if (ring) { ctx.lineWidth = 2; ctx.strokeStyle = style.text; ctx.stroke(); }
  }
  if (state.picked) {
    const q = proj.toPixel(state.picked.latDeg, state.picked.lonDeg);
    if (q.ok) {
      ctx.lineWidth = 2; ctx.strokeStyle = style.text;
      ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, 2 * Math.PI); ctx.moveTo(q.x - 14, q.y); ctx.lineTo(q.x - 5, q.y); ctx.moveTo(q.x + 5, q.y); ctx.lineTo(q.x + 14, q.y);
      ctx.moveTo(q.x, q.y - 14); ctx.lineTo(q.x, q.y - 5); ctx.moveTo(q.x, q.y + 5); ctx.lineTo(q.x, q.y + 14); ctx.stroke();
    }
  }
  if (state.layers.sites) return drawSites(ctx, proj, state.sites, proj.zoom ?? 1, style, { selected: state.selectedId, hovered: state.hoveredId, focused: state.focusedId }, state.overlayOf ?? null);
  return { zones: [] };
}

/** Site le plus proche d'un pixel (rayon de sélection en pixels), pour le clic et l'info-bulle ; priorité au niveau 1. */
export function siteAtPixel(proj, sites, x, y, radiusPx = 14) {
  let best = null;
  let bestD = radiusPx;
  for (const s of sites) {
    const q = proj.toPixel(s.latDeg, s.lonDeg);
    if (!q.ok) continue;
    const d = Math.hypot(q.x - x, q.y - y) - (s.tier === 1 ? 2 : 0);
    if (d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/** Distance au point sub-solaire (degrés) : 90° = terminateur (horizon plat). Utile pour la lecture sous le curseur. */
export function sunDistanceDeg(sun, latDeg, lonDeg) {
  return angularDistanceDeg(sun.latDeg, sun.lonDeg, latDeg, lonDeg);
}
