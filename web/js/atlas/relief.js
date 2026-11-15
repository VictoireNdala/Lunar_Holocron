// Relief polaire réel pour les cartes de l'Atlas (V2-06, BUILD-V2 § 6) : ombrage par incidence locale sur la grille LOLA 480 m, fondu du bord de la grille,
// sonde au survol (altitude, pente, cap et distance depuis le site, horizon dans cette direction). Fonctions PURES.
// ILLUSTRATIF : l'ombrage n'a PAS d'ombres portées et utilise l'azimut RÉEL du Soleil avec une élévation d'étude fixe (le Soleil polaire rase le sol : à son élévation réelle, tout serait noir).
import { R_REF_M } from '../constants.js';
import { gridHeight } from '../freepoint.js';
import { southPolar } from './sphere.js';
import { horizonAt } from '../visibility.js';

const DEG = Math.PI / 180;
export const STUDY_SUN_ELEVATION_DEG = 15; // élévation d'étude de l'ombrage (écrite dans la légende)
export const GRID_EDGE_M = 300_000; // le fondu commence avant le bord de la grille (≈ 304 km)
export const FADE_WIDTH_M = 25_000; // largeur du dégradé : jamais de bord net
const SHADE_MIN = 0.35;
const SHADE_MAX = 1.6;

/** Gradients de hauteur (m par m) de chaque cellule par différences centrées : { gx (vers x croissant), gy (vers y croissant, donc lignes décroissantes) }. */
export function computeGradients(grid) {
  const { nRows, nCols, spacingM, heights } = grid;
  const gx = new Float32Array(nRows * nCols);
  const gy = new Float32Array(nRows * nCols);
  const at = (r, c) => heights[Math.min(Math.max(r, 0), nRows - 1) * nCols + Math.min(Math.max(c, 0), nCols - 1)];
  for (let r = 0; r < nRows; r += 1) {
    for (let c = 0; c < nCols; c += 1) {
      const k = r * nCols + c;
      const e = at(r, c + 1);
      const w = at(r, c - 1);
      const up = at(r - 1, c); // ligne précédente = y plus grand
      const down = at(r + 1, c);
      gx[k] = Number.isFinite(e) && Number.isFinite(w) ? (e - w) / (2 * spacingM) : NaN;
      gy[k] = Number.isFinite(up) && Number.isFinite(down) ? (up - down) / (2 * spacingM) : NaN;
    }
  }
  return { gx, gy };
}

/** Gradient bilinéaire en (lat, lon) ; NaN hors grille. */
export function gradientAt(grid, grads, latDeg, lonDeg) {
  const { x, y } = southPolar(latDeg, lonDeg, R_REF_M);
  const col = (x - grid.x0) / grid.spacingM;
  const row = (grid.y0 - y) / grid.spacingM;
  const c0 = Math.floor(col);
  const r0 = Math.floor(row);
  if (!(c0 >= 0 && r0 >= 0 && c0 + 1 < grid.nCols && r0 + 1 < grid.nRows)) return { gx: NaN, gy: NaN };
  const wc = col - c0;
  const wr = row - r0;
  const i = r0 * grid.nCols + c0;
  const mix = (a) => (1 - wr) * ((1 - wc) * a[i] + wc * a[i + 1]) + wr * ((1 - wc) * a[i + grid.nCols] + wc * a[i + grid.nCols + 1]);
  return { gx: mix(grads.gx), gy: mix(grads.gy) };
}

/** Opacité du relief selon la distance au pôle (m, dans le plan) : 1 au centre, 0 au bord de la grille, dégradé monotone de largeur FADE_WIDTH_M. */
export function edgeAlpha(rPlaneM) {
  return Math.min(1, Math.max(0, (GRID_EDGE_M - rPlaneM) / FADE_WIDTH_M));
}

/**
 * Facteur d'ombrage (entre 0,35 et 1,6, 1 = surface plane) d'une cellule de gradient (gx, gy) pour un Soleil dont la direction horizontale dans le plan est celle
 * du méridien `sunLonDeg` (plan polaire Sud : x = ρ sin λ, y = ρ cos λ) et d'élévation d'étude fixe. Lambert, normalisé par l'éclairement d'une surface plane.
 */
export function reliefFactor(gx, gy, sunLonDeg, elevationDeg = STUDY_SUN_ELEVATION_DEG) {
  if (!Number.isFinite(gx) || !Number.isFinite(gy)) return 1;
  const el = elevationDeg * DEG;
  const sx = Math.cos(el) * Math.sin(sunLonDeg * DEG);
  const sy = Math.cos(el) * Math.cos(sunLonDeg * DEG);
  const sz = Math.sin(el);
  const norm = Math.sqrt(gx * gx + gy * gy + 1);
  const lambert = (-gx * sx - gy * sy + sz) / norm;
  return Math.min(SHADE_MAX, Math.max(SHADE_MIN, lambert / sz));
}

/** Pente (degrés) d'un gradient. */
export const slopeDeg = (gx, gy) => Math.atan(Math.hypot(gx, gy)) / DEG;

/**
 * Sonde au point (lat, lon) : altitude (m au-dessus de R_REF), pente, et si un site est fourni : distance (km) et cap (°) depuis lui,
 * élévation de l'horizon DANS CETTE DIRECTION (masque du site), état Soleil / Terre au site (marge ≥ 0 selon `isBodyVisible`).
 * `site` : fichier de site chargé ; renvoie null hors de la grille.
 */
export function probeAt(grid, grads, latDeg, lonDeg, site = null, isBodyVisible = null) {
  const heightM = gridHeight(grid, latDeg, lonDeg);
  if (!Number.isFinite(heightM)) return null;
  const g = gradientAt(grid, grads, latDeg, lonDeg);
  const out = { heightM, slopeDeg: Number.isFinite(g.gx) ? slopeDeg(g.gx, g.gy) : null };
  if (site) {
    const { lat_deg: lat0, lon_deg: lon0 } = site.location;
    const p0 = lat0 * DEG;
    const p1 = latDeg * DEG;
    const dLon = (lonDeg - lon0) * DEG;
    const hav = Math.sin((p1 - p0) / 2) ** 2 + Math.cos(p0) * Math.cos(p1) * Math.sin(dLon / 2) ** 2;
    out.distanceKm = (2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav)) * R_REF_M) / 1000;
    out.azimuthDeg = ((Math.atan2(Math.sin(dLon) * Math.cos(p1), Math.cos(p0) * Math.sin(p1) - Math.sin(p0) * Math.cos(p1) * Math.cos(dLon)) / DEG) + 360) % 360;
    out.horizonDeg = horizonAt(site.horizon.elev_deg, out.azimuthDeg);
    if (isBodyVisible) out.visible = { sun: isBodyVisible('sun'), earth: isBodyVisible('earth') };
  }
  return out;
}
