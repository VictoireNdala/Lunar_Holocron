// Carte « Panorama 360° » (T-10) : relie le rendu (panorama.js) à l'état (store.js) et aux contrôles.
// L'azimut central du panorama est `panoramaCenterAz`, partagé avec la caméra 3D au sol.
import { bodyStateAt } from '../data.js';
import { wrapDeg } from '../geometry.js';
import { formatNumber, getLang, t } from '../i18n.js';
import { fromScreen, makeView, renderPanorama, verticalExaggeration } from '../panorama.js';
import { horizonAt } from '../visibility.js';

const WINDOW_DEG = 90; // fenêtre par défaut (INTERFACE § 5)
const EL_MIN_DEG = -2;
const EL_MAX_DEFAULT_DEG = 14;
const EL_MAX_LIMITS = Object.freeze([4, 40]); // zoom vertical à la molette
const KEY_STEP_DEG = 5;
const AUTO_MARGIN_DEG = 2;
const CARDINALS = { fr: { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SO', W: 'O', NW: 'NO' }, en: { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' } };
const $ = (id) => document.getElementById(id);

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Haut de la fenêtre verticale adapté au site : max(relief, élévations des corps sur la période) + marge, borné à [4°, 14°].
 * Écart volontaire à la valeur fixe de 14° d'INTERFACE § 5 : près du pôle, tout se joue sur quelques degrés.
 */
function autoElMaxDeg(site) {
  const top = Math.max(...site.horizon.elev_deg, site.kpis.sun_el_deg.max, site.kpis.earth_el_deg.max);
  return Math.min(Math.max(top + AUTO_MARGIN_DEG, EL_MAX_LIMITS[0]), EL_MAX_DEFAULT_DEG);
}

/** Crée la carte ; renvoie `{ show(site), update(changed) }`. */
export function createPanoramaPanel(store) {
  const canvas = $('pano-canvas');
  const ctx = canvas.getContext('2d');
  let site = null;
  let full = false;
  let elMaxDeg = EL_MAX_DEFAULT_DEG;
  let view = null;
  let drag = null;

  function style() {
    return {
      skyTop: '#03050a', skyBottom: '#0b1422', grid: 'rgba(255,255,255,0.22)', terrain: '#3a4252', ridge: cssVar('--text'),
      hatch: 'rgba(255,159,67,0.55)', text: cssVar('--text'), sun: cssVar('--sun'), earth: cssVar('--earth'),
      sunHalo: 'rgba(255,212,121,0.45)', labelFont: '600 12px "Inter Variable", system-ui, sans-serif', tickFont: '11px "JetBrains Mono", monospace',
    };
  }

  function render() {
    if (!site) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    view = makeView({ centerAzDeg: full ? 180 : store.get().panoramaCenterAz, widthDeg: full ? 360 : WINDOW_DEG,
      elMinDeg: EL_MIN_DEG, elMaxDeg: elMaxDeg, widthPx: w, heightPx: h });
    const labels = { sun: t('body.sun'), earth: t('body.earth'), cardinals: CARDINALS[getLang()] ?? CARDINALS.en };
    const drawn = renderPanorama(ctx, view, site, store.get().tMs, style(), labels);
    $('pano-scale').textContent = t('pano.scale', { value: formatNumber(verticalExaggeration(view), 1) });
    $('pano-enlarged').textContent = drawn.enlarged.length ? t('pano.enlarged', { bodies: drawn.enlarged.map((b) => t(`body.${b}`)).join(', ') }) : '';
    $('pano-full').setAttribute('aria-pressed', String(full));
    canvas.setAttribute('aria-label', t('pano.aria', {
      center: formatNumber(view.centerAzDeg, 0),
      sun: formatNumber(bodyStateAt(site, 'sun', store.get().tMs).azDeg, 1),
      earth: formatNumber(bodyStateAt(site, 'earth', store.get().tMs).azDeg, 1),
    }));
  }

  function readout(x, y) {
    if (!view || !site) return;
    const { azDeg } = fromScreen(view, x, y);
    $('pano-readout').textContent = t('pano.readout', { az: formatNumber(azDeg, 1), h: formatNumber(horizonAt(site.horizon.elev_deg, azDeg), 2) });
  }

  const turn = (deg) => store.set({ panoramaCenterAz: wrapDeg(store.get().panoramaCenterAz + deg) });
  const centerOn = (body) => { full = false; store.set({ panoramaCenterAz: Math.round(bodyStateAt(site, body, store.get().tMs).azDeg) }); render(); };

  canvas.addEventListener('pointerdown', (e) => { if (!full) { drag = { x: e.clientX, az: store.get().panoramaCenterAz }; canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    readout(e.clientX - r.left, e.clientY - r.top);
    if (drag && view) store.set({ panoramaCenterAz: wrapDeg(drag.az - (e.clientX - drag.x) / view.pxPerDegX) });
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointerleave', () => { $('pano-readout').textContent = t('pano.readoutIdle'); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    elMaxDeg = Math.min(Math.max(elMaxDeg * (e.deltaY > 0 ? 1.15 : 1 / 1.15), EL_MAX_LIMITS[0]), EL_MAX_LIMITS[1]);
    render();
  }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-KEY_STEP_DEG); } else if (e.key === 'ArrowRight') { e.preventDefault(); turn(KEY_STEP_DEG); }
  });
  $('pano-left').addEventListener('click', () => turn(-WINDOW_DEG / 3));
  $('pano-right').addEventListener('click', () => turn(WINDOW_DEG / 3));
  $('pano-sun').addEventListener('click', () => centerOn('sun'));
  $('pano-earth').addEventListener('click', () => centerOn('earth'));
  $('pano-full').addEventListener('click', () => { full = !full; render(); });
  new ResizeObserver(render).observe(canvas);

  return {
    /** Affiche le panorama d'un site (centré sur le Soleil au premier affichage). */
    show(newSite) {
      const first = !site;
      site = newSite;
      elMaxDeg = autoElMaxDeg(site);
      $('pano-readout').textContent = t('pano.readoutIdle');
      if (first) store.set({ panoramaCenterAz: Math.round(bodyStateAt(site, 'sun', store.get().tMs).azDeg) });
      render();
    },
    /** Réagit aux changements d'état. */
    update(changed) {
      if (changed.includes('lang')) $('pano-readout').textContent = t('pano.readoutIdle');
      render();
    },
  };
}
