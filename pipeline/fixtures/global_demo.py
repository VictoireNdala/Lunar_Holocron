"""Points sub-corps FICTIFS pour `global.json` de test (le modèle analytique de `ephemeris_demo`) ; jamais utilisés par le code de production."""

from __future__ import annotations

import numpy as np

from pipeline.fixtures import ephemeris_demo


def demo_points(body: str, utc: list[str]) -> dict[str, np.ndarray]:
    """Points sub-corps du modèle fictif (déclinaison et longitude du corps) ; rayon constant."""
    t = ephemeris_demo._days_since(utc)
    if body == "sun":
        lat = ephemeris_demo.SUN_DECL_AMPL_DEG * np.sin(2 * np.pi * t / ephemeris_demo.SUN_DECL_PERIOD_D + ephemeris_demo.SUN_DECL_PHASE)
        lon, radius = ephemeris_demo.SUN_LON0_DEG - 360.0 * t / ephemeris_demo.SUN_SYNODIC_D, ephemeris_demo.SUN_RADIUS_DEG
    else:
        lat = ephemeris_demo.EARTH_LAT_AMPL_DEG * np.sin(2 * np.pi * t / ephemeris_demo.EARTH_LAT_PERIOD_D + ephemeris_demo.EARTH_LAT_PHASE)
        lon = ephemeris_demo.EARTH_LON_AMPL_DEG * np.sin(2 * np.pi * t / ephemeris_demo.EARTH_LON_PERIOD_D + ephemeris_demo.EARTH_LON_PHASE)
        radius = ephemeris_demo.EARTH_RADIUS_DEG
    return {"lat": lat, "lon": lon, "radius": np.full(t.shape, radius)}
