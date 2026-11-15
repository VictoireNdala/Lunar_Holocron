// Tests de atlas/markers.js (V2-03) : glyphes, taille liée au zoom, empreinte, regroupement, étiquettes, clavier, contrastes calculés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKGROUND_HEX, FAMILIES, FOOTPRINT_MIN_PX, clusterItems, contrastRatio, footprintRadiusPx, glyphOf, keyboardOrder, markerSizePx, nearestInDirection, placeLabels, showsFootprint } from '../js/atlas/markers.js';

test('glyphes : une forme et une couleur par famille, mission selon le statut, niveau 1 en tête', () => {
  assert.equal(glyphOf({ kind: 'lola_site', tier: 1 }).shape, 'disc');
  assert.equal(glyphOf({ kind: 'lola_site', tier: 1 }).priority, 0);
  assert.equal(glyphOf({ kind: 'feature', tier: 3 }).shape, 'ring');
  assert.equal(glyphOf({ kind: 'nasa_region' }).shape, 'diamond');
  assert.equal(glyphOf({ kind: 'apollo', tier: 4 }).shape, 'star');
  assert.deepEqual(['landed', 'planned', 'failed'].map((status) => glyphOf({ kind: 'mission', status }).fill), ['solid', 'hollow', 'cross']);
  const shapes = Object.values(FAMILIES).map((f) => f.shape);
  assert.equal(new Set(shapes).size, shapes.length, 'formes distinctes (double codage)');
});

test('contrastes calculés : chaque couleur ≥ 3:1 sur le fond de la carte, et les couleurs diffèrent entre elles', () => {
  for (const [name, f] of Object.entries(FAMILIES)) assert.ok(contrastRatio(f.color, BACKGROUND_HEX) >= 3, `${name} : ${contrastRatio(f.color, BACKGROUND_HEX).toFixed(2)}`);
  assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 1e-9);
  assert.equal(new Set(Object.values(FAMILIES).map((f) => f.color)).size, Object.keys(FAMILIES).length);
});

test('taille à l\'écran : proportionnelle à √zoom, bornée à [5 ; 16] px', () => {
  assert.equal(markerSizePx(1), 5);
  assert.equal(markerSizePx(4), 10);
  assert.equal(markerSizePx(16), 16); // 5·√16 = 20 → plafonné
  assert.equal(markerSizePx(0.1), 5);
  assert.ok(markerSizePx(9) > markerSizePx(4));
});

test('empreinte réelle : dessinée seulement au-delà de 14 px, proportionnelle au zoom', () => {
  assert.equal(footprintRadiusPx(8, 2), 16);
  assert.equal(showsFootprint(FOOTPRINT_MIN_PX), false);
  assert.equal(showsFootprint(FOOTPRINT_MIN_PX + 0.1), true);
  assert.equal(showsFootprint(footprintRadiusPx(8, 0.5)), false); // zoom faible : glyphe
  assert.equal(showsFootprint(footprintRadiusPx(8, 4)), true); // zoom fort : cercle réel
});

test('regroupement : cellules de 28 px, moyenne des positions, membres triés par priorité, isolés conservés', () => {
  const items = [
    { id: 'b', x: 10, y: 10, priority: 2 }, { id: 'a', x: 20, y: 12, priority: 0 }, { id: 'c', x: 200, y: 200, priority: 1 },
    { id: 'd', x: 100, y: 100, priority: 1 }, { id: 'e', x: 105, y: 110, priority: 1 }, { id: 'f', x: 110, y: 90, priority: 3 },
  ];
  const { singles, clusters } = clusterItems(items);
  assert.deepEqual(singles.map((s) => s.id), ['c']);
  const near = clusters.find((c) => c.members.includes('a'));
  assert.deepEqual(near.members, ['a', 'b']);
  assert.deepEqual([near.x, near.y, near.count], [15, 11, 2]);
  assert.equal(clusters.reduce((n, c) => n + c.count, 0) + singles.length, items.length, 'aucun élément perdu');
  assert.equal(clusterItems(items, 1000).clusters[0].count, items.length); // une grande cellule : tout est regroupé
});

test('étiquettes : pas de chevauchement, priorité au niveau 1, rectangles hors cadre écartés', () => {
  const c = [
    { id: 'low', x: 10, y: 10, w: 60, h: 12, priority: 3 }, { id: 'top', x: 40, y: 12, w: 60, h: 12, priority: 0 }, { id: 'far', x: 300, y: 10, w: 60, h: 12, priority: 5 },
    { id: 'out', x: 590, y: 10, w: 60, h: 12, priority: 1 },
  ];
  assert.deepEqual(placeLabels(c, { x: 0, y: 0, w: 600, h: 400 }), ['top', 'far']);
  assert.deepEqual(placeLabels(c), ['top', 'out', 'far']); // sans cadre : « out » est gardé
  assert.deepEqual(placeLabels([]), []);
});

test('clavier : ordre déterministe par priorité ; flèches vers le voisin dans un cône de ±60°', () => {
  const items = [{ id: 'z', x: 0, y: 0, priority: 0 }, { id: 'a', x: 50, y: 5, priority: 1 }, { id: 'm', x: 0, y: 40, priority: 1 }, { id: 'far', x: 300, y: 0, priority: 2 }];
  assert.deepEqual(keyboardOrder(items), ['z', 'a', 'm', 'far']);
  assert.equal(nearestInDirection(items, 'z', 'right'), 'a');
  assert.equal(nearestInDirection(items, 'z', 'down'), 'm');
  assert.equal(nearestInDirection(items, 'z', 'left'), null);
  assert.equal(nearestInDirection(items, 'a', 'right'), 'far');
  assert.equal(nearestInDirection(items, 'inconnu', 'up'), null);
});
