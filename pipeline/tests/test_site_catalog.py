"""Tests de l'outil de catalogue des sites réels (S-01) : le centre vient de l'emprise du fichier, jamais saisi à la main."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
import rasterio
from rasterio.transform import Affine

from pipeline.projection import lonlat_to_xy
from pipeline.tools.site_catalog import extent_center, make_entry, update_catalog

SOUTH_STERE = "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"


def _write(path: Path, x0: float, y0: float, n: int = 40, pix: float = 5.0) -> Path:
    """GeoTIFF n × n de pixels `pix`, coin haut-gauche (x0, y0), hauteur = 100 + colonne."""
    values = np.tile(100.0 + np.arange(n, dtype=np.float32), (n, 1))
    with rasterio.open(path, "w", driver="GTiff", width=n, height=n, count=1, dtype="float32", crs=SOUTH_STERE,
                       transform=Affine(pix, 0, x0, 0, -pix, y0), nodata=np.nan) as ds:
        ds.write(values, 1)
        ds.update_tags(AREA_OR_POINT="Area")
    return path


def test_center_is_extent_center(tmp_path: Path) -> None:
    """Le centre est le milieu de l'emprise (bord à bord) : ici x = x0 + 100, y = y0 − 100, converti en (lat, lon)."""
    path = _write(tmp_path / "Site99_final_adj_5mpp_surf.tif", x0=-9000.0, y0=1000.0)
    lat, lon, info = extent_center(path)
    xc, yc = lonlat_to_xy(lat, lon)
    assert (float(xc), float(yc)) == pytest.approx((-8900.0, 900.0), abs=1e-6)
    assert info["width"] == 40 and info["pixel_m"] == 5.0 and info["area_or_point"] == "Area"


def test_entry_has_both_labels_and_honesty_flags(tmp_path: Path) -> None:
    """D-018 : deux étiquettes (nasa_2024_region, lola_priority_site) ; D-016 : deux drapeaux d'honnêteté ; verified faux."""
    path = _write(tmp_path / "Site99_final_adj_5mpp_surf.tif", x0=-9000.0, y0=1000.0)
    e = make_entry("site99", "Site99", path, label_fr="Site d'essai", label_en="Test site", tier=1, lola_priority_site=True,
                   nasa_2024_region=None, read_date="2026-11-14")
    assert e["lola_priority_site"] is True and e["nasa_2024_region"] is None
    assert e["terrain_real"] is True and e["ephemeris_synthetic"] is True and e["verified"] is False
    assert "Site99_final_adj_5mpp_surf.tif" in e["center"]["source"] and "2026-11-14" in e["center"]["source"]
    assert len(e["dem"]["sha256"]) == 64 and e["dem"]["resolution_m"] == 5.0
    assert -89.99 <= e["center"]["lat_deg"] <= 89.99 and -180 <= e["center"]["lon_deg"] < 180


def test_update_catalog_replaces_same_id(tmp_path: Path) -> None:
    """Ajouter deux fois le même identifiant remplace l'entrée (sorties stables)."""
    path = _write(tmp_path / "Site99_final_adj_5mpp_surf.tif", x0=-9000.0, y0=1000.0)
    catalog = tmp_path / "sites_real.json"
    for _ in range(2):
        update_catalog(catalog, make_entry("site99", "Site99", path, "a", "b", 1, True, None, "2026-11-14"))
    doc = json.loads(catalog.read_text(encoding="utf-8"))
    assert [s["id"] for s in doc["sites"]] == ["site99"]
    assert catalog.read_text(encoding="utf-8").endswith("\n")
