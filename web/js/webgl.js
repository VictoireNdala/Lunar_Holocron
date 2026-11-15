// Détection et création de WebGL (M-064 § 2) : un seul test mémorisé, un renderer créé avec repli sans anticrénelage, libération propre du contexte, informations de diagnostic.
// Sans dépendance à three.js (testable) : `createRenderer` reçoit le constructeur de three.js.

export class WebGLUnavailableError extends Error {
  constructor(detail = '') { super(`WebGL indisponible${detail ? ` : ${detail}` : ''}`); this.name = 'WebGLUnavailableError'; this.code = 'webgl-unavailable'; }
}

let cached = null;

/** Oubli du résultat mémorisé (tests). */
export function resetWebGLDetection() { cached = null; }

/**
 * Teste une seule fois si un contexte WebGL peut être créé : { available, version (2 | 1 | 0), vendor, renderer, error }.
 * `failIfMajorPerformanceCaveat` est faux : un rendu logiciel (SwiftShader) compte comme disponible. `makeCanvas` est injectable pour les tests.
 */
export function detectWebGL(makeCanvas = () => document.createElement('canvas')) {
  if (cached) return cached;
  const result = { available: false, version: 0, vendor: null, renderer: null, error: null };
  try {
    const canvas = makeCanvas();
    const attrs = { failIfMajorPerformanceCaveat: false };
    let gl = canvas.getContext('webgl2', attrs);
    if (gl) result.version = 2;
    else {
      gl = canvas.getContext('webgl', attrs) ?? canvas.getContext('experimental-webgl', attrs);
      if (gl) result.version = 1;
    }
    if (gl) {
      result.available = true;
      try {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        result.vendor = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : (gl.getParameter(gl.VENDOR) ?? null);
        result.renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : (gl.getParameter(gl.RENDERER) ?? null);
      } catch { /* informations facultatives */ }
      gl.getExtension?.('WEBGL_lose_context')?.loseContext?.(); // on rend le contexte de test : Chrome en limite le nombre
    } else result.error = 'getContext a renvoyé null';
  } catch (err) {
    result.error = err?.message ?? String(err);
  }
  cached = result;
  return result;
}

/** Texte de diagnostic (#debug) : version, moteur, fabricant. */
export function webglInfoText(info = detectWebGL()) {
  if (!info.available) return `WebGL: indisponible (${info.error ?? 'raison inconnue'})`;
  return `WebGL ${info.version === 2 ? '2' : '1'} · renderer: ${info.renderer ?? '?'} · vendor: ${info.vendor ?? '?'}`;
}

/**
 * Crée un `THREE.WebGLRenderer` : d'abord avec anticrénelage, puis sans (certains pilotes le refusent) ; si la détection a déjà échoué, lève WebGLUnavailableError sans essayer.
 * Toute autre erreur est relancée telle quelle après la seconde tentative (jamais déguisée en « WebGL absent »).
 */
export function createRenderer(THREE, options = {}, detect = detectWebGL) {
  const info = detect();
  if (!info.available) throw new WebGLUnavailableError(info.error ?? '');
  try {
    return new THREE.WebGLRenderer({ antialias: true, ...options });
  } catch (first) {
    console.warn('[webgl] création avec anticrénelage refusée, nouvel essai sans :', first); // eslint-disable-line no-console
    return new THREE.WebGLRenderer({ ...options, antialias: false });
  }
}

/** Libère un renderer ET son contexte (le nombre de contextes WebGL d'une page est limité). */
export function releaseRenderer(renderer) {
  try { renderer.dispose(); } catch { /* déjà libéré */ }
  try { renderer.forceContextLoss(); } catch { /* sans effet */ }
  renderer.domElement?.remove?.();
}
