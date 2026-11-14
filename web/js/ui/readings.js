// Carte « Soleil et Terre à cet instant » (T-13, INTERFACE § 8) : état descriptif, lectures chiffrées, marge signée, avertissements.
// Tout vient de verdicts.js (mêmes formules que le pipeline) ; l'état ne dépend pas du seuil, seul le binaire « visible » en dépend.
import { siteTimeRange } from '../data.js';
import { formatNumber, formatUtc, t } from '../i18n.js';
import { bodyReading } from '../verdicts.js';

const BODIES = ['sun', 'earth'];
const STATUS_ICON = { hidden: '○', partial: '◐', visible: '●' };
const $ = (id) => document.getElementById(id);

const deg = (v, digits = 3) => `${formatNumber(v, digits)}°`;

/** Marge signée avec son signe toujours écrit (+ / −) : « +2,150° » ou « −0,809° ». */
function signedDeg(v) {
  const text = formatNumber(Math.abs(v), 3);
  return `${v < 0 ? '−' : '+'}${text}°`;
}

/** Crée la carte ; `render(site, state)` la met à jour (instant, seuil, langue, site). */
export function createReadings() {
  function renderBody(site, state, body) {
    const r = bodyReading(site, body, state.tMs, state.threshold);
    const root = document.querySelector(`[data-reading="${body}"]`);
    const chip = root.querySelector('[data-field="status"]');
    chip.textContent = `${STATUS_ICON[r.status]} ${t(`status.${r.status}`)} · ${formatNumber(r.fraction * 100, 1)} %`;
    chip.dataset.status = r.status; // l'icône et le texte portent le sens ; la couleur n'est qu'un renfort
    root.querySelector('[data-field="binary"]').textContent = t(r.visible ? 'verdict.visibleYes' : 'verdict.visibleNo', { mode: t(`verdict.${state.threshold}`) });
    const set = (field, text) => { root.querySelector(`[data-field="${field}"]`).textContent = text; };
    set('az', deg(r.azDeg));
    set('el', deg(r.elDeg));
    set('radius', deg(r.radiusDeg));
    set('horizon', deg(r.horizonDeg));
    set('margin', signedDeg(r.marginDeg));
    return r;
  }

  function render(site, state) {
    const readings = Object.fromEntries(BODIES.map((b) => [b, renderBody(site, state, b)]));
    const earth = readings.earth;
    const link = $('direct-link');
    link.textContent = t(earth.visible ? 'link.possible' : 'link.none', { mode: t(`verdict.${state.threshold}`) });
    link.dataset.possible = String(earth.visible);
    const warnings = [];
    for (const b of BODIES) if (readings[b].truncated) warnings.push(t('warn.truncated', { body: t(`body.${b}`) }));
    if (!readings.sun.inRange) {
      const range = siteTimeRange(site);
      warnings.push(t('time.outOfRange', { start: formatUtc(range.startMs), end: formatUtc(range.endMs) }));
    }
    const box = $('reading-warnings');
    box.replaceChildren(...warnings.map((text) => { const p = document.createElement('p'); p.textContent = text; return p; }));
    box.hidden = warnings.length === 0;
  }

  return { render };
}
