// Garde-fou (M-064 § 2.0) : tout module de web/js doit être syntaxiquement valide. Un seul module cassé chargé à la demande (le globe, par exemple) n'est détecté par
// aucun autre test et se présente à l'écran comme « WebGL indisponible ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function listJs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listJs(p) : (name.endsWith('.js') ? [p] : []);
  });
}

test('tous les modules de web/js passent `node --check`', () => {
  const files = listJs(fileURLToPath(new URL('../js', import.meta.url)));
  assert.ok(files.length > 40);
  const bad = [];
  for (const f of files) {
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { bad.push(`${f}: ${String(e.stderr).split('\n').slice(0, 4).join(' ')}`); }
  }
  assert.deepEqual(bad, []);
});
