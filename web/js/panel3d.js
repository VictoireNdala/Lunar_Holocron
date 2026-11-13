// Carte « Vue 3D » de la page : relie la vue three.js (terrain3d.js) à l'état et aux contrôles.
// three.js est chargé à la demande : si WebGL manque, la page reste utilisable et un message l'explique.
import { bodyStateAt } from './data.js';
import { wrapDeg } from './geometry.js';
import { formatNumber, t } from './i18n.js';
import { hypsoStops } from './terrainmesh.js';

const TURN_STEP_DEG = 30;
const $ = (id) => document.getElementById(id);

/** Crée la carte 3D ; `store` est la source d'état unique. */
export function createPanel3d(store) {
  let view = null;
  let viewError = null;
  let site = null;
  let terrain = null;
  let mode = 'overview';
  let qualityKey = null;

  async function ensureView() {
    if (view || viewError) return view;
    try {
      const { createTerrainView } = await import('./terrain3d.js');
      view = createTerrainView($('view3d'), {
        onQualityChange: (px) => { qualityKey = px > 0 ? 'view3d.qualityReduced' : 'view3d.qualityOff'; renderStatus(); },
      });
    } catch (err) {
      viewError = err;
      $('view3d').hidden = true;
      renderStatus();
    }
    return view;
  }

  function renderStatus() {
    const parts = [];
    if (viewError) parts.push(t('view3d.unavailable'));
    if (site && !viewError) {
      const sun = bodyStateAt(site, 'sun', store.get().tMs);
      if (sun.elDeg < 0) parts.push(t('view3d.sunBelow'));
    }
    if (qualityKey) parts.push(t(qualityKey));
    $('view3d-status').textContent = parts.join(' ');
    $('view3d-status').hidden = parts.length === 0;
  }

  function renderLegend() {
    const stops = hypsoStops().map((s) => `rgb(${s.rgb.join(',')}) ${Math.round(s.t * 100)}%`).join(', ');
    $('legend-bar').style.background = `linear-gradient(to right, ${stops})`;
    if (terrain) {
      $('legend-min').textContent = `${formatNumber(terrain.meta.z.min_m, 0)} m`;
      $('legend-max').textContent = `${formatNumber(terrain.meta.z.max_m, 0)} m`;
    }
  }

  function renderControls() {
    for (const btn of document.querySelectorAll('.mode-btn')) btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    $('view3d-turn').hidden = mode !== 'ground';
    $('view3d-az').textContent = t('view3d.lookingAt', { az: formatNumber(store.get().panoramaCenterAz, 0) });
    $('view3d-exag-value').textContent = t('view3d.exaggerationValue', { value: formatNumber(Number($('view3d-exag').value), 1) });
  }

  function pushBodies() {
    if (!view || !site) return;
    const { tMs } = store.get();
    view.setBodies(bodyStateAt(site, 'sun', tMs), bodyStateAt(site, 'earth', tMs));
  }

  function pushViewMode() {
    if (!view || !terrain) return;
    view.setViewMode(mode, { azDeg: store.get().panoramaCenterAz, observerHeight: site.location.observer_height_m });
  }

  for (const btn of document.querySelectorAll('.mode-btn')) {
    btn.addEventListener('click', () => { mode = btn.dataset.mode; pushViewMode(); renderControls(); });
  }
  for (const btn of document.querySelectorAll('[data-turn]')) {
    btn.addEventListener('click', () => store.set({ panoramaCenterAz: wrapDeg(store.get().panoramaCenterAz + Number(btn.dataset.turn) * TURN_STEP_DEG) }));
  }
  $('view3d-exag').addEventListener('input', (e) => { view?.setExaggeration(Number(e.target.value)); renderControls(); });

  return {
    /** Affiche le terrain et l'état des corps d'un site. */
    async show(newSite, newTerrain) {
      site = newSite;
      terrain = newTerrain;
      renderLegend();
      renderControls();
      if (await ensureView()) {
        view.setTerrain(terrain.meta, terrain.heightsM);
        view.setExaggeration(Number($('view3d-exag').value));
        pushBodies();
        pushViewMode();
      }
      renderStatus();
    },
    /** Réagit aux changements d'état (instant, langue, azimut du regard). */
    update(changed) {
      if (changed.includes('tMs')) pushBodies();
      if (changed.includes('panoramaCenterAz')) pushViewMode();
      renderLegend();
      renderControls();
      renderStatus();
    },
  };
}
