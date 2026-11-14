"""Tests du MNT synthétique (T-04) : déterminisme, formes plausibles, couverture, cohérence entre résolutions."""

from __future__ import annotations

import numpy as np
import pytest

from pipeline import geodesy
from pipeline.dem import MultiResDem
from pipeline.fixtures.dem_synthetic import KINDS, make_synthetic_dem

LAT0, LON0 = -89.0, 0.0


def _at(dem, east_m: float, north_m: float) -> float:
    """Hauteur au point situé à (east, north) mètres du site, au sol."""
    dist = float(np.hypot(east_m, north_m))
    az = float(np.degrees(np.arctan2(east_m, north_m)))
    lat, lon = geodesy.destination(LAT0, LON0, az, dist)
    return float(dem.height_m(lat, lon))


@pytest.fixture(scope="module")
def crater():
    """Cratère (demo-a), grille de 100 m sur ±20 km."""
    return make_synthetic_dem("crater", seed=1, resolution_m=100.0, center_lat_deg=LAT0, center_lon_deg=LON0, half_size_km=20.0)


def test_deterministic() -> None:
    """Deux appels identiques donnent des grilles identiques ; une autre graine change le bruit."""
    args = dict(resolution_m=200.0, center_lat_deg=LAT0, center_lon_deg=LON0, half_size_km=10.0)
    a = make_synthetic_dem("crater", seed=3, **args)
    b = make_synthetic_dem("crater", seed=3, **args)
    c = make_synthetic_dem("crater", seed=4, **args)
    assert np.array_equal(a.heights_m, b.heights_m)
    assert not np.array_equal(a.heights_m, c.heights_m)
    assert a.product == "SYNTHETIC" and a.license == "n/a"


def test_value_noise_matches_pointwise_hash() -> None:
    """La lecture dans la table des nœuds donne exactement le hachage point par point (non-régression de l'optimisation)."""
    from pipeline.fixtures.dem_synthetic import _hash_unit, value_noise
    rng = np.random.default_rng(12)
    e, n = rng.uniform(-60_000, 60_000, 2000), rng.uniform(-60_000, 60_000, 2000)
    cell, seed = 1500.0, 42
    gx, gy = e / cell, n / cell
    ix, iy = np.floor(gx).astype(np.int64), np.floor(gy).astype(np.int64)
    sx = (gx - ix) ** 2 * (3 - 2 * (gx - ix))
    sy = (gy - iy) ** 2 * (3 - 2 * (gy - iy))
    ref = ((_hash_unit(ix, iy, seed) * (1 - sx) + _hash_unit(ix + 1, iy, seed) * sx) * (1 - sy)
           + (_hash_unit(ix, iy + 1, seed) * (1 - sx) + _hash_unit(ix + 1, iy + 1, seed) * sx) * sy)
    assert np.array_equal(value_noise(e, n, cell, seed), ref)
    assert np.all(np.abs(ref) <= 1.0)


def test_crater_shape(crater) -> None:
    """Cratère : fond négatif au site, rebord ≈ +900 m à 4 km, dorsale au nord."""
    assert _at(crater, 0, 0) < -400
    rim = [_at(crater, 4000 * np.sin(a), 4000 * np.cos(a)) for a in np.radians(np.arange(0, 360, 45))]
    assert all(850 < h < 950 for h in rim), rim
    assert _at(crater, 0, 12_000) - _at(crater, 0, -12_000) > 500


def test_massif_shape() -> None:
    """Massif (demo-b) : sommet ≈ 1800 m à 12 km à l'est, plateau ≈ 0 au site."""
    dem = make_synthetic_dem("massif", seed=1, resolution_m=100.0, center_lat_deg=LAT0, center_lon_deg=LON0, half_size_km=20.0)
    assert 1750 < _at(dem, 12_000, 0) < 1850
    assert abs(_at(dem, 0, 0)) < 40
    assert _at(dem, 12_000, 0) > _at(dem, -12_000, 0) + 1500


def test_flat_amplitude() -> None:
    """Terrain peu accidenté (demo-c) : |h| < 80 m partout."""
    dem = make_synthetic_dem("flat", seed=1, resolution_m=200.0, center_lat_deg=-88.3, center_lon_deg=-120.0, half_size_km=30.0)
    assert np.nanmax(np.abs(dem.heights_m)) < 80


def test_noise_is_weak(crater) -> None:
    """Le bruit fractal reste de l'ordre de ±20 m : écart à la même forme sans bruit."""
    smooth = make_synthetic_dem("crater", seed=1, resolution_m=100.0, center_lat_deg=LAT0, center_lon_deg=LON0,
                                half_size_km=20.0, noise_amplitude_m=0.0)
    assert np.nanmax(np.abs(crater.heights_m - smooth.heights_m)) <= 20.0


def test_nan_beyond_half_size(crater) -> None:
    """Au-delà de la demi-taille demandée (plus la diagonale du carré) : NaN, pour exercer `truncated`."""
    assert np.isnan(_at(crater, 0, 40_000))
    assert np.isfinite(_at(crater, 0, 19_000))


def test_unknown_kind_refused() -> None:
    """Type de terrain inconnu : refusé avec la liste des types."""
    with pytest.raises(ValueError, match="crater"):
        make_synthetic_dem("volcano", seed=1, resolution_m=100.0, center_lat_deg=LAT0, center_lon_deg=LON0, half_size_km=5.0)
    assert set(KINDS) == {"crater", "massif", "flat"}


def test_resolutions_describe_the_same_terrain() -> None:
    """Grille fine et grille grossière (même graine) décrivent le même relief : MultiResDem cohérent."""
    fine = make_synthetic_dem("massif", seed=7, resolution_m=50.0, center_lat_deg=LAT0, center_lon_deg=LON0, half_size_km=5.0)
    coarse = make_synthetic_dem("massif", seed=7, resolution_m=250.0, center_lat_deg=LAT0, center_lon_deg=LON0, half_size_km=30.0)
    rng = np.random.default_rng(0)
    pts = [(e, n) for e, n in rng.uniform(-4_500, 4_500, (200, 2))]
    diffs = [abs(_at(fine, e, n) - _at(coarse, e, n)) for e, n in pts]
    assert max(diffs) < 15.0  # écart d'interpolation entre 50 m et 250 m sur un relief bruité de ±20 m
    multi = MultiResDem([fine, coarse])
    assert np.isfinite(_at(multi, 20_000, 0)) and np.isnan(_at(fine, 20_000, 0))
