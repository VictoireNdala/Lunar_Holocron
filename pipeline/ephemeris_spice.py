"""Soleil et Terre vus d'un site, par SPICE (docs/PIPELINE.md § ephemeris_spice ; T-20).

Chaîne : `spkpos(corps, et, "MOON_ME", "LT+S", "MOON")` donne le vecteur Lune → corps en **km** dans MOON_ME ;
le site est en `(R_REF + h)·up` converti de **mètres en km** (leçon de M-008) ; v = corps − site ; azimut et élévation
dans la base locale ENU ; rayon angulaire = asin(R_corps / |v|). Aucune réfraction. `MOON_ME` = `MOON_ME_DE440_ME421`
(noyau `moon_de440_250416.tf`), repère « Mean Earth » aligné sur celui de DE421 utilisé par les MNT de PGDA.
Les noyaux sont des fichiers locaux (`data/raw/spice/`, hors Git) : aucun accès réseau ici.
"""

from __future__ import annotations

from pathlib import Path
from typing import Sequence

import numpy as np
from numpy.typing import NDArray

from pipeline import geodesy
from pipeline.config import LAT_MAX_DEG, LAT_MIN_DEG, MDEG_PER_DEG, MOON_FRAME, R_EARTH_KM, R_REF_M, R_SUN_KM

# Noyaux retenus (noms exacts relevés dans les dossiers de NAIF le 2026-11-14), dans l'ordre de chargement.
KERNEL_NAMES = ("naif0012.tls", "de440s.bsp", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf")
ABCORR = "LT+S"  # temps de lumière et aberration stellaire (PIPELINE § éphémérides)
SITE_UNIT_KM_PER_M = 1e-3  # le site est en mètres, spkpos rend des kilomètres
BODIES = {"sun": ("SUN", R_SUN_KM), "earth": ("EARTH", R_EARTH_KM)}

FloatArray = NDArray[np.float64]
__all__ = ["KERNEL_NAMES", "R_SUN_KM", "SITE_UNIT_KM_PER_M", "body_series", "kernels_available", "load_kernels", "to_millidegrees"]


def kernels_available(kernel_dir: Path) -> bool:
    """Vrai si les 4 noyaux sont présents."""
    return all((Path(kernel_dir) / name).is_file() for name in KERNEL_NAMES)


def load_kernels(kernel_dir: Path) -> list[str]:
    """Charge les noyaux (idempotent) et renvoie la liste de leurs chemins, pour la provenance."""
    import spiceypy as sp

    paths = [str(Path(kernel_dir) / name) for name in KERNEL_NAMES]
    for path in paths:
        sp.furnsh(path)
    return paths


def body_series(body: str, lat_deg: float, lon_deg: float, height_m: float, utc: Sequence[str]) -> dict[str, FloatArray]:
    """Azimut, élévation et rayon angulaire (degrés) du corps vu du site, aux instants UTC donnés (ISO 8601 sans `Z`)."""
    import spiceypy as sp

    if body not in BODIES:
        raise ValueError(f"corps inconnu {body!r} ; attendu {tuple(BODIES)}")
    if not LAT_MIN_DEG <= lat_deg <= LAT_MAX_DEG:
        raise ValueError(f"latitude {lat_deg} hors [{LAT_MIN_DEG}, {LAT_MAX_DEG}] (pas de pôle exact, D-012)")
    name, radius_km = BODIES[body]
    et = np.array([sp.str2et(t.rstrip("Z")) for t in utc])
    pos_km, _ = sp.spkpos(name, et, MOON_FRAME, ABCORR, "MOON")
    east, north, up = geodesy.enu_basis(lat_deg, lon_deg)
    site_km = (R_REF_M + height_m) * SITE_UNIT_KM_PER_M * up
    v = np.asarray(pos_km) - site_km
    az, el = geodesy.az_el_from_vector(v, east, north, up)
    return {"az_deg": az, "el_deg": el, "radius_deg": np.degrees(np.arcsin(radius_km / np.linalg.norm(v, axis=-1)))}


def to_millidegrees(series: dict[str, FloatArray]) -> dict[str, NDArray[np.int64]]:
    """Séries du contrat : millidegrés entiers, azimut dans [0, 360000), rayon ≥ 1 (CONTRAT § 3)."""
    az = np.rint(series["az_deg"] * MDEG_PER_DEG).astype(np.int64) % (360 * MDEG_PER_DEG)
    el = np.rint(series["el_deg"] * MDEG_PER_DEG).astype(np.int64)
    radius = np.maximum(np.rint(series["radius_deg"] * MDEG_PER_DEG).astype(np.int64), 1)
    return {"az_mdeg": az, "el_mdeg": el, "radius_mdeg": radius}
