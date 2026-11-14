// Panneaux repliables de la vue de site (demande de l'humain, 2026-11-14) : chaque panneau peut être réduit en pastille
// et rouvert à tout moment ; « Scène seule » masque tout pour manipuler le relief 3D. L'état est mémorisé (localStorage,
// avec repli silencieux). Fonctions pures en tête de fichier (testées), liaison au DOM ensuite.
import { t } from '../i18n.js';

/** Panneaux de la vue de site, dans l'ordre canonique (identifiant = attribut `data-panel`). */
export const PANEL_IDS = Object.freeze(['verdict', 'view3d', 'bodies', 'compare', 'site', 'panorama', 'timeline', 'time', 'layers']);
const STORAGE_HIDDEN = 'lh.panels.hidden';
const STORAGE_RESTORE = 'lh.panels.restore';

/** Liste d'identifiants repliés depuis un texte « a,b » ; identifiants inconnus et doublons ignorés. */
export function parseHidden(raw) {
  if (typeof raw !== 'string') return [];
  const wanted = new Set(raw.split(',').map((s) => s.trim()));
  return PANEL_IDS.filter((id) => wanted.has(id));
}

/** Texte « a,b » dans l'ordre canonique. */
export function serializeHidden(ids) {
  return PANEL_IDS.filter((id) => ids.includes(id)).join(',');
}

/** Replie ou rouvre un panneau ; renvoie une nouvelle liste (l'entrée n'est pas modifiée). */
export function togglePanel(hidden, id) {
  if (!PANEL_IDS.includes(id)) throw new RangeError(`panneau inconnu : ${id}`);
  const next = hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id];
  return PANEL_IDS.filter((x) => next.includes(x));
}

/** Vrai si tous les panneaux de la portée (par défaut : tous) sont repliés. */
export function isSceneOnly(hidden, scope = PANEL_IDS) {
  return scope.length > 0 && scope.every((id) => hidden.includes(id));
}

/**
 * Bascule « scène seule » pour les panneaux de la portée (ceux de la vue courante) : cache tout en retenant l'état à restaurer,
 * ou restaure l'état retenu. Les panneaux des autres vues ne sont pas touchés.
 */
export function toggleSceneOnly(hidden, restore, scope = PANEL_IDS) {
  if (isSceneOnly(hidden, scope)) {
    const back = restore.filter((id) => scope.includes(id));
    return { hidden: PANEL_IDS.filter((id) => (scope.includes(id) ? back.includes(id) : hidden.includes(id))), restore: [] };
  }
  return { hidden: PANEL_IDS.filter((id) => hidden.includes(id) || scope.includes(id)), restore: PANEL_IDS.filter((id) => hidden.includes(id) && scope.includes(id)) };
}

function read(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* stockage indisponible : sans effet */ }
}

const $ = (id) => document.getElementById(id);

/** Branche les boutons de réduction, les pastilles de restauration et « Scène seule » ; renvoie `{ refresh }`. */
export function createPanels() {
  let hidden = parseHidden(read(STORAGE_HIDDEN));
  let restore = parseHidden(read(STORAGE_RESTORE));
  const panels = new Map([...document.querySelectorAll('[data-panel]')].map((el) => [el.dataset.panel, el]));
  const tray = $('tray');
  const sceneBtn = $('scene-only');
  const viewOf = () => document.body.dataset.view || 'site';
  // Panneaux de la vue courante : `data-panel-view` = liste de vues (« site atlas »).
  const scopeOf = () => PANEL_IDS.filter((id) => panels.has(id) && (panels.get(id).dataset.panelView ?? 'site').split(' ').includes(viewOf()));

  function save() {
    write(STORAGE_HIDDEN, serializeHidden(hidden));
    write(STORAGE_RESTORE, serializeHidden(restore));
  }

  function refresh() {
    const scope = scopeOf();
    for (const [id, el] of panels) el.classList.toggle('panel-collapsed', hidden.includes(id));
    const shownChips = scope.filter((id) => hidden.includes(id));
    tray.hidden = shownChips.length === 0;
    tray.replaceChildren(...shownChips.map((id) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tray-chip';
      chip.dataset.panel = `tray-${id}`;
      chip.textContent = t(panels.get(id).dataset.panelTitle);
      chip.setAttribute('aria-label', t('panel.restore', { name: chip.textContent }));
      chip.addEventListener('click', () => { hidden = togglePanel(hidden, id); save(); refresh(); });
      return chip;
    }));
    for (const btn of document.querySelectorAll('.panel-min')) {
      const name = t(panels.get(btn.dataset.target).dataset.panelTitle);
      btn.setAttribute('aria-label', t('panel.minimize', { name }));
      btn.title = t('panel.minimize', { name });
    }
    const only = isSceneOnly(hidden, scope);
    sceneBtn.hidden = scope.length === 0;
    sceneBtn.setAttribute('aria-pressed', String(only));
    sceneBtn.querySelector('.scene-label').textContent = t(only ? 'panel.showAll' : 'panel.sceneOnly');
    sceneBtn.querySelector('use').setAttribute('href', `./vendor/icons/sprite.svg#i-${only ? 'eye' : 'eye-off'}`);
  }

  for (const [id, el] of panels) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-min';
    btn.dataset.target = id;
    btn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="./vendor/icons/sprite.svg#i-minus"></use></svg>';
    btn.addEventListener('click', () => { hidden = togglePanel(hidden, id); save(); refresh(); });
    el.prepend(btn);
  }
  sceneBtn.addEventListener('click', () => {
    ({ hidden, restore } = toggleSceneOnly(hidden, restore, scopeOf()));
    save();
    refresh();
  });
  refresh();
  return { refresh };
}
