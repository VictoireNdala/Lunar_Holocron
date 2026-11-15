// Pyramide de tuiles partagée (cartes de l'Atlas et contexte de la vue 3D) : une seule instance par source de données, chargée à la demande.
import { computeGradients, gradientAt } from './relief.js';
import { baseFromGrid, createPyramid } from './pyramid.js';
import { southPolarInverse } from './sphere.js';
import { gridHeight } from '../freepoint.js';

const cache = new WeakMap();

/** Grille 480 m décodée avec ses gradients, ou null. */
export function ensurePolarRelief(source) {
  const entry = cache.get(source) ?? {};
  cache.set(source, entry);
  entry.polar ??= source.loadPolarGrid().then((grid) => ({ grid, grads: computeGradients(grid) })).catch(() => null);
  return entry.polar;
}

/** Pyramide de tuiles (repli : grille 480 m) ou null si le manifeste manque. */
export function ensurePyramid(source) {
  const entry = cache.get(source) ?? {};
  cache.set(source, entry);
  entry.pyramid ??= Promise.all([source.loadPolarTiles(), ensurePolarRelief(source)]).then(([manifest, relief]) => createPyramid(manifest,
    (s, tx, ty) => source.loadPolarTile(s, tx, ty), relief ? baseFromGrid(relief.grid, relief.grads, gradientAt, southPolarInverse, gridHeight) : null)).catch(() => null);
  return entry.pyramid;
}
