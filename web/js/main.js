// Initialisation de la page : chargement des données, état, langue, coque (U-02), vue de site (T-09, T-11).
import { loadRing } from './ringsource.js';
import { createDataSource, DataError, siteTimeRange } from './data.js';
import { buildFreePointSite, parseCoordinates } from './freepoint.js';
import { formatNumber, formatUtc, getLang, setLang, t } from './i18n.js';
import { createPanel3d } from './panel3d.js';
import { createPlayback, snapNow } from './playback.js';
import { createStore } from './store.js';
import { createAtlasPanel } from './ui/atlaspanel.js';
import { createAtlasSites } from './ui/atlassites.js';
import { preloadTier1 } from './preload.js';
import { createMapPanel } from './ui/mappanel.js';
import { createPanoramaPanel } from './ui/panoramapanel.js';
import { createPanels } from './ui/panels.js';
import { createComparePanel } from './ui/comparepanel.js';
import { createFreePointPanel } from './ui/freepointpanel.js';
import { createLinkPanel } from './ui/linkpanel.js';
import { createPlannerPanel } from './ui/plannerpanel.js';
import { createReadings } from './ui/readings.js';
import { renderMethodPage } from './ui/methodpage.js';
import { createSiteLinks } from './ui/sitelinks.js';
import { createTimelinePanel } from './ui/timelinepanel.js';
import { createVerdictPanel } from './ui/verdictpanel.js';
import { createShell } from './ui/shell.js';
import { decode, encode } from './urlstate.js';

const HOUR_MS = 3600 * 1000;
const CUSTOM_ID = /^custom:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/; // point libre (D-027) : jamais dans l'index
// Données par défaut : sorties du pipeline (web/data/, `py -m pipeline.cli build`). `?data=chemin/relatif/` permet de pointer un autre dossier de données.
const DEFAULT_DATA_ROOT = 'data/';
const DATA_ROOT_PATTERN = /^(?:[a-z0-9_-]+\/)+$/;
const TIME_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;

const $ = (id) => document.getElementById(id);
document.documentElement.dataset.booted = '1'; // lu par le filet de sécurité de index.html

/** Dossier de données : `?data=chemin/relatif/` si valide, sinon l'exemple. */
function dataRoot() {
  const requested = new URLSearchParams(window.location.search).get('data');
  return requested && DATA_ROOT_PATTERN.test(requested) ? requested : DEFAULT_DATA_ROOT;
}

const source = createDataSource(dataRoot());
const initialState = decode(window.location.hash);
if (!initialState.view && !initialState.siteIdA) initialState.view = 'atlas'; // ATLAS § 7 : sans site dans l'URL, on s'ouvre sur l'Atlas
const store = createStore(initialState);
const openSite = (id) => store.set({ siteIdA: id, view: 'site', selectedSiteId: null });
const selectSite = (id) => store.set({ selectedSiteId: id });
const atlas = createAtlasPanel(store, source, selectSite);
const maps = createMapPanel(store, atlas, selectSite, () => site);
const atlasSites = createAtlasSites(store, atlas, openSite);
const panel3d = createPanel3d(store, source);
const shell = createShell(store);
const panorama = createPanoramaPanel(store);
const panels = createPanels();
const siteLinks = createSiteLinks();
const readings = createReadings();
const compare = createComparePanel(store);
const freePoint = createFreePointPanel(store);
const linkPanel = createLinkPanel(store);
const planner = createPlannerPanel(store);
let siteB = null;
const timeline = createTimelinePanel(store);
const verdict = createVerdictPanel(store);
/** Période couverte : celle du site affiché (même période pour tous), à défaut celle de global.json. */
const coveredRange = () => (site ? siteTimeRange(site) : atlas.timeRange());
const playback = createPlayback({ store, getRange: coveredRange, clock: () => performance.now(), schedule: (fn) => requestAnimationFrame(fn), cancel: (h) => cancelAnimationFrame(h) });
let index = null;
let site = null;

/** Nom localisé d'un site (repli sur l'anglais). */
function siteName(entry) {
  return entry.name[getLang()] ?? entry.name.en;
}

/** Applique les textes statiques (data-i18n) et la langue du document. */
function applyStaticTexts() {
  document.documentElement.lang = getLang();
  document.title = t('app.title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const btn of document.querySelectorAll('.lang-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.lang === getLang()));
  $('footer-data').textContent = t('footer.data', { root: source.root });
}

