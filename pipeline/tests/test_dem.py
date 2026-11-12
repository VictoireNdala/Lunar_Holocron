"""Tests de l'interface Dem (T-04) : interpolation bilinéaire, couverture, trous, MultiResDem."""

from __future__ import annotations

import numpy as np
import pytest

from pipeline.dem import GridDem, MultiResDem
from pipeline.projection import lonlat_to_xy, xy_to_lonlat

SPACING_M = 100.0


def _plane_dem(a: float = 0.013, b: float = -0.021, c: float = 250.0, n: int = 201) -> GridDem:
    """Grille n × n centrée sur le pôle, valeurs = plan incliné a·x + b·y + c dans le plan projeté."""
    half = (n - 1) / 2 * SPACING_M
    x = -half + np.arange(n) * SPACING_M
    y = half - np.arange(n) * SPACING_M
    xx, yy = np.meshgrid(x, y)
    return GridDem(a * xx + b * yy + c, x_min_m=-half, y_max_m=half, spacing_m=SPACING_M, product="TEST-PLANE", license="n/a")


def test_bilinear_exact_on_inclined_plane() -> None:
    """Sur un plan incliné, l'interpolation bilinéaire est exacte (erreur < 1e-6 m)."""
    a, b, c = 0.013, -0.021, 250.0
    dem = _plane_dem(a, b, c)
    rng = np.random.default_rng(5)
    x, y = rng.uniform(-9_900, 9_900, 5000), rng.uniform(-9_900, 9_900, 5000)
    lat, lon = xy_to_lonlat(x, y)
    h = dem.height_m(lat, lon)
    x2, y2 = lonlat_to_xy(lat, lon)
    assert np.max(np.abs(h - (a * x2 + b * y2 + c))) < 1e-6


def test_grid_nodes_and_edges_are_exact() -> None:
    """Aux nœuds, y compris le dernier rang et la dernière colonne, la valeur stockée est rendue."""
    dem = _plane_dem()
    half = 100 * SPACING_M
    for x, y in [(-half, half), (half, -half), (0.0, 0.0), (half, half)]:
        lat, lon = xy_to_lonlat(x, y)
        assert dem.height_m(lat, lon) == pytest.approx(0.013 * x - 0.021 * y + 250.0, abs=1e-6)


def test_nan_outside_coverage_and_covers() -> None:
    """Hors de la grille : NaN, et covers() le dit."""
    dem = _plane_dem()
    lat, lon = xy_to_lonlat(np.array([0.0, 50_000.0]), np.array([0.0, 0.0]))
    h = dem.height_m(lat, lon)
    assert np.isfinite(h[0]) and np.isnan(h[1])
    assert dem.covers(lat, lon).tolist() == [True, False]


def test_holes_give_nan_only_nearby() -> None:
    """Un trou (NaN) ne contamine que les cellules qui le touchent."""
    dem = _plane_dem()
    values = dem.heights_m.copy()
    values[100, 100] = np.nan  # nœud central = pôle (x = 0, y = 0)
    holed = GridDem(values, x_min_m=dem.x_min_m, y_max_m=dem.y_max_m, spacing_m=SPACING_M, product="TEST", license="n/a")
    lat, lon = xy_to_lonlat(np.array([30.0, 500.0]), np.array([30.0, 500.0]))
    h = holed.height_m(lat, lon)
    assert np.isnan(h[0]) and np.isfinite(h[1])


def test_scalar_and_shape_preserved() -> None:
    """Un scalaire rend un scalaire (tableau 0-d) ; une forme 2-D est conservée."""
    dem = _plane_dem()
    assert np.ndim(dem.height_m(-89.95, 10.0)) == 0
    lat = np.full((3, 4), -89.95)
    assert dem.height_m(lat, np.zeros((3, 4))).shape == (3, 4)


def test_invalid_grid_refused() -> None:
    """Grille non 2-D, trop petite ou pas non positif : refusés."""
    with pytest.raises(ValueError):
        GridDem(np.zeros(5), x_min_m=0, y_max_m=0, spacing_m=1.0, product="X", license="n/a")
    with pytest.raises(ValueError):
        GridDem(np.zeros((1, 5)), x_min_m=0, y_max_m=0, spacing_m=1.0, product="X", license="n/a")
    with pytest.raises(ValueError):
        GridDem(np.zeros((3, 3)), x_min_m=0, y_max_m=0, spacing_m=0.0, product="X", license="n/a")


def test_multires_falls_back_to_coarse() -> None:
    """MultiResDem interroge le fin d'abord, puis le grossier là où le fin est NaN ; NaN au-delà des deux."""
    fine = _plane_dem(c=1000.0, n=21)  # ±1 km
    coarse = _plane_dem(c=0.0, n=201)  # ±10 km
    multi = MultiResDem([fine, coarse])
    lat, lon = xy_to_lonlat(np.array([500.0, 5_000.0, 50_000.0]), np.array([0.0, 0.0, 0.0]))
    h = multi.height_m(lat, lon)
    assert h[0] == pytest.approx(fine.height_m(lat[0], lon[0]))
    assert h[1] == pytest.approx(coarse.height_m(lat[1], lon[1]))
    assert np.isnan(h[2])
    assert multi.covers(lat, lon).tolist() == [True, True, False]
    assert multi.resolution_m == fine.resolution_m
    assert "TEST-PLANE" in multi.product


def test_multires_needs_at_least_one_dem() -> None:
    """MultiResDem vide : refusé."""
    with pytest.raises(ValueError):
        MultiResDem([])
