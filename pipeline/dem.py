"""Modèles numériques de terrain : interface `Dem`, grille projetée `GridDem`, combinaison `MultiResDem`.

Hauteurs en mètres au-dessus de la sphère de référence R_REF (docs/ARCHITECTURE.md § 2).
`GridDem` est une grille régulière dans le plan stéréographique polaire Sud, comme les produits LOLA polaires ;
le lecteur de MNT réel (`RasterDem`, T-22) réutilisera son interpolation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence

import numpy as np
from numpy.typing import ArrayLike, NDArray

from pipeline.projection import DEFAULT_PROJECTION, PolarProjection

FloatArray = NDArray[np.float64]
BoolArray = NDArray[np.bool_]


class Dem(ABC):
    """Interface commune : hauteur interpolée, résolution, produit, licence, couverture."""

    product: str
    license: str
    resolution_m: float

    @abstractmethod
    def height_m(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> FloatArray:
        """Hauteur (m) au-dessus de R_REF, interpolation bilinéaire ; NaN hors couverture ou dans un trou."""

    @abstractmethod
    def covers(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> BoolArray:
        """Vrai là où le point est dans l'emprise du MNT (même s'il tombe dans un trou)."""


class GridDem(Dem):
    """Grille n_rows × n_cols de pas `spacing_m` ; ligne 0 en haut (y max), colonne 0 à gauche (x min)."""

    def __init__(self, heights_m: ArrayLike, *, x_min_m: float, y_max_m: float, spacing_m: float,
                 product: str, license: str, projection: PolarProjection = DEFAULT_PROJECTION) -> None:
        """Valide et stocke la grille (float64, pour garder l'interpolation exacte)."""
        values = np.asarray(heights_m, dtype=np.float64)
        if values.ndim != 2 or min(values.shape) < 2:
            raise ValueError(f"grille 2-D d'au moins 2 × 2 attendue (forme reçue {values.shape})")
        if not spacing_m > 0:
            raise ValueError(f"spacing_m doit être > 0 (reçu {spacing_m})")
        self.heights_m = values
        self.x_min_m = float(x_min_m)
        self.y_max_m = float(y_max_m)
        self.spacing_m = float(spacing_m)
        self.resolution_m = float(spacing_m)
        self.product = product
        self.license = license
        self.projection = projection

    def _fractional_indices(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> tuple[FloatArray, FloatArray]:
        """(ligne, colonne) fractionnaires du point dans la grille."""
        x, y = self.projection.lonlat_to_xy(lat_deg, lon_deg)
        return (self.y_max_m - y) / self.spacing_m, (x - self.x_min_m) / self.spacing_m

    def covers(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> BoolArray:
        """Point dans l'emprise [0, n−1] en ligne et en colonne."""
        row, col = self._fractional_indices(lat_deg, lon_deg)
        n_rows, n_cols = self.heights_m.shape
        return (row >= 0) & (row <= n_rows - 1) & (col >= 0) & (col <= n_cols - 1)

    def height_m(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> FloatArray:
        """Interpolation bilinéaire ; NaN hors emprise ou si l'un des 4 nœuds voisins est NaN."""
        row, col = self._fractional_indices(lat_deg, lon_deg)
        n_rows, n_cols = self.heights_m.shape
        inside = self.covers(lat_deg, lon_deg)
        r0 = np.clip(np.floor(np.where(inside, row, 0.0)), 0, n_rows - 2).astype(np.intp)
        c0 = np.clip(np.floor(np.where(inside, col, 0.0)), 0, n_cols - 2).astype(np.intp)
        wr = np.where(inside, row, 0.0) - r0
        wc = np.where(inside, col, 0.0) - c0
        z = self.heights_m
        top = z[r0, c0] * (1.0 - wc) + z[r0, c0 + 1] * wc
        bottom = z[r0 + 1, c0] * (1.0 - wc) + z[r0 + 1, c0 + 1] * wc
        return np.where(inside, top * (1.0 - wr) + bottom * wr, np.nan)


class MultiResDem(Dem):
    """Interroge les MNT dans l'ordre (du plus fin au plus grossier) et garde la première valeur non NaN."""

    def __init__(self, dems: Sequence[Dem]) -> None:
        """`dems[0]` est le plus fin ; sa résolution est celle annoncée."""
        if not dems:
            raise ValueError("MultiResDem demande au moins un MNT")
        self.dems = list(dems)
        self.resolution_m = self.dems[0].resolution_m
        self.product = " + ".join(d.product for d in self.dems)
        self.license = " + ".join(sorted({d.license for d in self.dems}))

    def height_m(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> FloatArray:
        """Première valeur valide dans l'ordre des MNT."""
        out = np.asarray(self.dems[0].height_m(lat_deg, lon_deg), dtype=np.float64)
        for dem in self.dems[1:]:
            missing = np.isnan(out)
            if not missing.any():
                break
            out = np.where(missing, dem.height_m(lat_deg, lon_deg), out)
        return out

    def covers(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> BoolArray:
        """Couvert par au moins un des MNT."""
        result = np.asarray(self.dems[0].covers(lat_deg, lon_deg))
        for dem in self.dems[1:]:
            result = result | dem.covers(lat_deg, lon_deg)
        return result


class FlatDem(Dem):
    """Relief NON MODÉLISÉ (contrat 1.2, `terrain_tier: "flat"`) : hauteur nulle partout, couverture totale ; seul l'horizon géométrique (courbure) reste.

    Ni réel ni fictif : c'est l'absence de relief, dite comme telle (`terrain_modeled: false`).
    """

    product = "FLAT (relief non modélisé)"
    license = "n/a"
    resolution_m = 0.0

    def height_m(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> FloatArray:
        """0 m partout (forme de l'entrée)."""
        return np.zeros(np.broadcast(np.asarray(lat_deg), np.asarray(lon_deg)).shape, dtype=np.float64)

    def covers(self, lat_deg: ArrayLike, lon_deg: ArrayLike) -> BoolArray:
        """Toujours vrai."""
        return np.ones(np.broadcast(np.asarray(lat_deg), np.asarray(lon_deg)).shape, dtype=bool)
