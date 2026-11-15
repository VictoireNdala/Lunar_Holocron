// Les <link rel="modulepreload"> de web/index.html couvrent exactement les modules statiques de main.js (sinon le chargement redevient séquentiel, ou une précharge inutile).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { staticClosure } from '../../tests/reference/modulepreload_list.mjs';

test('index.html précharge tous les modules statiques de main.js, et seulement eux', () => {
  const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
  const declared = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((m) => m[1]).sort();
  assert.deepEqual(declared, staticClosure());
});
