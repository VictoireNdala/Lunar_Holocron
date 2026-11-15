// Globe 3D de l'Atlas (A-04, docs/ATLAS.md § 5.1) : sphère LISSE texturée (D-002/D-015 : pas de relief global, pas de LOD),
// éclairée vers le point sub-solaire. Aucun verdict de visibilité : horizon plat seulement. Hors ligne : texture locale ;
// si elle manque, sphère grise avec graticule (le dit via `onTextureError`).
import { glyphOf } from './markers.js';
import { createRenderer, releaseRenderer } from '../webgl.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { latLonToVector, terminatorCircle, vectorToLatLon } from './sphere.js';

const SPHERE_SEGMENTS = [64, 32];
const AMBIENT_NIGHT = 0.12; // le côté nuit n'est pas noir pur (légende : « éclairci pour la lisibilité »)
const SUN_INTENSITY = 2.4;
const SKY_DISTANCE = 7; // Soleil et Terre dessinés hors de la sphère, dans leur direction (taille exagérée, dit à l'écran)
const MIN_DISTANCE = 1.35;
const MAX_DISTANCE = 6;
const HOME = Object.freeze({ latDeg: -55, lonDeg: 0, distance: 4.2 }); // le pôle Sud est le sujet du produit : il est visible d'emblée
const FLY_MS = 900;
const STAR_COUNT = 700;
const STAR_SEED = 20261114;
const GRATICULE_STEP_DEG = 30;
const LINE_RADIUS = 1.003;
const MARKER_RADIUS = 1.006;

