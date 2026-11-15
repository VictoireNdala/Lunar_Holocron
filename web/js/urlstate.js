// État ⇄ fragment d'URL (INTERFACE § 3) : #a=site01-connecting-ridge&b=site04-shackleton-rim&t=2027-03-14T06:00Z&thr=strict&lang=fr&w=30
// Les valeurs invalides sont ignorées sans erreur. Fonctions pures, testées par web/tests/urlstate.test.js.
import { THRESHOLD_MODES } from './constants.js';
import { VIEWS } from './ui/nav.js';

const SITE_ID = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*|custom:-?\d{1,3}(?:\.\d{1,6})?,-?\d{1,3}(?:\.\d{1,6})?)$/; // identifiant du catalogue, ou point libre `custom:lat,lon` (D-027)
const TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})Z$/;
const LANGS = Object.freeze(['fr', 'en', 'sw']);
const WINDOWS = Object.freeze(['7', '30', '365', 'all']);
const PROJ_VIEWS = Object.freeze({ globe: 'atlas', world: 'world', south: 'south', north: 'north' });

/** Instant (ms UTC) → « AAAA-MM-JJTHH:MMZ » (tronqué à la minute). */
function formatTime(tMs) {
  return `${new Date(tMs).toISOString().slice(0, 16)}Z`;
}

/** « AAAA-MM-JJTHH:MMZ » → ms UTC, ou null si invalide (y compris une date impossible comme le 31 février). */
function parseTime(text) {
  const m = TIME.exec(text);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  const back = new Date(ms);
  const same = back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d
    && back.getUTCHours() === h && back.getUTCMinutes() === mi;
  return same ? ms : null;
}

/** État → fragment d'URL. */
export function encode(state) {
  const p = [];
  if (state.view) p.push(`view=${state.view}`);
  if (state.siteIdA) p.push(`a=${state.siteIdA}`);
  if (state.compare && state.siteIdB) p.push(`b=${state.siteIdB}`);
  if (Number.isFinite(state.tMs)) p.push(`t=${formatTime(state.tMs)}`);
  if (state.threshold) p.push(`thr=${state.threshold}`);
  if (state.lang) p.push(`lang=${state.lang}`);
  if (state.windowDays !== undefined) p.push(`w=${state.windowDays}`);
  return `#${p.join('&')}`;
}

/** Fragment d'URL → état partiel (seulement les valeurs valides). */
export function decode(hash) {
  const out = {};
  let params;
  try {
    params = new URLSearchParams((hash || '').replace(/^#/, ''));
  } catch {
    return out;
  }
  const get = (k) => { try { return params.get(k); } catch { return null; } };
  const view = get('view');
  if (VIEWS.includes(view)) out.view = view;
  const proj = get('proj'); // alias de ATLAS § 4 : `proj=globe|world|south|north` désigne la vue d'Atlas correspondante
  if (!out.view && Object.hasOwn(PROJ_VIEWS, proj)) out.view = PROJ_VIEWS[proj];
  const a = get('a');
  if (a && SITE_ID.test(a)) out.siteIdA = a;
  const b = get('b');
  if (b && SITE_ID.test(b)) { out.siteIdB = b; out.compare = true; }
  const t = get('t');
  const tMs = t ? parseTime(t) : null;
  if (tMs !== null) out.tMs = tMs;
  const thr = get('thr');
  if (THRESHOLD_MODES.includes(thr)) out.threshold = thr;
  const lang = get('lang');
  if (LANGS.includes(lang)) out.lang = lang;
  const w = get('w');
  if (WINDOWS.includes(w)) out.windowDays = w === 'all' ? 'all' : Number(w);
  return out;
}
