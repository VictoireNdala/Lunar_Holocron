"""Tests de géodésie (T-02) : valeurs de docs/TESTS-VALIDATION.md § 3 et § 2 bis, base ENU, vectorisation."""

from __future__ import annotations

import math
import time

import numpy as np
import pytest

from pipeline import config, geodesy

ARC_1DEG_M = config.R_REF_M * math.pi / 180.0  # 1° d'arc sur la sphère de référence


def test_one_degree_arc_length() -> None:
    """1° d'arc = 30 323,35 m (TESTS-VALIDATION § 3)."""
    assert ARC_1DEG_M == pytest.approx(30323.35, abs=0.01)


@pytest.mark.parametrize(("az_deg", "n_deg", "lat_exp", "lon_exp"), [
    (0.0, 1, -88.000000, 0.000000),
    (90.0, 1, -88.585822, 45.004364),
    (270.0, 1, -88.585822, -45.004364),
])
def test_destination_reference_cases(az_deg: float, n_deg: int, lat_exp: float, lon_exp: float) -> None:
    """Trajets depuis (-89, 0) : nord, est, ouest."""
    lat, lon = geodesy.destination(-89.0, 0.0, az_deg, n_deg * ARC_1DEG_M)
    assert lat == pytest.approx(lat_exp, abs=1e-6)
    assert lon == pytest.approx(lon_exp, abs=1e-6)


def test_destination_through_pole() -> None:
    """Vers le sud sur 2° depuis -89 : on passe le pôle, arrivée (-89, ±180)."""
    lat, lon = geodesy.destination(-89.0, 0.0, 180.0, 2 * ARC_1DEG_M)
    assert lat == pytest.approx(-89.0, abs=1e-6)
    assert abs(lon) == pytest.approx(180.0, abs=1e-6)


