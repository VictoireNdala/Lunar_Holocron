// Vues « Atlas » (A-04, A-05) : globe 3D et cartes 2D partagent les mêmes données (sites de l'index, global.json), la même horloge
// (store.tMs) et le même panneau de couches. Aucun verdict de visibilité ici : horizon plat seulement (D-015).
// Hors ligne : texture locale ; sans elle, repli gris avec message.
import { DataError, globalSeries } from '../data.js';
import { interpolateSubPoint } from '../atlas/sphere.js';
import { formatNumber, getLang, t } from '../i18n.js';

export const TEXTURE_URL = 'assets/moon/lroc_color_2k.jpg';
const $ = (id) => document.getElementById(id);

/** Crée la vue ; `source` = source de données ; `selectSite(id)` ouvre la fiche du site. Renvoie l'API partagée avec les cartes 2D. */
export function createAtlasPanel(store, source, selectSite) {
  let globe = null;
  let globalDoc = null;
  let sites = [];
  let starting = null;
  let globalPromise = null;
  let sitesPromise = null;
  let failure = null;
  let latLon = null;

  const layerState = () => ({ terminator: $('layer-terminator').checked, earthZone: $('layer-earth').checked, graticule: $('layer-graticule').checked, sites: $('layer-sites').checked });

  /** Points sub-solaire et sub-terrestre à l'instant donné, ou null tant que global.json n'est pas chargé. */
  function subPoints(tMs) {
    if (!globalDoc) return null;
    return { sun: interpolateSubPoint(globalSeries(globalDoc, 'sun'), tMs), earth: interpolateSubPoint(globalSeries(globalDoc, 'earth'), tMs) };
  }

  function renderFacts() {
    const { tMs } = store.get();
    const rows = [];
    const sp = subPoints(tMs);
    if (sp) {
      for (const body of ['sun', 'earth']) {
        const p = sp[body];
        rows.push([t(`atlas.sub.${body}`), `${formatNumber(p.latDeg, 2)}° ; ${formatNumber(p.lonDeg, 2)}°${p.inRange ? '' : ` (${t('atlas.outOfRange')})`}`]);
      }
    }
    rows.push([t('atlas.cursor'), latLon ? `${formatNumber(latLon.latDeg, 2)}° ; ${formatNumber(latLon.lonDeg, 2)}°` : '—']);
    $('atlas-facts').replaceChildren(...rows.flatMap(([k, v]) => [Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v })]));
    $('atlas-credit').textContent = t('atlas.credit');
    const view = document.body.dataset.view;
    $('atlas-kind-note').textContent = ['world', 'south', 'north'].includes(view) ? t(`atlas.kindNote.${view}`) : '';
    for (const el of document.querySelectorAll('[data-atlas-only]')) el.hidden = view !== 'atlas';
  }

  function renderStatus() {
    const note = $('atlas-texture-note');
    const text = failure ? t(failure) : '';
    note.textContent = text;
    note.hidden = !text;
  }

  function pushTime() {
    const sp = subPoints(store.get().tMs);
    if (globe && sp) globe.setSubPoints(sp.sun, sp.earth);
  }

  function showTip(info) {
    const el = $('globe-tip');
    latLon = info.latLon;
    if (info.site) {
      el.textContent = `${info.site.name} · ${formatNumber(info.site.latDeg, 3)}° ; ${formatNumber(info.site.lonDeg, 3)}°${info.site.synthetic ? ` · ${t('atlas.fictitious')}` : ''}`;
      const box = el.parentElement.getBoundingClientRect();
      el.style.left = `${info.x - box.left + 12}px`;
      el.style.top = `${info.y - box.top + 12}px`;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
    renderFacts();
  }

  /** Sites de l'index au format de l'Atlas ; mis en cache. */
  function ensureSites() {
    sitesPromise ??= source.loadIndex().then((index) => {
      sites = index.sites.map((s) => ({ id: s.id, name: s.name, latDeg: s.lat_deg, lonDeg: s.lon_deg, tier: s.tier ?? 99, synthetic: s.synthetic }));
      return sites;
    }).catch(() => sites);
    return sitesPromise;
  }

  /** global.json ; mis en cache ; son absence est signalée sans bloquer le reste de l'Atlas. */
  function ensureGlobal() {
    globalPromise ??= source.loadGlobal().then((doc) => { globalDoc = doc; return doc; }).catch((err) => {
      failure = err instanceof DataError ? 'atlas.noGlobal' : 'atlas.noGlobal';
      renderStatus();
      return null;
    });
    return globalPromise;
  }

  async function start() {
    try {
      const { createGlobe } = await import('../atlas/globe.js');
      globe = createGlobe($('globe'), {
        textureUrl: TEXTURE_URL,
        onTextureError: () => { failure = 'atlas.textureMissing'; renderStatus(); },
        onSiteClick: (s) => selectSite(s.id),
        onHover: showTip,
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
      });
    } catch {
      failure = 'atlas.noWebgl';
      renderStatus();
      return;
    }
    globe.setLayers(layerState());
    globe.setSelected(store.get().selectedSiteId);
    globe.setSites((await ensureSites()).map((s) => ({ ...s, name: s.name[getLang()] ?? s.name.en })));
    await ensureGlobal();
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
    show() { starting ??= start(); return starting; },
    ensureSites, ensureGlobal, subPoints, layerState,
    /** Période couverte par global.json ({ startMs, endMs }), ou null tant qu'il n'est pas chargé. */
    timeRange() {
      if (!globalDoc) return null;
      const startMs = Date.parse(globalDoc.time.t0_utc);
      return { startMs, endMs: startMs + (globalDoc.time.n - 1) * globalDoc.time.step_s * 1000 };
    },
    /** Réagit aux changements d'état (instant, langue). */
    update(changed) {
      if (changed.includes('tMs')) pushTime();
      if (changed.includes('selectedSiteId')) globe?.setSelected(store.get().selectedSiteId);
      if (changed.includes('lang') && globe) globe.setSites(sites.map((s) => ({ ...s, name: s.name[getLang()] ?? s.name.en })));
      renderFacts();
    },
    /** Caméra du globe vers un point (sans effet sur les cartes 2D, fixes). */
    flyTo(latDeg, lonDeg) { globe?.flyTo(latDeg, lonDeg, 1.7); },
    /** Lecture lat/lon sous le curseur (cartes 2D). */
    setCursor(ll) { latLon = ll; renderFacts(); },
    setStatus(key) { failure = key; renderStatus(); },
    renderFacts,
  };
}
