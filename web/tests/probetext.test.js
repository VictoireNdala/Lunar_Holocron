// Texte de sonde partagé par la carte du pôle Sud et la vue 3D (M-051 § 2.5) : mêmes mots pour les mêmes valeurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatProbe } from '../js/atlas/probetext.js';

const t = (key, v = {}) => `${key}${Object.keys(v).length ? `(${Object.entries(v).map(([k, x]) => `${k}=${x}`).join(',')})` : ''}`;
const fmt = (x, d) => x.toFixed(d);

test('sonde : relief seul quand aucun site n\'est affiché ; null si hors grille', () => {
  assert.equal(formatProbe(null, t, fmt), null);
  assert.equal(formatProbe({ heightM: 1114.4, slopeDeg: 30.14 }, t, fmt), 'probe.relief(h=1114,s=30.1)');
  assert.equal(formatProbe({ heightM: -5.4 }, t, fmt), 'probe.relief(h=-5,s=0.0)'); // pente absente = 0
});

test('sonde : avec un site, distance, cap, horizon dans cette direction, puis Soleil et Terre visibles', () => {
  const p = { heightM: 1000, slopeDeg: 12, distanceKm: 5.12, azimuthDeg: 140.4, horizonDeg: 21.2, visible: { sun: false, earth: true } };
  assert.equal(formatProbe(p, t, fmt), 'probe.relief(h=1000,s=12.0) · probe.site(d=5.1,az=140,hz=21.2) · probe.bodies(sun=probe.no,earth=probe.yes)');
  assert.equal(formatProbe({ ...p, visible: undefined }, t, fmt), 'probe.relief(h=1000,s=12.0) · probe.site(d=5.1,az=140,hz=21.2)');
});
