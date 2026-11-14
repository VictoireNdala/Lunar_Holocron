// Fonctions pures de l'Atlas (A-02, docs/ATLAS.md § 6) : aucun three.js, aucun DOM. Testées contre tests/golden/atlas_sphere.json.
// Convention du globe (écrite ici ET dans le test) : lat 0 / lon 0 → +x ; nord → +y ; lon +90° → −z.
// Vu de l'extérieur depuis +x (haut = +y), l'Est apparaît donc à DROITE, comme sur un globe ordinaire.
const DEG = Math.PI / 180;
const MDEG_PER_DEG = 1000;
const POLE_EPS_DEG = 1e-9; // en deçà, le sub-solaire est considéré à l'équateur (terminateur vertical)

/** Longitude ramenée dans [−180, 180). */
export function wrapLonDeg(lonDeg) {
  const w = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  return w;
}

/** (latitude, longitude) en degrés → vecteur unitaire {x, y, z}. */
export function latLonToVector(latDeg, lonDeg) {
  const la = latDeg * DEG;
  const lo = lonDeg * DEG;
  return { x: Math.cos(la) * Math.cos(lo), y: Math.sin(la), z: -Math.cos(la) * Math.sin(lo) };
}

/** Vecteur (non nécessairement unitaire) → {latDeg, lonDeg} ; longitude dans [−180, 180). */
export function vectorToLatLon(v) {
  const norm = Math.hypot(v.x, v.y, v.z);
  return { latDeg: Math.asin(Math.min(Math.max(v.y / norm, -1), 1)) / DEG, lonDeg: wrapLonDeg(Math.atan2(-v.z, v.x) / DEG) };
}

/** Distance angulaire (degrés) entre deux points : angle entre les vecteurs (atan2 du produit vectoriel et scalaire, stable). */
export function angularDistanceDeg(lat1, lon1, lat2, lon2) {
  const a = latLonToVector(lat1, lon1);
  const b = latLonToVector(lat2, lon2);
  const cross = Math.hypot(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return Math.atan2(cross, dot) / DEG;
}

/** Points du grand cercle à 90° du point sub-solaire (terminateur), `n` points régulièrement répartis. */
export function terminatorCircle(subLatDeg, subLonDeg, n = 180) {
  const s = latLonToVector(subLatDeg, subLonDeg);
  const helper = Math.abs(s.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const unit = (v) => { const m = Math.hypot(v.x, v.y, v.z); return { x: v.x / m, y: v.y / m, z: v.z / m }; };
  const e1 = unit(cross(s, helper));
  const e2 = cross(s, e1);
  return Array.from({ length: n }, (_, k) => {
    const a = (2 * Math.PI * k) / n;
    return vectorToLatLon({ x: Math.cos(a) * e1.x + Math.sin(a) * e2.x, y: Math.cos(a) * e1.y + Math.sin(a) * e2.y, z: Math.cos(a) * e1.z + Math.sin(a) * e2.z });
  });
}

/**
 * Latitude du terminateur à la longitude donnée : tan φ = −cos(λ − λ☉) / tan φ☉ (ATLAS § 5.2).
 * Renvoie null quand le Soleil est à l'équateur (φ☉ ≈ 0) : le terminateur est alors le couple de méridiens λ☉ ± 90°.
 */
export function terminatorLatitudeDeg(lonDeg, subLatDeg, subLonDeg) {
  if (Math.abs(subLatDeg) < POLE_EPS_DEG) return null;
  return Math.atan(-Math.cos((lonDeg - subLonDeg) * DEG) / Math.tan(subLatDeg * DEG)) / DEG;
}

/** (lat, lon) → pixel (x, y) d'une carte équirectangulaire w × h, longitude 0° au centre, nord en haut. */
export function equirectPixel(latDeg, lonDeg, w, h) {
  return { x: ((lonDeg + 180) / 360) * w, y: ((90 - latDeg) / 180) * h };
}

/** Pixel → (lat, lon). */
export function equirectLatLon(x, y, w, h) {
  return { latDeg: 90 - (y / h) * 180, lonDeg: wrapLonDeg((x / w) * 360 - 180) };
}

/** Stéréographique polaire Sud : ρ = 2R·tan((φ + 90°)/2), x = ρ·sin λ, y = ρ·cos λ (même convention que pipeline/projection.py). */
export function southPolar(latDeg, lonDeg, radiusM) {
  const rho = 2 * radiusM * Math.tan(((latDeg + 90) * DEG) / 2);
  return { x: rho * Math.sin(lonDeg * DEG), y: rho * Math.cos(lonDeg * DEG) };
}

/** Inverse de southPolar. */
export function southPolarInverse(x, y, radiusM) {
  return { latDeg: (2 * Math.atan(Math.hypot(x, y) / (2 * radiusM))) / DEG - 90, lonDeg: wrapLonDeg(Math.atan2(x, y) / DEG) };
}

/** Stéréographique polaire Nord : ρ = 2R·tan((90° − φ)/2), x = ρ·sin λ, y = −ρ·cos λ (longitude 0° vers le bas). */
export function northPolar(latDeg, lonDeg, radiusM) {
  const rho = 2 * radiusM * Math.tan(((90 - latDeg) * DEG) / 2);
  return { x: rho * Math.sin(lonDeg * DEG), y: -rho * Math.cos(lonDeg * DEG) };
}

/** Inverse de northPolar. */
export function northPolarInverse(x, y, radiusM) {
  return { latDeg: 90 - (2 * Math.atan(Math.hypot(x, y) / (2 * radiusM))) / DEG, lonDeg: wrapLonDeg(Math.atan2(x, -y) / DEG) };
}

/**
 * Point sub-solaire (ou sub-terrestre) à l'instant tMs : latitude interpolée linéairement, longitude sur le cercle (saut ±180 géré).
 * `series` = { t0Ms, stepMs, latMdeg[], lonMdeg[] } ; hors période : valeur de la borne, `inRange: false` (comme bodyStateAt).
 */
export function interpolateSubPoint(series, tMs) {
  if (!Number.isFinite(tMs)) throw new TypeError(`instant invalide : ${tMs}`);
  const last = series.latMdeg.length - 1;
  const raw = (tMs - series.t0Ms) / series.stepMs;
  const inRange = raw >= 0 && raw <= last;
  const i = Math.min(Math.max(raw, 0), last);
  const i0 = Math.floor(i);
  const i1 = Math.min(i0 + 1, last);
  const w = i - i0;
  const lon0 = series.lonMdeg[i0] / MDEG_PER_DEG;
  let dLon = series.lonMdeg[i1] / MDEG_PER_DEG - lon0;
  if (dLon > 180) dLon -= 360; else if (dLon < -180) dLon += 360;
  const lat0 = series.latMdeg[i0] / MDEG_PER_DEG;
  return { latDeg: lat0 + w * (series.latMdeg[i1] / MDEG_PER_DEG - lat0), lonDeg: wrapLonDeg(lon0 + w * dLon), inRange };
}