def _destination_by_rotation(lat: np.ndarray, lon: np.ndarray, az: np.ndarray, dist: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Implémentation indépendante : rotation 3D dans la base ENU."""
    east, north, up = geodesy.enu_basis(lat, lon)
    a, d = np.radians(az)[..., None], (dist / config.R_REF_M)[..., None]
    p = np.cos(d) * up + np.sin(d) * (np.cos(a) * north + np.sin(a) * east)
    return np.degrees(np.arcsin(p[..., 2])), np.degrees(np.arctan2(p[..., 1], p[..., 0]))


def test_destination_agrees_with_vector_rotation() -> None:
    """La formule fermée et la rotation 3D donnent le même point (1000 cas aléatoires, graine fixe)."""
    rng = np.random.default_rng(20261112)
    lat = rng.uniform(-89.99, -80.0, 1000)
    lon = rng.uniform(-180.0, 180.0, 1000)
    az = rng.uniform(0.0, 360.0, 1000)
    dist = rng.uniform(0.0, 150_000.0, 1000)
    lat1, lon1 = geodesy.destination(lat, lon, az, dist)
    lat2, lon2 = _destination_by_rotation(lat, lon, az, dist)
    assert np.max(np.abs(lat1 - lat2)) < 1e-9
    dlon = (lon1 - lon2 + 180.0) % 360.0 - 180.0
    assert np.max(np.abs(dlon * np.cos(np.radians(lat1)))) < 1e-9


def test_destination_zero_distance_and_lon_range() -> None:
    """Distance nulle : même point ; longitudes renvoyées dans [-180, 180)."""
    lat, lon = geodesy.destination(-88.3, -120.0, 37.0, 0.0)
    assert (lat, lon) == pytest.approx((-88.3, -120.0), abs=1e-12)
    _, lons = geodesy.destination(np.full(360, -89.5), np.full(360, 179.9), np.arange(360.0), np.full(360, 50_000.0))
    assert np.all((lons >= -180.0) & (lons < 180.0))


def test_enu_basis_orthonormal_right_handed() -> None:
    """east·north = 0, normes unitaires, east × north = up (1e-12)."""
    rng = np.random.default_rng(1)
    lat, lon = rng.uniform(-89.99, 89.99, 500), rng.uniform(-180, 180, 500)
    east, north, up = geodesy.enu_basis(lat, lon)
    for v in (east, north, up):
        assert np.max(np.abs(np.linalg.norm(v, axis=-1) - 1.0)) < 1e-12
    assert np.max(np.abs(np.sum(east * north, axis=-1))) < 1e-12
    assert np.max(np.abs(np.sum(east * up, axis=-1))) < 1e-12
    assert np.max(np.abs(np.sum(north * up, axis=-1))) < 1e-12
    assert np.max(np.abs(np.cross(east, north) - up)) < 1e-12


def test_north_points_to_north_pole() -> None:
    """Au pôle Sud, « nord » pointe vers +z (vers le pôle Nord) ; à l'équateur aussi."""
    for lat in (-89.99, -45.0, 0.0):
        _, north, _ = geodesy.enu_basis(lat, 30.0)
        assert north[2] > 0


@pytest.mark.parametrize(("e", "n", "az_exp"), [(0, 1, 0.0), (1, 0, 90.0), (0, -1, 180.0), (-1, 0, 270.0), (1, 1, 45.0)])
def test_az_el_cardinal_directions(e: float, n: float, az_exp: float) -> None:
    """Azimut 0 = Nord, 90 = Est, sens horaire."""
    east, north, up = geodesy.enu_basis(-89.0, 10.0)
    az, el = geodesy.az_el_from_vector(e * east + n * north, east, north, up)
    assert az == pytest.approx(az_exp, abs=1e-9)
    assert el == pytest.approx(0.0, abs=1e-9)


def test_az_wraps_into_0_360() -> None:
    """Un vecteur juste à l'ouest du nord donne un azimut proche de 360, jamais négatif ni égal à 360."""
    east, north, up = geodesy.enu_basis(-89.0, 0.0)
    az, _ = geodesy.az_el_from_vector(north - 1e-6 * east, east, north, up)
    assert 359.99 < az < 360.0
    az0, _ = geodesy.az_el_from_vector(north, east, north, up)
    assert az0 == 0.0


def test_elevation_of_vector() -> None:
    """Élévation : 90° à la verticale, 30° pour une pente de tan 30°."""
    east, north, up = geodesy.enu_basis(-88.0, 45.0)
    _, el = geodesy.az_el_from_vector(up, east, north, up)
    assert el == pytest.approx(90.0, abs=1e-9)
    _, el = geodesy.az_el_from_vector(north + math.tan(math.radians(30)) * up, east, north, up)
    assert el == pytest.approx(30.0, abs=1e-9)


def test_site_position() -> None:
    """Position du site : (R_REF + h) · up, en mètres."""
    pos = geodesy.site_position_moon_me(-89.99, 0.0, 100.0)
    assert np.linalg.norm(pos) == pytest.approx(config.R_REF_M + 100.0, abs=1e-6)
    assert pos[2] < 0


@pytest.mark.parametrize(("h_t", "d", "el_exp"), [
    (1000.0, 100_000.0, -1.076279),
    (0.0, 10_000.0, -0.164889),
    (0.0, 100_000.0, -1.648894),
    (2000.0, 20_000.0, 5.377488),
    (2000.0, 50_000.0, 1.464689),
    (500.0, 5_000.0, 5.627328),
])
def test_point_elevation_reference_cases(h_t: float, d: float, el_exp: float) -> None:
    """Élévation d'un point du relief, courbure incluse (TESTS-VALIDATION § 2 et § 2 bis)."""
    assert geodesy.point_elevation_deg(h_t, d, 0.0) == pytest.approx(el_exp, abs=1e-6)


def test_point_elevation_observer_height() -> None:
    """Un observateur plus haut voit le même point plus bas."""
    assert geodesy.point_elevation_deg(100.0, 1000.0, 2.0) < geodesy.point_elevation_deg(100.0, 1000.0, 0.0)


def test_vectorized_one_million_points_under_one_second() -> None:
    """Un appel sur 1 million de points prend moins d'une seconde."""
    rng = np.random.default_rng(7)
    n = 1_000_000
    lat, lon = rng.uniform(-89.99, -80, n), rng.uniform(-180, 180, n)
    az, dist = rng.uniform(0, 360, n), rng.uniform(0, 150_000, n)
    t0 = time.perf_counter()
    geodesy.destination(lat, lon, az, dist)
    assert time.perf_counter() - t0 < 1.0
    t0 = time.perf_counter()
    geodesy.point_elevation_deg(rng.uniform(-500, 2000, n), dist, 2.0)
    assert time.perf_counter() - t0 < 1.0
