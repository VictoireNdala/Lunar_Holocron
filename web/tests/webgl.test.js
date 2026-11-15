// Détection et création de WebGL (M-064 § 2) : détection mémorisée, absence simulée, repli sans anticrénelage, erreurs réelles non déguisées, libération du contexte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebGLUnavailableError, createRenderer, detectWebGL, releaseRenderer, resetWebGLDetection, webglInfoText } from '../js/webgl.js';
import { shadeTerrainImage } from '../js/terrain2d.js';

const fakeGl = (lose = []) => ({ getExtension: (n) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_VENDOR_WEBGL: 1, UNMASKED_RENDERER_WEBGL: 2 } : { loseContext: () => lose.push('lost') }), getParameter: (k) => ({ 1: 'ACME', 2: 'ACME GPU 9000' }[k]), VENDOR: 3, RENDERER: 4 });

test('détection : WebGL 2, puis WebGL 1, avec diagnostic ; le contexte de test est rendu ; résultat mémorisé', () => {
  resetWebGLDetection();
  const lost = []; let calls = 0;
  const canvas = { getContext: (type) => { calls += 1; return type === 'webgl2' ? fakeGl(lost) : null; } };
  const info = detectWebGL(() => canvas);
  assert.deepEqual([info.available, info.version, info.vendor, info.renderer], [true, 2, 'ACME', 'ACME GPU 9000']);
  assert.deepEqual(lost, ['lost']);
  detectWebGL(() => { throw new Error('ne doit pas être rappelé'); });
  assert.equal(calls, 1);
  assert.match(webglInfoText(info), /WebGL 2 · renderer: ACME GPU 9000 · vendor: ACME/);
  resetWebGLDetection();
  assert.equal(detectWebGL(() => ({ getContext: (t) => (t === 'webgl' ? fakeGl() : null) })).version, 1);
});

test('absence simulée (getContext renvoie null) ou exception : jamais d\'exception, available = false avec la raison', () => {
  resetWebGLDetection();
  const none = detectWebGL(() => ({ getContext: () => null }));
  assert.equal(none.available, false);
  assert.match(none.error, /null/);
  assert.match(webglInfoText(none), /indisponible/);
  resetWebGLDetection();
  const boom = detectWebGL(() => { throw new Error('contexte refusé'); });
  assert.equal(boom.available, false);
  assert.equal(boom.error, 'contexte refusé');
  resetWebGLDetection();
});

test('création : essai avec anticrénelage, repli sans ; WebGL absent → WebGLUnavailableError sans essayer ; autre erreur relancée telle quelle', () => {
  const ok = { available: true };
  const calls = [];
  class Picky { constructor(o) { calls.push(o.antialias); if (o.antialias) throw new Error('antialias refusé'); } }
  const r = createRenderer({ WebGLRenderer: Picky }, {}, () => ok);
  assert.ok(r instanceof Picky);
  assert.deepEqual(calls, [true, false]);
  class Never { constructor() { throw new Error('jamais appelé'); } }
  assert.throws(() => createRenderer({ WebGLRenderer: Never }, {}, () => ({ available: false, error: 'x' })), (e) => e instanceof WebGLUnavailableError && e.code === 'webgl-unavailable');
  class Broken { constructor() { throw new TypeError('erreur de code'); } }
  assert.throws(() => createRenderer({ WebGLRenderer: Broken }, {}, () => ok), (e) => e instanceof TypeError && e.code === undefined, 'une vraie erreur n\'est pas déguisée en « WebGL absent »');
});

test('libération : dispose ET forceContextLoss, élément retiré, tolérant aux erreurs', () => {
  const log = [];
  releaseRenderer({ dispose: () => log.push('dispose'), forceContextLoss: () => log.push('loss'), domElement: { remove: () => log.push('remove') } });
  assert.deepEqual(log, ['dispose', 'loss', 'remove']);
  releaseRenderer({ dispose: () => { throw new Error('x'); }, forceContextLoss: () => { throw new Error('y'); }, domElement: null });
});

test('carte 2D de repli : image ombrée de n × n pixels opaques, ombrage dépendant de l\'azimut du Soleil, plateau uniforme sans relief', () => {
  const n = 9; const meta = { grid: { n, size_m: 800, spacing_m: 100 }, z: { min_m: 0, max_m: 100 } };
  const slope = new Float32Array(n * n); // pente vers l'Est : z = 10 · colonne
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) slope[r * n + c] = 10 * c;
  const east = shadeTerrainImage(meta, slope, 90); const west = shadeTerrainImage(meta, slope, 270);
  assert.equal(east.length, n * n * 4);
  assert.ok([...east].filter((_, i) => i % 4 === 3).every((a) => a === 255));
  const k = (4 * n + 4) * 4;
  assert.notEqual(east[k], west[k], 'un versant face au Soleil et un versant à l\'ombre diffèrent');
  const flat = shadeTerrainImage(meta, new Float32Array(n * n), 90); const flat2 = shadeTerrainImage(meta, new Float32Array(n * n), 200);
  assert.deepEqual([...flat], [...flat2]);
});
