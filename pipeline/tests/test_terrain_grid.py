"""Tests de la grille de terrain 3D (CONTRAT § 6) : orientation, courbure, encodage uint16."""

from __future__ import annotations

import numpy as np
import pytest

from pipeline.config import R_REF_M
from pipeline.dem_synthetic import make_synthetic_dem
from pipeline.terrain_grid import build_terrain_grid, decode_uint16, encode_uint16


@pytest.fixture(scope="module")
def massif_grid():
    """Massif synthétique à 12 km à l'est ; grille de 30 km, 61 nœuds."""
    dem = make_synthetic_dem("massif", seed=1, resolution_m=200.0, center_lat_deg=-89.0, center_lon_deg=0.0, half_size_km=25.0)
    return build_terrain_grid(dem, -89.0, 0.0, size_m=30_000.0, n=61)


def test_orientation_row0_north_col0_west(massif_grid) -> None:
    """Le sommet (12 km à l'est) tombe dans la colonne attendue, sur la ligne du milieu."""
    z = massif_grid.z_m
    row, col = np.unravel_index(np.nanargmax(z), z.shape)
    assert row == 30
    assert col == 30 + 24  # 12 km / 500 m


def test_site_at_zero_and_curvature() -> None:
    """Le site vaut 0 ; un sol plat (h = 0) descend de (R)·(1 − cos(d/R)) avec la distance."""
    flat = make_synthetic_dem("flat", seed=1, resolution_m=200.0, center_lat_deg=-89.0, center_lon_deg=0.0,
                              half_size_km=20.0, noise_amplitude_m=0.0)
    flat.heights_m[:] = 0.0
    g = build_terrain_grid(flat, -89.0, 0.0, size_m=20_000.0, n=21)
    assert g.z_m[10, 10] == pytest.approx(0.0, abs=1e-6)
    expected = R_REF_M * np.cos(10_000.0 / R_REF_M) - R_REF_M
    assert g.z_m[0, 10] == pytest.approx(expected, abs=1e-3)
    assert expected == pytest.approx(-28.78, abs=0.01)  # ≈ 29 m à 10 km (CONTRAT § 6)


def test_nan_filled_and_counted() -> None:
    """Les nœuds hors MNT sont remplis par le plus proche voisin valide et comptés."""
    dem = make_synthetic_dem("flat", seed=1, resolution_m=200.0, center_lat_deg=-89.0, center_lon_deg=0.0, half_size_km=8.0)
    g = build_terrain_grid(dem, -89.0, 0.0, size_m=20_000.0, n=21)
    assert g.filled_nodes > 0
    assert np.all(np.isfinite(g.z_m))


def test_uint16_round_trip(massif_grid) -> None:
    """Décodage uint16 : erreur ≤ demi-pas de quantification ; 2·n² octets little-endian."""
    z_min, z_max, raw = encode_uint16(massif_grid.z_m)
    assert len(raw) == 2 * massif_grid.z_m.size
    back = decode_uint16(raw, z_min, z_max, massif_grid.z_m.shape)
    assert np.max(np.abs(back - massif_grid.z_m)) <= (z_max - z_min) / 65535 / 2 + 1e-9


def test_deterministic(massif_grid) -> None:
    """Même entrée → mêmes octets."""
    dem = make_synthetic_dem("massif", seed=1, resolution_m=200.0, center_lat_deg=-89.0, center_lon_deg=0.0, half_size_km=25.0)
    again = build_terrain_grid(dem, -89.0, 0.0, size_m=30_000.0, n=61)
    assert encode_uint16(again.z_m) == encode_uint16(massif_grid.z_m)
