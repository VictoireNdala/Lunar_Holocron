// Tests de web/js/store.js : état unique, abonnements, notification des seules clés changées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, DEFAULT_STATE } from '../js/store.js';

test('état initial = valeurs par défaut + surcharge', () => {
  const store = createStore({ lang: 'en' });
  assert.equal(store.get().lang, 'en');
  assert.equal(store.get().threshold, DEFAULT_STATE.threshold);
});

test('set notifie avec les clés changées ; rien si aucune valeur ne change', () => {
  const store = createStore();
  const calls = [];
  const unsubscribe = store.subscribe((state, changed) => calls.push([...changed]));
  store.set({ lang: 'sw', threshold: store.get().threshold });
  store.set({ lang: 'sw' });
  assert.deepEqual(calls, [['lang']]);
  unsubscribe();
  store.set({ lang: 'en' });
  assert.equal(calls.length, 1);
});

test('l\'état renvoyé ne peut pas être modifié de l\'extérieur', () => {
  const store = createStore();
  assert.throws(() => { store.get().lang = 'xx'; }, TypeError);
});
