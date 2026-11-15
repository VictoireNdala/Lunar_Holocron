// Chargement et lecture des fichiers de données (docs/CONTRAT-DONNEES.md). Aucun accès réseau externe :
// les chemins sont relatifs à la page. `fetch` est injectable pour les tests (node --test).
import { decodePolarGrid } from './freepoint.js';
import { MDEG_PER_DEG, N_AZIMUTHS, SUPPORTED_SCHEMA_MAJOR } from './constants.js';
import { lerpAzMdeg } from './geometry.js';

const BODIES = Object.freeze(['sun', 'earth']);
const SERIES = Object.freeze(['az_mdeg', 'el_mdeg', 'radius_mdeg']);
const UINT16_MAX = 65535;

/** Erreur de données avec un code stable, traduit par l'interface (i18n `error.<code>`). */
export class DataError extends Error {
  constructor(code, { url = null, status = null, details = [] } = {}) {
    super(`${code}${url ? ` (${url})` : ''}${details.length ? ` : ${details.join(' ; ')}` : ''}`);
    this.name = 'DataError';
    this.code = code; // 'missing' | 'network' | 'invalid-json' | 'schema-version' | 'contract' | 'unknown-site'
    this.url = url;
    this.status = status;
    this.details = details;
  }
}

/** Contrôle de la version majeure (CONTRAT § 7.1) ; renvoie une liste d'erreurs. */
function checkVersion(doc) {
  const v = doc && typeof doc.schema_version === 'string' ? doc.schema_version : '';
  const major = Number.parseInt(v.split('.')[0], 10);
  return /^\d+\.\d+$/.test(v) && major === SUPPORTED_SCHEMA_MAJOR ? [] : [`schema_version: "${v}" (attendu ${SUPPORTED_SCHEMA_MAJOR}.x)`];
}

/** Contrôles légers d'un index (la validation complète est faite par pipeline/validate.py). */
export function checkIndex(doc) {
  const errors = checkVersion(doc);
  if (errors.length) return errors;
  if (!Array.isArray(doc.sites) || doc.sites.length === 0) errors.push('sites: liste vide ou absente');
  else doc.sites.forEach((s, k) => {
    if (typeof s.id !== 'string' || typeof s.site_file !== 'string') errors.push(`sites[${k}]: id ou site_file manquant`);
  });
  return errors;
}

/** Contrôles légers d'un site : version, longueurs (CONTRAT § 7.2). */
export function checkSite(doc) {
  const errors = checkVersion(doc);
  if (errors.length) return errors;
  const count = doc.time?.count;
  if (!Number.isInteger(count) || count < 1) return ['time.count: entier ≥ 1 attendu'];
  for (const key of ['elev_deg', 'truncated']) {
    const n = doc.horizon?.[key]?.length;
    if (n !== N_AZIMUTHS) errors.push(`horizon.${key}: longueur ${n}, attendu ${N_AZIMUTHS}`);
  }
  for (const body of BODIES) for (const key of SERIES) {
    const n = doc.bodies?.[body]?.[key]?.length;
    if (n !== count) errors.push(`bodies.${body}.${key}: longueur ${n}, attendu ${count}`);
  }
  return errors;
}

/** Période couverte par un site, en millisecondes UTC. */
export function siteTimeRange(site) {
  const startMs = Date.parse(site.time.start_utc);
  const stepMs = site.time.step_s * 1000;
  const count = site.time.count;
  return { startMs, stepMs, count, endMs: startMs + (count - 1) * stepMs };
}

/**
 * État d'un corps à l'instant tMs : interpolation linéaire entre échantillons, azimut déroulé (CONTRAT § 3).
 * Hors période : pas d'extrapolation, valeur bornée et `inRange: false`.
 */
export function bodyStateAt(site, body, tMs) {
  if (!BODIES.includes(body)) throw new TypeError(`corps inconnu : ${body}`);
  if (!Number.isFinite(tMs)) throw new TypeError(`instant invalide : ${tMs}`);
  const { startMs, stepMs, count } = siteTimeRange(site);
  const raw = (tMs - startMs) / stepMs;
  const inRange = raw >= 0 && raw <= count - 1;
  const i = Math.min(Math.max(raw, 0), count - 1);
  const i0 = Math.floor(i);
  const i1 = Math.min(i0 + 1, count - 1);
  const w = i - i0;
  const s = site.bodies[body];
  const lerp = (a) => a[i0] + w * (a[i1] - a[i0]);
  return {
    azDeg: lerpAzMdeg(s.az_mdeg[i0], s.az_mdeg[i1], w) / MDEG_PER_DEG,
    elDeg: lerp(s.el_mdeg) / MDEG_PER_DEG,
    radiusDeg: lerp(s.radius_mdeg) / MDEG_PER_DEG,
    inRange,
  };
}

/** Lit une réponse HTTP ; traduit les échecs en DataError explicites. */
async function request(fetchFn, url, kind) {
  let res;
  try {
    res = await fetchFn(url);
  } catch {
    throw new DataError('network', { url });
  }
  if (!res.ok) throw new DataError('missing', { url, status: res.status });
  try {
    return kind === 'binary' ? await res.arrayBuffer() : await res.json();
  } catch {
    throw new DataError('invalid-json', { url });
  }
}

/** Contrôle un document chargé ; lève DataError si nécessaire. */
function ensure(errors, url) {
  if (!errors.length) return;
  const code = errors[0].startsWith('schema_version') ? 'schema-version' : 'contract';
  throw new DataError(code, { url, details: errors });
}

