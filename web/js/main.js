// Initialisation de la page : chargement des données, état, langue, coque (U-02), vue de site (T-09, T-11).
import { bodyStateAt, createDataSource, DataError, siteTimeRange } from './data.js';
import { formatNumber, formatUtc, getLang, setLang, t } from './i18n.js';
import { createPanel3d } from './panel3d.js';
import { createStore } from './store.js';
import { createPanoramaPanel } from './ui/panoramapanel.js';
import { createShell } from './ui/shell.js';
import { decode, encode } from './urlstate.js';

const HOUR_MS = 3600 * 1000;
// Jeu de données par défaut : l'exemple fait main, jusqu'à ce que le pipeline produise web/data/ (T-08).
const DEFAULT_DATA_ROOT = 'data/sample/';
const DATA_ROOT_PATTERN = /^(?:[a-z0-9_-]+\/)+$/;
const TIME_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
const BODIES = ['sun', 'earth'];

const $ = (id) => document.getElementById(id);

/** Dossier de données : `?data=chemin/relatif/` si valide, sinon l'exemple. */
function dataRoot() {
  const requested = new URLSearchParams(window.location.search).get('data');
  return requested && DATA_ROOT_PATTERN.test(requested) ? requested : DEFAULT_DATA_ROOT;
}

const source = createDataSource(dataRoot());
const store = createStore(decode(window.location.hash));
const panel3d = createPanel3d(store);
const shell = createShell(store);
const panorama = createPanoramaPanel(store);
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

/** Remplit le sélecteur de sites. */
function renderSiteSelect() {
  const select = $('site-select');
  select.replaceChildren(...index.sites.map((entry) => {
    const opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = entry.synthetic ? t('site.option', { name: siteName(entry) }) : siteName(entry);
    return opt;
  }));
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
  const entry = index.sites.find((s) => s.id === site.id);
  const range = siteTimeRange(site);
  const deg = (v) => `${formatNumber(v, 3)}°`;
  $('site-name').textContent = siteName(entry);
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

/** Azimut, élévation et rayon angulaire du Soleil et de la Terre (bodyStateAt). */
function renderBodies() {
  const { tMs } = store.get();
  for (const body of BODIES) {
    const s = bodyStateAt(site, body, tMs);
    const row = document.querySelector(`tr[data-body="${body}"]`);
    row.querySelector('[data-field="az"]').textContent = `${formatNumber(s.azDeg, 3)}°`;
    row.querySelector('[data-field="el"]').textContent = `${formatNumber(s.elDeg, 3)}°`;
    row.querySelector('[data-field="radius"]').textContent = `${formatNumber(s.radiusDeg, 3)}°`;
  }
}

/**
 * Pastille d'honnêteté (UI-DESIGN § 5.5) : toujours visible, jamais masquable ; elle dit si les données sont fictives.
 * Prudence : « démonstration » tant que rien n'est chargé.
 */
function renderHonesty() {
  const synthetic = !index || index.synthetic || Boolean(site?.synthetic);
  $('honesty-chip').classList.toggle('chip-real', !synthetic);
  $('honesty-label').textContent = t(synthetic ? 'honesty.synthetic' : 'honesty.real');
  $('honesty-note').textContent = t(synthetic ? 'honesty.syntheticNote' : 'honesty.realNote');
}

/** Rendu complet du panneau. */
function renderAll() {
  applyStaticTexts();
  renderHonesty();
  const entry = index && site ? index.sites.find((s) => s.id === site.id) : null;
  shell.render(store.get(), entry ? siteName(entry) : null, Boolean(site));
  if (!index) return;
  renderSiteSelect();
  if (!site) return;
  renderSiteInfo();
  renderTime();
  renderBodies();
}

/** Charge le site A puis rafraîchit l'affichage. */
async function loadSiteA() {
  const id = store.get().siteIdA;
  $('loading').hidden = false;
  try {
    const loaded = await source.loadSite(id);
    if (store.get().siteIdA !== id) return; // un autre site a été choisi entre-temps
    site = loaded;
    $('error').hidden = true;
    renderAll();
    panorama.show(site);
    const terrain = await source.loadTerrain(id);
    if (store.get().siteIdA === id) await panel3d.show(site, terrain);
  } catch (err) {
    showError(err);
  } finally {
    $('loading').hidden = true;
  }
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
  window.addEventListener('hashchange', () => store.set(decode(window.location.hash)));
}

/** Réactions aux changements d'état ; le fragment d'URL suit l'état stable. */
store.subscribe((state, changed) => {
  if (changed.includes('lang')) setLang(state.lang);
  window.history.replaceState(null, '', encode(state));
  if (changed.includes('siteIdA')) { loadSiteA(); return; }
  renderAll();
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
  const requested = store.get().siteIdA;
  const siteIdA = index.sites.some((s) => s.id === requested) ? requested : index.sites[0].id;
  if (siteIdA !== requested) store.set({ siteIdA });
  else await loadSiteA();
  window.history.replaceState(null, '', encode(store.get()));
}

start();
