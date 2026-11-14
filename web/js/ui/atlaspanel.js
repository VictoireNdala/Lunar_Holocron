// Vue « Atlas » (A-04) : relie le globe (atlas/globe.js) à l'horloge commune (store.tMs), aux sites de l'index et à global.json.
// Aucun verdict de visibilité ici : horizon plat seulement (D-015). Hors ligne : texture locale ; sans elle, repli gris avec message.
import { createDataSource, DataError, globalSeries } from '../data.js';
import { interpolateSubPoint } from '../atlas/sphere.js';
import { formatNumber, getLang, t } from '../i18n.js';

const TEXTURE_URL = 'assets/moon/lroc_color_2k.jpg';
const $ = (id) => document.getElementById(id);

/** Crée la vue ; `source` est la source de données (index, global) ; `openSite(id)` ouvre la vue de site. */
export function createAtlasPanel(store, source, openSite) {
  let globe = null;
  let globalDoc = null;
  let sites = [];
  let starting = null;
  let failure = null;
  let latLon = null;

  const tip = () => $('globe-tip');

  function renderFacts() {
    const dl = $('atlas-facts');
    const { tMs } = store.get();
    const rows = [];
    if (globalDoc) {
      for (const body of ['sun', 'earth']) {
        const p = interpolateSubPoint({ ...globalSeries(globalDoc, body) }, tMs);
        rows.push([t(`atlas.sub.${body}`), `${formatNumber(p.latDeg, 2)}° ; ${formatNumber(p.lonDeg, 2)}°${p.inRange ? '' : ` (${t('atlas.outOfRange')})`}`]);
      }
    }
    rows.push([t('atlas.cursor'), latLon ? `${formatNumber(latLon.latDeg, 2)}° ; ${formatNumber(latLon.lonDeg, 2)}°` : '—']);
    dl.replaceChildren(...rows.flatMap(([k, v]) => [Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v })]));
    $('atlas-credit').textContent = t('atlas.credit');
  }

  function pushTime() {
    if (!globe || !globalDoc) return;
    const { tMs } = store.get();
    globe.setSubPoints(interpolateSubPoint(globalSeries(globalDoc, 'sun'), tMs), interpolateSubPoint(globalSeries(globalDoc, 'earth'), tMs));
  }

  function renderStatus() {
    const note = $('atlas-texture-note');
    const text = failure ? t(failure) : '';
    note.textContent = text;
    note.hidden = !text;
  }

  function showTip(info) {
    const el = tip();
    latLon = info.latLon;
    if (info.site) {
      el.textContent = `${info.site.name} · ${formatNumber(info.site.latDeg, 3)}° ; ${formatNumber(info.site.lonDeg, 3)}°${info.site.synthetic ? ` · ${t('atlas.fictitious')}` : ''}`;
      el.style.left = `${info.x - el.parentElement.getBoundingClientRect().left + 12}px`;
      el.style.top = `${info.y - el.parentElement.getBoundingClientRect().top + 12}px`;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
    renderFacts();
  }

  async function start() {
    try {
      const { createGlobe } = await import('../atlas/globe.js');
      globe = createGlobe($('globe'), {
        textureUrl: TEXTURE_URL,
        onTextureError: () => { failure = 'atlas.textureMissing'; renderStatus(); },
        onSiteClick: (s) => openSite(s.id),
        onHover: showTip,
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      });
    } catch {
      failure = 'atlas.noWebgl';
      renderStatus();
      return;
    }
    try {
      const index = await source.loadIndex();
      sites = index.sites.map((s) => ({ id: s.id, name: s.name[getLang()] ?? s.name.en, latDeg: s.lat_deg, lonDeg: s.lon_deg, tier: s.tier ?? 99, synthetic: s.synthetic }));
      globe.setSites(sites);
    } catch { /* l'index est déjà signalé par la page */ }
    try {
      globalDoc = await source.loadGlobal();
    } catch (err) {
      failure = err instanceof DataError ? 'atlas.noGlobal' : 'atlas.noGlobal';
    }
    pushTime();
    renderStatus();
    renderFacts();
  }

  for (const [id, layer] of [['layer-terminator', 'terminator'], ['layer-earth', 'earthZone'], ['layer-graticule', 'graticule'], ['layer-sites', 'sites']]) {
    $(id).addEventListener('change', (e) => globe?.setLayers({ [layer]: e.target.checked }));
  }
  $('globe-home').addEventListener('click', () => globe?.home());
  // −84° et non −89,5° : exactement au pôle, la direction « haut » de la caméra est dégénérée (longitude 0° reste en bas de l'écran).
  $('globe-south').addEventListener('click', () => globe?.flyTo(-84, 0, 1.7));

  return {
    /** Démarre le globe au premier affichage (three.js chargé à la demande). */
    show() {
      starting ??= start();
      return starting;
    },
    /** Réagit aux changements d'état (instant, langue). */
    update(changed) {
      if (changed.includes('tMs')) pushTime();
      if (changed.includes('lang') && globe) { globe.setSites(sites.map((s) => s)); }
      renderFacts();
    },
  };
}
