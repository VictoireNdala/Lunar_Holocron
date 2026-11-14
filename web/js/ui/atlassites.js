// Fiche d'un site sur l'Atlas et visite guidée des sites prioritaires (S-03, S-04). Valable pour le globe et les trois cartes.
// La fiche vient de l'index.json (léger) ; « Voir le site » ouvre la vue de site. La visite n'avance que sur clic (pas de minuterie).
import { siteSheet, tourOrder, tourPosition } from '../atlas/sitesheet.js';
import { formatNumber, getLang, t } from '../i18n.js';

const $ = (id) => document.getElementById(id);

/** Crée la fiche et la visite ; `openSite(id)` ouvre la vue de site. `setEntries(index.sites)` fournit les sites. */
export function createAtlasSites(store, atlas, openSite) {
  let entries = [];
  let touring = false;

  const select = (id) => store.set({ selectedSiteId: id });

  function chip(text, kind) {
    const li = document.createElement('li');
    li.textContent = text;
    if (kind) li.className = kind;
    return li;
  }

  function fact(dl, term, value) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.append(dt, dd);
  }

  /** Centre la caméra du globe sur le site (les cartes 2D sont fixes : l'anneau de sélection suffit). */
  function focus(id) {
    const entry = entries.find((e) => e.id === id);
    if (entry) atlas.flyTo(entry.lat_deg, entry.lon_deg);
  }

  function render() {
    const id = store.get().selectedSiteId;
    const entry = entries.find((e) => e.id === id);
    const order = tourOrder(entries);
    const pos = entry ? tourPosition(order, id) : null;
    if (touring && !pos) touring = false; // la sélection est sortie de la visite (clic sur un autre marqueur)
    $('site-sheet').hidden = !entry;
    $('tour-start').hidden = touring;
    $('tour-start').disabled = order.length === 0;
    if (!entry) return;
    const sheet = siteSheet(entry);
    const name = entry.name[getLang()] ?? entry.name.en;
    $('sheet-name').textContent = name;
    $('sheet-chips').replaceChildren(
      chip(t(sheet.tierKey)),
      chip(t(sheet.reliefKey), sheet.synthetic ? 'chip-demo' : 'chip-real'),
      chip(t(sheet.ephemerisKey), entry.ephemeris_synthetic ? 'chip-demo' : 'chip-real'),
    );
    const facts = $('sheet-facts');
    facts.replaceChildren();
    fact(facts, t('sheet.coords'), `${formatNumber(sheet.latDeg, 3)}° ; ${formatNumber(sheet.lonDeg, 3)}°`);
    fact(facts, t('sheet.coordsStatus'), t(sheet.coordsKey));
    if (sheet.pgdaId) fact(facts, t('sheet.pgda'), sheet.pgdaId);
    if (entry.tier) fact(facts, t('sheet.region'), sheet.region ?? t('sheet.regionNone'));
    $('tour-status').hidden = !touring;
    if (touring) $('tour-status').textContent = t('tour.status', { n: pos.index + 1, total: pos.total });
    $('tour-prev').hidden = !touring || !pos.previousId;
    $('tour-next').hidden = !touring || !pos.nextId;
    $('tour-stop').hidden = !touring;
  }

  function step(delta) {
    const order = tourOrder(entries);
    const pos = tourPosition(order, store.get().selectedSiteId);
    const target = pos && (delta < 0 ? pos.previousId : pos.nextId);
    if (!target) return;
    focus(target);
    select(target);
  }

  $('tour-start').addEventListener('click', () => {
    const order = tourOrder(entries);
    if (!order.length) return;
    touring = true;
    focus(order[0]);
    if (store.get().selectedSiteId === order[0]) render(); else select(order[0]);
  });
  $('tour-prev').addEventListener('click', () => step(-1));
  $('tour-next').addEventListener('click', () => step(1));
  $('tour-stop').addEventListener('click', () => { touring = false; render(); });
  $('sheet-close').addEventListener('click', () => { touring = false; select(null); });
  $('sheet-open').addEventListener('click', () => { const id = store.get().selectedSiteId; if (id) openSite(id); });

  return {
    /** Fournit les entrées de l'index (sites) ; affiche la fiche si un site est déjà sélectionné. */
    setEntries(list) { entries = list; render(); },
    render,
  };
}
