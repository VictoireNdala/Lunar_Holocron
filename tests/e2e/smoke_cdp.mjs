// Test de fumée sans dépendance (T-15, TESTS-VALIDATION § 5) : pilote Edge ou Chrome par le protocole DevTools (CDP), sans Playwright ni npm.
// Usage : (1) servir l'application : py -m pipeline.tools.serve --port 8000 ; (2) node tests/e2e/smoke_cdp.mjs http://127.0.0.1:8000/ [chemin du navigateur]
// Contrôle : première image utile, chaque vue sans erreur ni requête hors de l'origine locale, vue 3D non uniforme, survol du panorama qui change la lecture,
// basculement strict/optimiste qui change un indicateur, pastille d'honnêteté, mémoire JavaScript. Code de sortie 1 au premier échec ; le détail est écrit sur la sortie standard.
// Limite : la vitesse d'image de la vue 3D n'est PAS mesurable ici (rendu logiciel SwiftShader) : à mesurer à la main sur la machine cible.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:8000/';
const browser = process.argv[3] ?? process.env.BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9444;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ` : ${detail}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lh-smoke-'))}`, '--window-size=1440,900',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
let page = null;
for (let i = 0; i < 40 && !page; i += 1) {
  try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* le navigateur démarre */ }
  if (!page) await wait(250);
}
if (!page) { console.log('ÉCHEC : navigateur injoignable'); proc.kill(); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
const errors = []; const foreign = []; const requests = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(`exception : ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(`console.error : ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(`journal : ${m.params.entry.text} ${m.params.entry.url ?? ''}`);
  if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; requests.push(u); if (!u.startsWith(new URL(base).origin) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.startsWith('about:')) foreign.push(u); }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result?.result?.value; };
await Promise.all([send('Runtime.enable'), send('Log.enable'), send('Network.enable'), send('Page.enable')]);
await send('Network.setCacheDisabled', { cacheDisabled: true });

