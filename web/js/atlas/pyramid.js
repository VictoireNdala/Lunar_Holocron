// Pyramide de tuiles du fond polaire (M-051 § 2.2) : décodage des tuiles (différences, octets séparés, deflate brut), choix du niveau selon le zoom,
// gradients par tuile et repli sur un niveau plus grossier (jamais de trou). Fonctions pures + chargement asynchrone injecté (hors ligne : fichiers statiques).
// Le niveau 480 m (grille complète) reste le repli final. Les niveaux fins ne couvrent que des fenêtres autour des sites (manifeste).
import { R_REF_M } from '../constants.js';
import { southPolar } from './sphere.js';

const FINER_TOLERANCE = 1.25; // on prend le niveau le plus grossier dont le pas ne dépasse pas 1,25 pixel d'écran
const MAX_TILES_PER_PREPARE = 64; // garde-fou : une fenêtre qui demanderait plus de tuiles retombe sur un niveau plus grossier

/** Hauteurs (m, NaN = pas de donnée) d'une tuile décompressée : annule les octets séparés puis les différences. `bytes` : contenu inflaté. */
export function unpackTile(bytes, storedPx, z) {
  const n = storedPx * storedPx;
  const heights = new Float32Array(n);
  const scale = (z.max_m - z.min_m) / z.max_code;
  for (let r = 0; r < storedPx; r += 1) {
    let code = 0;
    for (let c = 0; c < storedPx; c += 1) {
      const k = r * storedPx + c;
      code = (code + (bytes[k] | (bytes[n + k] << 8))) & 0xFFFF;
      heights[k] = code === z.nodata_code ? NaN : z.min_m + code * scale;
    }
  }
  return heights;
}

/** Inflate d'un flux deflate brut (RFC 1951) avec DecompressionStream (navigateur et Node ≥ 18). */
export async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Gradients (m par m) par différences centrées sur une tuile stockée ; NaN si un voisin manque ; bord = dernier échantillon répété. */
export function tileGradients(heights, storedPx, spacingM) {
  const gx = new Float32Array(storedPx * storedPx);
  const gy = new Float32Array(storedPx * storedPx);
  const at = (r, c) => heights[Math.min(Math.max(r, 0), storedPx - 1) * storedPx + Math.min(Math.max(c, 0), storedPx - 1)];
  for (let r = 0; r < storedPx; r += 1) {
    for (let c = 0; c < storedPx; c += 1) {
      const k = r * storedPx + c;
      const e = at(r, c + 1); const w = at(r, c - 1); const up = at(r - 1, c); const down = at(r + 1, c);
      gx[k] = Number.isFinite(e) && Number.isFinite(w) ? (e - w) / (2 * spacingM) : NaN;
      gy[k] = Number.isFinite(up) && Number.isFinite(down) ? (up - down) / (2 * spacingM) : NaN;
    }
  }
  return { gx, gy };
}

/**
 * Pyramide : `manifest` = polar/tiles.json ; `loadBytes(spacingM, tx, ty)` → Promise<Uint8Array> (octets du fichier .bin) ; `base` = repli
 * { gradientXY(x, y) } (grille 480 m) ou null. Renvoie { chooseLevel, prepare, gradientXY, stats }.
 */
