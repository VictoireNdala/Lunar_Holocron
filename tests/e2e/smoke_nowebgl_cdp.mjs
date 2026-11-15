// Test de fumée SANS WebGL (M-064 § 2.4) : simule un navigateur sans WebGL (getContext renvoie null pour webgl, webgl2 et experimental-webgl) et vérifie qu'il n'y a ni exception,
// ni page noire : #view=atlas bascule sur south, bandeau présent, globe grisé, vue Site = carte d'altitude 2D non uniforme, panorama et verdict présents, aucune requête externe.
// Usage : node tests/e2e/smoke_nowebgl_cdp.mjs http://127.0.0.1:8000/ [chemin du navigateur] [capture.png]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://127.0.0.1:8000/';
const browser = process.argv[3] || process.env.BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const shotPath = process.argv[4] || null;
const port = 9477;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ` : ${detail}` : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const proc = spawn(browser, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'lh-nogl-'))}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
let page = null;
for (let i = 0; i < 40 && !page; i += 1) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* démarrage */ } if (!page) await wait(250); }
if (!page) { console.log('ÉCHEC : navigateur injoignable'); proc.kill(); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const errors = []; const foreign = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(`exception : ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(`console.error : ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  if (m.method === 'Network.requestWillBeSent') { const u = m.params.request.url; if (!u.startsWith(new URL(base).origin) && !/^(data|blob|about):/.test(u)) foreign.push(u); }
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/assets\/moon\//.test(m.params.entry.url ?? '')) errors.push(`journal : ${m.params.entry.text}`);
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
await Promise.all([send('Runtime.enable'), send('Log.enable'), send('Network.enable'), send('Page.enable')]);
await send('Network.setCacheDisabled', { cacheDisabled: true });
// navigateur sans WebGL : getContext renvoie null pour les trois noms
await send('Page.addScriptToEvaluateOnNewDocument', { source: '(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; })();' });
const colors = (sel, step, shift) => `(() => { const c = document.querySelector('${sel}'); if (!c) return -1; const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const g = k.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, k.width, k.height).data; const s = new Set(); for (let i = 0; i < d.length; i += 4 * ${step}) s.add((d[i] >> ${shift}) * 1024 + (d[i + 1] >> ${shift}) * 32 + (d[i + 2] >> ${shift})); return s.size; })()`;
try {
  await send('Page.navigate', { url: `${base}?nogl=${Date.now()}#view=atlas&a=site01-connecting-ridge&t=2027-03-14T06:00Z&thr=strict&lang=fr&w=30` });
  await wait(5000);
  const hash = await ev('location.hash');
  check('#view=atlas bascule sur la carte 2D du pôle Sud', /view=south/.test(hash), hash);
  const banner = await ev("(() => { const b = document.getElementById('no3d'); return b && !b.hidden ? b.textContent.replace(/[ \\n\\t]+/g, ' ').trim() : ''; })()");
  check('bandeau persistant « 3D désactivée » avec la façon de l\'activer', /WebGL indisponible/.test(banner) && /accélération/.test(banner), banner.slice(0, 70));
  const globeBtn = await ev("(() => { const b = document.querySelector('.proj-btn[data-proj-view=\"atlas\"]'); return b ? b.disabled + '|' + b.title : 'absent'; })()");
  check('bouton Globe grisé avec info-bulle', /^true\|/.test(globeBtn) && globeBtn.length > 8, globeBtn);
  const mapPixels = await ev(colors('[data-scene="south"] canvas', 211, 4));
  check('carte du pôle Sud non noire (2D)', mapPixels > 15, `${mapPixels} couleurs`);
  await ev("document.querySelector('.rail-item[data-view=\"site\"]').click()");
  await wait(4500);
  const map2d = await ev(colors('canvas.terrain2d', 97, 3));
  check('vue Site : carte d\'altitude 2D non uniforme à la place de la scène 3D', map2d > 20, `${map2d} couleurs`);
  const probe = await ev("(async () => { const c = document.querySelector('canvas.terrain2d'); const r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.55, clientY: r.top + r.height * 0.45, bubbles: true })); await new Promise((q) => setTimeout(q, 600)); return document.getElementById('view3d-probe').textContent; })()");
  check('sonde au survol de la carte 2D (altitude, pente, cap, horizon)', /Altitude/.test(probe) && /horizon/.test(probe), probe.slice(0, 80));
  const hidden3d = await ev('[...document.querySelectorAll("[data-needs-webgl]")].every((e) => e.hidden)');
  check('commandes propres à la 3D masquées', hidden3d === true);
  const content = await ev("document.getElementById('pano-canvas').width > 0 && /%/.test(document.querySelector('[data-panel=\"verdict\"]')?.textContent ?? '') && document.getElementById('tl-canvas').width > 0");
  check('panorama, verdict et frise présents', content === true);
  if (shotPath) writeFileSync(shotPath, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await send('Page.navigate', { url: `${base}?nogl2=${Date.now()}#view=atlas&debug=1&lang=fr` });
  await wait(3500);
  const dbg = await ev("document.getElementById('debug-info').hidden ? '' : document.getElementById('debug-info').textContent");
  check('#debug affiche l\'état de WebGL', /WebGL: indisponible/.test(dbg), dbg);
  check('aucune exception ni console.error', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('aucune requête hors de l\'origine locale', foreign.length === 0, foreign.slice(0, 2).join(' | '));
} catch (err) { check('exécution', false, err.message); }
ws.close(); proc.kill();
console.log(results.every(Boolean) ? `\ntout est vert : ${results.length} contrôles` : `\n${results.filter((x) => !x).length} échec(s)`);
process.exit(results.every(Boolean) ? 0 : 1);
