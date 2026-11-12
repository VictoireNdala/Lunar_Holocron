// Tests de web/js/i18n.js : mêmes clés en FR et EN, repli, paramètres, format UTC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, t, setLang, getLang, formatUtc, formatNumber } from '../js/i18n.js';

test('le français et l\'anglais ont exactement les mêmes clés', () => {
  assert.deepEqual(Object.keys(MESSAGES.fr).sort(), Object.keys(MESSAGES.en).sort());
});

test('changement de langue et repli sur l\'anglais', () => {
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(t('body.sun'), 'Sun');
  setLang('fr');
  assert.equal(t('body.sun'), 'Soleil');
  setLang('sw'); // swahili prévu : clés absentes → anglais
  assert.equal(t('body.sun'), MESSAGES.sw['body.sun'] ?? 'Sun');
  setLang('xx'); // langue inconnue : ignorée
  assert.notEqual(getLang(), 'xx');
  setLang('fr');
});

test('paramètres et clé inconnue', () => {
  setLang('fr');
  assert.match(t('error.missing', { url: 'data/x.json', status: 404 }), /data\/x\.json/);
  assert.equal(t('cle.inexistante'), 'cle.inexistante');
});

test('formatUtc affiche toujours UTC', () => {
  assert.equal(formatUtc(Date.UTC(2027, 2, 14, 6, 5)), '2027-03-14 06:05 UTC');
});

test('formatNumber suit la langue', () => {
  setLang('fr');
  assert.equal(formatNumber(1.5, 2), '1,50');
  setLang('en');
  assert.equal(formatNumber(1.5, 2), '1.50');
  setLang('fr');
});
