// Aucune dépendance réseau (CLAUDE.md, principe 2) : pas d'adresse externe chargée par la page, le CSS ou nos modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WEB_DIR = fileURLToPath(new URL('..', import.meta.url));
const EXTERNAL = [
  /(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i, // <script src="https://…">, <link href="//…">
  /url\(\s*["']?\s*(?:https?:)?\/\//i, // CSS url(https://…)
  /\bfrom\s+["']\s*(?:https?:)?\/\//i, // import … from 'https://…'
  /\bimport\(\s*["']\s*(?:https?:)?\/\//i, // import('https://…')
  /\bfetch\(\s*["'`]\s*(?:https?:)?\/\//i, // fetch('https://…')
  /@import\s+(?:url\()?["']?\s*(?:https?:)?\/\//i, // CSS @import distant
];

function files(dir, ext) {
  return readdirSync(WEB_DIR + dir).filter((f) => f.endsWith(ext)).map((f) => dir + f);
}

test('index.html, CSS et modules JS ne chargent rien d\'externe', () => {
  const targets = ['index.html', 'preview.html', ...files('css/', '.css'), ...files('js/', '.js'), ...files('js/ui/', '.js'), ...files('js/atlas/', '.js')];
  for (const path of targets) {
    const text = readFileSync(WEB_DIR + path, 'utf8');
    for (const re of EXTERNAL) assert.doesNotMatch(text, re, `${path} : ${re}`);
  }
});

test('l\'importmap ne pointe que vers des fichiers locaux de vendor/', () => {
  const html = readFileSync(WEB_DIR + 'index.html', 'utf8');
  const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  assert.ok(match, 'importmap absent');
  const { imports } = JSON.parse(match[1]);
  assert.deepEqual(Object.keys(imports).sort(), ['three', 'three/addons/']);
  for (const target of Object.values(imports)) assert.match(target, /^\.\/vendor\/three\//);
});

test('les seules adresses https:// de web/js/ sont dans links.js (D-019)', () => {
  const targets = [...files('js/', '.js'), ...files('js/ui/', '.js'), ...files('js/atlas/', '.js')];
  for (const path of targets) {
    const text = readFileSync(WEB_DIR + path, 'utf8');
    const external = (text.match(/https?:\/\/(?!localhost)[^\s'"`)]+/g) ?? []);
    if (path === 'js/links.js') assert.ok(external.length >= 2, 'links.js doit porter les deux adresses');
    else assert.deepEqual(external, [], `${path} contient une adresse externe`);
  }
});

test('index.html ne contient aucun lien externe écrit en dur (les liens sont posés par links.js au clic)', () => {
  const html = readFileSync(WEB_DIR + 'index.html', 'utf8');
  assert.doesNotMatch(html, /https?:\/\/(?!localhost)/);
});
