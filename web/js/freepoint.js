// Point libre (V2-02, D-027) : Soleil, Terre, horizon et indicateurs d'un point saisi par l'utilisateur, calculés DANS LE NAVIGATEUR.
// Fonctions PURES. Soleil et Terre : global.json (points sub-corps, rayons angulaires) avec PARALLAXE ; horizon : grille polaire 480 m dérivée du LDEM
// (`polar/ldem_south_500m.*`) : « horizon approché (500 m) », PAS l'horizon 80 m du pipeline. Hors couverture (au nord de 80° S) : horizon plat.
// Les formules de visibilité sont celles de visibility.js ; les indicateurs sont un PORT de pipeline/kpi.py, vérifié par les mêmes séries.
import { DEFAULT_OBSERVER_HEIGHT_M, LAT_MAX_DEG, LAT_MIN_DEG, MDEG_PER_DEG, MOON_FRAME, N_AZIMUTHS, R_EARTH_KM, R_REF_M, R_SUN_KM } from './constants.js';
import { southPolar } from './atlas/sphere.js';
import { horizonAt, isVisible, visibleFraction } from './visibility.js';

const DEG = Math.PI / 180;
const BODY_RADIUS_M = Object.freeze({ sun: R_SUN_KM * 1000, earth: R_EARTH_KM * 1000 });
const HORIZON_MAX_M = 150_000;
const HORIZON_STEP_M = 240; // moitié du pas de la grille (480 m)
const NO_VALID_ELEVATION_DEG = -90;
const NO_DATA_CODE = 65535;
const UINT16_MAX_CODE = 65534;

/** Valide une coordonnée saisie ; renvoie { latDeg, lonDeg } (longitude dans [−180 ; 180]) ou null (pôle exact refusé, D-012). */
export function parseCoordinates(lat, lon) {
  const given = (v) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== ''));
  if (!given(lat) || !given(lon)) return null; // null, vide, booléen : refusés (Number(null) vaudrait 0)
  const latDeg = Number(lat);
  let lonDeg = Number(lon);
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return null;
  if (latDeg < LAT_MIN_DEG || latDeg > LAT_MAX_DEG || lonDeg < -180 || lonDeg > 360) return null;
  if (lonDeg > 180) lonDeg -= 360;
  return { latDeg, lonDeg };
}

/** Décode la grille polaire (métadonnées JSON + octets) en hauteurs (Float32Array, NaN = pas de donnée). */
export function decodePolarGrid(meta, buffer) {
  const { n_rows: nRows, n_cols: nCols, spacing_m: spacingM, x_min_m: x0, y_max_m: y0 } = meta.grid;
  if (buffer.byteLength !== nRows * nCols * 2) throw new RangeError(`${buffer.byteLength} octets, attendu ${nRows * nCols * 2}`);
  const view = new DataView(buffer);
  const { min_m: min, max_m: max } = meta.z;
  const heights = new Float32Array(nRows * nCols);
  for (let k = 0; k < heights.length; k += 1) {
    const code = view.getUint16(2 * k, true);
    heights[k] = code === NO_DATA_CODE ? NaN : min + (code / UINT16_MAX_CODE) * (max - min);
  }
  return { nRows, nCols, spacingM, x0, y0, heights, meta };
}

/** Hauteur (m au-dessus de R_REF) en (lat, lon) : interpolation bilinéaire dans le plan polaire ; NaN hors grille ou dans un trou. */
export function gridHeight(grid, latDeg, lonDeg) {
  const { x, y } = southPolar(latDeg, lonDeg, R_REF_M);
  const col = (x - grid.x0) / grid.spacingM;
  const row = (grid.y0 - y) / grid.spacingM;
  const c0 = Math.floor(col);
  const r0 = Math.floor(row);
  if (!(c0 >= 0 && r0 >= 0 && c0 + 1 < grid.nCols && r0 + 1 < grid.nRows)) return NaN;
  const wc = col - c0;
  const wr = row - r0;
  const h = grid.heights;
  const i = r0 * grid.nCols + c0;
  return (1 - wr) * ((1 - wc) * h[i] + wc * h[i + 1]) + wr * ((1 - wc) * h[i + grid.nCols] + wc * h[i + grid.nCols + 1]);
}

