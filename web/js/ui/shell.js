// Coque (UI-DESIGN § 5.1-5.2, U-02) : rail repliable, navigation par vues (fragment `view=`), raccourcis clavier.
// L'état reste dans store.js (une seule source de vérité) ; ce module ne fait que l'afficher et le modifier.
import { t } from '../i18n.js';
import { encode } from '../urlstate.js';
import { IMPLEMENTED_VIEWS, VIEWS, isTypingTarget, railKeyTarget } from './nav.js';

const RAIL_KEY = 'lh.rail.expanded'; // mémorisation locale du rail (application 100 % client)
const RAIL_SHORTCUT = '['; // bascule du rail au clavier
const $ = (id) => document.getElementById(id);

function readRailPreference() {
  try { return window.localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; }
}

function writeRailPreference(expanded) {
  try { window.localStorage.setItem(RAIL_KEY, expanded ? '1' : '0'); } catch { /* stockage indisponible : sans effet */ }
}

/** Branche la coque ; renvoie `render(state, siteName)` à appeler à chaque changement d'état. */
export function createShell(store) {
  const rail = $('rail');
  const toggle = $('rail-toggle');
  const items = [...document.querySelectorAll('.rail-item')];

  function setExpanded(expanded) {
    rail.classList.toggle('expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.querySelector('use').setAttribute('href', `./vendor/icons/sprite.svg#i-panel-left-${expanded ? 'close' : 'open'}`);
    toggle.querySelector('.rail-label').textContent = t(expanded ? 'nav.collapse' : 'nav.expand');
    writeRailPreference(expanded);
  }

  function go(view) {
    store.set({ view });
    $('main').focus({ preventScroll: true });
  }

  toggle.addEventListener('click', () => setExpanded(!rail.classList.contains('expanded')));
  items.forEach((item, k) => {
    item.addEventListener('click', (e) => { e.preventDefault(); go(item.dataset.view); });
    item.addEventListener('keydown', (e) => {
      const target = railKeyTarget(k, e.key, items.length);
      if (target !== null) { e.preventDefault(); items[target].focus(); }
    });
  });
  for (const link of document.querySelectorAll('[data-goto]')) {
    link.addEventListener('click', (e) => { e.preventDefault(); go(link.dataset.goto); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === RAIL_SHORTCUT && !e.ctrlKey && !e.metaKey && !e.altKey && !isTypingTarget(document.activeElement)) {
      setExpanded(!rail.classList.contains('expanded'));
    }
  });
  setExpanded(readRailPreference());

  return {
    /** Vue active, `aria-current`, liens à jour, fil d'Ariane. */
    render(state, siteName, siteReady) {
      const view = VIEWS.includes(state.view) ? state.view : 'site';
      for (const item of items) {
        const active = item.dataset.view === view;
        if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
        item.setAttribute('href', encode({ ...state, view: item.dataset.view }));
        const label = item.querySelector('.rail-label');
        const soon = IMPLEMENTED_VIEWS.includes(item.dataset.view) ? '' : ` · ${t('nav.soon')}`;
        label.textContent = t(`nav.${item.dataset.view}`) + soon;
        let short = item.querySelector('.rail-short');
        if (!short) { short = document.createElement('span'); short.className = 'rail-short'; short.setAttribute('aria-hidden', 'true'); item.append(short); }
        short.textContent = t(`nav.short.${item.dataset.view}`);
        item.setAttribute('aria-label', label.textContent);
      }
      for (const panel of document.querySelectorAll('[data-view-panel]')) {
        panel.hidden = panel.dataset.viewPanel !== view || (panel.id === 'panel-a' && !siteReady);
      }
      $('scene').hidden = view !== 'site';
      $('crumb').textContent = view === 'site' && siteName ? siteName : t(`nav.${view}`);
      toggle.querySelector('.rail-label').textContent = t(rail.classList.contains('expanded') ? 'nav.collapse' : 'nav.expand');
    },
  };
}
