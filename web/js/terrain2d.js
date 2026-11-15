// Carte d'altitude 2D d'un site (M-064 § 2.3) : repli de la vue 3D quand WebGL est absent ou en erreur. Canvas 2D uniquement.
// Même interface que terrain3d.js pour ce qu'utilise panel3d.js : setTerrain, setBodies, setPreviewLight, setProbe, pickAt, element… Rendu ILLUSTRATIF (aucun verdict n'en dépend).
import { hypsoColor } from './terrainmesh.js';
import { gridZAt } from './terrainring.js';
import { reliefFactor, STUDY_SUN_ELEVATION_DEG } from './atlas/relief.js';

const MARGIN_PX = 28;
const DEG = Math.PI / 180;

/** Image (n × n) des couleurs d'altitude ombrées par un Soleil d'étude d'azimut `azDeg` ; fonction pure (testée). Les hauteurs sont relatives au site (courbure incluse). */
export function shadeTerrainImage(meta, heights, azDeg) {
  const { n, spacing_m: sp } = meta.grid;
  const { min_m: zMin, max_m: zMax } = meta.z;
  const span = zMax > zMin ? zMax - zMin : 1;
  const out = new Uint8ClampedArray(n * n * 4);
  const at = (r, c) => heights[Math.min(Math.max(r, 0), n - 1) * n + Math.min(Math.max(c, 0), n - 1)];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const gx = (at(r, c + 1) - at(r, c - 1)) / (2 * sp); // vers l'Est
      const gy = (at(r - 1, c) - at(r + 1, c)) / (2 * sp); // vers le Nord (ligne 0 = nord)
      const f = reliefFactor(gx, gy, azDeg, STUDY_SUN_ELEVATION_DEG);
      const col = hypsoColor((at(r, c) - zMin) / span);
      const k = (r * n + c) * 4;
      out[k] = Math.min(255, col[0] * 255 * f); out[k + 1] = Math.min(255, col[1] * 255 * f); out[k + 2] = Math.min(255, col[2] * 255 * f); out[k + 3] = 255;
    }
  }
  return out;
}

/** Crée la carte dans `container`. */
export function createTerrainMap2D(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'terrain2d';
  canvas.setAttribute('role', 'img');
  canvas.style.cssText = 'display:block;width:100%;height:100%;background:#000;cursor:crosshair';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let meta = null; let heights = null; let image = null; let imageKey = ''; let sunAz = 225; let sunEl = null; let probe = null; let pending = false; let disposed = false;
  let layout = { x0: 0, y0: 0, side: 1 };
  const buffer = document.createElement('canvas');

  function computeLayout() {
    const side = Math.max(10, Math.min(canvas.width, canvas.height) - 2 * MARGIN_PX);
    layout = { x0: (canvas.width - side) / 2, y0: (canvas.height - side) / 2, side };
  }

  function draw() {
    pending = false;
    if (disposed || !ctx) return;
    const w = Math.max(1, container.clientWidth); const h = Math.max(1, container.clientHeight);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.fillStyle = '#05070b'; ctx.fillRect(0, 0, w, h);
    if (!meta) return;
    computeLayout();
    const { n, size_m: size } = meta.grid;
    const key = `${Math.round(sunAz)}`;
    if (key !== imageKey) {
      buffer.width = buffer.height = n;
      buffer.getContext('2d').putImageData(new ImageData(shadeTerrainImage(meta, heights, sunAz), n, n), 0, 0);
      imageKey = key;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffer, layout.x0, layout.y0, layout.side, layout.side);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(layout.x0, layout.y0, layout.side, layout.side);
    const cx = layout.x0 + layout.side / 2; const cy = layout.y0 + layout.side / 2;
    ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#e8eef7'; ctx.font = '12px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText('N', cx, layout.y0 - 8);
    ctx.fillText(`${(size / 2000).toFixed(0)} km`, layout.x0 + layout.side - 22, layout.y0 + layout.side + 18);
    if (sunEl !== null) { // flèche vers le Soleil, au bord de la carte
      const ex = cx + Math.sin(sunAz * DEG) * (layout.side / 2 + 14); const ey = cy - Math.cos(sunAz * DEG) * (layout.side / 2 + 14);
      ctx.fillStyle = sunEl >= 0 ? '#ffd166' : 'rgba(255,209,102,0.35)'; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, 2 * Math.PI); ctx.fill();
    }
    if (probe) {
      const px = layout.x0 + ((probe.e + size / 2) / size) * layout.side; const py = layout.y0 + ((size / 2 - probe.n) / size) * layout.side;
      ctx.strokeStyle = '#ff3df2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 7, 0, 2 * Math.PI); ctx.moveTo(px - 11, py); ctx.lineTo(px + 11, py); ctx.moveTo(px, py - 11); ctx.lineTo(px, py + 11); ctx.stroke();
    }
  }
  const requestRender = () => { if (!pending && !disposed) { pending = true; requestAnimationFrame(draw); } };
  const observer = new ResizeObserver(requestRender);
  observer.observe(container);
  requestRender();

  return {
    kind: '2d',
    setTerrain(m, h) { meta = m; heights = h; imageKey = ''; probe = null; requestRender(); },
    setRing() {},
    setBodies(sun) { if (sun) { sunAz = sun.azDeg; sunEl = sun.elDeg; } requestRender(); },
    setBodyScale() {}, setStudyLight() {}, setViewMode() {}, setExaggeration() {},
    setPreviewLight(light) { if (light) { sunAz = light.azDeg; requestRender(); } },
    measureBody() { return null; },
    /** Point du terrain sous le curseur (pixels client) : { e, n, u } en m, ou null hors de la carte. */
    pickAt(clientX, clientY) {
      if (!meta) return null;
      const r = canvas.getBoundingClientRect();
      const px = ((clientX - r.left) / r.width) * canvas.width; const py = ((clientY - r.top) / r.height) * canvas.height;
      const size = meta.grid.size_m;
      const e = ((px - layout.x0) / layout.side) * size - size / 2; const n = size / 2 - ((py - layout.y0) / layout.side) * size;
      if (Math.abs(e) > size / 2 || Math.abs(n) > size / 2) return null;
      return { e, n, u: gridZAt(meta, heights, e, n) };
    },
    setProbe(point) { probe = point; requestRender(); },
    get element() { return canvas; },
    renderNow() { draw(); },
    info() { return { geometries: 0, textures: 0 }; },
    dispose() { disposed = true; observer.disconnect(); canvas.remove(); },
  };
}