/** Relief plat : hauteur nulle partout (relief NON modélisé, hors couverture). */
export const flatHeight = () => 0;

/** Point atteint depuis (lat, lon) en suivant l'azimut sur la distance au sol (mêmes formules que pipeline/geodesy.py). */
function destination(latDeg, lonDeg, azRad, deltaRad) {
  const lat = latDeg * DEG;
  const sinLat2 = Math.min(Math.max(Math.sin(lat) * Math.cos(deltaRad) + Math.cos(lat) * Math.sin(deltaRad) * Math.cos(azRad), -1), 1);
  const lon2 = lonDeg * DEG + Math.atan2(Math.sin(azRad) * Math.sin(deltaRad) * Math.cos(lat), Math.cos(deltaRad) - Math.sin(lat) * sinLat2);
  return { latDeg: Math.asin(sinLat2) / DEG, lonDeg: lon2 / DEG };
}

/**
 * Masque d'horizon (360 azimuts) : élévation maximale du relief, courbure incluse (mêmes formules que pipeline/horizon.py).
 * `heightFn(lat, lon)` : hauteur en m (NaN ignoré). `truncated[a]` : au moins un point NaN avant 150 km (masque minorant).
 */
export function computeHorizon(heightFn, latDeg, lonDeg, eyeM = DEFAULT_OBSERVER_HEIGHT_M) {
  const ground = heightFn(latDeg, lonDeg);
  const elev = new Array(N_AZIMUTHS).fill(NO_VALID_ELEVATION_DEG);
  const truncated = new Array(N_AZIMUTHS).fill(true);
  if (!Number.isFinite(ground)) return { elev_deg: elev, truncated, groundM: NaN };
  const hObserver = ground + eyeM;
  for (let a = 0; a < N_AZIMUTHS; a += 1) {
    const az = a * DEG;
    let best = -Infinity;
    let missing = false;
    for (let dist = HORIZON_STEP_M; dist <= HORIZON_MAX_M; dist += HORIZON_STEP_M) {
      const delta = dist / R_REF_M;
      const p = destination(latDeg, lonDeg, az, delta);
      const ht = heightFn(p.latDeg, p.lonDeg);
      if (Number.isNaN(ht)) { missing = true; continue; }
      const rt = R_REF_M + ht;
      const e = Math.atan2(rt * Math.cos(delta) - (R_REF_M + hObserver), rt * Math.sin(delta)) / DEG;
      if (e > best) best = e;
    }
    elev[a] = Number.isFinite(best) ? Math.round(best * 100) / 100 : NO_VALID_ELEVATION_DEG;
    truncated[a] = missing;
  }
  return { elev_deg: elev, truncated, groundM: ground };
}

/**
 * Azimut, élévation et rayon angulaire (millidegrés entiers) d'un corps vu d'un point, à chaque échantillon de global.json.
 * Élévation EXACTE avec parallaxe : el = atan2(d·cosθ − (R+h), d·sinθ), d = R_corps / sin(rayon angulaire depuis le centre de la Lune),
 * θ = distance angulaire entre le point et le point sub-corps ; azimut = cap initial du grand cercle vers le point sub-corps.
 */
export function bodySeries(globalDoc, body, latDeg, lonDeg, heightM) {
  const s = globalDoc[body];
  const n = globalDoc.time.n;
  const lat = latDeg * DEG;
  const r = R_REF_M + heightM;
  const rBody = BODY_RADIUS_M[body];
  const az = new Array(n);
  const el = new Array(n);
  const radius = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const latB = (s.lat_mdeg[i] / MDEG_PER_DEG) * DEG;
    const dLon = ((s.lon_mdeg[i] / MDEG_PER_DEG) - lonDeg) * DEG;
    const d = rBody / Math.sin((s.radius_mdeg[i] / MDEG_PER_DEG) * DEG);
    const cosTheta = Math.sin(lat) * Math.sin(latB) + Math.cos(lat) * Math.cos(latB) * Math.cos(dLon);
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const elRad = Math.atan2(d * cosTheta - r, d * sinTheta);
    const dist = Math.sqrt(d * d + r * r - 2 * d * r * cosTheta);
    const azRad = Math.atan2(Math.sin(dLon) * Math.cos(latB), Math.cos(lat) * Math.sin(latB) - Math.sin(lat) * Math.cos(latB) * Math.cos(dLon));
    az[i] = Math.round((((azRad / DEG) % 360) + 360) % 360 * MDEG_PER_DEG) % (360 * MDEG_PER_DEG);
    el[i] = Math.round((elRad / DEG) * MDEG_PER_DEG);
    radius[i] = Math.round((Math.asin(rBody / dist) / DEG) * MDEG_PER_DEG);
  }
  return { az_mdeg: az, el_mdeg: el, radius_mdeg: radius };
}

