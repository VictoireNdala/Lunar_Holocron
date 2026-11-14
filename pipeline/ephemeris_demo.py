"""Soleil et Terre de démonstration (docs/PIPELINE.md § ephemeris_demo ; T-07).

VALEURS FICTIVES mais plausibles, jamais présentées comme réelles (`engine: "demo-analytic"`, `synthetic: true`).
Modèle analytique : points sub-solaire et sub-terrestre qui oscillent ; aucun aléa (mêmes entrées, mêmes sorties).
Interface identique à `ephemeris_spice.body_series` (azimut, élévation, rayon en degrés).
"""

from __future__ import annotations

from typing import Sequence

import numpy as np
from numpy.typing import NDArray

from pipeline.config import LAT_MAX_DEG, LAT_MIN_DEG

FloatArray = NDArray[np.float64]
# Paramètres du modèle fictif (docs/PIPELINE.md). Ce ne sont pas des mesures.
SUN_DECL_AMPL_DEG, SUN_DECL_PERIOD_D, SUN_DECL_PHASE = 1.54, 346.62, 0.7
SUN_LON0_DEG, SUN_SYNODIC_D = 40.0, 29.530589
EARTH_LAT_AMPL_DEG, EARTH_LAT_PERIOD_D, EARTH_LAT_PHASE = 6.7, 27.212, 1.3
EARTH_LON_AMPL_DEG, EARTH_LON_PERIOD_D, EARTH_LON_PHASE = 7.9, 27.555, 2.1
SUN_RADIUS_DEG = 0.2665
EARTH_RADIUS_DEG = 0.95
BODIES = ("sun", "earth")


def utc_grid(start_utc: str, step_s: int, count: int) -> list[str]:
    """`count` instants UTC ISO 8601 sans `Z`, espacés de `step_s`."""
    t0 = np.datetime64(start_utc.rstrip("Z"), "s")
    return [str(t0 + np.timedelta64(k * step_s, "s")) for k in range(count)]


def _days_since(utc: Sequence[str], origin: str = "2026-01-01T00:00:00") -> FloatArray:
    """Jours écoulés depuis 2026-01-01T00:00Z."""
    t = np.array([np.datetime64(u.rstrip("Z"), "s") for u in utc])
    return (t - np.datetime64(origin, "s")) / np.timedelta64(1, "D")


def body_series(body: str, lat_deg: float, lon_deg: float, utc: Sequence[str]) -> dict[str, FloatArray]:
    """Azimut, élévation et rayon angulaire fictifs du corps vu du site, aux instants donnés."""
    if body not in BODIES:
        raise ValueError(f"corps inconnu {body!r} ; attendu {BODIES}")
    if not LAT_MIN_DEG <= lat_deg <= LAT_MAX_DEG:
        raise ValueError(f"latitude {lat_deg} hors [{LAT_MIN_DEG}, {LAT_MAX_DEG}] (pas de pôle exact, D-012)")
    t = _days_since(utc)
    if body == "sun":
        decl = SUN_DECL_AMPL_DEG * np.sin(2 * np.pi * t / SUN_DECL_PERIOD_D + SUN_DECL_PHASE)
        lon_b = SUN_LON0_DEG - 360.0 * t / SUN_SYNODIC_D
        radius = SUN_RADIUS_DEG
    else:
        decl = EARTH_LAT_AMPL_DEG * np.sin(2 * np.pi * t / EARTH_LAT_PERIOD_D + EARTH_LAT_PHASE)
        lon_b = EARTH_LON_AMPL_DEG * np.sin(2 * np.pi * t / EARTH_LON_PERIOD_D + EARTH_LON_PHASE)
        radius = EARTH_RADIUS_DEG
    phi, d, dl = np.radians(lat_deg), np.radians(decl), np.radians(lon_b - lon_deg)
    sin_el = np.sin(phi) * np.sin(d) + np.cos(phi) * np.cos(d) * np.cos(dl)
    az = np.degrees(np.arctan2(np.cos(d) * np.sin(dl), np.cos(phi) * np.sin(d) - np.sin(phi) * np.cos(d) * np.cos(dl))) % 360.0
    az = np.where(az >= 360.0, 0.0, az)
    return {"az_deg": az, "el_deg": np.degrees(np.arcsin(np.clip(sin_el, -1.0, 1.0))), "radius_deg": np.full(t.shape, radius)}
