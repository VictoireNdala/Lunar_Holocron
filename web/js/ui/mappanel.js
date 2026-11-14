// Cartes 2D de l'Atlas (A-05) : monde, pôle Sud, pôle Nord. Canvas 2D (fonctionne sans WebGL). Même horloge, mêmes couches et mêmes sites
// que le globe. La texture est rééchantillonnée dans la projection ; l'ombre de nuit est celle d'un horizon plat (aucun verdict).
import { getLang, formatNumber, t } from '../i18n.js';
import { MAP_KINDS, buildBase, drawMap, makeProjection, shade, siteAtPixel, textureData } from '../atlas/maps2d.js';
import { TEXTURE_URL } from './atlaspanel.js';

const MAX_POLAR_PX = 820; // plafond de taille des cartes polaires (coût du rééchantillonnage)
const MAX_WORLD_W = 1500;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Crée les trois cartes ; `atlas` = API partagée (sites, positions, couches, lecture). */
export function createMapPanel(store, atlas, openSite) {
  const maps = {};
  for (const kind of MAP_KINDS) {
    const scene = document.querySelector(`[data-scene="${kind}"]`);
    maps[kind] = { scene, canvas: scene.querySelector('canvas'), tip: scene.querySelector('.globe-tip'), ctx: scene.querySelector('canvas').getContext('2d'), proj: null, base: null, size: '' };
  }
  let tex = null;
  let texFailed = false;
  let texPromise = null;
  const current = () => document.body.dataset.view;

  function loadTexture() {
    texPromise ??= new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { try { tex = textureData(img); } catch { texFailed = true; } resolve(); };
      img.onerror = () => { texFailed = true; resolve(); };
      img.src = TEXTURE_URL;
    });
    return texPromise;
  }

  function style() {
    return {
      bg: '#06080c', grid: 'rgba(255,255,255,0.28)', text: cssVar('--text'), sun: cssVar('--sun'), earth: cssVar('--earth'), edge: 'rgba(255,255,255,0.5)',
      real: cssVar('--ok'), realSoft: '#9fe8c9', synthetic: cssVar('--warn'), font: '11px "JetBrains Mono", monospace',
    };
  }

  function render(kind) {
    const m = maps[kind];
    const cw = m.canvas.clientWidth;
    const ch = m.canvas.clientHeight;
    if (!cw || !ch) return;
    const k = Math.min(1, (kind === 'world' ? MAX_WORLD_W / cw : MAX_POLAR_PX / Math.min(cw, ch)));
    const w = Math.round(cw * k);
    const h = Math.round(ch * k);
    if (m.size !== `${w}x${h}`) {
      m.canvas.width = w; m.canvas.height = h; m.size = `${w}x${h}`;
      m.proj = makeProjection(kind, w, h);
      m.base = buildBase(m.proj, tex);
    }
    const sp = atlas.subPoints(store.get().tMs);
    const image = sp ? shade(m.base, sp.sun) : new ImageData(m.base.rgb, w, h);
    const layers = atlas.layerState();
    drawMap(m.ctx, m.proj, { image, sun: sp?.sun ?? { latDeg: 0, lonDeg: 0 }, earth: sp?.earth ?? { latDeg: 0, lonDeg: 0 }, sites: sitesNow(), selectedId: store.get().selectedSiteId, layers: sp ? layers : { ...layers, terminator: false, earthZone: false } }, style(), {});
  }

  let sitesCache = [];
  const sitesNow = () => sitesCache.map((s) => ({ ...s, name: s.name[getLang()] ?? s.name.en }));

  async function show(kind) {
    sitesCache = await atlas.ensureSites();
    await Promise.all([loadTexture(), atlas.ensureGlobal()]);
    atlas.setStatus(texFailed ? 'atlas.textureMissing' : null);
    for (const m of Object.values(maps)) { m.size = ''; } // la texture vient d'arriver : refaire le fond
    if (current() === kind) render(kind);
    atlas.renderFacts();
  }

  for (const kind of MAP_KINDS) {
    const m = maps[kind];
    const toCanvas = (e) => {
      const r = m.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * m.canvas.width, y: ((e.clientY - r.top) / r.height) * m.canvas.height, left: e.clientX - r.left, top: e.clientY - r.top };
    };
    m.canvas.addEventListener('pointermove', (e) => {
      if (!m.proj) return;
      const p = toCanvas(e);
      atlas.setCursor(m.proj.fromPixel(p.x, p.y));
      const s = siteAtPixel(m.proj, sitesNow(), p.x, p.y);
      m.canvas.style.cursor = s ? 'pointer' : 'crosshair';
      if (s) {
        m.tip.textContent = `${s.name} · ${formatNumber(s.latDeg, 3)}° ; ${formatNumber(s.lonDeg, 3)}°${s.synthetic ? ` · ${t('atlas.fictitious')}` : ''}`;
        m.tip.style.left = `${p.left + 12}px`; m.tip.style.top = `${p.top + 12}px`; m.tip.hidden = false;
      } else {
        m.tip.hidden = true;
      }
    });
    m.canvas.addEventListener('pointerleave', () => { m.tip.hidden = true; atlas.setCursor(null); });
    m.canvas.addEventListener('click', (e) => {
      if (!m.proj) return;
      const p = toCanvas(e);
      const s = siteAtPixel(m.proj, sitesNow(), p.x, p.y);
      if (s) openSite(s.id);
    });
    new ResizeObserver(() => { if (current() === kind && tex !== undefined) render(kind); }).observe(m.scene);
  }
  for (const id of ['layer-terminator', 'layer-earth', 'layer-graticule', 'layer-sites']) {
    document.getElementById(id).addEventListener('change', () => { if (MAP_KINDS.includes(current())) render(current()); });
  }

  return {
    /** Affiche la carte demandée (chargement paresseux de la texture et des données). */
    show,
    /** Réagit aux changements d'état : instant, langue. */
    update(changed) {
      const view = current();
      if (MAP_KINDS.includes(view) && (changed.includes('tMs') || changed.includes('lang') || changed.includes('view') || changed.includes('selectedSiteId'))) render(view);
    },
  };
}
