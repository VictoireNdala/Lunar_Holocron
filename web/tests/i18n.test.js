// Tests de web/js/i18n.js : interface en anglais seulement, repli, paramètres, format UTC, formats de nombres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, t, setLang, getLang, formatUtc, formatNumber } from '../js/i18n.js';

test('l\'interface est en anglais seulement : plus de dictionnaire français', () => {
  assert.deepEqual(Object.keys(MESSAGES).sort(), ['en', 'sw']);
  assert.equal(getLang(), 'en');
  assert.equal(t('body.sun'), 'Sun');
});

test('langue inconnue ou retirée ignorée, swahili prévu : clés absentes → anglais', () => {
  setLang('fr'); // retirée : ignorée
  assert.equal(getLang(), 'en');
  setLang('xx');
  assert.equal(getLang(), 'en');
  setLang('sw');
  assert.equal(t('body.sun'), 'Sun');
  setLang('en');
});

test('aucun texte français dans le dictionnaire (caractères accentués et mots courants)', () => {
  const suspects = Object.entries(MESSAGES.en).filter(([, v]) => /[àâçéèêëîïôùûœ]/i.test(v) && !/^[^a-z]*$/i.test(v));
  // les seuls caractères accentués admis : noms propres et symboles (ex. « Gläser », « Idel'son » sans accent) ; la liste doit rester vide
  assert.deepEqual(suspects.map(([k]) => k), []);
});

test('paramètres et clé inconnue', () => {
  assert.match(t('error.missing', { url: 'data/x.json', status: 404 }), /data\/x\.json/);
  assert.equal(t('cle.inexistante'), 'cle.inexistante');
});

test('formatUtc affiche toujours UTC ; formatNumber en anglais (point décimal)', () => {
  assert.equal(formatUtc(Date.UTC(2027, 2, 14, 6, 5)), '2027-03-14 06:05 UTC');
  assert.equal(formatNumber(1.5, 2), '1.50');
  assert.equal(formatNumber(1234.5, 1), '1,234.5');
});
