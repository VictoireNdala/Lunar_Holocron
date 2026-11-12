"""Terrains synthétiques déterministes (mode démonstration, docs/PIPELINE.md § dem_synthetic).

VALEURS FICTIVES : produit "SYNTHETIC", donc `synthetic: true` dans toutes les sorties.
Le relief est une fonction continue des coordonnées locales au sol autour du site (est, nord en mètres,
obtenues par distance et azimut sur la sphère). Il est échantillonné sur une grille du plan stéréographique polaire :
deux grilles de résolutions différentes, mais de même graine, décrivent donc le même terrain.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

from pipeline import geodesy
from pipeline.dem import GridDem
from pipeline.projection import DEFAULT_PROJECTION

FloatArray = NDArray[np.float64]
KINDS = ("crater", "massif", "flat")
ROWS_PER_CHUNK = 256  # génération par bandes de lignes, pour borner la mémoire

# Paramètres des scénarios (fictifs, docs/PIPELINE.md § 1, tableau des sites de démonstration).
CRATER = {"radius_m": 4000.0, "depth_m": 600.0, "rim_height_m": 900.0, "rim_width_m": 1500.0,
          "ridge_north_m": 12000.0, "ridge_height_m": 700.0, "ridge_sigma_north_m": 2000.0, "ridge_sigma_east_m": 8000.0}
MASSIF = {"peak_east_m": 12000.0, "peak_north_m": 0.0, "peak_height_m": 1800.0, "peak_sigma_m": 3000.0}
FLAT = {"undulation_amplitude_m": 30.0, "undulation_cell_m": 20000.0, "noise_amplitude_m": 20.0}
NOISE = {"base_cell_m": 4000.0, "octaves": 5, "amplitude_m": 10.0}  # somme des octaves < 2 × amplitude ≈ 20 m

_MASK64 = np.uint64(0xFFFFFFFFFFFFFFFF)


def _hash_unit(ix: NDArray[np.int64], iy: NDArray[np.int64], seed: int) -> FloatArray:
    """Valeur pseudo-aléatoire déterministe dans [-1, 1) attachée au nœud entier (ix, iy) (mélangeur de type splitmix64)."""
    h = ix.astype(np.uint64) * np.uint64(0x9E3779B97F4A7C15)
    h ^= iy.astype(np.uint64) * np.uint64(0xC2B2AE3D27D4EB4F)
    h ^= np.uint64((seed * 0x165667B19E3779F9) & 0xFFFFFFFFFFFFFFFF)
    h ^= h >> np.uint64(33)
    h *= np.uint64(0xFF51AFD7ED558CCD)
    h ^= h >> np.uint64(33)
    h *= np.uint64(0xC4CEB9FE1A85EC53)
    h ^= h >> np.uint64(33)
    return (h >> np.uint64(11)).astype(np.float64) / float(2**53) * 2.0 - 1.0


def value_noise(east_m: FloatArray, north_m: FloatArray, cell_m: float, seed: int) -> FloatArray:
    """Bruit de valeur lissé (smoothstep) sur un réseau de pas `cell_m` ; continu, dans [-1, 1]."""
    gx, gy = east_m / cell_m, north_m / cell_m
    ix, iy = np.floor(gx).astype(np.int64), np.floor(gy).astype(np.int64)
    fx, fy = gx - ix, gy - iy
    sx, sy = fx * fx * (3.0 - 2.0 * fx), fy * fy * (3.0 - 2.0 * fy)
    # Table des valeurs aux nœuds du réseau couvert (petite), puis lecture : mêmes valeurs que le hachage point par point.
    ix0, iy0 = int(ix.min()), int(iy.min())
    tx, ty = np.meshgrid(np.arange(ix0, int(ix.max()) + 2), np.arange(iy0, int(iy.max()) + 2))
    table = _hash_unit(tx, ty, seed)
    jx, jy = ix - ix0, iy - iy0
    v00, v10 = table[jy, jx], table[jy, jx + 1]
    v01, v11 = table[jy + 1, jx], table[jy + 1, jx + 1]
    return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy


def fractal_noise(east_m: FloatArray, north_m: FloatArray, seed: int, amplitude_m: float) -> FloatArray:
    """Somme d'octaves de bruit de valeur (pas divisé par 2, amplitude divisée par 2)."""
    total = np.zeros_like(east_m)
    for k in range(NOISE["octaves"]):
        total += amplitude_m / 2**k * value_noise(east_m, north_m, NOISE["base_cell_m"] / 2**k, seed + 1000 * k)
    return total


