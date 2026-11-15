// Panorama 360° (T-10, docs/INTERFACE.md § 5) : silhouette du masque d'horizon, boussole, Soleil et Terre, traces ±24 h.
// Fonctions de projection pures (testées) + rendu Canvas 2D. Le calcul fait foi : le masque vient du fichier de site,
// les positions de bodyStateAt ; le dessin ne décide d'aucun verdict.
import { bodySprite, discRadiusPx, earthPhase } from './bodies.js';
import { bodyStateAt, siteTimeRange } from './data.js';
import { wrapDeg } from './geometry.js';
import { horizonAt } from './visibility.js';

const MIN_BODY_RADIUS_PX = 5; // rayon dessiné minimal (taille exagérée signalée, INTERFACE § 5)
const TICK_STEP_DEG = 10;
const CARDINALS = Object.freeze({ 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' });
const TRACK_HOURS = 24;
const HOUR_MS = 3600 * 1000;

/** Fenêtre d'affichage : azimut central et largeur (degrés), plage d'élévation, taille en pixels. */
export function makeView({ centerAzDeg, widthDeg, elMinDeg, elMaxDeg, widthPx, heightPx }) {
  return Object.freeze({
    centerAzDeg: wrapDeg(centerAzDeg), widthDeg, elMinDeg, elMaxDeg, widthPx, heightPx,
    pxPerDegX: widthPx / widthDeg, pxPerDegY: heightPx / (elMaxDeg - elMinDeg),
  });
}

/** Écart d'azimut signé de `azDeg` par rapport à `centerDeg`, dans (−180, 180]. */
export function relativeAzDeg(azDeg, centerDeg) {
  let d = (((azDeg - centerDeg) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

/** (azimut, élévation) → pixel ; `inView` faux si l'azimut sort de la fenêtre (x indique alors le côté). */
export function toScreen(view, azDeg, elDeg) {
  const rel = relativeAzDeg(azDeg, view.centerAzDeg);
  return {
    x: view.widthPx / 2 + rel * view.pxPerDegX,
    y: (view.elMaxDeg - elDeg) * view.pxPerDegY,
    inView: Math.abs(rel) <= view.widthDeg / 2,
  };
}

/** Pixel → (azimut, élévation) : lecture au curseur. */
export function fromScreen(view, x, y) {
  return { azDeg: wrapDeg(view.centerAzDeg + (x - view.widthPx / 2) / view.pxPerDegX), elDeg: view.elMaxDeg - y / view.pxPerDegY };
}

/** Graduations visibles : tous les 10° et tous les 45° (points cardinaux et intercardinaux, codes N…NW). */
export function compassTicks(view) {
  const lo = view.centerAzDeg - view.widthDeg / 2;
  const hi = view.centerAzDeg + view.widthDeg / 2;
  const seen = new Set();
  const ticks = [];
  for (const step of [TICK_STEP_DEG, 45]) {
    for (let k = Math.ceil(lo / step); k * step <= hi; k += 1) {
      const az = wrapDeg(k * step);
      if (seen.has(az) || (view.widthDeg >= 360 && k * step === hi)) continue;
      seen.add(az);
      ticks.push({ azDeg: az, x: view.widthPx / 2 + (k * step - view.centerAzDeg) * view.pxPerDegX, cardinal: CARDINALS[az] ?? null });
    }
  }
  return ticks.sort((a, b) => a.x - b.x);
}

/** Exagération verticale affichée : échelle verticale / échelle horizontale. */
export function verticalExaggeration(view) {
  return view.pxPerDegY / view.pxPerDegX;
}

/** Rayon dessiné d'un corps : échelle réelle (horizontale) ou minimum lisible, avec drapeau « élargi ». */
export function bodyRadiusPx(view, radiusDeg) {
  const real = radiusDeg * view.pxPerDegX;
  return real >= MIN_BODY_RADIUS_PX ? { radiusPx: real, enlarged: false } : { radiusPx: MIN_BODY_RADIUS_PX, enlarged: true };
}

/** Trace d'un corps sur ±24 h (échantillons horaires), limitée à la période couverte. */
function track(site, body, tMs) {
  const { startMs, endMs } = siteTimeRange(site);
  const pts = [];
  for (let h = -TRACK_HOURS; h <= TRACK_HOURS; h += 1) {
    const t = tMs + h * HOUR_MS;
    if (t >= startMs && t <= endMs) pts.push(bodyStateAt(site, body, t));
  }
  return pts;
}

/**
 * Dessine le panorama. `style` : couleurs (lues dans les jetons CSS) ; `labels` : textes localisés.
 * Renvoie ce qui a été dessiné (corps élargis, corps hors fenêtre) pour l'interface.
 */
export function renderPanorama(ctx, view, site, tMs, style, labels) {
  const { widthPx: W, heightPx: H } = view;
  const mask = site.horizon.elev_deg;
  const truncated = site.horizon.truncated;
  ctx.clearRect(0, 0, W, H);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, style.skyTop);
  sky.addColorStop(1, style.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Ligne de l'horizon géométrique (élévation 0).
  const y0 = toScreen(view, view.centerAzDeg, 0).y;
  ctx.strokeStyle = style.grid;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(W, y0); ctx.stroke();
  ctx.setLineDash([]);

  // Traces ±24 h puis corps (dessinés AVANT le relief : le relief passe devant, INTERFACE § 5).
  const drawn = { enlarged: [], offscreen: [], scales: {} };
  for (const body of ['sun', 'earth']) {
    const color = style[body];
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    let prev = null;
    for (const s of track(site, body, tMs)) {
      const p = toScreen(view, s.azDeg, s.elDeg);
      if (prev && p.inView && prev.inView && Math.abs(p.x - prev.x) < W / 2) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      prev = p;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const s = bodyStateAt(site, body, tMs);
    const p = toScreen(view, s.azDeg, s.elDeg);
    const { radiusPx, enlarged, scale } = discRadiusPx(s.radiusDeg, view.pxPerDegX, style.bodyScale ?? 1);
    if (enlarged) drawn.enlarged.push(body);
    drawn.scales[body] = scale;
    if (!p.inView) { drawn.offscreen.push({ body, side: p.x < W / 2 ? 'left' : 'right', azDeg: s.azDeg, y: p.y }); continue; }
    if (body === 'sun') {
      const size = radiusPx * 2 * 2.4; // le sprite : disque (assombrissement centre-bord) + halo additif
      ctx.drawImage(bodySprite('sun', radiusPx), p.x - size / 2, p.y - size / 2, size, size);
    } else {
      const phase = earthPhase(bodyStateAt(site, 'sun', tMs), s); // Terre SCHÉMATIQUE : phase réelle, texture procédurale
      const size = (radiusPx * 2) / 0.9;
      ctx.drawImage(bodySprite('earth', radiusPx, phase), p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.fillStyle = style.text;
    ctx.font = style.labelFont;
    ctx.fillText(labels[body], p.x + radiusPx + 6, p.y - radiusPx - 2);
  }

  // Silhouette du relief (masque d'horizon interpolé, bouclage 360°) ; azimuts « truncated » hachurés.
  ctx.fillStyle = style.terrain;
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 1) ctx.lineTo(x, toScreen(view, 0, horizonAt(mask, fromScreen(view, x, 0).azDeg)).y);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = style.ridge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 1) {
    const y = toScreen(view, 0, horizonAt(mask, fromScreen(view, x, 0).azDeg)).y;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = style.hatch;
  for (let x = 0; x <= W; x += 6) {
    const az = fromScreen(view, x, 0).azDeg;
    if (!truncated[Math.floor(az) % 360]) continue;
    const y = toScreen(view, 0, horizonAt(mask, az)).y;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 6, H); ctx.stroke();
  }

  // Boussole : graduations et étiquettes.
  ctx.fillStyle = style.text;
  ctx.strokeStyle = style.grid;
  ctx.font = style.tickFont;
  ctx.textAlign = 'center';
  for (const t of compassTicks(view)) {
    const major = t.cardinal !== null;
    ctx.beginPath(); ctx.moveTo(t.x, H); ctx.lineTo(t.x, H - (major ? 12 : 6)); ctx.stroke();
    ctx.fillText(major ? labels.cardinals[t.cardinal] : `${Math.round(t.azDeg)}°`, t.x, H - (major ? 16 : 10));
  }
  ctx.textAlign = 'start';

  // Flèches pour les corps hors fenêtre.
  for (const o of drawn.offscreen) {
    const x = o.side === 'left' ? 10 : W - 10;
    const y = Math.min(Math.max(o.y, 14), H - 30);
    ctx.fillStyle = style[o.body];
    ctx.beginPath();
    if (o.side === 'left') { ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y - 7); ctx.lineTo(x + 6, y + 7); } else { ctx.moveTo(x + 6, y); ctx.lineTo(x - 6, y - 7); ctx.lineTo(x - 6, y + 7); }
    ctx.fill();
    ctx.fillStyle = style.text;
    ctx.textAlign = o.side === 'left' ? 'left' : 'right';
    ctx.fillText(`${labels[o.body]} ${Math.round(o.azDeg)}°`, o.side === 'left' ? x + 10 : x - 10, y + 4);
    ctx.textAlign = 'start';
  }
  return drawn;
}
