// Liste des modules statiques de web/js/main.js (fermeture des `import … from './…'`), pour les <link rel="modulepreload"> de web/index.html.
// Usage : node tests/reference/modulepreload_list.mjs        → imprime les balises
//         node tests/reference/modulepreload_list.mjs --check → vérifie que web/index.html les contient toutes (utilisé par web/tests/modulepreload.test.js)
import { readFileSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web');

export function staticClosure(entry = 'js/main.js') {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(webDir, file), 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"\n]*?from\s+'(\.[^']+)'/gm)) walk(normalize(join(dirname(file), m[1])));
    for (const m of src.matchAll(/^import\s+'(\.[^']+)'/gm)) walk(normalize(join(dirname(file), m[1])));
  };
  walk(normalize(entry));
  return [...seen].map((f) => `./${f.split(sep).join('/')}`).sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = staticClosure();
  if (process.argv.includes('--check')) {
    const html = readFileSync(join(webDir, 'index.html'), 'utf8');
    const missing = files.filter((f) => !html.includes(`<link rel="modulepreload" href="${f}">`));
    console.log(missing.length ? `manquants : ${missing.join(', ')}` : `ok : ${files.length} modules`);
    process.exit(missing.length ? 1 : 0);
  }
  console.log(files.map((f) => `  <link rel="modulepreload" href="${f}">`).join('\n'));
  void relative;
}
