// Contexte de la vue 3D : charge les tuiles utiles puis construit l'anneau (terrainring.js) autour d'un site. Hors ligne ; null si rien à montrer.
import { R_REF_M } from './constants.js';
import { ensurePyramid } from './atlas/pyramidsource.js';
import { southPolar } from './atlas/sphere.js';
import { RING_HALF_M, buildRingArrays } from './terrainring.js';

const RING_PX_PER_M = 1 / 240; // niveau 240 m de la pyramide pour l'anneau

/**
 * Anneau de contexte du site, ou null : relief non modélisé (`flat`), pyramide absente ou trop peu de hauteurs.
 * `site` : fichier de site (contrat 1.2) ; `terrain` : { meta, heightsM } du terrain central.
 */
export async function loadRing(source, site, terrain) {
  if (site.terrain_tier === 'flat' || site.terrain_modeled === false) return null; // relief non modélisé : on ne dessine pas de relief autour
  const pyramid = await ensurePyramid(source);
  if (!pyramid) return null;
  const { lat_deg: lat, lon_deg: lon } = site.location;
  const c = southPolar(lat, lon, R_REF_M);
  const margin = RING_HALF_M * 1.1;
  const level = await pyramid.prepare({ xMin: c.x - margin, xMax: c.x + margin, yMin: c.y - margin, yMax: c.y + margin }, RING_PX_PER_M);
  const heightFn = (latDeg, lonDeg) => { const p = southPolar(latDeg, lonDeg, R_REF_M); return pyramid.heightXY(p.x, p.y, level); };
  return buildRingArrays(terrain.meta, terrain.heightsM, lat, lon, heightFn);
}
