"""Lecture par fenêtre d'un MNT GeoTIFF polaire Sud (produits LOLA de PGDA), avec rasterio.

Contrôles imposés (docs/BRANCHEMENT-DONNEES-REELLES.md § 2) : la projection du fichier doit être celle de
`PolarProjection` par défaut (stéréographique polaire Sud, sphère 1 737 400 m, λ0 = 0, sans décalage ni facteur
d'échelle) ; sinon le fichier est refusé au lieu d'être deviné. La convention de pixel est lue (`AREA_OR_POINT`) :
« Area » = le transform désigne le coin des pixels (centre à +½ pixel) ; « Point » = il désigne les centres.
Le fichier n'est jamais lu en entier : seule la fenêtre utile (plus une marge) est chargée.
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

from pipeline.config import R_REF_M
from pipeline.dem import GridDem
from pipeline.projection import DEFAULT_PROJECTION

MARGIN_PX = 2  # marge de lecture autour de la fenêtre (interpolation bilinéaire)
EXPECTED_PROJ = {"proj": "stere", "lat_0": -90.0, "lon_0": 0.0, "x_0": 0.0, "y_0": 0.0, "R": R_REF_M}


def _check_crs(ds: rasterio.io.DatasetReader) -> None:
    """Refuse toute projection différente de celle de PolarProjection par défaut."""
    params = ds.crs.to_dict() if ds.crs else {}
    for key, expected in EXPECTED_PROJ.items():
        got = params.get(key)
        ok = got == expected if isinstance(expected, str) else got is not None and math.isclose(float(got), expected, abs_tol=1e-6)
        if not ok:
            raise ValueError(f"projection non prise en charge : {key} = {got!r}, attendu {expected!r} ({ds.name})")
    lat_ts = params.get("lat_ts", -90.0)
    k = params.get("k", params.get("k_0", 1.0))
    if not (math.isclose(float(lat_ts), -90.0) and math.isclose(float(k), 1.0)):
        raise ValueError(f"échelle non prise en charge : lat_ts = {lat_ts}, k = {k} ({ds.name})")
    t = ds.transform
    if not (t.b == 0 and t.d == 0 and t.a > 0 and math.isclose(t.e, -t.a)):
        raise ValueError(f"transform non pris en charge (rotation ou pixels non carrés) : {t}")


def read_geotiff_window(path: str | Path, center_lat_deg: float, center_lon_deg: float, half_size_km: float,
                        product: str | None = None, license: str = "à relever (SOURCES.md)") -> GridDem:
    """Charge le carré du plan projeté couvrant ±half_size_km autour du site ; NaN là où le fichier ne couvre pas."""
    with rasterio.open(path) as ds:
        _check_crs(ds)
        pix = ds.transform.a
        x_corner, y_corner = ds.transform.c, ds.transform.f
        point = ds.tags().get("AREA_OR_POINT", "Area").lower() == "point"
        x_center0 = x_corner if point else x_corner + pix / 2  # x du centre de la colonne 0
        y_center0 = y_corner if point else y_corner - pix / 2  # y du centre de la ligne 0
        xc, yc = (float(v) for v in DEFAULT_PROJECTION.lonlat_to_xy(center_lat_deg, center_lon_deg))
        half = half_size_km * 1000.0
        col0 = int(math.floor((xc - half - x_center0) / pix)) - MARGIN_PX
        col1 = int(math.ceil((xc + half - x_center0) / pix)) + MARGIN_PX
        row0 = int(math.floor((y_center0 - (yc + half)) / pix)) - MARGIN_PX
        row1 = int(math.ceil((y_center0 - (yc - half)) / pix)) + MARGIN_PX
        window = Window(col0, row0, col1 - col0 + 1, row1 - row0 + 1)
        values = ds.read(1, window=window, boundless=True, fill_value=np.nan).astype(np.float64)
        if ds.nodata is not None and not np.isnan(ds.nodata):
            values[values == ds.nodata] = np.nan
        name = product or Path(path).name
    return GridDem(values, x_min_m=x_center0 + col0 * pix, y_max_m=y_center0 - row0 * pix, spacing_m=pix,
                   product=name, license=license)