try {
  // 1. première image utile (liste des sites chargée, indicateur de chargement masqué)
  await send('Page.navigate', { url: `${base}?smoke=${Date.now()}#view=site&a=site01-connecting-ridge&t=2027-03-14T06:00Z&thr=strict&lang=fr&w=30` });
  // « première image utile » = liste des sites chargée et indicateur de chargement masqué, comptée depuis la réception du document HTML (un profil de navigateur neuf peut
  // retarder la navigation elle-même de plusieurs secondes : ce délai n'est pas celui de l'application ; les deux valeurs sont publiées).
  const first = await ev(`new Promise((res) => { const tick = () => { const s = document.getElementById('site-select'); const n = performance.getEntriesByType('navigation')[0]; if (s && s.options.length > 0 && document.getElementById('loading').hidden) res({ total: Math.round(performance.now()), sinceHtml: Math.round(performance.now() - n.responseEnd) }); else if (performance.now() > 40000) res({ total: -1, sinceHtml: -1 }); else setTimeout(tick, 25); }; tick(); })`);
  check('première image utile < 2 s après réception du HTML (local, rendu logiciel, cache désactivé)', first.sinceHtml > 0 && first.sinceHtml < 2000, `${first.sinceHtml} ms (navigation complète : ${first.total} ms)`);
  await wait(2500);

  // 2. pastille d'honnêteté
  const pill = await ev(`(document.getElementById('honesty-label')?.textContent ?? '').replace(/\\s+/g, ' ').trim()`);
  check('pastille d\'honnêteté présente (données réelles, niveau de relief dit)', /Real data · 5 m terrain/.test(pill), pill.slice(0, 80));

  // 3. vue 3D non uniforme
  // le canvas WebGL est vide hors de l'image de rendu : on analyse une capture d'écran de la page (région de la vue 3D)
  const shot = (await send('Page.captureScreenshot', { format: 'png' })).result.data;
  const nonUniform = await ev(`(async () => { const img = new Image(); img.src = 'data:image/png;base64,${shot}'; await img.decode(); const k = document.createElement('canvas'); k.width = img.width; k.height = img.height; const g = k.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(Math.round(img.width * 0.35), Math.round(img.height * 0.15), Math.round(img.width * 0.2), Math.round(img.height * 0.5)).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 23) seen.add((d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3)); return seen.size; })()`);
  check('vue 3D : pixels non uniformes', nonUniform > 20, `${nonUniform} couleurs distinctes échantillonnées`);

  // 3 bis. le globe de l'Atlas se crée (un module cassé s'affiche comme « WebGL indisponible » : on vérifie le message, pas seulement le canvas)
  await ev("document.querySelector('.rail-item[data-view=\"atlas\"]').click()");
  await wait(2500);
  const globe = await ev("(() => { const n = document.getElementById('atlas-texture-note'); return { canvas: !!document.querySelector('#globe canvas'), note: n && !n.hidden ? n.textContent : '' }; })()");
  check('globe 3D de l’Atlas créé (canvas présent, aucun message « indisponible » ni « erreur »)', globe.canvas && !/unavailable|error/i.test(globe.note), globe.note.slice(0, 80));
  await ev("document.querySelector('.rail-item[data-view=\"site\"]').click()");
  await wait(1500);
  // 4. survol du panorama
  const hover = await ev(`(async () => { const c = document.getElementById('pano-canvas'); const r = c.getBoundingClientRect(); const out = []; for (const f of [0.2, 0.7]) { c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * f, clientY: r.top + r.height * 0.5, bubbles: true })); await new Promise((q) => setTimeout(q, 150)); out.push(document.getElementById('pano-readout').textContent); } return out; })()`);
  check('panorama : le curseur change la lecture (azimut, hauteur)', hover[0] !== hover[1] && /°/.test(hover[0]), `${hover[0].slice(0, 40)} / ${hover[1].slice(0, 40)}`);

  // 5. strict / optimiste
  const thr = await ev(`(async () => { const read = () => document.querySelector('[data-panel="verdict"]')?.textContent.replace(/\\s+/g, ' ') ?? ''; const before = read(); const b = [...document.querySelectorAll('button')].find((x) => /Optimistic/.test(x.textContent)); b.click(); await new Promise((q) => setTimeout(q, 600)); return { before, after: read() }; })()`);
  check('basculer strict / optimiste change au moins un indicateur', thr.before !== thr.after);

  // 6. chaque vue, sans erreur
  for (const view of ['atlas', 'world', 'south', 'north', 'link', 'method', 'site']) {
    await ev(`document.querySelector('.rail-item[data-view="${view}"]').click()`);
    await wait(view === 'link' ? 1800 : 1200);
    const shown = await ev(`document.querySelectorAll('[data-view-panel]:not([hidden])').length + document.querySelectorAll('[data-scene]:not([hidden]) canvas').length`);
    check(`vue « ${view} » affichée`, shown > 0, `${shown} éléments visibles`);
  }

  // 7. pas d'erreur, pas de requête hors origine, mémoire
  // Les textures de l'Atlas (NASA SVS) ne sont pas versionnées (Q-013) : sur une copie propre leur 404 est attendu et l'application le dit à l'écran ; tout autre message est un échec.
  const textureMissing = errors.filter((e) => /assets\/moon\//.test(e));
  const real = errors.filter((e) => !/assets\/moon\//.test(e));
  if (textureMissing.length) console.log(`note  texture de l'Atlas absente (attendu sur une copie propre, Q-013) : ${textureMissing.length} requête(s) 404`);
  check('aucun console.error ni exception pendant la visite (hors texture de l’Atlas non versionnée)', real.length === 0, real.slice(0, 3).join(' | '));
  check('aucune requête hors de l\'origine locale (aucune dépendance réseau)', foreign.length === 0, foreign.slice(0, 3).join(' | '));
  const heapMb = await ev('Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576)');
  check('mémoire JavaScript < 400 Mo', heapMb > 0 && heapMb < 400, `${heapMb} Mo`);
  console.log(`requêtes : ${requests.length}`);
} catch (err) {
  check('exécution du test', false, err.message);
}
ws.close();
proc.kill();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} échec(s) sur ${results.length}` : `\ntout est vert : ${results.length} contrôles`);
process.exit(failed.length ? 1 : 0);
