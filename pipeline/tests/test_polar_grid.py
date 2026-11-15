"""Grille polaire 480 m (V2-02, D-027) : moyenne par blocs, codage uint16 avec NaN, fichiers produits et cohérents avec le LDEM 80 m."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline.dem_geotiff import read_geotiff_window
from pipeline.polar_grid import BLOCK_PX, MAX_CODE, NO_DATA_CODE, block_mean, encode

ROOT = Path(__file__).resolve().parents[2]
POLAR = ROOT / "web" / "data" / "polar"
LDEM = ROOT / "data" / "raw" / "LDEM_80S_80MPP_ADJ.tiff"


def test_block_mean_averages_blocks_and_requires_half_valid_pixels() -> None:
    """Moyenne exacte par bloc ; un bloc dont moins de la moitié des pixels est valide devient NaN ; le surplus des bords est ignoré."""
    a = np.arange(7 * 7, dtype=float).reshape(7, 7)  # 7 → un seul bloc de 6 par axe
    out = block_mean(a, 6)
    assert out.shape == (1, 1)
    assert out[0, 0] == a[:6, :6].mean()
    b = np.ones((6, 6))
    b[:3, :] = np.nan
    assert block_mean(b, 6)[0, 0] == 1.0  # 18 pixels valides sur 36 : exactement la moitié, gardé
    b[3, :] = np.nan
    assert np.isnan(block_mean(b, 6)[0, 0])  # 12 sur 36 : rejeté


def test_encode_maps_nan_to_the_reserved_code_and_keeps_the_range() -> None:
    """NaN → 65535 ; les valeurs valides couvrent 0..65534 ; décodage à moins d'un pas de quantification."""
    g = np.array([[0.0, 10.0], [np.nan, 5.0]])
    z_min, z_max, raw = encode(g)
    q = np.frombuffer(raw, dtype="<u2").reshape(2, 2)
    assert (z_min, z_max) == (0.0, 10.0)
    assert q[1, 0] == NO_DATA_CODE and q[0, 0] == 0 and q[0, 1] == MAX_CODE
    assert abs(z_min + q[1, 1] / MAX_CODE * (z_max - z_min) - 5.0) <= (z_max - z_min) / MAX_CODE


@pytest.mark.skipif(not (POLAR / "ldem_south_500m.bin").is_file(), reason="grille polaire non construite")
def test_files_are_consistent_and_match_the_80m_ldem_where_it_is_available() -> None:
    """Taille du binaire = n_rows × n_cols × 2 ; la grille 480 m retrouve la moyenne du LDEM 80 m autour de Site04 (écart borné par la quantification)."""
    meta = json.loads((POLAR / "ldem_south_500m.json").read_text(encoding="utf-8"))
    g = meta["grid"]
    raw = (POLAR / "ldem_south_500m.bin").read_bytes()
    assert len(raw) == g["n_rows"] * g["n_cols"] * 2 and g["spacing_m"] == 80.0 * BLOCK_PX and meta["derived"] is True
    if not LDEM.is_file():
        pytest.skip("LDEM absent")
    q = np.frombuffer(raw, dtype="<u2").reshape(g["n_rows"], g["n_cols"]).astype(float)
    z = np.where(q == NO_DATA_CODE, np.nan, meta["z"]["min_m"] + q / MAX_CODE * (meta["z"]["max_m"] - meta["z"]["min_m"]))
    dem = read_geotiff_window(LDEM, -89.7668, -171.8699, 3.0)
    # centre du bloc le plus proche du site (ligne, colonne) ; moyenne des pixels 80 m du bloc recalculée à part
    from pipeline.projection import DEFAULT_PROJECTION

    x, y = (float(v) for v in DEFAULT_PROJECTION.lonlat_to_xy(-89.7668, -171.8699))
    col = int(round((x - g["x_min_m"]) / g["spacing_m"]))
    row = int(round((g["y_max_m"] - y) / g["spacing_m"]))
    block_values = []
    for dr in range(-BLOCK_PX // 2 + 0, BLOCK_PX // 2):
        for dc in range(-BLOCK_PX // 2 + 0, BLOCK_PX // 2):
            bx = g["x_min_m"] + col * g["spacing_m"] + (dc + 0.5) * 80.0
            by = g["y_max_m"] - row * g["spacing_m"] - (dr + 0.5) * 80.0
            lat, lon = DEFAULT_PROJECTION.xy_to_lonlat(bx, by)
            block_values.append(float(dem.height_m(float(lat), float(lon))))
    assert abs(np.nanmean(block_values) - z[row, col]) < 2.0, (np.nanmean(block_values), z[row, col])