def _gauss(u: FloatArray) -> FloatArray:
    """Profil gaussien exp(−u²)."""
    return np.exp(-u * u)


def terrain_height_m(kind: str, east_m: FloatArray, north_m: FloatArray, seed: int, noise_amplitude_m: float) -> FloatArray:
    """Hauteur fictive (m) en fonction des coordonnées locales au sol autour du site."""
    r = np.hypot(east_m, north_m)
    if kind == "crater":
        c = CRATER
        bowl = np.where(r < c["radius_m"], -c["depth_m"] * (1.0 - (r / c["radius_m"]) ** 2), 0.0)
        rim = c["rim_height_m"] * _gauss((r - c["radius_m"]) / c["rim_width_m"])
        ridge = c["ridge_height_m"] * _gauss((north_m - c["ridge_north_m"]) / c["ridge_sigma_north_m"]) * _gauss(east_m / c["ridge_sigma_east_m"])
        base = bowl + rim + ridge
    elif kind == "massif":
        m = MASSIF
        base = m["peak_height_m"] * _gauss(np.hypot(east_m - m["peak_east_m"], north_m - m["peak_north_m"]) / m["peak_sigma_m"])
    elif kind == "flat":
        f = FLAT
        base = f["undulation_amplitude_m"] * value_noise(east_m, north_m, f["undulation_cell_m"], seed + 77)
        noise_amplitude_m = min(noise_amplitude_m, f["noise_amplitude_m"] / 2.0)
    else:
        raise ValueError(f"type de terrain inconnu {kind!r} ; attendu l'un de {KINDS}")
    return base + fractal_noise(east_m, north_m, seed, noise_amplitude_m)


def make_synthetic_dem(kind: str, seed: int, resolution_m: float, center_lat_deg: float, center_lon_deg: float,
                       half_size_km: float, noise_amplitude_m: float = NOISE["amplitude_m"]) -> GridDem:
    """Grille carrée de demi-côté `half_size_km` centrée sur le site (plan stéréographique) ; NaN au-delà, par construction."""
    if kind not in KINDS:
        raise ValueError(f"type de terrain inconnu {kind!r} ; attendu l'un de {KINDS}")
    half_m = half_size_km * 1000.0
    n = int(np.floor(2.0 * half_m / resolution_m)) + 1
    x0, y0 = DEFAULT_PROJECTION.lonlat_to_xy(center_lat_deg, center_lon_deg)
    x_min, y_max = float(x0) - (n - 1) / 2 * resolution_m, float(y0) + (n - 1) / 2 * resolution_m
    x = x_min + np.arange(n) * resolution_m
    heights = np.empty((n, n), dtype=np.float64)
    for start in range(0, n, ROWS_PER_CHUNK):
        rows = np.arange(start, min(start + ROWS_PER_CHUNK, n))
        xx, yy = np.meshgrid(x, y_max - rows * resolution_m)
        lat, lon = DEFAULT_PROJECTION.xy_to_lonlat(xx, yy)
        dist, az = geodesy.distance_azimuth(center_lat_deg, center_lon_deg, lat, lon)
        az_rad = np.radians(az)
        heights[rows] = terrain_height_m(kind, dist * np.sin(az_rad), dist * np.cos(az_rad), seed, noise_amplitude_m)
    return GridDem(heights, x_min_m=x_min, y_max_m=y_max, spacing_m=resolution_m, product="SYNTHETIC", license="n/a")
