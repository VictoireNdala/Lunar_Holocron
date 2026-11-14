"""Tests du masque d'horizon (T-05, TESTS-VALIDATION § 2) : sol lisse, marche, convention d'azimut, symétrie, truncated, NaN."""

from __future__ import annotations

import math
import time
from collections.abc import Callable

import numpy as np
import pytest

from pipeline import geodesy
from pipeline.config import R_REF_M
from pipeline.dem import Dem, GridDem
from pipeline.fixtures.dem_synthetic import make_synthetic_dem
from pipeline.horizon import HorizonConfig, compute_horizon, sample_distances

LAT0, LON0 = -89.0, 0.0
CFG = HorizonConfig(observer_height_m=0.0)


class FunctionDem(Dem):
    """MNT analytique : hauteur = f(est_m, nord_m) autour du site, NaN au-delà de `radius_km` (couverture)."""

    product, license, resolution_m = "TEST-FUNCTION", "n/a", 1.0

    def __init__(self, f: Callable[[np.ndarray, np.ndarray], np.ndarray], radius_km: float = 1e9) -> None:
        self.f, self.radius_m = f, radius_km * 1000.0

    def _local(self, lat, lon):
        d, az = geodesy.distance_azimuth(LAT0, LON0, lat, lon)
        return d, d * np.sin(np.radians(az)), d * np.cos(np.radians(az))

    def height_m(self, lat, lon):
        d, e, n = self._local(np.asarray(lat, float), np.asarray(lon, float))
        return np.where(d <= self.radius_m, self.f(e, n), np.nan)

    def covers(self, lat, lon):
        return self._local(np.asarray(lat, float), np.asarray(lon, float))[0] <= self.radius_m


