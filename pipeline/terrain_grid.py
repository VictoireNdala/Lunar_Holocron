"""Grille de terrain 3D d'un site (docs/CONTRAT-DONNEES.md § 6, docs/PIPELINE.md § export).

Nœud (ligne, colonne) : Est = −size/2 + col·pas, Nord = +size/2 − ligne·pas (ligne 0 = nord, colonne 0 = ouest).
Hauteur verticale locale, courbure incluse : z = (R + h)·cos(d/R) − (R + h_site).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from pipeline import geodesy
from pipeline.config import R_REF_M
from pipeline.dem import Dem

FloatArray = NDArray[np.float64]
UINT16_MAX = 65535


@dataclass(frozen=True)
class TerrainGrid:
    """Grille n × n de hauteurs locales (m), avec le nombre de nœuds remplis faute de MNT."""

    z_m: FloatArray
    size_m: float
    n: int
    site_height_m: float
    filled_nodes: int

    @property
    def spacing_m(self) -> float:
        """Pas de la grille."""
        return self.size_m / (self.n - 1)


def _fill_nearest(h: FloatArray) -> tuple[FloatArray, int]:
    """Remplace chaque NaN par la valeur valide la plus proche (distance en nœuds) ; renvoie aussi leur nombre."""
    bad = np.isnan(h)
    count = int(bad.sum())
    if count == 0:
        return h, 0
    if count == h.size:
        raise ValueError("aucune hauteur valide dans la grille")
    good_rc = np.argwhere(~bad)
    out = h.copy()
    for r, c in np.argwhere(bad):  # peu de nœuds en pratique ; boucle bornée par leur nombre
        k = np.argmin((good_rc[:, 0] - r) ** 2 + (good_rc[:, 1] - c) ** 2)
        out[r, c] = h[tuple(good_rc[k])]
    return out, count


def build_terrain_grid(dem: Dem, lat_deg: float, lon_deg: float, size_m: float, n: int) -> TerrainGrid:
    """Échantillonne le MNT sur la grille locale du site et applique la courbure."""
    offsets = -size_m / 2 + np.arange(n) * (size_m / (n - 1))
    east, north = np.meshgrid(offsets, offsets[::-1])
    dist = np.hypot(east, north)
    az = np.degrees(np.arctan2(east, north))
    lat, lon = geodesy.destination(lat_deg, lon_deg, az, dist)
    h, filled = _fill_nearest(np.asarray(dem.height_m(lat, lon), dtype=np.float64))
    h_site = float(h[n // 2, n // 2])
    z = (R_REF_M + h) * np.cos(dist / R_REF_M) - (R_REF_M + h_site)
    return TerrainGrid(z_m=z, size_m=float(size_m), n=int(n), site_height_m=h_site, filled_nodes=filled)


def encode_uint16(z_m: FloatArray) -> tuple[float, float, bytes]:
    """Quantification linéaire uint16 little-endian sur [min, max] (CONTRAT § 6)."""
    z_min, z_max = float(np.min(z_m)), float(np.max(z_m))
    span = z_max - z_min if z_max > z_min else 1.0
    q = np.rint((z_m - z_min) / span * UINT16_MAX).astype("<u2")
    return z_min, z_max, q.tobytes(order="C")


def decode_uint16(raw: bytes, z_min: float, z_max: float, shape: tuple[int, int]) -> FloatArray:
    """Inverse de encode_uint16 : z = min + v/65535·(max − min)."""
    v = np.frombuffer(raw, dtype="<u2").reshape(shape).astype(np.float64)
    return z_min + v / UINT16_MAX * (z_max - z_min)
