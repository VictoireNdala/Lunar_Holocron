"""Projection stéréographique polaire Sud, paramétrable (docs/ARCHITECTURE.md § 3).

Convention par défaut (données synthétiques) : sphère R_REF, λ0 = 0, échelle vraie au pôle, `lon 0` vers +y, `lon 90 E` vers +x.
Pour un MNT réel, les paramètres viennent de l'étiquette (.LBL) et priment (docs/BRANCHEMENT-DONNEES-REELLES.md § 2.3).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

from pipeline.config import R_REF_M
from pipeline.geodesy import wrap_lon_deg

FloatArray = NDArray[np.float64]


@dataclass(frozen=True)
class PolarProjection:
    """Stéréographique polaire Sud : x = k0·ρ·sin(λ−λ0) + FE, y = k0·ρ·cos(λ−λ0) + FN, ρ = 2R·tan((φ+90°)/2)."""

    radius_m: float = R_REF_M
    center_lon_deg: float = 0.0
    scale_k0: float = 1.0
    false_easting_m: float = 0.0
    false_northing_m: float = 0.0

    def __post_init__(self) -> None:
        """Refuse les paramètres non physiques."""
        if not self.radius_m > 0:
            raise ValueError(f"radius_m doit être > 0 (reçu {self.radius_m})")
        if not self.scale_k0 > 0:
            raise ValueError(f"scale_k0 doit être > 0 (reçu {self.scale_k0})")

    def lonlat_to_xy(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> tuple[FloatArray, FloatArray]:
        """(lat, lon) en degrés → (x, y) en mètres."""
        lat = np.radians(np.asarray(lat_deg, dtype=np.float64))
        dlon = np.radians(np.asarray(lon_deg, dtype=np.float64) - self.center_lon_deg)
        rho = self.scale_k0 * 2.0 * self.radius_m * np.tan((lat + np.pi / 2.0) / 2.0)
        return rho * np.sin(dlon) + self.false_easting_m, rho * np.cos(dlon) + self.false_northing_m

    def xy_to_lonlat(self, x_m: ArrayLike, y_m: ArrayLike) -> tuple[FloatArray, FloatArray]:
        """(x, y) en mètres → (lat, lon) en degrés, lon dans [-180, 180) (au pôle exact, lon = λ0 ramené)."""
        dx = np.asarray(x_m, dtype=np.float64) - self.false_easting_m
        dy = np.asarray(y_m, dtype=np.float64) - self.false_northing_m
        rho = np.hypot(dx, dy) / self.scale_k0
        lat = 2.0 * np.arctan(rho / (2.0 * self.radius_m)) - np.pi / 2.0
        lon = np.degrees(np.arctan2(dx, dy)) + self.center_lon_deg
        return np.degrees(lat), wrap_lon_deg(lon)


DEFAULT_PROJECTION = PolarProjection()


def lonlat_to_xy(lat_deg: ArrayLike, lon_deg: ArrayLike) -> tuple[FloatArray, FloatArray]:
    """Projection avec les paramètres par défaut."""
    return DEFAULT_PROJECTION.lonlat_to_xy(lat_deg, lon_deg)


def xy_to_lonlat(x_m: ArrayLike, y_m: ArrayLike) -> tuple[FloatArray, FloatArray]:
    """Projection inverse avec les paramètres par défaut."""
    return DEFAULT_PROJECTION.xy_to_lonlat(x_m, y_m)