/** Générateur pseudo-aléatoire déterministe (graine fixe, pas de Math.random : sorties reproductibles). */
function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function disc(fill, ring) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (!ring) {
    const g = ctx.createRadialGradient(64, 64, 24, 64, 64, 64);
    g.addColorStop(0, fill); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  }
  ctx.beginPath(); ctx.arc(64, 64, ring ? 54 : 32, 0, 2 * Math.PI); ctx.fillStyle = fill; ctx.fill();
  if (ring) { ctx.lineWidth = 10; ctx.strokeStyle = ring; ctx.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function lineFrom(points, color, opacity = 1) {
  const g = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
}

const toArr = (p, r) => { const v = latLonToVector(p.latDeg, p.lonDeg); return [v.x * r, v.y * r, v.z * r]; };

/** Crée le globe dans `container` ; renvoie l'API (setTime, setSites, setLayers, flyTo, home, dispose…). */
export function createGlobe(container, { textureUrl, onTextureError = () => {}, onSiteClick = () => {}, onHover = () => {}, reducedMotion = false } = {}) {
  const renderer = createRenderer(THREE);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = MIN_DISTANCE;
  controls.maxDistance = MAX_DISTANCE;

  const material = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 1, metalness: 0 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, ...SPHERE_SEGMENTS), material);
  scene.add(sphere);
  let texture = null;
  new THREE.TextureLoader().load(textureUrl, (t) => {
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texture = t;
    material.map = t; material.color.set(0xffffff); material.needsUpdate = true; requestRender();
  }, undefined, () => onTextureError());

  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT_NIGHT);
  const sunLight = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
  scene.add(ambient, sunLight);

  const stars = (() => {
    const r = lcg(STAR_SEED); const pos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const u = r() * 2 - 1; const a = r() * 2 * Math.PI; const s = Math.sqrt(1 - u * u);
      pos.set([40 * s * Math.cos(a), 40 * u, 40 * s * Math.sin(a)], 3 * i);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.8 }));
  })();
  scene.add(stars);

  const textures = [disc('#ffd479', null), disc('#5aa9ff', '#ffffff')];
  const bodySprites = textures.map((map) => new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false })));
  const subMarkers = [0xffd479, 0x5aa9ff].map((c) => new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 8), new THREE.MeshBasicMaterial({ color: c })));
  scene.add(...bodySprites, ...subMarkers);

  const layerObjects = { terminator: null, earthZone: null };
  const graticule = new THREE.Group();
  for (let lat = -60; lat <= 60; lat += GRATICULE_STEP_DEG) {
    graticule.add(lineFrom(Array.from({ length: 121 }, (_, k) => toArr({ latDeg: lat, lonDeg: -180 + (k * 360) / 120 }, LINE_RADIUS)), 0xffffff, 0.25));
  }
  for (let lon = -180; lon < 180; lon += GRATICULE_STEP_DEG) {
    graticule.add(lineFrom(Array.from({ length: 91 }, (_, k) => toArr({ latDeg: -90 + (k * 180) / 90, lonDeg: lon }, LINE_RADIUS)), 0xffffff, 0.25));
  }
  scene.add(graticule);
  graticule.visible = false;

  const siteGroup = new THREE.Group();
  let selectedId = null;
  /** Taille à l'écran des marqueurs liée à la distance de la caméra : sans cela, ils deviennent d'énormes disques qui se recouvrent dès qu'on s'approche. */
  function updateMarkerScale() {
    const k = Math.min(1.2, Math.max(0.16, (camera.position.length() - 1) / 2));
    for (const m of siteGroup.children) m.scale.setScalar(k * (m.userData.id === selectedId ? 1.9 : 1));
  }
  scene.add(siteGroup);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pending = false; let disposed = false; let fly = null; let hovered = null;
  const sub = { sun: { latDeg: 0, lonDeg: 0 }, earth: { latDeg: 0, lonDeg: 0 } };
  const layers = { terminator: true, earthZone: true, graticule: false, sites: true };

  function requestRender() { if (!pending && !disposed) { pending = true; requestAnimationFrame(tick); } }

  function tick(now) {
    pending = false;
    if (disposed) return;
    if (fly) {
      const k = Math.min((now - fly.t0) / FLY_MS, 1);
      const e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(fly.from, fly.to, e).normalize().multiplyScalar(fly.fromDist + (fly.toDist - fly.fromDist) * e);
      if (k >= 1) fly = null; else requestRender();
    }
    controls.update();
    updateMarkerScale();
    renderer.render(scene, camera);
  }

  function setCircle(name, latLon, color) {
    if (layerObjects[name]) { scene.remove(layerObjects[name]); layerObjects[name].geometry.dispose(); layerObjects[name].material.dispose(); }
    const pts = terminatorCircle(latLon.latDeg, latLon.lonDeg, 180);
    const loop = [...pts, pts[0]].map((p) => toArr(p, LINE_RADIUS));
    layerObjects[name] = lineFrom(loop, color);
    scene.add(layerObjects[name]);
  }

  function applyLayers() {
    if (layerObjects.terminator) layerObjects.terminator.visible = layers.terminator;
    if (layerObjects.earthZone) layerObjects.earthZone.visible = layers.earthZone;
    graticule.visible = layers.graticule;
    siteGroup.visible = layers.sites;
    requestRender();
  }

  function resize() {
    const w = container.clientWidth || 1; const h = container.clientHeight || 1;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); requestRender();
  }

  function pick(event) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster;
  }

  function siteAt(event) {
    const rc = pick(event);
    const hit = rc.intersectObjects(siteGroup.children, false)[0];
    const front = rc.intersectObject(sphere, false)[0];
    return hit && (!front || hit.distance <= front.distance + 0.02) ? hit.object.userData : null;
  }

  renderer.domElement.addEventListener('pointermove', (e) => {
    const s = layers.sites ? siteAt(e) : null;
    renderer.domElement.style.cursor = s ? 'pointer' : 'grab';
    const front = pick(e).intersectObject(sphere, false)[0];
    const ll = front ? vectorToLatLon({ x: front.point.x, y: front.point.y, z: front.point.z }) : null;
    if (s !== hovered || ll) { hovered = s; onHover({ site: s, latLon: ll, x: e.clientX, y: e.clientY }); }
  });
  renderer.domElement.addEventListener('pointerleave', () => onHover({ site: null, latLon: null }));
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; // un glissement n'est pas un clic
    const s = layers.sites ? siteAt(e) : null;
    if (s) onSiteClick(s);
  });
  renderer.domElement.addEventListener('dblclick', (e) => { const s = layers.sites ? siteAt(e) : null; if (s) api.flyTo(s.latDeg, s.lonDeg); });
  controls.addEventListener('change', requestRender);
  const ro = new ResizeObserver(resize); ro.observe(container);

  const api = {
    /** Points sub-solaire et sub-terrestre : lumière, marqueurs, Soleil et Terre hors de la sphère, terminateur et zone « Terre visible ». */
    setSubPoints(sun, earth) {
      sub.sun = sun; sub.earth = earth;
      const s = latLonToVector(sun.latDeg, sun.lonDeg); const e = latLonToVector(earth.latDeg, earth.lonDeg);
      sunLight.position.set(s.x * 10, s.y * 10, s.z * 10);
      subMarkers[0].position.set(s.x * MARKER_RADIUS, s.y * MARKER_RADIUS, s.z * MARKER_RADIUS);
      subMarkers[1].position.set(e.x * MARKER_RADIUS, e.y * MARKER_RADIUS, e.z * MARKER_RADIUS);
      bodySprites[0].position.set(s.x * SKY_DISTANCE, s.y * SKY_DISTANCE, s.z * SKY_DISTANCE); bodySprites[0].scale.setScalar(0.9);
      bodySprites[1].position.set(e.x * SKY_DISTANCE, e.y * SKY_DISTANCE, e.z * SKY_DISTANCE); bodySprites[1].scale.setScalar(1.1);
      setCircle('terminator', sun, 0xffd479);
      setCircle('earthZone', earth, 0x5aa9ff);
      applyLayers();
    },
    /** Marqueurs de sites : [{id, name, latDeg, lonDeg, tier, synthetic}] ; le niveau 1 est plus grand et plus lumineux. */
    setSites(sites) {
      for (const m of siteGroup.children) { m.geometry.dispose(); m.material.dispose(); }
      siteGroup.clear();
      for (const s of sites) {
        const big = s.tier === 1;
        const m = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.022 : 0.014, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(glyphOf(s).color) })); // couleur de la famille (même palette que les cartes 2D)
        const p = latLonToVector(s.latDeg, s.lonDeg);
        m.position.set(p.x * MARKER_RADIUS, p.y * MARKER_RADIUS, p.z * MARKER_RADIUS);
        m.userData = s; siteGroup.add(m);
      }
      api.setSelected(selectedId);
      requestRender();
    },
    /** Marqueur du site dont la fiche est ouverte : agrandi (null = aucun). */
    setSelected(id) {
      selectedId = id;
      requestRender();
    },
    setLayers(next) { Object.assign(layers, next); applyLayers(); },
    /** Caméra vers (lat, lon) en moins d'une seconde (instantané si « réduire les animations »). */
    flyTo(latDeg, lonDeg, distance = 2.2) {
      const v = latLonToVector(latDeg, lonDeg);
      const target = new THREE.Vector3(v.x, v.y, v.z);
      const fromDist = camera.position.length();
      if (reducedMotion) { camera.position.copy(target).multiplyScalar(distance); controls.update(); requestRender(); return; }
      fly = { t0: performance.now(), from: camera.position.clone().normalize(), to: target, fromDist, toDist: distance };
      requestRender();
    },
    home() { api.flyTo(HOME.latDeg, HOME.lonDeg, HOME.distance); },
    /** Vue initiale immédiate (sans animation). */
    resetCamera() { const v = latLonToVector(HOME.latDeg, HOME.lonDeg); camera.position.set(v.x * HOME.distance, v.y * HOME.distance, v.z * HOME.distance); controls.update(); requestRender(); },
    renderNow() { tick(performance.now()); },
    info() { return { ...renderer.info.memory, textureLoaded: Boolean(texture) }; },
    dispose() {
      disposed = true; ro.disconnect(); controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose(); }); });
      textures.forEach((t) => t.dispose()); texture?.dispose();
      releaseRenderer(renderer);
    },
  };
  api.resetCamera();
  resize();
  return api;
}
