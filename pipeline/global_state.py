"""Points sub-solaire et sub-terrestre sur toute la période (A-03, docs/ATLAS.md § 3.3) → `web/data/global.json`.

Même vecteur Lune → corps que les séries de site (SPICE : `spkpos(…, "MOON_ME", "LT+S", "MOON")`) :
`lat = asin(z/|r|)`, `lon = atan2(y, x)` (est positif, repère MOON_ME). Le rayon est le rayon angulaire vu du centre de la Lune.
Mode démonstration : les points du modèle fictif (`ephemeris_demo`) ; `synthetic: true`. Entiers en millidegrés ; longitude dans [-180000, 180000).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from pipeline import __version__, ephemeris_demo, ephemeris_spice
from pipeline.config import MDEG_PER_DEG, MOON_FRAME
from pipeline.export import SCHEMA_VERSION, PipelineConfig, dump_json

HALF_TURN_MDEG = 180 * MDEG_PER_DEG


def _spice_points(body: str, utc: list[str]) -> dict[str, np.ndarray]:
    """Latitude, longitude et rayon angulaire (degrés) du point sub-corps, vu du centre de la Lune."""
    import spiceypy as sp

    name, radius_km = ephemeris_spice.BODIES[body]
    et = np.array([sp.str2et(t) for t in utc])
    pos, _ = sp.spkpos(name, et, MOON_FRAME, ephemeris_spice.ABCORR, "MOON")  # km, du centre de la Lune au centre du corps
    pos = np.asarray(pos)
    r = np.linalg.norm(pos, axis=1)
    return {"lat": np.degrees(np.arcsin(pos[:, 2] / r)), "lon": np.degrees(np.arctan2(pos[:, 1], pos[:, 0])),
            "radius": np.degrees(np.arcsin(radius_km / r))}


def _demo_points(body: str, utc: list[str]) -> dict[str, np.ndarray]:
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


def _to_mdeg(p: dict[str, np.ndarray]) -> dict[str, list[int]]:
    """Millidegrés entiers ; longitude ramenée dans [-180000, 180000) ; rayon ≥ 1."""
    lon = np.rint(p["lon"] * MDEG_PER_DEG).astype(np.int64)
    lon = (lon + HALF_TURN_MDEG) % (2 * HALF_TURN_MDEG) - HALF_TURN_MDEG
    return {"lat_mdeg": [int(v) for v in np.rint(p["lat"] * MDEG_PER_DEG)], "lon_mdeg": [int(v) for v in lon],
            "radius_mdeg": [int(v) for v in np.maximum(np.rint(p["radius"] * MDEG_PER_DEG), 1)]}


def build_global(cfg: PipelineConfig, engine: str) -> dict[str, Any]:
    """Document `global.json` pour le moteur « spice » ou « demo-analytic »."""
    utc = ephemeris_demo.utc_grid(cfg.start_utc, cfg.step_s, cfg.count)
    if engine == "spice":
        ephemeris_spice.load_kernels(cfg.kernel_dir)
        points = _spice_points
    elif engine == "demo-analytic":
        points = _demo_points
    else:
        raise ValueError(f"moteur inconnu {engine!r}")
    return {
        "schema_version": SCHEMA_VERSION, "synthetic": engine == "demo-analytic",
        "provenance": {"ephemeris": {"engine": engine, "kernels": list(ephemeris_spice.KERNEL_NAMES) if engine == "spice" else [],
                                     "abcorr": ephemeris_spice.ABCORR if engine == "spice" else None, "frame": MOON_FRAME},
                       "pipeline_version": __version__, "generated_utc": cfg.build_utc},
        "time": {"t0_utc": cfg.start_utc, "step_s": cfg.step_s, "n": cfg.count},
        "sun": _to_mdeg(points("sun", utc)), "earth": _to_mdeg(points("earth", utc)),
    }


def write_global(doc: dict[str, Any], out_dir: Path) -> Path:
    """Écrit `global.json` (JSON compact, clés triées, saut de ligne final)."""
    path = Path(out_dir) / "global.json"
    dump_json(path, doc)
    return path
