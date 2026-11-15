"""Pyramide de tuiles du fond polaire (M-051 § 2.2) : `web/data/polar/tiles.json` et `web/data/polar/tiles/<pas>/<tx>_<ty>.bin`.

Niveaux dérivés du LDEM 80 m par moyenne par blocs (240 m = 3 × 3 pixels, 160 m = 2 × 2, 80 m = 1 × 1) ; le niveau 480 m existe déjà (`polar_grid.py`).
Les niveaux fins ne couvrent que des FENÊTRES autour des sites du catalogue (budget de poids, voir DECISIONS Q-017) ; ailleurs l'interface garde le 480 m.
Tuile = 128 × 128 échantillons de cœur plus une bordure de 2 échantillons (calcul des gradients sans couture) = 132 × 132 uint16.
Quantification linéaire sur [z_min, z_max] du LDEM (65535 = pas de donnée) ; codage : différences horizontales, octets de poids faible puis de poids fort
séparés, deflate brut (RFC 1951, décodé par DecompressionStream('deflate-raw')). Dérivé reproductible : mêmes entrées, mêmes octets.
"""

from __future__ import annotations

import json
import math
import shutil
import zlib
from pathlib import Path

import numpy as np
import rasterio

from pipeline.dem_geotiff import _check_crs
from pipeline.export import SCHEMA_VERSION, dump_json
from pipeline.polar_grid import DEFAULT_SOURCE, MAX_CODE, NO_DATA_CODE, block_mean
from pipeline.projection import DEFAULT_PROJECTION

TILE_PX = 128
BORDER_PX = 2
STORED_PX = TILE_PX + 2 * BORDER_PX
# pas (m) → (facteur de blocs du LDEM 80 m, demi-côté (km) de la fenêtre couverte autour de chaque site) ; réglage de budget (Q-017)
LEVELS: dict[int, tuple[int, float]] = {240: (3, 45.0), 160: (2, 25.0), 80: (1, 12.0)}
OUT_DIR = Path("web/data/polar")


def encode_tile(codes: np.ndarray) -> bytes:
    """uint16 (132 × 132) → différences horizontales (modulo 65536), octets bas puis hauts, deflate brut niveau 9."""
    q = codes.astype(np.int64)
    delta = (np.diff(q, axis=1, prepend=0) & 0xFFFF).astype(np.uint16)
    shuffled = np.concatenate([(delta & 0xFF).astype(np.uint8).ravel(), (delta >> 8).astype(np.uint8).ravel()])
    comp = zlib.compressobj(9, zlib.DEFLATED, -15)
    return comp.compress(shuffled.tobytes()) + comp.flush()


def decode_tile(data: bytes) -> np.ndarray:
    """Inverse de `encode_tile` (utilisé par les tests ; l'interface a son propre décodeur JavaScript)."""
    shuffled = np.frombuffer(zlib.decompress(data, -15), dtype=np.uint8)
    half = STORED_PX * STORED_PX
    delta = shuffled[:half].astype(np.uint16) | (shuffled[half:].astype(np.uint16) << 8)
    return (np.cumsum(delta.reshape(STORED_PX, STORED_PX).astype(np.int64), axis=1) & 0xFFFF).astype(np.uint16)


def quantize(values: np.ndarray, z_min: float, z_max: float) -> np.ndarray:
    """Hauteurs (m) → codes uint16 ; NaN → NO_DATA_CODE."""
    q = np.rint((np.where(np.isfinite(values), values, z_min) - z_min) / (z_max - z_min) * MAX_CODE)
    return np.where(np.isfinite(values), q, NO_DATA_CODE).astype(np.uint16)


def level_samples(values: np.ndarray, factor: int, rows: tuple[int, int], cols: tuple[int, int]) -> np.ndarray:
    """Échantillons du niveau (moyenne par blocs de `factor`) pour les lignes [r0, r1) et colonnes [c0, c1) du niveau ; hors du LDEM : NaN."""
    n_rows, n_cols = values.shape[0] // factor, values.shape[1] // factor
    out = np.full((rows[1] - rows[0], cols[1] - cols[0]), np.nan)
    r0, r1 = max(rows[0], 0), min(rows[1], n_rows)
    c0, c1 = max(cols[0], 0), min(cols[1], n_cols)
    if r0 >= r1 or c0 >= c1:
        return out
    block = values[r0 * factor:r1 * factor, c0 * factor:c1 * factor].astype(np.float64)
    out[r0 - rows[0]:r1 - rows[0], c0 - cols[0]:c1 - cols[0]] = block_mean(block, factor) if factor > 1 else block
    return out


