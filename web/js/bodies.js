// Soleil et Terre « en vrais disques » (V2-04, BUILD-V2 § 5) : fonctions PURES (assombrissement centre-bord, phase de la Terre, rayon à l'écran) et
// tracé de sprites sur un canvas. Aucune image distante : tout est calculé. La Terre est SCHÉMATIQUE : phase réelle, texture procédurale (océans, continents
// stylisés, atmosphère), jamais une photo ; l'interface le dit (« Terre (schématique) »).
const DEG = Math.PI / 180;
export const LIMB_DARKENING_U = 0.6; // coefficient de la loi linéaire I(r) = 1 − u·(1 − √(1 − r²)) ; valeur usuelle dans le visible, paramètre documenté
export const MIN_BODY_RADIUS_PX = 3; // plancher de lisibilité : en dessous, le disque est agrandi ET signalé
export const BODY_SCALES = Object.freeze([1, 4, 8]); // facteurs d'agrandissement proposés (illustratifs)
const PHASE_STEPS = 32;
const ANGLE_STEP_DEG = 10;

/** Intensité relative (0–1) à la distance réduite r ∈ [0 ; 1] du centre du disque solaire : assombrissement centre-bord linéaire. */
export function limbIntensity(r, u = LIMB_DARKENING_U) {
  const x = Math.min(Math.max(r, 0), 1);
  return 1 - u * (1 - Math.sqrt(1 - x * x));
}

/**
 * Phase de la Terre vue du site : fraction éclairée k = (1 − cos ψ) / 2, où ψ est la séparation angulaire Soleil – Terre vue du site
 * (Terre pleine quand le Soleil est à l'opposé, ψ = 180°), et angle de position `paDeg` du Soleil autour du disque de la Terre, compté depuis le zénith
 * vers les azimuts croissants (0° = le limbe éclairé est en haut, 90° = à droite sur un panorama dont l'azimut croît vers la droite).
 */
export function earthPhase(sun, earth) {
  const sE = Math.sin(earth.elDeg * DEG);
  const cE = Math.cos(earth.elDeg * DEG);
  const sS = Math.sin(sun.elDeg * DEG);
  const cS = Math.cos(sun.elDeg * DEG);
  const dA = (sun.azDeg - earth.azDeg) * DEG;
  const cosPsi = Math.min(1, Math.max(-1, sS * sE + cS * cE * Math.cos(dA)));
  const paDeg = ((Math.atan2(cS * Math.sin(dA), sS * cE - cS * sE * Math.cos(dA)) / DEG) + 360) % 360;
  return { k: (1 - cosPsi) / 2, psiDeg: Math.acos(cosPsi) / DEG, paDeg };
}

/** Phase quantifiée (pour mettre les sprites en cache sans les redessiner à chaque heure) : k au 1/32, angle de position à 10°. */
export function quantizePhase(phase) {
  return { k: Math.round(phase.k * PHASE_STEPS) / PHASE_STEPS, paDeg: (Math.round(phase.paDeg / ANGLE_STEP_DEG) * ANGLE_STEP_DEG) % 360 };
}

/** Rayon dessiné (px) d'un disque de `radiusDeg` degrés à `pxPerDeg` px/°, avec facteur d'agrandissement illustratif ; `enlarged` si ≠ taille réelle. */
export function discRadiusPx(radiusDeg, pxPerDeg, scale = 1) {
  const real = radiusDeg * pxPerDeg;
  const wanted = real * scale;
  if (wanted >= MIN_BODY_RADIUS_PX) return { radiusPx: wanted, enlarged: scale !== 1, scale };
  return { radiusPx: MIN_BODY_RADIUS_PX, enlarged: true, scale: MIN_BODY_RADIUS_PX / real };
}

/** Bruit de valeur déterministe (continents stylisés) : pas d'aléa, mêmes entrées, mêmes pixels. */
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function valueNoise(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0) * (1 - sx) + hash(x0 + 1, y0) * sx;
  const b = hash(x0, y0 + 1) * (1 - sx) + hash(x0 + 1, y0 + 1) * sx;
  return a * (1 - sy) + b * sy;
}

/** Albédo schématique (0 = océan, 1 = continent, +nuages) en un point de la sphère vu de face : x, y ∈ [−1 ; 1] dans le disque. */
export function earthSurface(x, y) {
  const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  const n = valueNoise(x * 3.2 + 1.7, y * 3.2 + 4.1) * 0.65 + valueNoise(x * 7 + 9.3, y * 7 + 2.2) * 0.35;
  const cloud = valueNoise(x * 5 + 20, y * 5 + 11);
  return { land: n > 0.55 ? 1 : 0, cloud: cloud > 0.68 ? (cloud - 0.68) * 3 : 0, z };
}

