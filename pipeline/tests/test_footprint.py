"""Demi-côté de l'emprise 5 m exporté dans l'index (M-051 § 2.1) : lu dans l'en-tête du GeoTIFF, plafonné à la fenêtre de lecture."""
import numpy as np
import rasterio
from rasterio.transform import from_origin

from pipeline.sites import REAL_NEAR_HALF_KM, footprint_half_km


def _tif(path, n_px):
    with rasterio.open(path, "w", driver="GTiff", width=n_px, height=n_px, count=1, dtype="float32",
                       transform=from_origin(-n_px * 2.5, n_px * 2.5, 5.0, 5.0)) as ds:
        ds.write(np.zeros((1, n_px, n_px), dtype="float32"))


def test_demi_cote_petit_produit(tmp_path):
    _tif(tmp_path / "a.tif", 400)  # 2 km de côté
    assert footprint_half_km(tmp_path / "a.tif") == 1.0


def test_demi_cote_plafonne_a_la_fenetre_de_lecture(tmp_path):
    _tif(tmp_path / "b.tif", 4000)  # 20 km de côté : la fenêtre lue est de ±8,5 km
    assert footprint_half_km(tmp_path / "b.tif") == REAL_NEAR_HALF_KM
    _tif(tmp_path / "c.tif", 3200)  # 16 km : emprise entière
    assert footprint_half_km(tmp_path / "c.tif") == 8.0
