// Tests de web/js/ui/panels.js (fonctions pures) : état des panneaux repliés, « scène seule », lecture sûre du stockage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PANEL_IDS, parseHidden, serializeHidden, togglePanel, toggleSceneOnly, isSceneOnly } from '../js/ui/panels.js';

test('PANEL_IDS : les panneaux de la vue de site (six) et celui de l\'Atlas (couches)', () => {
  assert.deepEqual([...PANEL_IDS], ['verdict', 'view3d', 'bodies', 'site', 'panorama', 'time', 'layers']);
});

test('portée : « scène seule » ne touche que les panneaux de la vue courante', () => {
  const siteScope = ['verdict', 'view3d', 'bodies', 'site', 'panorama', 'time'];
  const only = toggleSceneOnly(['layers'], [], siteScope);
  assert.deepEqual(only.hidden, [...PANEL_IDS]); // les panneaux de l'Atlas gardent leur état (ici : couches déjà réduit)
  assert.equal(isSceneOnly(only.hidden, siteScope), true);
  assert.equal(isSceneOnly(only.hidden, ['layers']), true);
  const back = toggleSceneOnly(only.hidden, only.restore, siteScope);
  assert.deepEqual(back.hidden, ['layers']); // seuls les panneaux de la vue de site sont rouverts
  assert.equal(isSceneOnly([], []), false); // portée vide : jamais « scène seule »
  const atlas = toggleSceneOnly(['panorama'], [], ['time', 'layers']);
  assert.deepEqual(atlas.hidden, ['panorama', 'time', 'layers']);
  assert.deepEqual(atlas.restore, []);
});

test('parseHidden : ne garde que les identifiants connus, sans doublon ; entrées invalides ignorées', () => {
  assert.deepEqual(parseHidden('panorama,time'), ['panorama', 'time']);
  assert.deepEqual(parseHidden('panorama,panorama,inconnu,,time'), ['panorama', 'time']);
  assert.deepEqual(parseHidden(''), []);
  assert.deepEqual(parseHidden(null), []);
  assert.deepEqual(parseHidden(undefined), []);
  assert.deepEqual(parseHidden(42), []);
});

test('serializeHidden / parseHidden : aller-retour dans l\'ordre canonique', () => {
  assert.equal(serializeHidden(['time', 'view3d']), 'view3d,time');
  assert.deepEqual(parseHidden(serializeHidden(['site', 'panorama'])), ['site', 'panorama']);
});

test('togglePanel : replie puis rouvre, sans muter l\'entrée ; identifiant inconnu refusé', () => {
  const start = ['panorama'];
  const a = togglePanel(start, 'time');
  assert.deepEqual(a, ['panorama', 'time']);
  assert.deepEqual(start, ['panorama']);
  assert.deepEqual(togglePanel(a, 'panorama'), ['time']);
  assert.throws(() => togglePanel([], 'nope'), RangeError);
});

test('toggleSceneOnly : cache tout, puis restaure l\'état précédent', () => {
  const before = ['panorama'];
  const only = toggleSceneOnly(before, before);
  assert.equal(isSceneOnly(only.hidden), true);
  assert.deepEqual(only.hidden, [...PANEL_IDS]);
  assert.deepEqual(only.restore, ['panorama']);
  const back = toggleSceneOnly(only.hidden, only.restore);
  assert.deepEqual(back.hidden, ['panorama']);
  assert.equal(isSceneOnly(back.hidden), false);
});

test('toggleSceneOnly : sans état à restaurer, tout se rouvre', () => {
  const back = toggleSceneOnly([...PANEL_IDS], []);
  assert.deepEqual(back.hidden, []);
});

test('isSceneOnly : vrai seulement si tous les panneaux de la portée sont repliés', () => {
  assert.equal(isSceneOnly(['verdict', 'view3d', 'bodies', 'site', 'panorama', 'time']), false); // il manque « layers » (portée = tous)
  assert.equal(isSceneOnly([...PANEL_IDS]), true);
  assert.equal(isSceneOnly([]), false);
});