/** Affiche une erreur claire (jamais de page blanche). */
function showError(err) {
  const params = err instanceof DataError
    ? { url: err.url ?? '', status: err.status ?? '', details: err.details.join(' ; ') }
    : { details: String(err?.message ?? err) };
  const key = err instanceof DataError ? `error.${err.code}` : 'error.unexpected';
  $('error-text').textContent = t(key, params);
  $('error').hidden = false;
  $('loading').hidden = true;
}

/** Nom d'un site affiché : celui de l'index, sinon celui du fichier (point libre, absent de l'index). */
function displayName(shown) {
  const entry = index?.sites.find((s) => s.id === shown.id);
  return entry ? siteName(entry) : (shown.name[getLang()] ?? shown.name.en);
}

/** Remplit le sélecteur de sites (le point libre affiché y est ajouté en tête). */
function renderSiteSelect() {
  const select = $('site-select');
  const options = index.sites.map((entry) => {
    const opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = entry.synthetic ? t('site.option', { name: siteName(entry) }) : siteName(entry);
    return opt;
  });
  if (site && CUSTOM_ID.test(site.id)) {
    const opt = document.createElement('option');
    opt.value = site.id;
    opt.textContent = displayName(site);
    options.unshift(opt);
  }
  select.replaceChildren(...options);
  select.value = store.get().siteIdA;
}