/** Trace le Soleil sur `canvas` (carré `size` px) : disque à assombrissement centre-bord, halo additif étendu au-delà du disque. Calcul pixel par pixel SANS relecture du canvas (getImageData est très lent sur un canvas accéléré). */
export function drawSunSprite(canvas, size) {
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const disc = c / 2.4; // le disque occupe 1/2,4 du sprite ; le reste est le halo
  const img = ctx.createImageData(size, size);
  const haloStart = disc * 0.8;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      const i = (y * size + x) * 4;
      const r = d / disc;
      if (r <= 1) {
        const I = limbIntensity(r);
        const edge = Math.min(1, (1 - r) * disc); // bord adouci sur ~1 px
        img.data[i] = 255; img.data[i + 1] = Math.round(236 * I + 19); img.data[i + 2] = Math.round(190 * I * I + 10); img.data[i + 3] = Math.round(255 * edge);
      } else if (d < c) { // halo : dégradé radial de haloStart à c (mêmes arrêts que l'ancien dégradé du canvas)
        const t = Math.min(1, Math.max(0, (d - haloStart) / (c - haloStart)));
        let a; let g; let b;
        if (t < 0.35) { const k = t / 0.35; a = 0.55 + (0.18 - 0.55) * k; g = 214 + (190 - 214) * k; b = 128 + (90 - 128) * k; }
        else { const k = (t - 0.35) / 0.65; a = 0.18 * (1 - k); g = 190 + (180 - 190) * k; b = 90 + (80 - 90) * k; }
        img.data[i] = 255; img.data[i + 1] = Math.round(g); img.data[i + 2] = Math.round(b); img.data[i + 3] = Math.round(255 * a);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Trace la Terre schématique sur `canvas` (carré `size` px) avec sa phase : face éclairée (océans, continents stylisés, nuages, voile d'atmosphère au limbe)
 * et face sombre bleutée très atténuée. `k` : fraction éclairée ; `paDeg` : angle de position du Soleil (voir earthPhase).
 */
export function drawEarthSprite(canvas, size, k, paDeg) {
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const c = size / 2;
  const R = c * 0.9;
  const pa = paDeg * DEG;
  const sx = Math.sin(pa); // direction du Soleil dans le plan du disque (haut = zénith, droite = azimuts croissants)
  const sy = -Math.cos(pa);
  const b = 1 - 2 * k; // terminateur : ellipse de demi-petit axe |b| ; b > 0 : croissant, b < 0 : gibbeuse
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x + 0.5 - c) / R;
      const dy = (y + 0.5 - c) / R;
      const r2 = dx * dx + dy * dy;
      if (r2 > 1) continue;
      const along = dx * sx + dy * sy; // coordonnée le long de la direction du Soleil
      const across = -dx * sy + dy * sx;
      const termAlong = b * Math.sqrt(Math.max(0, 1 - across * across)); // abscisse du terminateur à cette « latitude »
      const lit = along >= termAlong;
      const surf = earthSurface(dx, dy);
      let rr; let gg; let bb;
      if (surf.land) { rr = 70; gg = 120; bb = 60; } else { rr = 24; gg = 78; bb = 158; }
      rr += surf.cloud * 180; gg += surf.cloud * 170; bb += surf.cloud * 160;
      const limb = Math.pow(Math.sqrt(r2), 4) * 0.55; // voile d'atmosphère bleutée au bord
      rr += (120 - rr) * limb; gg += (170 - gg) * limb; bb += (255 - bb) * limb;
      const shade = lit ? 0.45 + 0.55 * Math.min(1, Math.abs(along - termAlong) * 2.2 + 0.25) : 0.08;
      const i = (y * size + x) * 4;
      img.data[i] = Math.min(255, rr * shade); img.data[i + 1] = Math.min(255, gg * shade); img.data[i + 2] = Math.min(255, bb * shade);
      img.data[i + 3] = Math.round(255 * Math.min(1, (1 - Math.sqrt(r2)) * R));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

const cache = new Map();

/** Sprite en cache (même taille arrondie à la puissance de deux supérieure, même phase quantifiée) : renvoie un canvas prêt pour drawImage. */
export function bodySprite(body, radiusPx, phase = null) {
  const size = Math.min(256, Math.max(32, 2 ** Math.ceil(Math.log2(Math.max(8, radiusPx * (body === 'sun' ? 5 : 2.4))))));
  const q = body === 'earth' && phase ? quantizePhase(phase) : null;
  const key = body === 'sun' ? `sun|${size}` : `earth|${size}|${q.k}|${q.paDeg}`;
  if (!cache.has(key)) {
    const canvas = document.createElement('canvas');
    if (body === 'sun') drawSunSprite(canvas, size); else drawEarthSprite(canvas, size, q.k, q.paDeg);
    cache.set(key, canvas);
    if (cache.size > 80) cache.delete(cache.keys().next().value); // cache borné
  }
  return cache.get(key);
}