/** Plus long intervalle d'absence (heures) et nombre d'intervalles : port de `gap_stats` (pipeline/kpi.py). */
export function gapStats(visible, stepS) {
  let longest = 0;
  let nGaps = 0;
  let run = 0;
  for (let i = 0; i <= visible.length; i += 1) {
    if (i < visible.length && !visible[i]) { run += 1; continue; }
    if (run > 0) { nGaps += 1; longest = Math.max(longest, run); run = 0; }
  }
  return { longestH: (longest * stepS) / 3600, nGaps };
}

/** Port de `compute_kpis` (pipeline/kpi.py) : renvoie `{ kpis, monthly }` au format du contrat. */
export function computeKpis(horizonElevDeg, bodies, startUtc, stepS) {
  const count = bodies.sun.az_mdeg.length;
  const vis = { sun: {}, earth: {} };
  for (const body of ['sun', 'earth']) {
    const b = bodies[body];
    const f = new Float64Array(count);
    for (let i = 0; i < count; i += 1) {
      f[i] = visibleFraction(b.el_mdeg[i] / MDEG_PER_DEG, b.radius_mdeg[i] / MDEG_PER_DEG, horizonAt(horizonElevDeg, b.az_mdeg[i] / MDEG_PER_DEG));
    }
    for (const mode of ['strict', 'any']) vis[body][mode] = Array.from(f, (v) => isVisible(v, mode));
  }
  vis.both = {};
  for (const mode of ['strict', 'any']) vis.both[mode] = vis.sun[mode].map((v, i) => v && vis.earth[mode][i]);
  const startMs = Date.parse(startUtc);
  const endMs = startMs + stepS * 1000 * (count - 1);
  const kpis = { window: { start_utc: startUtc, end_utc: new Date(endMs).toISOString().replace('.000Z', 'Z') } };
  for (const key of ['sun', 'earth', 'both']) {
    kpis[key] = {};
    for (const mode of ['strict', 'any']) {
      const { longestH, nGaps } = gapStats(vis[key][mode], stepS);
      kpis[key][mode] = { visible_pct: (100 * vis[key][mode].filter(Boolean).length) / count, longest_gap_h: longestH, n_gaps: nGaps };
    }
  }
  for (const body of ['sun', 'earth']) {
    const el = bodies[body].el_mdeg.map((v) => v / MDEG_PER_DEG);
    kpis[`${body}_el_deg`] = { min: Math.min(...el), max: Math.max(...el) };
  }
  const labels = Array.from({ length: count }, (_, i) => new Date(startMs + i * stepS * 1000).toISOString().slice(0, 7));
  const months = [...new Set(labels)].sort();
  const monthly = months.map((ym) => {
    const idx = labels.reduce((acc, l, i) => (l === ym ? (acc.push(i), acc) : acc), []);
    const pct = (key) => (100 * idx.filter((i) => vis[key].strict[i]).length) / idx.length;
    return { ym, sun_strict_pct: pct('sun'), earth_strict_pct: pct('earth'), both_strict_pct: pct('both') };
  });
  return { kpis, monthly };
}

/**
 * Terrain local 20 × 20 km (257²) échantillonné dans `heightFn` avec la courbure, au format de `loadTerrainFile` ({ meta, heightsM }) ;
 * les nœuds sans donnée prennent la hauteur du site. Sert à la vue 3D d'un point libre (relief LISSÉ à 480 m).
 */
