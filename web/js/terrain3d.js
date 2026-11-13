// Vue 3D du terrain (INTERFACE § 6). Rendu ILLUSTRATIF : les ombres ne servent jamais aux verdicts,
// qui viennent du masque d'horizon (CLAUDE.md, principe 3). Aucune ressource externe : sprites dessinés par Canvas.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { bodyDirection, buildTerrainArrays, gridCenterHeight } from './terrainmesh.js';

const OVERVIEW_DISTANCE_FACTOR = 1.2; // distance initiale = 1,2 × côté de la grille
const OVERVIEW_ELEVATION_DEG = 35; // angle de vue initial au-dessus de l'horizontale
const OVERVIEW_AZIMUTH_DEG = 180; // caméra placée au sud, regard vers le nord
const GROUND_FOV_DEG = 60;
const OVERVIEW_FOV_DEG = 45;
// Soleil et Terre placés juste au-delà du bord de la grille (demi-diagonale ≈ 0,71 × côté), dans leur direction vue du site :
// la direction est exacte pour la caméra au sol ; en vue d'ensemble, ils apparaissent au-dessus du bord de terrain correspondant.
const SKY_DISTANCE_FACTOR = 0.9;
const MIN_SPRITE_RADIUS_DEG = 2.0; // rayon apparent minimal des sprites (agrandis, signalé dans l'interface)
const BELOW_HORIZON_OPACITY = 0.35; // corps sous l'horizon géométrique : sprite atténué
const SUN_INTENSITY = 2.5;
// Pas d'atmosphère : le vrai ciel lunaire n'éclaire presque pas. Ambiance relevée pour garder la teinte lisible (rendu illustratif).
const AMBIENT_LIT = 0.35;
const AMBIENT_DARK = 0.12; // Soleil sous l'horizon : sombre
const SHADOW_SIZES = Object.freeze([2048, 1024, 0]); // 0 = ombres désactivées (qualité adaptative)
const SLOW_FRAME_MS = 25;
const FRAMES_PER_CHECK = 30;

