"""Pyramide de tuiles du fond polaire (M-051 § 2.2) : codage réversible, sélection des tuiles, cohérence manifeste / fichiers."""
import json
from pathlib import Path

import numpy as np
import pytest

from pipeline.polar_tiles import STORED_PX, TILE_PX, decode_tile, encode_tile, level_samples, quantize, wanted_tiles
from pipeline.polar_grid import NO_DATA_CODE

POLAR = Path(__file__).resolve().parents[2] / "web" / "data" / "polar"


def test_codage_reversible_avec_trous():
    rng = np.random.default_rng(7)
    z = np.cumsum(rng.normal(0, 3, (STORED_PX, STORED_PX)), axis=1) - 800.0
    z[10:14, 20:30] = np.nan
    codes = quantize(z, -7300.0, 7100.0)
    assert (codes[10:14, 20:30] == NO_DATA_CODE).all()
    assert np.array_equal(decode_tile(encode_tile(codes)), codes)
    assert encode_tile(codes) == encode_tile(codes)  # reproductible


def test_quantification_pas_inferieur_a_25_cm():
    z = np.linspace(-7300, 7100, 1000).reshape(10, 100)
    codes = quantize(z, -7300.0, 7100.0).astype(float)
    back = -7300.0 + codes / 65534 * 14400.0
    assert np.abs(back - z).max() < 0.25


def test_echantillons_de_niveau_moyenne_et_bords():
    v = np.arange(36, dtype=float).reshape(6, 6)
    out = level_samples(v, 3, (0, 2), (0, 2))
    assert out[0, 0] == v[0:3, 0:3].mean() and out[1, 1] == v[3:6, 3:6].mean()
    pad = level_samples(v, 3, (-1, 3), (-1, 3))  # bordure hors du LDEM : NaN
    assert np.isnan(pad[0, :]).all() and np.isnan(pad[:, 0]).all() and np.isfinite(pad[1, 1])
    assert level_samples(v, 1, (0, 2), (0, 2)).tolist() == v[:2, :2].tolist()


def test_tuiles_voulues_fenetre_autour_du_site():
    spacing, n = 80.0, 7600
    x0, y0 = -303960.0, 303960.0
    one = wanted_tiles([(0.0, 0.0)], 1.0, x0, y0, spacing, n)  # ±1 km au pôle : une ou quelques tuiles voisines
    assert 1 <= len(one) <= 4
    big = wanted_tiles([(0.0, 0.0)], 12.0, x0, y0, spacing, n)
    assert one <= big and len(big) >= 4
    assert all(0 <= tx < n // TILE_PX + 1 and 0 <= ty < n // TILE_PX + 1 for tx, ty in big)


@pytest.mark.skipif(not (POLAR / "tiles.json").is_file(), reason="pyramide non construite")
def test_manifeste_coherent_avec_les_fichiers():
    m = json.loads((POLAR / "tiles.json").read_text(encoding="utf-8"))
    total = 0
    for lv in m["levels"]:
        assert len(lv["tiles"]) == len({tuple(t) for t in lv["tiles"]})
        size = 0
        for tx, ty in lv["tiles"]:
            f = POLAR / "tiles" / str(int(lv["spacing_m"])) / f"{tx}_{ty}.bin"
            assert f.is_file(), f
            size += f.stat().st_size
        assert size == lv["bytes"]
        total += size
    assert total == m["total_bytes"]
    first = m["levels"][0]["tiles"][0]
    codes = decode_tile((POLAR / "tiles" / str(int(m["levels"][0]["spacing_m"])) / f"{first[0]}_{first[1]}.bin").read_bytes())
    assert codes.shape == (STORED_PX, STORED_PX)
