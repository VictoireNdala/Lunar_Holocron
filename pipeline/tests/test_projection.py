"""Tests de la projection stéréographique polaire Sud (T-02) : docs/TESTS-VALIDATION.md § 3."""

from __future__ import annotations

import time

import numpy as np
import pytest

from pipeline import config
from pipeline.projection import DEFAULT_PROJECTION, PolarProjection, lonlat_to_xy, xy_to_lonlat


@pytest.mark.parametrize(("lat", "lon", "x_exp", "y_exp"), [
    (-90.0, 0.0, 0.0, 0.0),
    (-89.0, 0.0, 0.0, 30324.12),
    (-89.0, 90.0, 30324.12, 0.0),
    (-89.0, 180.0, 0.0, -30324.12),
    (-89.0, -90.0, -30324.12, 0.0),
    (-85.0, 45.0, 107277.323, 107277.323),
])
def test_reference_cases(lat: float, lon: float, x_exp: float, y_exp: float) -> None:
    """Valeurs de référence, tolérance 0,01 m ; lon 0 vers +y, lon 90 E vers +x."""
    x, y = lonlat_to_xy(lat, lon)
    assert x == pytest.approx(x_exp, abs=0.01)
    assert y == pytest.approx(y_exp, abs=0.01)


def _random_points(n: int = 1000) -> tuple[np.ndarray, np.ndarray]:
    """Points aléatoires (graine fixe) entre -90° et -80°."""
    rng = np.random.default_rng(42)
    return rng.uniform(-90.0, -80.0, n), rng.uniform(-180.0, 180.0, n)


def test_round_trip_lonlat_xy_lonlat() -> None:
    """lonlat → xy → lonlat : erreur < 1e-9° (longitude comparée modulo 360)."""
    lat, lon = _random_points()
    lat2, lon2 = xy_to_lonlat(*lonlat_to_xy(lat, lon))
    assert np.max(np.abs(lat2 - lat)) < 1e-9
    dlon = (lon2 - lon + 180.0) % 360.0 - 180.0
    assert np.max(np.abs(dlon)) < 1e-9


def test_round_trip_xy_lonlat_xy() -> None:
    """xy → lonlat → xy : erreur < 1e-6 m."""
    rng = np.random.default_rng(3)
    x, y = rng.uniform(-300_000, 300_000, 1000), rng.uniform(-300_000, 300_000, 1000)
    x2, y2 = lonlat_to_xy(*xy_to_lonlat(x, y))
    assert np.max(np.abs(x2 - x)) < 1e-6
    assert np.max(np.abs(y2 - y)) < 1e-6


def test_inverse_at_origin_is_pole() -> None:
    """L'origine se projette au pôle Sud ; longitude renvoyée dans [-180, 180)."""
    lat, lon = xy_to_lonlat(0.0, 0.0)
    assert lat == pytest.approx(-90.0, abs=1e-12)
    assert -180.0 <= lon < 180.0


def test_default_parameters() -> None:
    """Paramètres par défaut : sphère R_REF, λ0 = 0, échelle vraie au pôle, pas de décalage."""
    p = DEFAULT_PROJECTION
    assert (p.radius_m, p.center_lon_deg, p.scale_k0, p.false_easting_m, p.false_northing_m) == (config.R_REF_M, 0.0, 1.0, 0.0, 0.0)


def test_parametrized_projection() -> None:
    """λ0, facteur d'échelle et décalages sont appliqués, et l'inverse les retire."""
    base_x, base_y = lonlat_to_xy(-88.0, 120.0)
    p = PolarProjection(center_lon_deg=90.0)
    x, y = p.lonlat_to_xy(-88.0, 210.0)
    assert (x, y) == pytest.approx((base_x, base_y), abs=1e-6)
    p = PolarProjection(scale_k0=0.5, false_easting_m=1000.0, false_northing_m=-2000.0)
    x, y = p.lonlat_to_xy(-88.0, 120.0)
    assert (x, y) == pytest.approx((0.5 * base_x + 1000.0, 0.5 * base_y - 2000.0), abs=1e-6)
    lat, lon = p.xy_to_lonlat(x, y)
    assert (lat, lon) == pytest.approx((-88.0, 120.0), abs=1e-9)


def test_invalid_parameters_refused() -> None:
    """Rayon ou facteur d'échelle non positifs : refusés."""
    with pytest.raises(ValueError):
        PolarProjection(radius_m=0.0)
    with pytest.raises(ValueError):
        PolarProjection(scale_k0=-1.0)


def test_vectorized_one_million_points_under_one_second() -> None:
    """Aller et retour sur 1 million de points : chacun < 1 s."""
    rng = np.random.default_rng(11)
    lat, lon = rng.uniform(-90, -80, 1_000_000), rng.uniform(-180, 180, 1_000_000)
    t0 = time.perf_counter()
    x, y = lonlat_to_xy(lat, lon)
    assert time.perf_counter() - t0 < 1.0
    t0 = time.perf_counter()
    xy_to_lonlat(x, y)
    assert time.perf_counter() - t0 < 1.0
