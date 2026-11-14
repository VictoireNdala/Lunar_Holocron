"""Tests du lecteur GeoTIFF par fenêtre : petit fichier écrit par le test (aucun téléchargement)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import Affine

from pipeline.dem_geotiff import read_geotiff_window
from pipeline.projection import lonlat_to_xy, xy_to_lonlat

SOUTH_STERE = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
PIX = 100.0
N = 400  # ±20 km
X0, Y0 = -20_000.0, 20_000.0  # coin haut-gauche


def _write(path: Path, values: np.ndarray, crs: str = SOUTH_STERE, area_or_point: str = "Area") -> Path:
    """Écrit un GeoTIFF float32 de la grille donnée (ligne 0 = y max)."""
    with rasterio.open(path, "w", driver="GTiff", width=values.shape[1], height=values.shape[0], count=1, dtype="float32",
                       crs=crs, transform=Affine(PIX, 0, X0, 0, -PIX, Y0), nodata=np.nan) as ds:
        ds.write(values.astype(np.float32), 1)
        ds.update_tags(AREA_OR_POINT=area_or_point)
    return path


def _plane(a: float = 0.01, b: float = -0.02, c: float = 100.0) -> np.ndarray:
    """Plan a·x + b·y + c évalué aux centres des pixels (convention « Area »)."""
    xc = X0 + (np.arange(N) + 0.5) * PIX
    yc = Y0 - (np.arange(N) + 0.5) * PIX
    xx, yy = np.meshgrid(xc, yc)
    return a * xx + b * yy + c


def test_plane_read_exactly(tmp_path: Path) -> None:
    """Plan incliné : la hauteur interpolée égale le plan (float32 : tolérance 1e-3 m)."""
    path = _write(tmp_path / "plane.tif", _plane())
    dem = read_geotiff_window(path, center_lat_deg=-89.9, center_lon_deg=30.0, half_size_km=8.0)
    rng = np.random.default_rng(1)
    x, y = rng.uniform(-6000, 6000, 500), rng.uniform(-6000, 6000, 500)
    x0, y0 = lonlat_to_xy(-89.9, 30.0)
    lat, lon = xy_to_lonlat(x + x0, y + y0)
    h = dem.height_m(lat, lon)
    xp, yp = lonlat_to_xy(lat, lon)
    assert np.max(np.abs(h - (0.01 * xp - 0.02 * yp + 100.0))) < 1e-3
    assert dem.resolution_m == PIX


def test_point_registration_shifts_half_pixel(tmp_path: Path) -> None:
    """« Point » : les coordonnées du transform désignent les centres ; le plan est lu décalé d'un demi-pixel."""
    area = read_geotiff_window(_write(tmp_path / "a.tif", _plane()), -89.9, 30.0, 8.0)
    point = read_geotiff_window(_write(tmp_path / "p.tif", _plane(), area_or_point="Point"), -89.9, 30.0, 8.0)
    lat, lon = xy_to_lonlat(np.array([1000.0]), np.array([-2000.0]))
    # En « Point », chaque valeur est attribuée 50 m plus à l'ouest et 50 m plus au nord : écart = a·50 − b·50,
    # avec a = 0,01 et b = −0,02, soit +1,5 m.
    a, b = 0.01, -0.02
    assert float(point.height_m(lat, lon)[0] - area.height_m(lat, lon)[0]) == pytest.approx(a * PIX / 2 - b * PIX / 2, abs=1e-3)


def test_orientation_bump(tmp_path: Path) -> None:
    """Une bosse placée en (x > 0, y > 0) du plan projeté est retrouvée au même endroit."""
    v = np.zeros((N, N))
    v[100, 300] = 1000.0  # ligne 100 = y = +9950 m, colonne 300 = x = +10050 m
    dem = read_geotiff_window(_write(tmp_path / "bump.tif", v), -89.9, 0.0, 15.0)
    lat, lon = xy_to_lonlat(np.array([10_050.0]), np.array([9_950.0]))
    assert float(dem.height_m(lat, lon)[0]) == pytest.approx(1000.0, abs=1e-3)


def test_wrong_projection_refused(tmp_path: Path) -> None:
    """Projection différente (pôle Nord, autre rayon) : refusée avec un message clair."""
    path = _write(tmp_path / "north.tif", _plane(), crs=SOUTH_STERE.replace("lat_0=-90", "lat_0=90").replace("lat_ts=-90", "lat_ts=90"))
    with pytest.raises(ValueError, match="lat_0"):
        read_geotiff_window(path, -89.9, 30.0, 5.0)
    path = _write(tmp_path / "radius.tif", _plane(), crs=SOUTH_STERE.replace("R=1737400", "R=1737150"))
    with pytest.raises(ValueError, match="R"):
        read_geotiff_window(path, -89.9, 30.0, 5.0)


def test_window_outside_file_gives_nan(tmp_path: Path) -> None:
    """Fenêtre qui déborde du fichier : NaN au-delà, pas d'exception."""
    dem = read_geotiff_window(_write(tmp_path / "plane.tif", _plane()), -89.9, 30.0, 40.0)
    lat, lon = xy_to_lonlat(np.array([35_000.0]), np.array([0.0]))
    assert np.isnan(dem.height_m(lat, lon)[0])
