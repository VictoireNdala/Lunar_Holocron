"""Grille polaire 480 m dérivée du LDEM 80 m (V2-02, D-027) : `web/data/polar/ldem_south_500m.{json,bin}`.

Sert au « point libre » calculé dans le navigateur (horizon approché) et au fond polaire. Moyenne par blocs de 6 × 6 pixels du LDEM
(80 m → 480 m) ; un bloc dont moins de la moitié des pixels est valide devient NaN. Quantification uint16 linéaire sur [min, max] ;
la valeur 65535 est réservée à « pas de donnée ». Même projection que le LDEM (stéréographique polaire Sud, sphère 1 737 400 m).
Ce n'est PAS le MNT 80 m : l'interface le dit (« horizon approché (500 m) »).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import rasterio

from pipeline.dem_geotiff import _check_crs
from pipeline.export import SCHEMA_VERSION, dump_json

BLOCK_PX = 6
NO_DATA_CODE = 65535
MAX_CODE = 65534
DEFAULT_SOURCE = Path("data/raw/LDEM_80S_80MPP_ADJ.tiff")
DEFAULT_OUT = Path("web/data/polar")
STEM = "ldem_south_500m"


def block_mean(values: np.ndarray, block: int = BLOCK_PX) -> np.ndarray:
    """Moyenne par blocs de `block × block` (le surplus des bords est ignoré) ; NaN si moins de la moitié des pixels est valide."""
    rows, cols = (values.shape[0] // block) * block, (values.shape[1] // block) * block
    cut = values[:rows, :cols].reshape(rows // block, block, cols // block, block)
    valid = np.isfinite(cut)
    count = valid.sum(axis=(1, 3))
    total = np.where(valid, cut, 0.0).sum(axis=(1, 3))
    return np.where(count * 2 >= block * block, total / np.maximum(count, 1), np.nan)


def encode(grid: np.ndarray) -> tuple[float, float, bytes]:
    """uint16 little-endian sur [min, max] des valeurs valides ; NaN → 65535."""
    finite = grid[np.isfinite(grid)]
    z_min, z_max = float(finite.min()), float(finite.max())
    q = np.rint((np.where(np.isfinite(grid), grid, z_min) - z_min) / (z_max - z_min) * MAX_CODE)
    q = np.where(np.isfinite(grid), q, NO_DATA_CODE).astype("<u2")
    return z_min, z_max, q.tobytes(order="C")


def build_polar_grid(source: Path = DEFAULT_SOURCE, out_dir: Path = DEFAULT_OUT) -> dict:
    """Écrit les deux fichiers et renvoie les métadonnées."""
    with rasterio.open(source) as ds:
        _check_crs(ds)
        pix = float(ds.transform.a)
        point = ds.tags().get("AREA_OR_POINT", "Area").lower() == "point"
        x_center0 = ds.transform.c if point else ds.transform.c + pix / 2
        y_center0 = ds.transform.f if point else ds.transform.f - pix / 2
        values = ds.read(1).astype(np.float64)
        if ds.nodata is not None and not np.isnan(ds.nodata):
            values[values == ds.nodata] = np.nan
    grid = block_mean(values)
    n_rows, n_cols = grid.shape
    spacing = pix * BLOCK_PX
    z_min, z_max, raw = encode(grid)
    meta = {
        "schema_version": SCHEMA_VERSION,
        "product": "LDEM_80S_80MPP_ADJ moyenné par blocs de 6 × 6 pixels (480 m)",
        "source": "https://pgda.gsfc.nasa.gov/products/90",
        "citation": "Barker et al. 2023, Planet. Sci. J. 4, 183, https://doi.org/10.3847/PSJ/acf3e1",
        "derived": True,
        "projection": {"kind": "polar-stereographic-south", "radius_m": 1737400.0, "lon0_deg": 0.0},
        "grid": {"n_rows": int(n_rows), "n_cols": int(n_cols), "spacing_m": spacing, "block_px": BLOCK_PX,
                 # centre du bloc (0, 0) : moyenne des pixels 0..5, donc décalé de 2,5 pixels depuis le centre du pixel 0
                 "x_min_m": x_center0 + (BLOCK_PX - 1) / 2 * pix, "y_max_m": y_center0 - (BLOCK_PX - 1) / 2 * pix},
        "z": {"encoding": "uint16-linear-nodata-65535", "min_m": z_min, "max_m": z_max, "file": f"{STEM}.bin", "byte_order": "little",
              "row_order": "north-to-south (y décroissant)", "col_order": "west-to-east (x croissant)", "nodata_code": NO_DATA_CODE, "max_code": MAX_CODE},
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    dump_json(out_dir / f"{STEM}.json", meta)
    (out_dir / f"{STEM}.bin").write_bytes(raw)
    return meta


def main() -> None:
    """`py -m pipeline.polar_grid` : (re)construit la grille polaire depuis data/raw/."""
    meta = build_polar_grid()
    g = meta["grid"]
    print(f"{STEM} : {g['n_rows']} × {g['n_cols']} blocs de {g['spacing_m']:.0f} m, z de {meta['z']['min_m']:.0f} à {meta['z']['max_m']:.0f} m -> {DEFAULT_OUT}")


if __name__ == "__main__":
    main()
