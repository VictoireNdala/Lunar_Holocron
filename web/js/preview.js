// Page d'aperçu du relief réel (outil de développement, M-014 étape B) : terrain seul, sans horizon ni éphémérides.
// Données : web/data/local/preview.json, produit par `py -m pipeline.tools.crop_real_dem` (dossier ignoré par Git).
import { DataError, loadTerrainFile } from './data.js';
import { formatNumber, getLang, setLang, t } from './i18n.js';
import { hypsoStops } from './terrainmesh.js';

const ROOT = 'data/local/';
const PREVIEW_LIGHT = Object.freeze({ azDeg: 315, elDeg: 20 }); // éclairage illustratif (nord-ouest, rasant), dit à l'écran
const $ = (id) => document.getElementById(id);

let previews = [];
let view = null;
let current = null;
let mode = 'overview';

function applyTexts() {
  document.documentElement.lang = getLang();
  document.title = `${t('preview.title')} · ${t('app.title')}`;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const b of document.querySelectorAll('.lang-btn')) b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
  for (const b of document.querySelectorAll('.mode-btn')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
  $('exag-value').textContent = t('view3d.exaggerationValue', { value: formatNumber(Number($('exag').value), 1) });
  $('light-note').textContent = t('preview.light', { az: PREVIEW_LIGHT.azDeg, el: PREVIEW_LIGHT.elDeg });
  const select = $('preview-select');
  select.replaceChildren(...previews.map((p) => Object.assign(document.createElement('option'), { value: p.id, textContent: p.name[getLang()] ?? p.name.en })));
  if (current) select.value = current.entry.id;
  renderFacts();
}

function renderFacts() {
  if (!current) return;
  const { entry, terrain } = current;
  const pairs = [
    [t('preview.center'), `${formatNumber(entry.lat_deg, 3)}°, ${formatNumber(entry.lon_deg, 3)}°`],
    [t('preview.siteHeight'), formatNumber(entry.site_height_m, 0)],
    [t('preview.product'), `${entry.dem.product} (${formatNumber(entry.dem.resolution_m, 0)} m)`],
    [t('preview.resampling'), entry.dem.resampling],
    [t('preview.citation'), entry.dem.citation],
  ];
  $('facts').replaceChildren(...pairs.flatMap(([k, v]) => [
    Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v })]));
  const stops = hypsoStops().map((s) => `rgb(${s.rgb.join(',')}) ${Math.round(s.t * 100)}%`).join(', ');
  $('legend-bar').style.background = `linear-gradient(to right, ${stops})`;
  $('legend-min').textContent = `${formatNumber(terrain.meta.z.min_m, 0)} m`;
  $('legend-max').textContent = `${formatNumber(terrain.meta.z.max_m, 0)} m`;
}

function showError(err) {
  const key = err instanceof DataError ? `error.${err.code}` : 'error.unexpected';
  $('error-text').textContent = err instanceof DataError && err.code === 'missing' && err.url?.endsWith('preview.json')
    ? t('preview.empty') : t(key, { url: err?.url ?? '', status: err?.status ?? '', details: err?.details?.join?.(' ; ') ?? String(err) });
  $('error').hidden = false;
}

async function show(id) {
  const entry = previews.find((p) => p.id === id);
  const terrain = await loadTerrainFile(ROOT + entry.terrain_file);
  current = { entry, terrain };
  if (!view) {
    const { createTerrainView } = await import('./terrain3d.js');
    view = createTerrainView($('view3d'));
  }
  view.setTerrain(terrain.meta, terrain.heightsM);
  view.setExaggeration(Number($('exag').value));
  view.setBodies(null, null);
  view.setPreviewLight(PREVIEW_LIGHT);
  view.setViewMode(mode, { azDeg: 0, observerHeight: 2 });
  applyTexts();
}

async function start() {
  setLang(new URLSearchParams(window.location.hash.slice(1)).get('lang') === 'en' ? 'en' : 'fr');
  applyTexts();
  for (const b of document.querySelectorAll('.lang-btn')) b.addEventListener('click', () => { setLang(b.dataset.lang); applyTexts(); });
  for (const b of document.querySelectorAll('.mode-btn')) {
    b.addEventListener('click', () => { mode = b.dataset.mode; view?.setViewMode(mode, { azDeg: 0, observerHeight: 2 }); applyTexts(); });
  }
  $('exag').addEventListener('input', () => { view?.setExaggeration(Number($('exag').value)); applyTexts(); });
  $('preview-select').addEventListener('change', (e) => show(e.target.value).catch(showError));
  try {
    const res = await fetch(`${ROOT}preview.json`);
    if (!res.ok) throw new DataError('missing', { url: `${ROOT}preview.json`, status: res.status });
    previews = (await res.json()).previews;
    await show(previews[0].id);
  } catch (err) {
    showError(err);
  }
}

start();