/** Ajoute des paires terme / valeur à une liste de définitions. */
function fillFacts(dl, pairs) {
  dl.replaceChildren(...pairs.flatMap(([term, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    return [dt, dd];
  }));
}

/** Fiche du site : nom, coordonnées, période, provenance. */
function renderSiteInfo() {
  const range = siteTimeRange(site);
  const deg = (v) => `${formatNumber(v, 3)}°`;
  $('site-name').textContent = displayName(site);
  $('site-synthetic').hidden = !site.synthetic;
  fillFacts($('site-info'), [
    [t('site.lat'), deg(site.location.lat_deg)],
    [t('site.lon'), deg(site.location.lon_deg)],
    [t('site.observer'), `${formatNumber(site.location.observer_height_m, 1)} m`],
    [t('site.period'), t('site.periodValue', { start: formatUtc(range.startMs), end: formatUtc(range.endMs) })],
    [t('site.samples'), formatNumber(range.count, 0)],
    [t('site.step'), t('site.stepValue', { hours: formatNumber(site.time.step_s / 3600, 0) })],
  ]);
  const prov = site.provenance;
  const pairs = [
    [t('prov.dem'), `${prov.dem.product} (${formatNumber(prov.dem.resolution_m, 1)} m)`],
    [t('prov.ephemeris'), prov.ephemeris.engine],
    [t('prov.pipeline'), prov.pipeline_version],
    [t('prov.generated'), prov.generated_utc],
  ];
  if (prov.note) pairs.push([t('prov.note'), prov.note]);
  fillFacts($('site-provenance'), pairs);
  siteLinks.render(site);
}

/** Champ de date, instant affiché, avertissement hors période. */
function renderTime() {
  const { tMs } = store.get();
  const input = $('time-input');
  if (document.activeElement !== input) input.value = new Date(tMs).toISOString().slice(0, 16);
  $('time-current').textContent = t('time.current', { time: formatUtc(tMs) });
  const range = siteTimeRange(site);
  const out = tMs < range.startMs || tMs > range.endMs;
  $('time-warning').hidden = !out;
  if (out) $('time-warning').textContent = t('time.outOfRange', { start: formatUtc(range.startMs), end: formatUtc(range.endMs) });
}

/**
 * Pastille d'honnêteté (UI-DESIGN § 5.5) : toujours visible, jamais masquable ; elle dit si les données sont fictives.
 * Prudence : « démonstration » tant que rien n'est chargé.
 */
function renderHonesty() {
  // Le site affiché décide ; en attendant son chargement, l'index (prudence : « démonstration » si rien n'est chargé).
  const synthetic = site ? Boolean(site.synthetic) : !index || index.synthetic;
  $('honesty-chip').classList.toggle('chip-real', !synthetic);
  const tier = !synthetic && site?.terrain_tier ? site.terrain_tier : null; // contrat 1.2 : 5m | 80m | flat, dit à l'écran
  $('honesty-label').textContent = t(synthetic ? 'honesty.synthetic' : tier ? `honesty.real.${tier}` : 'honesty.real');
  $('honesty-note').textContent = t(synthetic ? 'honesty.syntheticNote' : tier ? `honesty.realNote.${tier}` : 'honesty.realNote');
}

/** Boutons de lecture, de vitesse et sélecteur de projection : reflètent l'état commun. */
function renderPlayback() {
  const { playing, speed, view } = store.get();
  $('play-toggle').setAttribute('aria-pressed', String(playing));
  $('play-toggle').textContent = t(playing ? 'time.pause' : 'time.play');
  for (const btn of document.querySelectorAll('.speed-btn')) btn.setAttribute('aria-pressed', String(Number(btn.dataset.speed) === speed));
  for (const btn of document.querySelectorAll('.proj-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.projView === view));
}

/** Message sous la barre de temps (« maintenant » hors période, fin de lecture) ; vide = masqué. */
function showTimeNote(text) {
  $('time-note').textContent = text ?? '';
  $('time-note').hidden = !text;
}

/** Démarre la vue Atlas demandée (globe ou carte 2D) ; chargement paresseux. */
function showAtlasView() {
  const view = store.get().view;
  if (view === 'atlas') atlas.show();
  else if (['world', 'south', 'north'].includes(view)) maps.show(view);
}

/** Rendu complet du panneau. */
function renderAll() {
  applyStaticTexts();
  renderHonesty();
  shell.render(store.get(), site && index ? displayName(site) : null, Boolean(site));
  panels.refresh();
  renderPlayback();
  showAtlasView();
  if (store.get().view === 'method') renderMethodPage(site);
  if (!index) return;
  renderSiteSelect();
  if (!site) return;
  renderSiteInfo();
  renderTime();
  readings.render(site, store.get());
  verdict.render(site, store.get());
  freePoint.render(site, store.get());
  linkPanel.render(site, store.get());
  planner.render(site);
  for (const body of ['earth', 'sun']) {
    const c = linkPanel.countdown.describe(site, body, store.get().tMs, store.get().threshold, store.get().minAngleDeg);
    $(`count-${body}`).textContent = c.text;
    $(`count-${body}`).title = c.tip;
  }
  compare.render(site, siteB, store.get());
  if (store.get().view === 'site') timeline.render(site, store.get());
}

/** Point libre : Soleil et Terre depuis global.json (parallaxe), horizon depuis la grille polaire 480 m si le point est au sud de 80° S ; tout dans le navigateur. */
async function loadCustom(match) {
  const coords = parseCoordinates(match[1], match[2]);
  if (!coords) throw new Error(t('freepoint.invalid'));
  const globalDoc = await source.loadGlobal();
  let grid = null;
  if (coords.latDeg <= -80) grid = await source.loadPolarGrid().catch(() => null); // sans grille : horizon plat, dit à l'écran
  const built = buildFreePointSite({ globalDoc, grid, ...coords });
  return built;
}

/** Charge le site A puis rafraîchit l'affichage. */
async function loadSiteA() {
  const id = store.get().siteIdA;
  const custom = CUSTOM_ID.exec(id);
  $('loading').hidden = false;
  try {
    const built = custom ? await loadCustom(custom) : null;
    const loaded = built ? built.site : await source.loadSite(id);
    if (store.get().siteIdA !== id) return; // un autre site a été choisi entre-temps
    site = loaded;
    $('error').hidden = true;
    renderAll();
    panorama.show(site);
    $('loading').hidden = true; // le verdict, le panorama et la frise sont affichés : la vue 3D (three.js, maillage) arrive ensuite sans bloquer
    const terrain = built ? built.terrain : await source.loadTerrain(id);
    if (store.get().siteIdA === id) await panel3d.show(site, terrain);
    if (store.get().siteIdA === id) loadRing(source, site, terrain).then((ring) => panel3d.setRing(ring, loaded)).catch(() => {}); // contexte 3D : facultatif, jamais bloquant
  } catch (err) {
    showError(err);
  } finally {
    $('loading').hidden = true;
  }
}

/** Charge le site B demandé (`b=` dans l'URL ou liste), s'il existe dans l'index et diffère de A ; sinon la comparaison est vide. */
async function loadSiteB() {
  const { compare: on, siteIdB, siteIdA } = store.get();
  const known = index?.sites.some((s) => s.id === siteIdB);
  if (on && siteIdB === siteIdA) { store.set({ siteIdB: null, compare: false }); return; } // B égal à A : on referme la comparaison (et l'URL)
  if (!on || !known) { siteB = null; if (site) renderAll(); return; }
  try {
    const loaded = await source.loadSite(siteIdB);
    if (store.get().siteIdB !== siteIdB) return; // un autre site B a été choisi entre-temps
    siteB = loaded;
  } catch (err) {
    siteB = null;
    showError(err);
  }
  if (site) renderAll();
}

/** Lit le champ de date (UTC) ; null si invalide. */
function parseTimeInput(text) {
  const m = TIME_INPUT_PATTERN.exec(text.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(ms).toISOString().slice(0, 16) === `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` ? ms : null;
}

/** Branche les contrôles de la page sur le store. */
function bindControls() {
  $('site-select').addEventListener('change', (e) => store.set({ siteIdA: e.target.value }));
  $('honesty-chip').addEventListener('click', () => {
    const open = $('honesty-chip').getAttribute('aria-expanded') !== 'true';
    $('honesty-chip').setAttribute('aria-expanded', String(open));
    $('honesty-note').hidden = !open;
  });
  for (const btn of document.querySelectorAll('.lang-btn')) btn.addEventListener('click', () => store.set({ lang: btn.dataset.lang }));
  $('time-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const ms = parseTimeInput($('time-input').value);
    if (ms === null) {
      $('time-warning').hidden = false;
      $('time-warning').textContent = t('time.invalid');
      return;
    }
    store.set({ tMs: ms });
    renderTime();
  });
  for (const btn of document.querySelectorAll('[data-step-h]')) {
    btn.addEventListener('click', () => store.set({ tMs: store.get().tMs + Number(btn.dataset.stepH) * HOUR_MS }));
  }
  $('play-toggle').addEventListener('click', () => { showTimeNote(null); playback.toggle(); });
  for (const btn of document.querySelectorAll('.speed-btn')) btn.addEventListener('click', () => playback.setSpeed(Number(btn.dataset.speed)));
  for (const btn of document.querySelectorAll('.proj-btn')) btn.addEventListener('click', () => store.set({ view: btn.dataset.projView }));
  for (const btn of document.querySelectorAll('.bscale-btn')) btn.addEventListener('click', () => store.set({ bodyScale: Number(btn.dataset.scale) }));
  $('time-now').addEventListener('click', () => {
    const range = coveredRange();
    const snap = snapNow(Date.now(), range);
    if (snap.outside) showTimeNote(t('time.nowOutside', { start: formatUtc(range.startMs), end: formatUtc(range.endMs) }));
    else { showTimeNote(null); store.set({ tMs: snap.tMs }); }
  });
  window.addEventListener('hashchange', () => store.set(decode(window.location.hash)));
}

/** Réactions aux changements d'état ; le fragment d'URL suit l'état stable. */
store.subscribe((state, changed) => {
  if (changed.includes('lang')) setLang(state.lang);
  window.history.replaceState(null, '', encode(state));
  if (changed.includes('playing') && !state.playing && coveredRange() && state.tMs >= coveredRange().endMs) showTimeNote(t('time.ended'));
  if (changed.includes('siteIdB') || changed.includes('compare')) loadSiteB();
  if (changed.includes('siteIdA')) {
    loadSiteB(); // B égal à A : la comparaison se vide
    if (changed.includes('view')) renderAll(); // bascule de vue immédiate ; le site se charge ensuite
    atlasSites.render();
    loadSiteA();
    return;
  }
  renderAll();
  atlas.update(changed);
  maps.update(changed);
  atlasSites.render();
  if (site) { panel3d.update(changed); panorama.update(changed); }
});

/** Démarrage : langue, index, site initial. */
async function start() {
  setLang(store.get().lang);
  bindControls();
  applyStaticTexts();
  try {
    index = await source.loadIndex();
  } catch (err) {
    showError(err);
    return;
  }
  showAtlasView();
  atlasSites.setEntries(index.sites);
  compare.setIndex(index.sites);
  const requested = store.get().siteIdA;
  const siteIdA = index.sites.some((s) => s.id === requested) || CUSTOM_ID.test(requested) ? requested : index.sites[0].id;
  if (siteIdA !== requested) store.set({ siteIdA });
  else await loadSiteA();
  await loadSiteB();
  window.history.replaceState(null, '', encode(store.get()));
  // Préchargement discret du terrain et des séries des sites prioritaires, une fois la première vue affichée (S-04).
  setTimeout(() => preloadTier1(source, index.sites), 1500);
}

start();
