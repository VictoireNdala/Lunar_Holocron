"""Constantes physiques et conventions du projet (une seule définition ; miroir JS : web/js/constants.js).

La lecture des fichiers de config/ (pipeline.json, sites.json) sera ajoutée en T-07.
"""

from __future__ import annotations

# --- Géométrie lunaire -----------------------------------------------------------------------------
# Rayon de la sphère de référence des MNT LOLA (hauteurs exprimées au-dessus de 1 737,4 km).
# Source : docs/ARCHITECTURE.md § 2 ; à confirmer dans l'étiquette .LBL du MNT réel (docs/BRANCHEMENT-DONNEES-REELLES.md § 2).
R_REF_M: float = 1_737_400.0

# Repère lunaire de référence (D-003) : celui de LOLA, pas IAU_MOON.
MOON_FRAME: str = "MOON_ME"

# --- Rayons des corps (rayon angulaire = asin(R / distance)) ------------------------------------
# Rayon nominal du Soleil : résolution B3 de l'UAI (2015), 695 700 km. Valeur écrite de mémoire, citée dans docs/PIPELINE.md.
R_SUN_KM: float = 695_700.0
# Rayon moyen de la Terre : 6 371,0 km (rayon moyen arrondi, valeur de docs/PIPELINE.md ; l'UGGI donne 6 371,0088 km).
R_EARTH_KM: float = 6_371.0

# --- Conventions d'échantillonnage (docs/CONTRAT-DONNEES.md, D-005) -------------------------------
TIME_STEP_S: int = 3600  # pas de temps des séries
AZ_STEP_DEG: float = 1.0  # pas d'azimut du masque d'horizon
N_AZIMUTHS: int = 360  # nombre d'azimuts du masque
MDEG_PER_DEG: int = 1000  # séries en millidegrés entiers

# --- Bornes et valeurs par défaut ----------------------------------------------------------------
# Pôle exact interdit : l'azimut n'y est pas défini (D-012). -89,99 est la latitude de test près du pôle.
LAT_MIN_DEG: float = -89.99
LAT_MAX_DEG: float = 89.99
# Hauteur de l'œil par défaut : 2,0 m. DÉCISION PROVISOIRE (D-008, Q-007).
DEFAULT_OBSERVER_HEIGHT_M: float = 2.0

# --- Seuils de visibilité (ARCHITECTURE § 2, D-004) ---------------------------------------------
# strict : f >= 0,5 (centre du disque au-dessus de l'horizon) ; any : f > 0 (une partie du disque visible).
STRICT_MIN_FRACTION: float = 0.5
# Tolérance numérique sur la fraction visible (D-031) : Python (numpy) et JavaScript (V8) peuvent différer d'un ulp sur acos/sqrt ; un cas EXACTEMENT à la limite
# (f = 0,5 en strict, f = 0 en optimiste) ne doit pas dépendre de la bibliothèque mathématique. 1e-9 de fraction ≈ 3·10⁻¹⁰ ° : très en dessous de la précision des données (1 m°).
VISIBILITY_TOLERANCE: float = 1e-9
THRESHOLD_MODES: tuple[str, ...] = ("strict", "any")
# Seuil par défaut : strict (D-004, à confirmer Q-006).
DEFAULT_THRESHOLD: str = "strict"
