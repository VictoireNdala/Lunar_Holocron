"""Formules de visibilité (docs/ARCHITECTURE.md § 3). Miroir exact : web/js/visibility.js (mêmes valeurs d'or, tests/golden/).

Fraction visible d'un disque de rayon angulaire r dont le centre est à l'élévation el, au-dessus d'un horizon plat h :
d = el − h ; x = clamp(d / r, −1, 1) ; f = 1 − (acos x − x·√(1 − x²)) / π.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike, NDArray

from pipeline.config import N_AZIMUTHS, STRICT_MIN_FRACTION, THRESHOLD_MODES, VISIBILITY_TOLERANCE

FloatArray = NDArray[np.float64]


def visible_fraction(el_deg: ArrayLike, radius_deg: ArrayLike, horizon_deg: ArrayLike) -> FloatArray:
    """Part du disque au-dessus de l'horizon, dans [0, 1] ; horizon lu au seul azimut du centre (approximation assumée)."""
    r = np.asarray(radius_deg, dtype=np.float64)
    if np.any(r <= 0):
        raise ValueError("radius_deg doit être > 0")
    d = np.asarray(el_deg, dtype=np.float64) - np.asarray(horizon_deg, dtype=np.float64)
    x = np.clip(d / r, -1.0, 1.0)
    return 1.0 - (np.arccos(x) - x * np.sqrt(1.0 - x * x)) / np.pi


def horizon_at(horizon_elev_deg: ArrayLike, az_deg: ArrayLike) -> FloatArray:
    """Masque d'horizon interpolé linéairement à l'azimut donné, avec bouclage 359° → 0°."""
    h = np.asarray(horizon_elev_deg, dtype=np.float64)
    if h.shape != (N_AZIMUTHS,):
        raise ValueError(f"masque de {N_AZIMUTHS} valeurs attendu (reçu {h.shape})")
    az = np.mod(np.asarray(az_deg, dtype=np.float64), 360.0)
    i0 = np.floor(az).astype(np.intp) % N_AZIMUTHS
    w = az - np.floor(az)
    return h[i0] * (1.0 - w) + h[(i0 + 1) % N_AZIMUTHS] * w


def is_visible(fraction: ArrayLike, mode: str) -> NDArray[np.bool_]:
    """Seuil binaire : 'strict' ⇒ f ≥ 0,5 (centre au-dessus) ; 'any' ⇒ f > 0 (une partie du disque), à la tolérance numérique VISIBILITY_TOLERANCE près (D-031)."""
    if mode not in THRESHOLD_MODES:
        raise ValueError(f"mode inconnu {mode!r} ; attendu {THRESHOLD_MODES}")
    f = np.asarray(fraction, dtype=np.float64)
    return f >= STRICT_MIN_FRACTION - VISIBILITY_TOLERANCE if mode == "strict" else f > VISIBILITY_TOLERANCE
