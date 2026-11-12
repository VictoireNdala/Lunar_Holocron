// Textes de l'interface et formats (INTERFACE § 1). Tout texte affiché passe par t(). Repli : langue courante → anglais → clé.
// Toujours UTC : aucune conversion en heure locale.

const FR = {
  'app.title': 'Lunar Holocron',
  'app.tagline': 'Navigateur des sites d’alunissage du pôle Sud lunaire',
  'banner.synthetic': 'DONNÉES DE DÉMONSTRATION — valeurs fictives',
  'lang.label': 'Langue',
  'loading': 'Chargement…',
  'site.label': 'Site',
  'site.heading': 'Site sélectionné',
  'site.lat': 'Latitude',
  'site.lon': 'Longitude',
  'site.period': 'Période couverte',
  'site.samples': 'Nombre d’échantillons',
  'site.step': 'Pas de temps',
  'site.observer': 'Hauteur de l’œil au-dessus du sol',
  'site.synthetic': 'Site fictif : données synthétiques',
  'site.periodValue': 'du {start} au {end}',
  'site.option': '{name} — fictif',
  'site.stepValue': '{hours} h',
  'prov.heading': 'Provenance des données',
  'prov.dem': 'Terrain (MNT)',
  'prov.ephemeris': 'Éphémérides',
  'prov.pipeline': 'Version du générateur',
  'prov.generated': 'Date de génération',
  'prov.note': 'Note',
  'time.heading': 'Date et heure',
  'time.label': 'Instant (UTC)',
  'time.hint': 'Format AAAA-MM-JJTHH:MM, toujours en UTC.',
  'time.apply': 'Afficher',
  'time.minusDay': '−1 jour',
  'time.minusHour': '−1 h',
  'time.plusHour': '+1 h',
  'time.plusDay': '+1 jour',
  'time.current': 'Instant affiché : {time}',
  'time.invalid': 'Date invalide : utilisez le format AAAA-MM-JJTHH:MM (UTC).',
  'time.outOfRange': 'Date hors de la période couverte ({start} – {end}) : les valeurs affichées sont celles de la borne la plus proche.',
  'bodies.heading': 'Soleil et Terre à cet instant',
  'bodies.note': 'Azimut : 0° = Nord, 90° = Est. Élévation : angle au-dessus du plan horizontal local, sans tenir compte du relief (le relief viendra avec le panorama).',
  'body.sun': 'Soleil',
  'body.earth': 'Terre',
  'reading.body': 'Corps',
  'reading.az': 'Azimut',
  'reading.el': 'Élévation',
  'reading.radius': 'Rayon angulaire',
  'upcoming': 'À venir : panorama 360° avec le relief, vue 3D, frise temporelle et verdicts de visibilité.',
  'error.title': 'Erreur de données',
  'error.missing': 'Fichier introuvable : {url} (HTTP {status}).',
  'error.network': 'Impossible de lire {url}. Ouvrez l’application par un serveur local : « py -m http.server 8000 -d web », puis http://localhost:8000.',
  'error.invalid-json': 'Fichier illisible (JSON invalide) : {url}.',
  'error.schema-version': 'Version du format de données non prise en charge dans {url} : {details}.',
  'error.contract': 'Fichier non conforme au contrat de données : {url} — {details}.',
  'error.unknown-site': 'Site inconnu : {details}.',
  'error.unexpected': 'Erreur inattendue : {details}.',
  'footer.data': 'Dossier de données : {root}',
  'footer.license': 'Code sous licence Apache 2.0. Projet indépendant, non approuvé par la NASA.',
};

const EN = {
  'app.title': 'Lunar Holocron',
  'app.tagline': 'Lunar South Pole landing-site navigator',
  'banner.synthetic': 'DEMONSTRATION DATA — fictitious values',
  'lang.label': 'Language',
  'loading': 'Loading…',
  'site.label': 'Site',
  'site.heading': 'Selected site',
  'site.lat': 'Latitude',
  'site.lon': 'Longitude',
  'site.period': 'Period covered',
  'site.samples': 'Number of samples',
  'site.step': 'Time step',
  'site.observer': 'Eye height above ground',
  'site.synthetic': 'Fictitious site: synthetic data',
  'site.periodValue': 'from {start} to {end}',
  'site.option': '{name} — fictitious',
  'site.stepValue': '{hours} h',
  'prov.heading': 'Data provenance',
  'prov.dem': 'Terrain (DEM)',
  'prov.ephemeris': 'Ephemerides',
  'prov.pipeline': 'Generator version',
  'prov.generated': 'Generation date',
  'prov.note': 'Note',
  'time.heading': 'Date and time',
  'time.label': 'Instant (UTC)',
  'time.hint': 'Format YYYY-MM-DDTHH:MM, always UTC.',
  'time.apply': 'Show',
  'time.minusDay': '−1 day',
  'time.minusHour': '−1 h',
  'time.plusHour': '+1 h',
  'time.plusDay': '+1 day',
  'time.current': 'Displayed instant: {time}',
  'time.invalid': 'Invalid date: use the format YYYY-MM-DDTHH:MM (UTC).',
  'time.outOfRange': 'Date outside the covered period ({start} – {end}): values shown are those of the nearest bound.',
  'bodies.heading': 'Sun and Earth at this instant',
  'bodies.note': 'Azimuth: 0° = North, 90° = East. Elevation: angle above the local horizontal plane, terrain not taken into account (terrain comes with the panorama).',
  'body.sun': 'Sun',
  'body.earth': 'Earth',
  'reading.body': 'Body',
  'reading.az': 'Azimuth',
  'reading.el': 'Elevation',
  'reading.radius': 'Angular radius',
  'upcoming': 'Coming next: 360° panorama with terrain, 3D view, timeline and visibility verdicts.',
  'error.title': 'Data error',
  'error.missing': 'File not found: {url} (HTTP {status}).',
  'error.network': 'Cannot read {url}. Open the application through a local server: “py -m http.server 8000 -d web”, then http://localhost:8000.',
  'error.invalid-json': 'Unreadable file (invalid JSON): {url}.',
  'error.schema-version': 'Unsupported data format version in {url}: {details}.',
  'error.contract': 'File does not comply with the data contract: {url} — {details}.',
  'error.unknown-site': 'Unknown site: {details}.',
  'error.unexpected': 'Unexpected error: {details}.',
  'footer.data': 'Data folder: {root}',
  'footer.license': 'Code under the Apache 2.0 licence. Independent project, not endorsed by NASA.',
};

/** Dictionnaires. Swahili prévu (D-009) : vide pour l'instant, repli sur l'anglais. */
export const MESSAGES = Object.freeze({ fr: Object.freeze(FR), en: Object.freeze(EN), sw: Object.freeze({}) });
const LOCALES = Object.freeze({ fr: 'fr-FR', en: 'en-GB', sw: 'sw' });

let currentLang = 'fr';

/** Change la langue (ignoré si la langue n'existe pas). */
export function setLang(lang) {
  if (Object.hasOwn(MESSAGES, lang)) currentLang = lang;
}

/** Langue courante. */
export function getLang() {
  return currentLang;
}

/** Texte traduit ; {param} remplacé par params.param. */
export function t(key, params = {}) {
  const text = MESSAGES[currentLang][key] ?? MESSAGES.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

/** Instant (ms) → « AAAA-MM-JJ HH:MM UTC ». */
export function formatUtc(tMs) {
  const iso = new Date(tMs).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Nombre avec `digits` décimales, séparateur décimal de la langue courante. */
export function formatNumber(value, digits) {
  return new Intl.NumberFormat(LOCALES[currentLang], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
