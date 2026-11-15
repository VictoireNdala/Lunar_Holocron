// Carte « Point libre » (V2-02, D-027) : saisie d'une latitude et d'une longitude ; le calcul est fait par main.js (freepoint.js) dans le navigateur.
// Le point n'est jamais écrit dans l'index ni sur disque ; il est seulement dans le fragment d'URL (`a=custom:lat,lon`) pour être partageable.
import { formatNumber, t } from '../i18n.js';
import { parseCoordinates } from '../freepoint.js';

const $ = (id) => document.getElementById(id);
const CUSTOM_ID = /^custom:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;
const COORD_DECIMALS = 4; // ≈ 3 m sur la Lune : au-delà, la grille 480 m ne distingue rien

/** Crée la carte ; `render(site, state)` préremplit les champs et affiche le résultat. */
export function createFreePointPanel(store) {
  function status(text) {
    $('fp-status').textContent = text ?? '';
    $('fp-status').hidden = !text;
  }

  $('fp-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const coords = parseCoordinates($('fp-lat').value.replace(',', '.'), $('fp-lon').value.replace(',', '.'));
    if (!coords) { status(t('freepoint.invalid')); return; }
    status(null);
    const id = `custom:${Number(coords.latDeg.toFixed(COORD_DECIMALS))},${Number(coords.lonDeg.toFixed(COORD_DECIMALS))}`;
    store.set({ siteIdA: id, view: 'site' });
  });

  return {
    render(site) {
      const m = CUSTOM_ID.exec(site?.id ?? '');
      if (m && document.activeElement !== $('fp-lat') && document.activeElement !== $('fp-lon')) {
        $('fp-lat').value = m[1];
        $('fp-lon').value = m[2];
        status(t('freepoint.loaded', { lat: formatNumber(Number(m[1]), 4), lon: formatNumber(Number(m[2]), 4) }));
      } else if (!m) {
        status(null);
      }
    },
  };
}
