"""Géodésie sur la sphère de référence : trajet sphérique, base ENU, azimut/élévation, élévation d'un point du relief.

Conventions (docs/ARCHITECTURE.md § 2) : latitude sélénocentrique négative au Sud, longitude Est positive,
azimut 0 = Nord, 90 = Est, sens horaire, dans [0, 360) ; élévation géométrique au-dessus du plan horizontal local.
Toutes les fonctions acceptent des scalaires ou des tableaux NumPy (diffusion standard).
"""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike, NDArray

from pipeline.config import R_REF_M

FloatArray = NDArray[np.float64]


def wrap_lon_deg(lon_deg: ArrayLike) -> FloatArray:
    """Ramène une longitude dans [-180, 180)."""
    return (np.asarray(lon_deg, dtype=np.float64) + 180.0) % 360.0 - 180.0


def wrap_az_deg(az_deg: ArrayLike) -> FloatArray:
    """Ramène un azimut dans [0, 360) (le cas 360 − ε arrondi à 360 est ramené à 0)."""
    az = np.asarray(az_deg, dtype=np.float64) % 360.0
    return np.where(az >= 360.0, 0.0, az)


def destination(lat_deg: ArrayLike, lon_deg: ArrayLike, az_deg: ArrayLike, dist_m: ArrayLike,
                radius_m: float = R_REF_M) -> tuple[FloatArray, FloatArray]:
    """Point atteint depuis (lat, lon) en suivant l'azimut `az_deg` sur la distance au sol `dist_m` (ARCHITECTURE § 3)."""
    lat = np.radians(np.asarray(lat_deg, dtype=np.float64))
    lon = np.radians(np.asarray(lon_deg, dtype=np.float64))
    az = np.radians(np.asarray(az_deg, dtype=np.float64))
    delta = np.asarray(dist_m, dtype=np.float64) / radius_m
    sin_lat, cos_lat = np.sin(lat), np.cos(lat)
    sin_d, cos_d = np.sin(delta), np.cos(delta)
    sin_lat2 = np.clip(sin_lat * cos_d + cos_lat * sin_d * np.cos(az), -1.0, 1.0)
    lat2 = np.arcsin(sin_lat2)
    lon2 = lon + np.arctan2(np.sin(az) * sin_d * cos_lat, cos_d - sin_lat * sin_lat2)
    return np.degrees(lat2), wrap_lon_deg(np.degrees(lon2))


def distance_azimuth(lat1_deg: ArrayLike, lon1_deg: ArrayLike, lat2_deg: ArrayLike, lon2_deg: ArrayLike,
                     radius_m: float = R_REF_M) -> tuple[FloatArray, FloatArray]:
    """Problème inverse : distance au sol (m, haversine) et azimut initial [0, 360) du point 1 vers le point 2."""
    lat1 = np.radians(np.asarray(lat1_deg, dtype=np.float64))
    lat2 = np.radians(np.asarray(lat2_deg, dtype=np.float64))
    dlon = np.radians(np.asarray(lon2_deg, dtype=np.float64) - np.asarray(lon1_deg, dtype=np.float64))
    hav = np.sin((lat2 - lat1) / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    delta = 2.0 * np.arctan2(np.sqrt(hav), np.sqrt(np.clip(1.0 - hav, 0.0, None)))
    az = np.arctan2(np.sin(dlon) * np.cos(lat2), np.cos(lat1) * np.sin(lat2) - np.sin(lat1) * np.cos(lat2) * np.cos(dlon))
    return delta * radius_m, wrap_az_deg(np.degrees(az))


def enu_basis(lat_deg: ArrayLike, lon_deg: ArrayLike) -> tuple[FloatArray, FloatArray, FloatArray]:
    """Vecteurs unitaires (east, north, up) dans MOON_ME, de forme (..., 3) (docs/PIPELINE.md § geodesy)."""
    lat = np.radians(np.asarray(lat_deg, dtype=np.float64))
    lon = np.radians(np.asarray(lon_deg, dtype=np.float64))
    sin_lat, cos_lat, sin_lon, cos_lon = np.sin(lat), np.cos(lat), np.sin(lon), np.cos(lon)
    zero = np.zeros_like(lat)
    up = np.stack([cos_lat * cos_lon, cos_lat * sin_lon, sin_lat], axis=-1)
    east = np.stack([-sin_lon, cos_lon, zero], axis=-1)
    north = np.stack([-sin_lat * cos_lon, -sin_lat * sin_lon, cos_lat], axis=-1)
    return east, north, up


def az_el_from_vector(v: ArrayLike, east: ArrayLike, north: ArrayLike, up: ArrayLike) -> tuple[FloatArray, FloatArray]:
    """Azimut [0, 360) et élévation (degrés) d'un vecteur dans la base locale ; dernier axe = composantes x, y, z."""
    v = np.asarray(v, dtype=np.float64)
    v_e = np.sum(v * east, axis=-1)
    v_n = np.sum(v * north, axis=-1)
    v_u = np.sum(v * up, axis=-1)
    norm = np.linalg.norm(v, axis=-1)
    az = wrap_az_deg(np.degrees(np.arctan2(v_e, v_n)))
    el = np.degrees(np.arcsin(np.clip(v_u / norm, -1.0, 1.0)))
    return az, el


def site_position_moon_me(lat_deg: ArrayLike, lon_deg: ArrayLike, height_m: ArrayLike,
                          radius_m: float = R_REF_M) -> FloatArray:
    """Position du site dans MOON_ME, en **mètres** : (R_REF + h) · up."""
    _, _, up = enu_basis(lat_deg, lon_deg)
    return (radius_m + np.asarray(height_m, dtype=np.float64))[..., None] * up


def point_elevation_deg(h_target_m: ArrayLike, dist_m: ArrayLike, h_observer_m: ArrayLike,
                        radius_m: float = R_REF_M) -> FloatArray:
    """Élévation (degrés) d'un point du relief de hauteur h_t à la distance au sol d, courbure incluse (ARCHITECTURE § 3)."""
    h_t = np.asarray(h_target_m, dtype=np.float64)
    h_o = np.asarray(h_observer_m, dtype=np.float64)
    delta = np.asarray(dist_m, dtype=np.float64) / radius_m
    r_t = radius_m + h_t
    return np.degrees(np.arctan2(r_t * np.cos(delta) - (radius_m + h_o), r_t * np.sin(delta)))
