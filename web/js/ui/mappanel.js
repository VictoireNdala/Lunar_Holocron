// Cartes 2D de l'Atlas (A-05, V2-03) : monde, pôle Sud, pôle Nord. Canvas 2D (fonctionne sans WebGL). Même horloge, mêmes couches et mêmes sites que le globe.
// Zoom (molette, boutons, touches), panoramique (glisser), marqueurs à taille liée au zoom, regroupement, navigation au clavier. Aucun verdict : horizon plat.
import { getLang, formatNumber, t } from '../i18n.js';
import { MAP_KINDS, buildBase, drawMap, makeProjection, shade, textureData } from '../atlas/maps2d.js';
import { zoneAt } from '../atlas/markerdraw.js';
import { FAMILIES, glyphOf, keyboardOrder, nearestInDirection } from '../atlas/markers.js';
import { TEXTURE_URL } from './atlaspanel.js';

const MAX_POLAR_PX = 820; // plafond de taille des cartes polaires (coût du rééchantillonnage)
const MAX_WORLD_W = 1500;
const ZOOM_MIN = 1;
const ZOOM_MAX = 48;
const REBUILD_DELAY_MS = 160; // après le dernier geste : refaire le fond à la nouvelle échelle
const DRAG_THRESHOLD_PX = 4;
const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Crée les trois cartes ; `atlas` = API partagée (sites, positions, couches, lecture). */
export function createMapPanel(store, atlas, openSite) {
  const maps = {};
  for (const kind of MAP_KINDS) {
    const scene = document.querySelector(`[data-scene="${kind}"]`);
    const canvas = scene.querySelector('canvas');
    canvas.tabIndex = 0;
    const live = document.createElement('p');
    live.className = 'visually-hidden';
    live.setAttribute('aria-live', 'polite');
    scene.append(live);
    maps[kind] = { kind, scene, canvas, live, tip: scene.querySelector('.globe-tip'), ctx: canvas.getContext('2d'), size: '', view: { zoom: 1, panX: 0, panY: 0 },
      base: null, baseView: null, baseId: 0, proj: null, shaded: null, shadeKey: '', zones: [], hoveredId: null, focusedId: null, timer: null };
  }
  let tex = null;
  let texFailed = false;
  let texPromise = null;
  let sitesCache = [];
  let baseCounter = 0;
  const current = () => document.body.dataset.view;
  const sitesNow = () => sitesCache.map((s) => ({ ...s, name: s.name[getLang()] ?? s.name.en }));

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

  /** Dessine la carte ; `rebuild` force le rééchantillonnage du fond à l'échelle courante (sinon le fond existant est mis à l'échelle). */
  function render(kind, rebuild = false) {
    const m = maps[kind];
    const cw = m.canvas.clientWidth;
    const ch = m.canvas.clientHeight;
    if (!cw || !ch) return;
    const k = Math.min(1, (kind === 'world' ? MAX_WORLD_W / cw : MAX_POLAR_PX / Math.min(cw, ch)));
    const w = Math.round(cw * k);
    const h = Math.round(ch * k);
    if (m.size !== `${w}x${h}`) { m.canvas.width = w; m.canvas.height = h; m.size = `${w}x${h}`; m.base = null; }
    if (!m.base || rebuild) {
      m.baseView = { ...m.view };
      m.base = buildBase(makeProjection(kind, w, h, undefined, m.baseView), tex);
      m.baseId = ++baseCounter;
      m.shadeKey = '';
    }
    m.proj = makeProjection(kind, w, h, undefined, m.view);
    const sp = atlas.subPoints(store.get().tMs);
    const key = `${m.baseId}|${store.get().tMs}|${sp ? 1 : 0}`;
    if (m.shadeKey !== key) {
      m.shaded ??= document.createElement('canvas');
      m.shaded.width = w; m.shaded.height = h;
      m.shaded.getContext('2d').putImageData(sp ? shade(m.base, sp.sun) : new ImageData(m.base.rgb, w, h), 0, 0);
      m.shadeKey = key;
    }
    const { zoom: z0, panX: p0x, panY: p0y } = m.baseView;
    const { zoom: z1, panX: p1x, panY: p1y } = m.view;
    const ratio = z1 / z0;
    const backdrop = { canvas: m.shaded, k: ratio, e: w / 2 + p1x - ratio * (w / 2 + p0x), f: h / 2 + p1y - ratio * (h / 2 + p0y) };
    const layers = atlas.layerState();
    const result = drawMap(m.ctx, m.proj, {
      backdrop, sun: sp?.sun ?? { latDeg: 0, lonDeg: 0 }, earth: sp?.earth ?? { latDeg: 0, lonDeg: 0 }, sites: sitesNow(),
      selectedId: store.get().selectedSiteId, hoveredId: m.hoveredId, focusedId: m.focusedId, picked: store.get().pickedPoint,
      layers: sp ? layers : { ...layers, terminator: false, earthZone: false },
    }, style(), {});
    m.zones = result.zones;
    updateZoomLabel(m);
  }

  function updateZoomLabel(m) {
    const label = m.scene.querySelector('.map-zoom-level');
    if (label) label.textContent = `×${formatNumber(m.view.zoom, m.view.zoom < 10 ? 1 : 0)}`;
  }

  /** Limite le panoramique pour ne jamais perdre la carte hors du cadre. */
  function clampPan(m, view) {
    const w = m.canvas.width;
    const h = m.canvas.height;
    const limX = m.kind === 'world' ? (w * view.zoom - w) / 2 : (w / 2) * view.zoom;
    const limY = m.kind === 'world' ? (h * view.zoom - h) / 2 : (h / 2) * view.zoom;
    return { zoom: view.zoom, panX: Math.max(-limX, Math.min(limX, view.panX)), panY: Math.max(-limY, Math.min(limY, view.panY)) };
  }

  /** Change la vue ; le fond est rééchantillonné peu après le dernier geste. */
  function setView(m, view) {
    m.view = clampPan(m, { ...view, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, view.zoom)) });
    render(m.kind);
    clearTimeout(m.timer);
    m.timer = setTimeout(() => render(m.kind, true), REBUILD_DELAY_MS);
  }

  /** Zoom d'un facteur autour d'un pixel (le point sous le curseur reste fixe). */
  function zoomAt(m, factor, x, y) {
    const z1 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, m.view.zoom * factor));
    const k = z1 / m.view.zoom;
    const c = { x: m.canvas.width / 2, y: m.canvas.height / 2 };
    setView(m, { zoom: z1, panX: x - c.x - (x - c.x - m.view.panX) * k, panY: y - c.y - (y - c.y - m.view.panY) * k });
  }

  function zoomOnPoint(m, factor, x, y) { // centre le point (x, y) de l'écran puis zoome
    const z1 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, m.view.zoom * factor));
    const k = z1 / m.view.zoom;
    const c = { x: m.canvas.width / 2, y: m.canvas.height / 2 };
    setView(m, { zoom: z1, panX: -(x - c.x - m.view.panX) * k, panY: -(y - c.y - m.view.panY) * k });
  }

  function priorityOf(zone) {
    const ids = zone.members ?? [zone.id];
    return Math.min(...ids.map((id) => { const s = sitesCache.find((e) => e.id === id); return s ? glyphOf(s).priority : 9; }));
  }

  function describe(zone) {
    if (zone.members) return t('marker.cluster', { n: zone.members.length, names: zone.members.slice(0, 4).map((id) => sitesNow().find((s) => s.id === id)?.name ?? id).join(', ') });
    const s = sitesNow().find((e) => e.id === zone.id);
    const family = t(glyphOf(s).labelKey);
    const tier = s.terrain_tier ? t(`marker.tier.${s.terrain_tier}`) : '';
    return `${s.name} · ${family}${tier ? ` · ${tier}` : ''} · ${formatNumber(s.latDeg, 3)}° ; ${formatNumber(s.lonDeg, 3)}°${s.synthetic ? ` · ${t('atlas.fictitious')}` : ''}`;
  }

  function activate(m, zone) {
    if (zone.members) { zoomOnPoint(m, 3, zone.x, zone.y); return; }
    store.set({ pickedPoint: null });
    openSite(zone.id);
  }

  function focusZone(m, zone) {
    m.focusedId = zone ? zone.id : null;
    m.live.textContent = zone ? describe(zone) : '';
    render(m.kind);
  }

  for (const kind of MAP_KINDS) {
    const m = maps[kind];
    const toCanvas = (e) => {
      const r = m.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * m.canvas.width, y: ((e.clientY - r.top) / r.height) * m.canvas.height, left: e.clientX - r.left, top: e.clientY - r.top };
    };
    let drag = null;
    m.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, panX: m.view.panX, panY: m.view.panY, moved: false, id: e.pointerId };
    });
    m.canvas.addEventListener('pointermove', (e) => {
      if (!m.proj) return;
      if (drag && !drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > DRAG_THRESHOLD_PX) { drag.moved = true; m.canvas.setPointerCapture(drag.id); m.canvas.style.cursor = 'grabbing'; }
      if (drag?.moved) {
        const r = m.canvas.getBoundingClientRect();
        const sx = m.canvas.width / r.width;
        setView(m, { zoom: m.view.zoom, panX: drag.panX + (e.clientX - drag.x) * sx, panY: drag.panY + (e.clientY - drag.y) * sx });
        m.tip.hidden = true;
        return;
      }
      const p = toCanvas(e);
      atlas.setCursor(m.proj.fromPixel(p.x, p.y));
      const zone = zoneAt(m.zones, p.x, p.y);
      const hovered = zone && !zone.members ? zone.id : null;
      m.canvas.style.cursor = zone ? 'pointer' : 'crosshair';
      if (zone) {
        m.tip.textContent = describe(zone);
        m.tip.style.left = `${p.left + 12}px`; m.tip.style.top = `${p.top + 12}px`; m.tip.hidden = false;
      } else {
        m.tip.hidden = true;
      }
      if (hovered !== m.hoveredId) { m.hoveredId = hovered; render(kind); }
    });
    m.canvas.addEventListener('pointerup', () => { if (drag?.moved) m.canvas.style.cursor = 'crosshair'; });
    m.canvas.addEventListener('pointerleave', () => { m.tip.hidden = true; atlas.setCursor(null); if (m.hoveredId) { m.hoveredId = null; render(kind); } });
    m.canvas.addEventListener('click', (e) => {
      if (!m.proj) return;
      if (drag?.moved) { drag = null; return; } // c'était un glissement, pas un clic
      drag = null;
      const p = toCanvas(e);
      const zone = zoneAt(m.zones, p.x, p.y);
      if (zone) { activate(m, zone); return; }
      const ll = m.proj.fromPixel(p.x, p.y);
      if (ll && Math.abs(ll.latDeg) <= 89.99) store.set({ pickedPoint: { latDeg: ll.latDeg, lonDeg: ll.lonDeg }, selectedSiteId: null });
    });
    m.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = toCanvas(e);
      zoomAt(m, Math.exp(-e.deltaY * 0.0016), p.x, p.y);
    }, { passive: false });
    m.canvas.addEventListener('keydown', (e) => {
      const zones = m.zones;
      if (e.key === '+' || e.key === '=') { zoomAt(m, 1.5, m.canvas.width / 2, m.canvas.height / 2); e.preventDefault(); return; }
      if (e.key === '-') { zoomAt(m, 1 / 1.5, m.canvas.width / 2, m.canvas.height / 2); e.preventDefault(); return; }
      if (e.key === '0') { setView(m, { zoom: 1, panX: 0, panY: 0 }); e.preventDefault(); return; }
      if (ARROWS[e.key] && e.shiftKey) { // Maj + flèches : panoramique
        const step = 60;
        setView(m, { zoom: m.view.zoom, panX: m.view.panX + (e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0), panY: m.view.panY + (e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0) });
        e.preventDefault(); return;
      }
      if (!zones.length) return;
      const order = keyboardOrder(zones.map((z) => ({ id: z.id, priority: priorityOf(z) })));
      const at = order.indexOf(m.focusedId);
      if (e.key === 'Tab') {
        const next = e.shiftKey ? at - 1 : at + 1;
        if (next < 0 || next >= order.length) { if (m.focusedId) focusZone(m, null); return; } // sortie naturelle de la carte
        e.preventDefault(); focusZone(m, zones.find((z) => z.id === order[next])); return;
      }
      if (ARROWS[e.key]) {
        e.preventDefault();
        const id = m.focusedId ? nearestInDirection(zones.map((z) => ({ id: z.id, x: z.x, y: z.y })), m.focusedId, ARROWS[e.key]) : order[0];
        if (id) focusZone(m, zones.find((z) => z.id === id));
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && m.focusedId) { e.preventDefault(); activate(m, zones.find((z) => z.id === m.focusedId)); return; }
      if (e.key === 'Escape' && m.focusedId) { focusZone(m, null); }
    });
    for (const btn of m.scene.querySelectorAll('[data-map-zoom]')) {
      btn.addEventListener('click', () => {
        const act = btn.dataset.mapZoom;
        if (act === 'reset') setView(m, { zoom: 1, panX: 0, panY: 0 });
        else zoomAt(m, act === 'in' ? 1.6 : 1 / 1.6, m.canvas.width / 2, m.canvas.height / 2);
      });
    }
    new ResizeObserver(() => { if (current() === kind && tex !== undefined) render(kind); }).observe(m.scene);
  }
  for (const id of ['layer-terminator', 'layer-earth', 'layer-graticule', 'layer-sites']) {
    document.getElementById(id).addEventListener('change', () => { if (MAP_KINDS.includes(current())) render(current()); });
  }

  /** Légende : un symbole par famille (forme + couleur), depuis la définition unique des marqueurs. */
  const SYMBOL = { disc: '●', ring: '○', diamond: '◆', triangle: '▲', star: '✦', square: '■' };
  function buildLegend() {
    const ul = document.getElementById('marker-legend');
    ul.replaceChildren(...Object.entries(FAMILIES).filter(([k]) => k !== 'fictional').map(([, f]) => {
      const li = document.createElement('li');
      const sym = document.createElement('span');
      sym.textContent = SYMBOL[f.shape];
      sym.style.color = f.color;
      sym.setAttribute('aria-hidden', 'true');
      li.append(sym, ` ${t(f.labelKey)}`);
      return li;
    }));
  }

  async function show(kind) {
    buildLegend();
    sitesCache = await atlas.ensureSites();
    await Promise.all([loadTexture(), atlas.ensureGlobal()]);
    atlas.setStatus(texFailed ? 'atlas.textureMissing' : null);
    for (const m of Object.values(maps)) { m.base = null; } // la texture vient d'arriver : refaire le fond
    if (current() === kind) render(kind);
    atlas.renderFacts();
  }

  return {
    /** Affiche la carte demandée (chargement paresseux de la texture et des données). */
    show,
    /** Réagit aux changements d'état : instant, langue, sélection. */
    update(changed) {
      const view = current();
      if (MAP_KINDS.includes(view) && (changed.includes('tMs') || changed.includes('lang') || changed.includes('view') || changed.includes('selectedSiteId') || changed.includes('pickedPoint'))) render(view);
    },
  };
}