/** Décode la grille de terrain uint16 little-endian en hauteurs (CONTRAT § 6). */
function decodeHeights(meta, buffer, url) {
  const n = meta.grid.n;
  if (buffer.byteLength !== n * n * 2) {
    throw new DataError('contract', { url, details: [`${buffer.byteLength} octets, attendu ${n * n * 2}`] });
  }
  const view = new DataView(buffer);
  const { min_m: min, max_m: max } = meta.z;
  const heightsM = new Float32Array(n * n);
  for (let k = 0; k < n * n; k += 1) heightsM[k] = min + (view.getUint16(2 * k, true) / UINT16_MAX) * (max - min);
  return heightsM;
}

/** Charge un terrain seul (métadonnées + .bin) depuis son URL de métadonnées ; sert aussi aux aperçus du relief réel. */
export async function loadTerrainFile(metaUrl, fetchFn = (url) => globalThis.fetch(url)) {
  const meta = await request(fetchFn, metaUrl, 'json');
  ensure(checkVersion(meta), metaUrl);
  const binUrl = metaUrl.slice(0, metaUrl.lastIndexOf('/') + 1) + meta.z.file;
  return { meta, heightsM: decodeHeights(meta, await request(fetchFn, binUrl, 'binary'), binUrl) };
}

/** Contrôles légers de global.json (la validation complète est faite par pipeline/validate.py). */
export function checkGlobal(doc) {
  const errors = checkVersion(doc);
  if (errors.length) return errors;
  const n = doc.time?.n;
  if (!Number.isInteger(n) || n < 1) return ['time.n: entier ≥ 1 attendu'];
  for (const body of ['sun', 'earth']) for (const key of ['lat_mdeg', 'lon_mdeg', 'radius_mdeg']) {
    const got = doc[body]?.[key]?.length;
    if (got !== n) errors.push(`${body}.${key}: longueur ${got}, attendu ${n}`);
  }
  return errors;
}

/** Séries d'un corps de global.json au format de `interpolateSubPoint` (atlas/sphere.js). */
export function globalSeries(doc, body) {
  return { t0Ms: Date.parse(doc.time.t0_utc), stepMs: doc.time.step_s * 1000, latMdeg: doc[body].lat_mdeg, lonMdeg: doc[body].lon_mdeg };
}

/** Source de données relative à `root` (ex. 'data/'), avec cache mémoire. */
export function createDataSource(root, fetchFn = (url) => globalThis.fetch(url)) {
  let indexPromise = null;
  let globalPromise = null;
  let polarPromise = null;
  let tilesPromise = null;
  const sites = new Map();
  const terrains = new Map();

  async function loadIndex() {
    if (!indexPromise) {
      const url = `${root}index.json`;
      indexPromise = request(fetchFn, url, 'json').then((doc) => { ensure(checkIndex(doc), url); return doc; });
      indexPromise.catch(() => { indexPromise = null; });
    }
    return indexPromise;
  }

  /** Éphémérides globales de l'Atlas (facultatives : un dossier sans global.json lève DataError « missing »). */
  async function loadGlobal() {
    if (!globalPromise) {
      const url = `${root}global.json`;
      globalPromise = request(fetchFn, url, 'json').then((doc) => { ensure(checkGlobal(doc), url); return doc; });
      globalPromise.catch(() => { globalPromise = null; });
    }
    return globalPromise;
  }

  /** Grille polaire 480 m (point libre) : métadonnées + octets, décodées ; mise en cache. */
  async function loadPolarGrid() {
    if (!polarPromise) {
      const url = `${root}polar/ldem_south_500m.json`;
      polarPromise = request(fetchFn, url, 'json').then(async (meta) => {
        const binUrl = `${root}polar/${meta.z.file}`;
        return decodePolarGrid(meta, await request(fetchFn, binUrl, 'binary'));
      });
      polarPromise.catch(() => { polarPromise = null; });
    }
    return polarPromise;
  }

  /** Manifeste de la pyramide de tuiles du fond polaire (polar/tiles.json) ; échoue si le dossier n'en a pas (le fond garde alors le 480 m). */
  function loadPolarTiles() {
    tilesPromise ??= request(fetchFn, `${root}polar/tiles.json`, 'json');
    tilesPromise.catch(() => { tilesPromise = null; });
    return tilesPromise;
  }

  /** Octets d'une tuile (fichier .bin compressé). */
  async function loadPolarTile(spacingM, tx, ty) {
    return new Uint8Array(await request(fetchFn, `${root}polar/tiles/${spacingM}/${tx}_${ty}.bin`, 'binary'));
  }

  async function entryOf(id) {
    const entry = (await loadIndex()).sites.find((s) => s.id === id);
    if (!entry) throw new DataError('unknown-site', { details: [id] });
    return entry;
  }

  async function loadSite(id) {
    if (!sites.has(id)) {
      const promise = entryOf(id).then(async (entry) => {
        const url = root + entry.site_file;
        const doc = await request(fetchFn, url, 'json');
        ensure(checkSite(doc), url);
        return doc;
      });
      sites.set(id, promise);
      promise.catch(() => sites.delete(id));
    }
    return sites.get(id);
  }

  async function loadTerrain(id) {
    if (!terrains.has(id)) {
      const promise = entryOf(id).then((entry) => loadTerrainFile(root + entry.terrain_file, fetchFn));
      terrains.set(id, promise);
      promise.catch(() => terrains.delete(id));
    }
    return terrains.get(id);
  }

  return { root, loadIndex, loadSite, loadTerrain, loadGlobal, loadPolarGrid, loadPolarTiles, loadPolarTile };
}
