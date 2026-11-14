// Page « Sources et méthode » (T-14, INTERFACE § 10) : les textes sont statiques (i18n) ; la provenance est lue dans le fichier du site affiché,
// jamais écrite à la main ici. Une note apparaît si le site est fictif.
import { formatNumber, t } from '../i18n.js';

const $ = (id) => document.getElementById(id);

/** Remplit la provenance du site affiché (`site` peut être null avant le chargement). */
export function renderMethodPage(site) {
  $('method-no-site').hidden = Boolean(site);
  $('method-synthetic').hidden = !site?.synthetic;
  const dl = $('method-provenance');
  dl.replaceChildren();
  if (!site) return;
  const prov = site.provenance;
  const pairs = [
    [t('prov.dem'), `${prov.dem.product} (${formatNumber(prov.dem.resolution_m, 1)} m)`],
    [t('method.source'), prov.dem.source ?? '—'],
    [t('method.license'), prov.dem.license ?? '—'],
    [t('method.citation'), prov.dem.citation ?? '—'],
    [t('method.position'), prov.dem.position_source ?? '—'],
    [t('prov.ephemeris'), `${prov.ephemeris.engine}${prov.ephemeris.abcorr ? ` (${prov.ephemeris.abcorr})` : ''}`],
    [t('method.kernels'), (prov.ephemeris.kernels ?? []).join(', ') || '—'],
    [t('prov.pipeline'), prov.pipeline_version],
    [t('prov.generated'), prov.generated_utc],
  ];
  if (prov.note) pairs.push([t('prov.note'), prov.note]);
  for (const [term, value] of pairs) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.append(dt, dd);
  }
}