export function createPyramid(manifest, loadBytes, base = null) {
  const core = manifest.tile.core_px;
  const border = manifest.tile.border_px;
  const stored = manifest.tile.stored_px;
  const levels = [...manifest.levels].sort((a, b) => a.spacing_m - b.spacing_m).map((lv) => ({ ...lv, have: new Set(lv.tiles.map(([tx, ty]) => `${tx}_${ty}`)) }));
  const cache = new Map(); // `${spacing}/${tx}_${ty}` → { gx, gy } (prête) ou null (échec)
  const pending = new Map();

  /** Niveau (objet) à utiliser pour `pxPerM` pixels d'écran par mètre de plan, ou null : le fond 480 m suffit. */
  function chooseLevel(pxPerM) {
    const want = 1 / pxPerM;
    if (!levels.length || 480 <= FINER_TOLERANCE * want) return null;
    const fine = levels.filter((lv) => lv.spacing_m <= FINER_TOLERANCE * want);
    return fine.length ? fine[fine.length - 1] : levels[0];
  }

  const tileKey = (lv, tx, ty) => `${lv.spacing_m}/${tx}_${ty}`;
  const tilesOf = (lv, bbox) => {
    const out = [];
    const n = Math.ceil(lv.n_cols / core);
    const i0 = Math.floor((bbox.xMin - lv.x0_m) / lv.spacing_m / core); const i1 = Math.floor((bbox.xMax - lv.x0_m) / lv.spacing_m / core);
    const j0 = Math.floor((lv.y0_m - bbox.yMax) / lv.spacing_m / core); const j1 = Math.floor((lv.y0_m - bbox.yMin) / lv.spacing_m / core);
    for (let ty = Math.max(0, j0); ty <= Math.min(n - 1, j1); ty += 1) for (let tx = Math.max(0, i0); tx <= Math.min(n - 1, i1); tx += 1) if (lv.have.has(`${tx}_${ty}`)) out.push([tx, ty]);
    return out;
  };

  function load(lv, tx, ty) {
    const key = tileKey(lv, tx, ty);
    if (cache.has(key)) return Promise.resolve();
    if (!pending.has(key)) {
      pending.set(key, loadBytes(lv.spacing_m, tx, ty).then(inflateRaw).then((raw) => {
        const heights = unpackTile(raw, stored, manifest.z);
        cache.set(key, { heights, ...tileGradients(heights, stored, lv.spacing_m) });
      }).catch(() => { cache.set(key, null); }).finally(() => pending.delete(key)));
    }
    return pending.get(key);
  }

  /** Charge les tuiles du niveau adapté à `pxPerM` qui couvrent `bbox` (plan, m) ; renvoie le niveau choisi (null = 480 m seulement). */
  async function prepare(bbox, pxPerM) {
    let lv = chooseLevel(pxPerM);
    while (lv && tilesOf(lv, bbox).length > MAX_TILES_PER_PREPARE) lv = levels[levels.indexOf(lv) + 1] ?? null; // fenêtre trop grande : niveau plus grossier
    if (lv) await Promise.all(tilesOf(lv, bbox).map(([tx, ty]) => load(lv, tx, ty)));
    return lv;
  }

  /** Valeur bilinéaire du champ `field` ('gx' | 'gy' | 'heights') au point du plan (x, y) depuis le niveau `lv` puis les plus grossiers déjà chargés ; null si aucun ne couvre. */
  function locate(x, y, lv, field) {
    for (let k = lv ? levels.indexOf(lv) : levels.length; k < levels.length; k += 1) {
      const level = levels[k];
      const col = (x - level.x0_m) / level.spacing_m;
      const row = (level.y0_m - y) / level.spacing_m;
      const tx = Math.floor(col / core); const ty = Math.floor(row / core);
      const t = cache.get(tileKey(level, tx, ty));
      if (!t) continue;
      const c = col - tx * core + border; const r = row - ty * core + border; // indices dans la tuile stockée
      const c0 = Math.floor(c); const r0 = Math.floor(r);
      if (c0 < 0 || r0 < 0 || c0 + 1 >= stored || r0 + 1 >= stored) continue;
      const wc = c - c0; const wr = r - r0; const i = r0 * stored + c0;
      const mix = (a) => (1 - wr) * ((1 - wc) * a[i] + wc * a[i + 1]) + wr * ((1 - wc) * a[i + stored] + wc * a[i + stored + 1]);
      const v = mix(t[field]);
      if (Number.isFinite(v)) return { value: v, level, mix, t };
    }
    return null;
  }

  /** Gradient bilinéaire au point du plan (x, y) en m, depuis le niveau `lv` puis les niveaux plus grossiers déjà chargés, puis le repli 480 m. */
  function gradientXY(x, y, lv) {
    const hit = locate(x, y, lv, 'gx');
    if (hit) return { gx: hit.value, gy: hit.mix(hit.t.gy), spacingM: hit.level.spacing_m };
    return base ? { ...base.gradientXY(x, y), spacingM: 480 } : { gx: NaN, gy: NaN, spacingM: NaN };
  }

  /** Hauteur (m au-dessus de R_REF) au point du plan (x, y) : même repli que gradientXY ; NaN si rien ne couvre. */
  function heightXY(x, y, lv) {
    const hit = locate(x, y, lv, 'heights');
    if (hit) return hit.value;
    return base?.heightXY ? base.heightXY(x, y) : NaN;
  }

  return { chooseLevel, prepare, gradientXY, heightXY, levels, stats: () => ({ tiles: cache.size }) };
}

/** Adaptateur de la grille 480 m (repli) : gradient bilinéaire au point du plan. */
export function baseFromGrid(grid, grads, gradientAtLatLon, inverse, heightAtLatLon = null) {
  return {
    gradientXY: (x, y) => { const ll = inverse(x, y, R_REF_M); return gradientAtLatLon(grid, grads, ll.latDeg, ll.lonDeg); },
    heightXY: heightAtLatLon ? (x, y) => { const ll = inverse(x, y, R_REF_M); return heightAtLatLon(grid, ll.latDeg, ll.lonDeg); } : null,
  };
}

/** Pixels d'écran par mètre de plan et rectangle de plan visible d'une projection polaire Sud (`fromPixel`) ; null si la carte n'est pas mesurable. */
export function viewMetrics(proj) {
  const plane = (px, py) => { const ll = proj.fromPixel(px, py); return ll ? southPolar(ll.latDeg, ll.lonDeg, R_REF_M) : null; };
  const a = plane(proj.w / 2, proj.h / 2);
  const b = plane(proj.w / 2 + 50, proj.h / 2);
  if (!a || !b) return null;
  const pxPerM = 50 / Math.hypot(b.x - a.x, b.y - a.y);
  const pts = [];
  for (const fy of [0, 0.5, 1]) for (const fx of [0, 0.5, 1]) { const p = plane(fx * proj.w, fy * proj.h); if (p) pts.push(p); }
  if (!pts.length) return null;
  return { pxPerM, bbox: { xMin: Math.min(...pts.map((p) => p.x)), xMax: Math.max(...pts.map((p) => p.x)), yMin: Math.min(...pts.map((p) => p.y)), yMax: Math.max(...pts.map((p) => p.y)) } };
}