def _az_distance(e: np.ndarray, n: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """(azimut en degrés, distance en m) à partir de (est, nord)."""
    return np.degrees(np.arctan2(e, n)) % 360.0, np.hypot(e, n)


def test_distances_grid() -> None:
    """Pas de 20 m jusqu'à 25 km, puis 120 m jusqu'à 150 km (borne incluse) ; strictement croissant."""
    d = sample_distances(CFG)
    assert d[0] == 20.0 and d[-1] == 150_000.0 and np.all(np.diff(d) > 0)
    assert d[np.searchsorted(d, 25_000.0)] == 25_000.0
    # 1 249 distances proches (20 m … 24 980 m) + 1 042 lointaines (25 000 m … 149 920 m) + 150 000 m = 2 292 (PIPELINE : « ≈ 2300 »).
    assert d.size == 1249 + 1042 + 1


def test_smooth_ground_is_flat() -> None:
    """Sol lisse (h = 0) : |masque| < 0,01° à tous les azimuts ; jamais sous le plancher de courbure (≈ −0,0003°)."""
    elev, truncated = compute_horizon(FunctionDem(lambda e, n: np.zeros_like(e)), LAT0, LON0, 0.0, CFG)
    assert elev.shape == (360,) and truncated.shape == (360,)
    assert np.max(np.abs(elev)) < 0.01
    assert not truncated.any()


@pytest.mark.parametrize(("height_m", "dist_m", "expected_deg"), [(2000.0, 20_000.0, 5.377488), (2000.0, 50_000.0, 1.464689), (500.0, 5_000.0, 5.627328)])
def test_step_plateau(height_m: float, dist_m: float, expected_deg: float) -> None:
    """Plateau de hauteur H commençant à D dans un secteur (az 80°–100°) : masque = élévation du bord du plateau (tolérance 0,005°).

    Le plateau commence 0,5 m avant D : la distance haversine d'un point échantillonné à D peut valoir D − 1e-4 m ;
    sans cette marge, le premier point du plateau serait l'échantillon suivant (artefact de construction du test).
    """
    def f(e, n):
        az, d = _az_distance(e, n)
        return np.where((d >= dist_m - 0.5) & (az >= 80) & (az <= 100), height_m, 0.0)
    elev, _ = compute_horizon(FunctionDem(f), LAT0, LON0, 0.0, CFG)
    assert elev[85:96].min() == pytest.approx(expected_deg, abs=0.005)
    assert np.max(np.abs(elev[0:70])) < 0.01 and np.max(np.abs(elev[110:360])) < 0.01  # hors secteur : sol plat


@pytest.mark.parametrize(("az_deg", "label"), [(0, "nord"), (90, "est"), (180, "sud"), (270, "ouest")])
def test_azimuth_convention(az_deg: int, label: str) -> None:
    """Montagne isolée au nord / est / sud / ouest : pic du masque à 0° / 90° / 180° / 270° (0 = nord, sens horaire)."""
    e0, n0 = 6000.0 * math.sin(math.radians(az_deg)), 6000.0 * math.cos(math.radians(az_deg))
    def f(e, n):
        return 800.0 * np.exp(-(((e - e0) ** 2 + (n - n0) ** 2) / 1200.0 ** 2))
    elev, _ = compute_horizon(FunctionDem(f), LAT0, LON0, 0.0, CFG)
    peak = int(np.argmax(elev))
    assert min(abs(peak - az_deg), 360 - abs(peak - az_deg)) <= 1, f"{label} : pic à {peak}°"


def test_symmetry_of_revolution_crater() -> None:
    """Cratère de révolution centré sur le site : écart-type du masque < 0,02°."""
    def f(e, n):
        d = np.hypot(e, n)
        return -300.0 * (1 - (d / 3000.0) ** 2) * (d < 3000.0) + 500.0 * np.exp(-(((d - 3000.0) / 700.0) ** 2))
    elev, _ = compute_horizon(FunctionDem(f), LAT0, LON0, 0.0, CFG)
    assert np.std(elev) < 0.02


def test_truncated_flag() -> None:
    """MNT qui s'arrête à 60 km avec far_max = 150 km : truncated partout ; MNT de 160 km : nulle part."""
    flat = lambda e, n: np.zeros_like(e)
    assert compute_horizon(FunctionDem(flat, radius_km=60.0), LAT0, LON0, 0.0, CFG)[1].all()
    assert not compute_horizon(FunctionDem(flat, radius_km=160.0), LAT0, LON0, 0.0, CFG)[1].any()


def test_nan_hole_does_not_erase_mask() -> None:
    """Un trou NaN dans le MNT est ignoré par le maximum ; l'azimut concerné est marqué truncated."""
    def f(e, n):
        az, d = _az_distance(e, n)
        h = np.where((d > 4000) & (d < 5000), 300.0, 0.0)  # relief devant le trou
        return np.where((az > 119.5) & (az < 120.5) & (d > 8000) & (d < 9000), np.nan, h)
    elev, truncated = compute_horizon(FunctionDem(f), LAT0, LON0, 0.0, CFG)
    assert elev[120] > 2.0  # le relief à 4–5 km est conservé
    assert truncated[120] and not truncated[200]


def test_site_outside_dem() -> None:
    """Site entièrement hors MNT : −90° et truncated à tous les azimuts."""
    elev, truncated = compute_horizon(FunctionDem(lambda e, n: np.zeros_like(e), radius_km=0.0001), LAT0, LON0, 0.0, CFG)
    assert (elev == -90.0).all() and truncated.all()


def test_observer_height_lowers_nothing_but_raises_view() -> None:
    """Observateur plus haut : le masque ne peut qu'être plus bas ou égal (même relief)."""
    f = lambda e, n: 300.0 * np.exp(-(((e - 3000.0) ** 2 + n ** 2) / 800.0 ** 2))
    low, _ = compute_horizon(FunctionDem(f), LAT0, LON0, None, HorizonConfig(observer_height_m=0.0))
    high, _ = compute_horizon(FunctionDem(f), LAT0, LON0, None, HorizonConfig(observer_height_m=30.0))
    assert np.all(high <= low + 1e-9) and high[90] < low[90]


def test_rounded_to_hundredth_degree() -> None:
    """Arrondi final à 0,01°."""
    elev, _ = compute_horizon(FunctionDem(lambda e, n: 123.4 * np.exp(-(e ** 2 + n ** 2) / 5e6)), LAT0, LON0, 0.0, CFG)
    assert np.allclose(elev * 100, np.round(elev * 100))


def test_real_grid_dem_and_timing() -> None:
    """Sur un GridDem synthétique (cratère de 8 km, site au centre) : horizon ≈ 20° ; calcul < 30 s par site."""
    dem = make_synthetic_dem("crater", seed=1, resolution_m=100.0, center_lat_deg=LAT0, center_lon_deg=LON0, half_size_km=40.0)
    assert isinstance(dem, GridDem)
    t0 = time.perf_counter()
    elev, truncated = compute_horizon(dem, LAT0, LON0, 2.0, HorizonConfig())
    assert time.perf_counter() - t0 < 30.0
    assert 18.0 < np.median(elev) < 24.0  # atan(1500/4000) ≈ 20,6° (D-014 : horizon du centre du cratère)
    assert truncated.all()  # la grille de 40 km ne couvre pas 150 km


def test_formula_matches_geodesy_helper() -> None:
    """Un seul point de relief : le masque vaut exactement l'élévation de geodesy.point_elevation_deg (même formule, une définition)."""
    h_t, d = 400.0, 3000.0
    def f(e, n):
        az, dist = _az_distance(e, n)
        return np.where((np.abs(dist - d) < 10.0) & (az > 44) & (az < 46), h_t, 0.0)
    elev, _ = compute_horizon(FunctionDem(f), LAT0, LON0, 0.0, CFG)
    assert elev[45] == pytest.approx(round(float(geodesy.point_elevation_deg(h_t, d, 0.0)), 2), abs=0.01)
    assert R_REF_M == 1_737_400.0
