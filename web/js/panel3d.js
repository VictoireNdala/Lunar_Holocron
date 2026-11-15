// Carte « Vue 3D » de la page : relie la vue three.js (terrain3d.js) à l'état et aux contrôles.
// three.js est chargé à la demande : si WebGL manque, la page reste utilisable et un message l'explique.
import { bodyStateAt } from './data.js';
import { wrapDeg } from './geometry.js';
import { formatNumber, t } from './i18n.js';
import { hypsoStops } from './terrainmesh.js';
import { bodyReading } from './verdicts.js';
import { destination } from './freepoint.js';
import { formatProbe } from './atlas/probetext.js';
import { probeAt } from './atlas/relief.js';
import { ensurePolarRelief } from './atlas/pyramidsource.js';
import { gridZAt } from './terrainring.js';
import { R_REF_M } from './constants.js';

const TURN_STEP_DEG = 30;
const $ = (id) => document.getElementById(id);

/** Crée la carte 3D ; `store` est la source d'état unique. */
export function createPanel3d(store, source = null) {
  let view = null;
  let viewError = null;
  let site = null;
  let terrain = null;
  let mode = 'overview';
  let qualityKey = null;
  let hasRing = false;
  let probePoint = null; // { e, n, u } du dernier point sondé (souris ou clavier)
  const KEY_STEP_M = 500;

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
    if (hasRing) parts.push(t('view3d.ringNote'));
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

  /** Sonde (même texte que la carte) au point local (e, n, u) : lat/lon par le cap et la distance au sol depuis le site. */
  async function probe(point) {
    const out = $('view3d-probe');
    if (!out || !site || !source) return;
    if (!point) { probePoint = null; view?.setProbe(null); out.textContent = t('view3d.probeHint'); return; }
    const relief = await ensurePolarRelief(source);
    if (!relief) return;
    const dist = Math.hypot(point.e, point.n);
    const { lat_deg: lat0, lon_deg: lon0 } = site.location;
    const ll = dist === 0 ? { latDeg: lat0, lonDeg: lon0 } : destination(lat0, lon0, Math.atan2(point.e, point.n), dist / R_REF_M);
    const visible = (body) => bodyReading(site, body, store.get().tMs, store.get().threshold).visible;
    const p = probeAt(relief.grid, relief.grads, ll.latDeg, ll.lonDeg, site, visible);
    if (!p) { out.textContent = t('view3d.probeOutside'); return; }
    probePoint = point;
    view?.setProbe(point);
    const dh = (R_REF_M + point.u) / Math.cos(dist / R_REF_M) - R_REF_M; // écart de hauteur au site (courbure retirée), lu sur le maillage 3D
    out.textContent = `${formatProbe(p, t, formatNumber)} · ${t('view3d.probeDelta', { dh: formatNumber(dh, 0) })}`;
  }

  /** Clavier : les flèches déplacent la sonde de 500 m sur le terrain central (à partir du site) ; Échap l'enlève. */
  function onKey(ev) {
    const step = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowRight: [1, 0], ArrowLeft: [-1, 0] }[ev.key];
    if (ev.key === 'Escape') { probe(null); return; }
    if (!step || !terrain) return;
    ev.preventDefault();
    const half = terrain.meta.grid.size_m / 2;
    const e = Math.max(-half, Math.min(half, (probePoint?.e ?? 0) + step[0] * KEY_STEP_M));
    const n = Math.max(-half, Math.min(half, (probePoint?.n ?? 0) + step[1] * KEY_STEP_M));
    probe({ e, n, u: gridZAt(terrain.meta, terrain.heightsM, e, n) });
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
  $('view3d-study').addEventListener('change', (e) => view?.setStudyLight(e.target.checked));

  return {
    /** Affiche le terrain et l'état des corps d'un site. */
    async show(newSite, newTerrain) {
      site = newSite;
      terrain = newTerrain;
      hasRing = false;
      renderLegend();
      renderControls();
      if (await ensureView()) {
        view.setTerrain(terrain.meta, terrain.heightsM);
        if (!view.element.dataset.probe) {
          view.element.dataset.probe = '1';
          view.element.tabIndex = 0;
          view.element.setAttribute('aria-describedby', 'view3d-probe');
          let last = 0;
          view.element.addEventListener('pointermove', (ev) => { const now = performance.now(); if (now - last < 60 || ev.buttons) return; last = now; const hit = view.pickAt(ev.clientX, ev.clientY); if (hit) probe(hit); });
          view.element.addEventListener('keydown', onKey);
        }
        probe(null);
        view.setExaggeration(Number($('view3d-exag').value));
        view.setStudyLight($('view3d-study').checked);
        pushBodies();
        pushViewMode();
      }
      renderStatus();
    },
    /** Anneau de contexte (voir ringsource.js) pour le site affiché ; ignoré si la vue n'existe pas ou a changé de site. */
    setRing(arrays, forSite) { if (view && site === forSite) { view.setRing(arrays); hasRing = Boolean(arrays); renderStatus(); } },
    /** Réagit aux changements d'état (instant, langue, azimut du regard). */
    update(changed) {
      if (changed.includes('tMs')) pushBodies();
      if (changed.includes('bodyScale')) { view?.setBodyScale(store.get().bodyScale); pushBodies(); }
      if (changed.includes('panoramaCenterAz')) pushViewMode();
      renderLegend();
      renderControls();
      renderStatus();
    },
  };
}
