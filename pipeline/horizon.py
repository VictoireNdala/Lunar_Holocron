"""Masque d'horizon d'un site (docs/PIPELINE.md § horizon ; T-05).

Pour chaque azimut entier a, élévation maximale du relief vu de l'observateur, courbure incluse
(`geodesy.point_elevation_deg`, formule d'ARCHITECTURE § 3). Un point sans hauteur (NaN) est ignoré ;
`truncated[a]` est vrai si au moins un échantillon de ce rayon est NaN avant la distance maximale :
le masque est alors un **minorant**. Calcul vectorisé par bandes d'azimuts (mémoire bornée).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray

from pipeline import geodesy
from pipeline.config import DEFAULT_OBSERVER_HEIGHT_M, N_AZIMUTHS
from pipeline.dem import Dem

FloatArray = NDArray[np.float64]
AZIMUTHS_PER_BAND = 36  # 10 bandes de 36 azimuts : ≈ 100 000 points par bande
ROUND_DECIMALS = 2  # arrondi final à 0,01°
NO_VALID_ELEVATION_DEG = -90.0  # aucun point valide à cet azimut


@dataclass(frozen=True)
class HorizonConfig:
    """Paramètres de config/pipeline.json, section `horizon` (valeurs de docs/PIPELINE.md § 1)."""

    near_max_km: float = 25.0
    far_max_km: float = 150.0
    near_step_m: float = 20.0
    far_step_m: float = 120.0
    observer_height_m: float = DEFAULT_OBSERVER_HEIGHT_M  # DÉCISION PROVISOIRE D-008 / Q-007

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "HorizonConfig":
        """Construit depuis la section `horizon` du JSON ; les clés inconnues (az_step_deg) sont ignorées."""
        known = {k: d[k] for k in HorizonConfig.__dataclass_fields__ if k in d}
        return HorizonConfig(**known)


def sample_distances(cfg: HorizonConfig) -> FloatArray:
    """Distances d'échantillonnage : pas fin jusqu'à near_max, pas large ensuite, **far_max toujours inclus** comme dernier point."""
    far_max_m = cfg.far_max_km * 1000.0
    near = np.arange(cfg.near_step_m, cfg.near_max_km * 1000.0, cfg.near_step_m)
    far = np.arange(cfg.near_max_km * 1000.0, far_max_m, cfg.far_step_m)
    return np.concatenate([near, far, [far_max_m]])


def compute_horizon(dem: Dem, lat_deg: float, lon_deg: float, observer_height_m: float | None = None,
                    cfg: HorizonConfig | None = None) -> tuple[FloatArray, NDArray[np.bool_]]:
    """Renvoie (elev_deg[360], truncated[360]) du masque d'horizon du site."""
    cfg = cfg or HorizonConfig()
    eye_m = cfg.observer_height_m if observer_height_m is None else observer_height_m
    ground_m = float(np.asarray(dem.height_m(lat_deg, lon_deg)))
    elev = np.full(N_AZIMUTHS, NO_VALID_ELEVATION_DEG)
    truncated = np.ones(N_AZIMUTHS, dtype=bool)
    if not np.isfinite(ground_m):
        return elev, truncated  # site hors MNT : rien à dire, minorant total
    h_observer = ground_m + eye_m
    dist = sample_distances(cfg)
    for start in range(0, N_AZIMUTHS, AZIMUTHS_PER_BAND):
        az = np.arange(start, min(start + AZIMUTHS_PER_BAND, N_AZIMUTHS), dtype=np.float64)[:, None]
        lat, lon = geodesy.destination(lat_deg, lon_deg, az, dist[None, :])
        h_target = np.asarray(dem.height_m(lat, lon), dtype=np.float64)
        e = geodesy.point_elevation_deg(h_target, dist[None, :], h_observer)
        e = np.where(np.isnan(h_target), -np.inf, e)  # les NaN sont ignorés par le maximum
        best = e.max(axis=1)
        rows = slice(start, start + az.shape[0])
        elev[rows] = np.where(np.isfinite(best), best, NO_VALID_ELEVATION_DEG)
        truncated[rows] = np.isnan(h_target).any(axis=1)
    return np.round(elev, ROUND_DECIMALS), truncated