/** Disque dessiné sur un canvas, pour un sprite (aucune image distante). */
function discTexture(fill, ring) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const r = size / 2;
  if (!ring) {
    const glow = ctx.createRadialGradient(r, r, r * 0.4, r, r, r);
    glow.addColorStop(0, fill);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.beginPath();
  ctx.arc(r, r, r * (ring ? 0.85 : 0.5), 0, 2 * Math.PI);
  ctx.fillStyle = fill;
  ctx.fill();
  if (ring) { ctx.lineWidth = size * 0.08; ctx.strokeStyle = ring; ctx.stroke(); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Crée la vue dans `container`. Renvoie l'API documentée dans INTERFACE § 2. */
export function createTerrainView(container, { onQualityChange = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(OVERVIEW_FOV_DEG, 1, 1, 1e6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;

  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT_DARK);
  const sunLight = new THREE.DirectionalLight(0xffffff, 0);
  sunLight.castShadow = true;
  scene.add(ambient, sunLight, sunLight.target);

  const textures = [discTexture('#f5a623', null), discTexture('#3b82f6', '#ffffff')];
  const sprites = textures.map((map) => new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false })));
  sprites.forEach((s) => scene.add(s));

  const marker = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), new THREE.MeshBasicMaterial({ color: 0x00e5ff }));
  scene.add(marker);

  let mesh = null;
  let meta = null;
  let heights = null;
  let exaggeration = 1;
  let mode = 'overview';
  let groundAzDeg = 0;
  let observerHeightM = 2;
  let bodies = { sun: null, earth: null };
  let qualityLevel = 0;
  let frameTimes = [];
  let pending = false;
  let disposed = false;

  const size = () => (meta ? meta.grid.size_m : 1);

  function applyShadowQuality() {
    const px = SHADOW_SIZES[qualityLevel];
    sunLight.castShadow = px > 0;
    if (px > 0) {
      sunLight.shadow.mapSize.set(px, px);
      sunLight.shadow.map?.dispose();
      sunLight.shadow.map = null;
    }
  }

  function render() {
    pending = false;
    if (disposed) return;
    const t0 = performance.now();
    renderer.render(scene, camera);
    frameTimes.push(performance.now() - t0);
    if (frameTimes.length >= FRAMES_PER_CHECK) {
      const mean = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      frameTimes = [];
      if (mean > SLOW_FRAME_MS && qualityLevel < SHADOW_SIZES.length - 1) {
        qualityLevel += 1;
        applyShadowQuality();
        onQualityChange(SHADOW_SIZES[qualityLevel]);
      }
    }
  }

  function requestRender() {
    if (!pending && !disposed) { pending = true; requestAnimationFrame(render); }
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    requestRender();
  }

  function rebuildMesh() {
    if (!meta) return;
    const arrays = buildTerrainArrays(meta, heights, exaggeration);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(arrays.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(arrays.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(arrays.indices, 1));
    geometry.computeVertexNormals();
    if (mesh) { mesh.geometry.dispose(); mesh.geometry = geometry; } else {
      mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
    const s = size();
    const siteY = gridCenterHeight(meta, heights) * exaggeration;
    marker.scale.set(s * 0.002, s * 0.02, s * 0.002);
    marker.position.set(0, siteY + s * 0.01, 0);
    const cam = sunLight.shadow.camera;
    cam.left = cam.bottom = -s * 0.75;
    cam.right = cam.top = s * 0.75;
    cam.near = 1;
    cam.far = s * 6;
    cam.updateProjectionMatrix();
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = meta.grid.spacing_m * 0.3;
    placeBodies();
  }

  function placeBodies() {
    const s = size();
    const dist = s * SKY_DISTANCE_FACTOR;
    ['sun', 'earth'].forEach((name, k) => {
      const b = bodies[name];
      sprites[k].visible = Boolean(b);
      if (!b) return;
      const d = bodyDirection(b.azDeg, b.elDeg);
      sprites[k].position.set(d.x * dist, d.y * dist, d.z * dist);
      const r = dist * Math.tan(Math.max(b.radiusDeg, MIN_SPRITE_RADIUS_DEG) * Math.PI / 180) * 2;
      sprites[k].scale.set(r, r, 1);
      sprites[k].material.opacity = b.elDeg < 0 ? BELOW_HORIZON_OPACITY : 1;
      sprites[k].material.transparent = true;
    });
    const sun = bodies.sun;
    const lit = Boolean(sun) && sun.elDeg >= 0;
    sunLight.intensity = lit ? SUN_INTENSITY : 0;
    ambient.intensity = lit ? AMBIENT_LIT : AMBIENT_DARK;
    if (sun) {
      const d = bodyDirection(sun.azDeg, sun.elDeg);
      sunLight.position.set(d.x * s * 3, d.y * s * 3, d.z * s * 3);
      sunLight.target.position.set(0, 0, 0);
    }
  }

  function applyCamera(reset) {
    const s = size();
    if (mode === 'ground') {
      controls.enabled = false;
      camera.fov = GROUND_FOV_DEG;
      camera.near = 0.5;
      camera.far = s * 10;
      const y = gridCenterHeight(meta, heights) * exaggeration + observerHeightM;
      const d = bodyDirection(groundAzDeg, 0);
      camera.position.set(0, y, 0);
      camera.lookAt(d.x * 1000, y, d.z * 1000);
    } else {
      controls.enabled = true;
      camera.fov = OVERVIEW_FOV_DEG;
      camera.near = s * 0.001;
      camera.far = s * 10;
      if (reset) {
        const d = bodyDirection(OVERVIEW_AZIMUTH_DEG, OVERVIEW_ELEVATION_DEG);
        const dist = s * OVERVIEW_DISTANCE_FACTOR;
        camera.position.set(d.x * dist, d.y * dist, d.z * dist);
        controls.target.set(0, 0, 0);
      }
      controls.update();
    }
    camera.updateProjectionMatrix();
    requestRender();
  }

  controls.addEventListener('change', requestRender);
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  applyShadowQuality();
  resize();

  return {
    /** Grille de terrain décodée (data.js → loadTerrain). */
    setTerrain(terrainMeta, heightsM) { meta = terrainMeta; heights = heightsM; rebuildMesh(); applyCamera(true); },
    /** États {azDeg, elDeg, radiusDeg} du Soleil et de la Terre (ou null). */
    setBodies(sun, earth) { bodies = { sun, earth }; placeBodies(); requestRender(); },
    /** 'overview' (orbite) ou 'ground' (au sol, regard vers azDeg). */
    setViewMode(newMode, { azDeg = groundAzDeg, observerHeight = observerHeightM } = {}) {
      const reset = newMode !== mode;
      mode = newMode === 'ground' ? 'ground' : 'overview';
      groundAzDeg = azDeg;
      observerHeightM = observerHeight;
      if (meta) applyCamera(reset);
    },
    /** Exagération verticale (×1 à ×5). */
    setExaggeration(f) { exaggeration = f; rebuildMesh(); if (meta) applyCamera(false); },
    /** Rendu immédiat (sans attendre l'image suivante), utile aux contrôles et aux captures. */
    renderNow() { render(); },
    /** Mémoire GPU suivie par three.js (contrôle des fuites). */
    info() { return { ...renderer.info.memory, shadowMapSize: SHADOW_SIZES[qualityLevel] }; },
    /** Libère géométries, matériaux, textures, contrôles et contexte WebGL. */
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      mesh?.geometry.dispose();
      mesh?.material.dispose();
      marker.geometry.dispose();
      marker.material.dispose();
      sprites.forEach((s) => s.material.dispose());
      textures.forEach((t) => t.dispose());
      sunLight.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
