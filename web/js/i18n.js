// Textes de l'interface et formats (INTERFACE § 1). Tout texte affiché passe par t(). Repli : langue courante → anglais → clé.
// Toujours UTC : aucune conversion en heure locale.

const FR = {
  'app.title': 'Lunar Holocron',
  'app.tagline': 'Navigateur des sites d’alunissage du pôle Sud lunaire',
  'honesty.synthetic': 'Données de démonstration · valeurs fictives',
  'honesty.syntheticNote': 'Le relief, le Soleil et la Terre affichés ici sont fictifs : ils servent à construire et tester l’outil en attendant les données NASA. Aucune valeur de cette page n’est une mesure.',
  'honesty.real': 'Données réelles',
  'honesty.realNote': 'Relief et éphémérides issus des données NASA citées dans la page « Sources et méthode ».',
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
  'upcoming': 'À venir : panorama 360° avec le masque d’horizon, frise temporelle et verdicts de visibilité.',
  'view3d.heading': 'Vue 3D du terrain',
  'view3d.mode': 'Mode de caméra',
  'view3d.overview': 'Vue d’ensemble',
  'view3d.ground': 'Au sol',
  'view3d.turnLeft': '◀ 30°',
  'view3d.turnRight': '30° ▶',
  'view3d.lookingAt': 'Regard vers {az}°',
  'view3d.exaggeration': 'Exagération verticale',
  'view3d.exaggerationValue': '×{value}',
  'view3d.legend': 'Hauteur locale par rapport au site (m), courbure incluse',
  'view3d.note': 'Rendu illustratif : les ombres ne servent pas aux verdicts de visibilité. Soleil et Terre sont agrandis et placés dans leur direction vue du site (azimut, élévation) ; atténués quand ils sont sous l’horizon géométrique. Nord vers le fond en vue d’ensemble.',
  'view3d.sunBelow': 'Soleil sous l’horizon géométrique : éclairage direct éteint.',
  'view3d.qualityReduced': 'Qualité réduite automatiquement : ombres allégées.',
  'view3d.qualityOff': 'Qualité réduite automatiquement : ombres désactivées.',
  'view3d.unavailable': 'Vue 3D indisponible : ce navigateur ne permet pas WebGL.',
  'preview.title': 'Aperçu du relief réel',
  'preview.chip': 'Relief réel LOLA 80 m · aperçu : pas d’horizon calculé, ni Soleil ni Terre',
  'preview.chipNote': 'Le relief est réel (LOLA, 80 m par pixel, rééchantillonné). Aucun horizon, aucune position du Soleil ou de la Terre ne sont calculés sur cette page : l’éclairage est illustratif. À 80 m, le relief est trop grossier pour un horizon fiable : c’est un aperçu, pas une mesure.',
  'preview.light': 'Éclairage d’aperçu illustratif (azimut {az}°, élévation {el}°) : ce n’est pas la position du Soleil.',
  'preview.choose': 'Aperçu',
  'preview.product': 'Produit',
  'preview.citation': 'Citation',
  'preview.resampling': 'Rééchantillonnage',
  'preview.center': 'Centre (lat, lon)',
  'preview.siteHeight': 'Hauteur du centre (m, au-dessus de 1 737,4 km)',
  'preview.empty': 'Aucun aperçu : lancez « py -m pipeline.tools.crop_real_dem » (le fichier data/raw n’est pas versionné).',
  'preview.back': 'Retour à l’application',
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
  'honesty.synthetic': 'Demonstration data · fictitious values',
  'honesty.syntheticNote': 'The terrain, Sun and Earth shown here are fictitious: they are used to build and test the tool until the NASA data are connected. No value on this page is a measurement.',
  'honesty.real': 'Real data',
  'honesty.realNote': 'Terrain and ephemerides from the NASA data cited on the “Sources and method” page.',
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
  'upcoming': 'Coming next: 360° panorama with the horizon mask, timeline and visibility verdicts.',
  'view3d.heading': '3D terrain view',
  'view3d.mode': 'Camera mode',
  'view3d.overview': 'Overview',
  'view3d.ground': 'Ground level',
  'view3d.turnLeft': '◀ 30°',
  'view3d.turnRight': '30° ▶',
  'view3d.lookingAt': 'Looking at {az}°',
  'view3d.exaggeration': 'Vertical exaggeration',
  'view3d.exaggerationValue': '×{value}',
  'view3d.legend': 'Local height relative to the site (m), curvature included',
  'view3d.note': 'Illustrative rendering: shadows are not used for visibility verdicts. Sun and Earth are enlarged and placed in their direction as seen from the site (azimuth, elevation); dimmed when below the geometric horizon. North points away in overview.',
  'view3d.sunBelow': 'Sun below the geometric horizon: direct lighting off.',
  'view3d.qualityReduced': 'Quality reduced automatically: lighter shadows.',
  'view3d.qualityOff': 'Quality reduced automatically: shadows disabled.',
  'view3d.unavailable': '3D view unavailable: this browser does not support WebGL.',
  'preview.title': 'Real terrain preview',
  'preview.chip': 'Real LOLA terrain, 80 m · preview: no horizon computed, no Sun or Earth',
  'preview.chipNote': 'The terrain is real (LOLA, 80 m per pixel, resampled). No horizon and no Sun or Earth position are computed on this page: the lighting is illustrative. At 80 m the terrain is too coarse for a reliable horizon: this is a preview, not a measurement.',
  'preview.light': 'Illustrative preview lighting (azimuth {az}°, elevation {el}°): this is not the Sun’s position.',
  'preview.choose': 'Preview',
  'preview.product': 'Product',
  'preview.citation': 'Citation',
  'preview.resampling': 'Resampling',
  'preview.center': 'Centre (lat, lon)',
  'preview.siteHeight': 'Centre height (m, above 1,737.4 km)',
  'preview.empty': 'No preview: run “py -m pipeline.tools.crop_real_dem” (the data/raw file is not versioned).',
  'preview.back': 'Back to the application',
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