def wanted_tiles(centers_xy: list[tuple[float, float]], half_km: float, x0: float, y0: float, spacing: float, n: int) -> set[tuple[int, int]]:
    """Tuiles (tx, ty) du niveau qui touchent un carré de ±half_km autour d'un des centres (plan stéréographique, mètres)."""
    tiles: set[tuple[int, int]] = set()
    n_tiles = math.ceil(n / TILE_PX)
    for x, y in centers_xy:
        i0, i1 = (x - half_km * 1000 - x0) / spacing, (x + half_km * 1000 - x0) / spacing
        j0, j1 = (y0 - (y + half_km * 1000)) / spacing, (y0 - (y - half_km * 1000)) / spacing
        for ty in range(max(0, math.floor(j0 / TILE_PX)), min(n_tiles - 1, math.floor(j1 / TILE_PX)) + 1):
            for tx in range(max(0, math.floor(i0 / TILE_PX)), min(n_tiles - 1, math.floor(i1 / TILE_PX)) + 1):
                tiles.add((tx, ty))
    return tiles


def build_polar_tiles(centers_lonlat: list[tuple[float, float]], source: Path = DEFAULT_SOURCE, out_dir: Path = OUT_DIR,
                      levels: dict[int, tuple[int, float]] | None = None) -> dict:
    """Écrit les tuiles et le manifeste ; `centers_lonlat` : (lat, lon) des sites autour desquels on garde le détail."""
    levels = levels or LEVELS
    with rasterio.open(source) as ds:
        _check_crs(ds)
        pix = float(ds.transform.a)
        point = ds.tags().get("AREA_OR_POINT", "Area").lower() == "point"
        x_c0 = ds.transform.c if point else ds.transform.c + pix / 2
        y_c0 = ds.transform.f if point else ds.transform.f - pix / 2
        values = ds.read(1)
    z_min, z_max = float(np.nanmin(values)), float(np.nanmax(values))
    centers_xy = [tuple(float(v) for v in DEFAULT_PROJECTION.lonlat_to_xy(lat, lon)) for lat, lon in centers_lonlat]
    shutil.rmtree(out_dir / "tiles", ignore_errors=True)
    manifest_levels = []
    total_bytes = 0
    for spacing, (factor, half_km) in sorted(levels.items(), reverse=True):
        n = min(values.shape) // factor
        x0 = x_c0 + (factor - 1) / 2 * pix  # centre de l'échantillon (0, 0) : moyenne des pixels 0 .. factor-1
        y0 = y_c0 - (factor - 1) / 2 * pix
        tiles = sorted(wanted_tiles(centers_xy, half_km, x0, y0, factor * pix, n))
        (out_dir / "tiles" / str(spacing)).mkdir(parents=True, exist_ok=True)
        level_bytes = 0
        for tx, ty in tiles:
            rows = (ty * TILE_PX - BORDER_PX, ty * TILE_PX + TILE_PX + BORDER_PX)
            cols = (tx * TILE_PX - BORDER_PX, tx * TILE_PX + TILE_PX + BORDER_PX)
            data = encode_tile(quantize(level_samples(values, factor, rows, cols), z_min, z_max))
            (out_dir / "tiles" / str(spacing) / f"{tx}_{ty}.bin").write_bytes(data)
            level_bytes += len(data)
        total_bytes += level_bytes
        manifest_levels.append({"spacing_m": float(spacing), "block_px": factor, "x0_m": x0, "y0_m": y0, "n_rows": n, "n_cols": n,
                                "window_half_km": half_km, "tiles": [[tx, ty] for tx, ty in tiles], "bytes": level_bytes})
    meta = {
        "schema_version": SCHEMA_VERSION,
        "product": "LDEM_80S_80MPP_ADJ, pyramide de tuiles (moyenne par blocs) ; fenêtres de détail autour des sites du catalogue",
        "source": "https://pgda.gsfc.nasa.gov/products/90",
        "citation": "Barker et al. 2023, Planet. Sci. J. 4, 183, https://doi.org/10.3847/PSJ/acf3e1",
        "derived": True,
        "projection": {"kind": "polar-stereographic-south", "radius_m": 1737400.0, "lon0_deg": 0.0},
        "tile": {"core_px": TILE_PX, "border_px": BORDER_PX, "stored_px": STORED_PX, "path": "tiles/{spacing_m}/{tx}_{ty}.bin",
                 "coding": "uint16 linéaire, différences horizontales mod 65536, octets bas puis hauts, deflate brut",
                 "tx_axis": "x croissant (ouest → est)", "ty_axis": "y décroissant (nord → sud)"},
        "z": {"min_m": z_min, "max_m": z_max, "nodata_code": NO_DATA_CODE, "max_code": MAX_CODE},
        "levels": manifest_levels,
        "total_bytes": total_bytes,
    }
    dump_json(out_dir / "tiles.json", meta)
    return meta


def main() -> None:
    """`py -m pipeline.polar_tiles` : reconstruit la pyramide autour des sites de `web/data/index.json`."""
    index = json.loads((Path("web/data") / "index.json").read_text(encoding="utf-8"))["sites"]
    meta = build_polar_tiles([(s["lat_deg"], s["lon_deg"]) for s in index])
    for lv in meta["levels"]:
        print(f"{lv['spacing_m']:.0f} m : {len(lv['tiles'])} tuiles, {lv['bytes'] / 1e6:.2f} Mo")
    print(f"total : {meta['total_bytes'] / 1e6:.2f} Mo")


if __name__ == "__main__":
    main()
