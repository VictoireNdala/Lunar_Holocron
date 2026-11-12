// Constantes du projet, miroir exact de pipeline/config.py (vérifié par pipeline/tests/test_web_sample.py).
// Une seule définition par constante : toute modification se fait dans les deux fichiers, dans le même commit.

// --- Géométrie lunaire ---
// Rayon de la sphère de référence des MNT LOLA. Source : docs/ARCHITECTURE.md § 2 ; à confirmer dans l'étiquette .LBL du MNT réel.
export const R_REF_M = 1737400.0;
// Repère lunaire de référence (D-003).
export const MOON_FRAME = 'MOON_ME';

// --- Rayons des corps ---
// Rayon nominal du Soleil, résolution B3 de l'UAI (2015). Valeur écrite de mémoire, citée dans docs/PIPELINE.md.
export const R_SUN_KM = 695700.0;
// Rayon moyen de la Terre, 6 371,0 km (valeur de docs/PIPELINE.md).
export const R_EARTH_KM = 6371.0;

// --- Échantillonnage (docs/CONTRAT-DONNEES.md, D-005) ---
export const TIME_STEP_S = 3600;
export const AZ_STEP_DEG = 1.0;
export const N_AZIMUTHS = 360;
export const MDEG_PER_DEG = 1000;

// --- Bornes et valeurs par défaut ---
// Pôle exact interdit, bornes incluses (D-012).
export const LAT_MIN_DEG = -89.99;
export const LAT_MAX_DEG = 89.99;
// Hauteur de l'œil par défaut : DÉCISION PROVISOIRE (D-008, Q-007).
export const DEFAULT_OBSERVER_HEIGHT_M = 2.0;

// --- Contrat de données ---
// Version majeure comprise par l'interface (CONTRAT § 7.1) ; identique à pipeline/validate.py.
export const SUPPORTED_SCHEMA_MAJOR = 1;

// --- Seuils de visibilité (ARCHITECTURE § 2, D-004) ---
// strict : f >= 0,5 (centre du disque au-dessus de l'horizon) ; any : f > 0 (une partie du disque visible).
export const STRICT_MIN_FRACTION = 0.5;
export const THRESHOLD_MODES = Object.freeze(['strict', 'any']);
// Seuil par défaut : strict (D-004, à confirmer Q-006).
export const DEFAULT_THRESHOLD = 'strict';
