// Tests de web/js/ui/panels.js (fonctions pures) : état des panneaux repliés, « scène seule », lecture sûre du stockage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PANEL_IDS, parseHidden, serializeHidden, togglePanel, toggleSceneOnly, isSceneOnly } from '../js/ui/panels.js';

test('PANEL_IDS : les cinq panneaux de la vue de site', () => {
  assert.deepEqual([...PANEL_IDS], ['view3d', 'bodies', 'site', 'panorama', 'time']);
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

test('isSceneOnly : vrai seulement si les cinq panneaux sont repliés', () => {
  assert.equal(isSceneOnly(['view3d', 'bodies', 'site', 'panorama']), false);
  assert.equal(isSceneOnly([...PANEL_IDS]), true);
  assert.equal(isSceneOnly([]), false);
});