export function buildLocalTerrain(heightFn, latDeg, lonDeg, siteHeightM, id, sizeM = 20000, n = 257) {
  const spacing = sizeM / (n - 1);
  const heightsM = new Float32Array(n * n);
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const east = -sizeM / 2 + c * spacing;
      const north = sizeM / 2 - r * spacing;
      const dist = Math.hypot(east, north);
      const p = dist === 0 ? { latDeg, lonDeg } : destination(latDeg, lonDeg, Math.atan2(east, north), dist / R_REF_M);
      let h = heightFn(p.latDeg, p.lonDeg);
      if (!Number.isFinite(h)) h = siteHeightM;
      const z = (R_REF_M + h) * Math.cos(dist / R_REF_M) - (R_REF_M + siteHeightM);
      heightsM[r * n + c] = z;
      if (z < min) min = z;
      if (z > max) max = z;
    }
  }
  const meta = { schema_version: '1.2', id, grid: { n, size_m: sizeM, spacing_m: spacing }, frame: 'local-enu', z: { encoding: 'float32', min_m: min, max_m: max === min ? min + 1 : max } };
  return { meta, heightsM };
}

/**
 * Site complet (format `sites/<id>.json`, contrat 1.2) pour un point libre : réutilise telle quelle toute l'interface (verdict, lectures, frise, comparaison).
 * `grid` : grille polaire 480 m décodée (ou null). Au sud de 80° S et dans la grille : horizon approché ; sinon horizon plat, relief non modélisé.
 */
export function buildFreePointSite({ globalDoc, grid, latDeg, lonDeg, eyeM = DEFAULT_OBSERVER_HEIGHT_M }) {
  const covered = grid !== null && latDeg <= -80 && Number.isFinite(gridHeight(grid, latDeg, lonDeg));
  const heightFn = covered ? (lat, lon) => gridHeight(grid, lat, lon) : flatHeight;
  const horizon = computeHorizon(heightFn, latDeg, lonDeg, eyeM);
  const ground = Number.isFinite(horizon.groundM) ? horizon.groundM : 0;
  const bodies = { sun: bodySeries(globalDoc, 'sun', latDeg, lonDeg, ground + eyeM), earth: bodySeries(globalDoc, 'earth', latDeg, lonDeg, ground + eyeM) };
  const { t0_utc: start, step_s: stepS, n: count } = globalDoc.time;
  const { kpis, monthly } = computeKpis(horizon.elev_deg, bodies, start, stepS);
  const label = `${latDeg.toFixed(3)}°, ${lonDeg.toFixed(3)}°`;
  return {
    site: {
      schema_version: '1.2', id: `custom:${latDeg},${lonDeg}`, name: { fr: `Point libre (${label})`, en: `Free point (${label})` },
      synthetic: false, terrain_real: covered, terrain_modeled: covered, ephemeris_synthetic: false, kind: 'custom', position_basis: 'user',
      terrain_tier: covered ? 'approx500m' : 'flat',
      location: { lat_deg: latDeg, lon_deg: lonDeg, ground_height_m: Math.round(ground * 100) / 100, observer_height_m: eyeM, frame: MOON_FRAME, r_ref_m: R_REF_M },
      provenance: {
        dem: covered
          ? { product: grid.meta.product, resolution_m: grid.spacingM, source: grid.meta.source, license: 'aucune licence indiquée sur les pages PGDA ; citation demandée', citation: grid.meta.citation, position_source: 'saisie de l’utilisateur' }
          : { product: 'FLAT (relief non modélisé)', resolution_m: 0, source: null, license: 'n/a', position_source: 'saisie de l’utilisateur' },
        ephemeris: { engine: 'spice (global.json, calcul dans le navigateur)', kernels: globalDoc.provenance.ephemeris.kernels, abcorr: globalDoc.provenance.ephemeris.abcorr },
        pipeline_version: globalDoc.provenance.pipeline_version, generated_utc: globalDoc.provenance.generated_utc,
      },
      horizon: { az_step_deg: 1.0, elev_deg: horizon.elev_deg, truncated: horizon.truncated, max_distance_km: HORIZON_MAX_M / 1000 },
      time: { start_utc: start, step_s: stepS, count }, bodies, kpis, monthly,
    },
    terrain: buildLocalTerrain(heightFn, latDeg, lonDeg, ground, `custom:${latDeg},${lonDeg}`),
    covered,
  };
}
