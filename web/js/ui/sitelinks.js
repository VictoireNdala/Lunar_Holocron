// Fiche de site : liens profonds Quickmap / Moon Trek et copie des coordonnées (S-05, D-019).
// Aucun chargement : les liens ne sont que des <a> ouverts par un clic de l'utilisateur.
import { deepLinks } from '../links.js';
import { t } from '../i18n.js';

const $ = (id) => document.getElementById(id);

/** Crée le bloc de liens ; `render(site)` le remplit pour le site affiché. */
export function createSiteLinks() {
  let current = null;

  function note(key) {
    $('links-status').textContent = key ? t(key) : '';
    $('links-status').hidden = !key;
  }

  /** Remplit les liens et les coordonnées ; masque les liens si les coordonnées sont invalides. */
  function render(site) {
    current = deepLinks(site.location);
    $('links-block').hidden = false;
    $('links-invalid').hidden = Boolean(current);
    $('links-actions').hidden = !current;
    $('links-coords').hidden = !current;
    note(null);
    if (!current) return;
    $('link-quickmap').href = current.quickmap.url;
    $('link-trek').href = current.trek.url;
    $('links-coords').textContent = current.coordsText;
    const manual = !current.quickmap.centered || !current.trek.centered;
    $('links-note').textContent = t(manual ? 'links.noteManual' : 'links.noteCentered');
    $('links-source').textContent = t(site.synthetic ? 'links.sourceSynthetic' : `links.source.${site.position_basis ?? 'dem_center'}`);
  }

  $('links-copy').addEventListener('click', async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.coordsText);
      note('links.copied');
    } catch {
      note('links.copyFailed'); // presse-papiers refusé (contexte non sécurisé, permission) : les coordonnées restent affichées
    }
  });

  return { render };
}
