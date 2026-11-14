// Cartes 2D de l'Atlas (A-05, docs/ATLAS.md §§ 5.2-5.3) : monde (équirectangulaire), pôle Sud et pôle Nord (stéréographiques polaires).
// Canvas 2D, sans three.js : fonctionne même sans WebGL. Les projections viennent de sphere.js (testées contre tests/golden/atlas_sphere.json).
// Aucun verdict de visibilité : ombre de nuit = Soleil à l'horizon PLAT sur une sphère lisse ; la texture est illustrative.
import {
  angularDistanceDeg, equirectLatLon, equirectPixel, latLonToVector, northPolar, northPolarInverse, southPolar, southPolarInverse,
  terminatorCircle,
} from './sphere.js';

const DEG = Math.PI / 180;
const R_UNIT = 1; // rayon de la sphère unité : les stéréographiques sont mises à l'échelle en pixels
const MARGIN_PX = 14;
const NIGHT_MAX_ALPHA = 0.62;
const NIGHT_SOFTNESS = 14; // largeur du crépuscule fictif (plus grand = transition plus nette) ; purement esthétique
const DEFAULT_LIMIT_DEG = 60; // la carte polaire va de 60° de latitude au pôle (ATLAS § 5.3)
export const MAP_KINDS = Object.freeze(['world', 'south', 'north']);

/** Projection d'une carte de w × h pixels : `toPixel(lat, lon)` → {x, y, ok}, `fromPixel(x, y)` → {latDeg, lonDeg} | null. */
export function makeProjection(kind, w, h, limitDeg = DEFAULT_LIMIT_DEG) {
  if (kind === 'world') {
    return {
      kind, w, h,
      toPixel: (lat, lon) => ({ ...equirectPixel(lat, lon, w, h), ok: true }),
      fromPixel: (x, y) => (x >= 0 && x <= w && y >= 0 && y <= h ? equirectLatLon(x, y, w, h) : null),
    };
  }
  const south = kind === 'south';
  const polar = south ? southPolar : northPolar;
  const inverse = south ? southPolarInverse : northPolarInverse;
  const cx = w / 2;
  const cy = h / 2;
  const radiusPx = Math.min(w, h) / 2 - MARGIN_PX;
  const edge = polar(south ? -limitDeg : limitDeg, 0, R_UNIT); // la carte s'étend du pôle jusqu'à la latitude ±limitDeg
  const scale = radiusPx / Math.hypot(edge.x, edge.y);
  return {
    kind, w, h, cx, cy, radiusPx, limitDeg,
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
export function buildBase(proj, tex) {
  const { w, h } = proj;
  const rgb = new Uint8ClampedArray(w * h * 4);
  const normals = new Float32Array(w * h * 3);
  const valid = new Uint8Array(w * h);
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
    }
  }
  return { rgb, normals, valid, w, h };
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
    const f = 1 - NIGHT_MAX_ALPHA * night;
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
  ctx.putImageData(state.image, 0, 0);
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
  if (state.layers.sites) {
    for (const s of state.sites) {
      const q = proj.toPixel(s.latDeg, s.lonDeg);
      if (!q.ok) continue;
      const big = s.tier === 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, big ? 6 : 4, 0, 2 * Math.PI);
      ctx.fillStyle = s.synthetic ? style.synthetic : (big ? style.real : style.realSoft); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = '#06080c'; ctx.stroke();
      if (s.id === state.selectedId) { ctx.beginPath(); ctx.arc(q.x, q.y, 11, 0, 2 * Math.PI); ctx.lineWidth = 2.5; ctx.strokeStyle = style.text; ctx.stroke(); }
    }
  }
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
