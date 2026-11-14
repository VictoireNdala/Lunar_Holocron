"""Construction des `SiteSpec` des sites RÉELS depuis config/sites_real.json (relief LOLA, éphémérides SPICE). Les sites fictifs de test sont dans pipeline/fixtures."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pipeline import geodesy
from pipeline.dem import Dem, MultiResDem
from pipeline.dem_geotiff import read_geotiff_window
from pipeline.ephemeris_spice import kernels_available
from pipeline.export import PipelineConfig, SiteSpec

REAL_NEAR_HALF_KM = 8.5  # le MNT 5 m couvre 16 km ; marge d'interpolation
REAL_FAR_HALF_KM_MARGIN = 5.0  # le MNT 80 m couvre far_max_km + marge
RAW_DIR = Path("data/raw")
LDEM_80M = RAW_DIR / "LDEM_80S_80MPP_ADJ.tiff"
LDEM_80M_INFO = "LDEM_80S_80MPP_ADJ (PGDA 90, LOLA, 80 m ; Barker et al. 2023, Planet. Sci. J. 4, 183, https://doi.org/10.3847/PSJ/acf3e1)"


def real_specs(path: Path, cfg: PipelineConfig, only: set[str] | None = None) -> tuple[list[SiteSpec], list[str]]:
    """Sites réels dont le MNT 5 m est présent et dont les noyaux SPICE sont là ; renvoie aussi les sites ignorés (avec la raison)."""
    skipped: list[str] = []
    if not kernels_available(cfg.kernel_dir):
        return [], [f"noyaux SPICE absents de {cfg.kernel_dir}"]
    if not LDEM_80M.is_file():
        return [], [f"{LDEM_80M} absent"]
    specs = []
    far_half = cfg.horizon.far_max_km + REAL_FAR_HALF_KM_MARGIN
    for s in json.loads(path.read_text(encoding="utf-8"))["sites"]:
        if only is not None and s["id"] not in only:
            continue
        dem_path = RAW_DIR / s["dem"]["file"]
        if not dem_path.is_file():
            skipped.append(f"{s['id']} : {dem_path.name} absent")
            continue
        lat, lon = s["center"]["lat_deg"], s["center"]["lon_deg"]
        dem: Dem = MultiResDem([read_geotiff_window(dem_path, lat, lon, REAL_NEAR_HALF_KM, product=s["dem"]["product"]),
                                read_geotiff_window(LDEM_80M, lat, lon, far_half, product="LDEM_80S_80MPP_ADJ 80 m")])
        specs.append(SiteSpec(
            id=s["id"], name={"fr": s["label_fr"], "en": s["label_en"]}, lat_deg=lat, lon_deg=lon, dem=dem,
            dem_info=_real_dem_info(s), engine="spice", terrain_real=True, verified=bool(s["verified"]),
            index_extra={"tier": s["tier"], "pgda_id": s["pgda_id"], "lola_priority_site": s["lola_priority_site"],
                         "nasa_2024_region": s["nasa_2024_region"]}))
    return specs, skipped


def _real_dem_info(s: dict[str, Any]) -> dict[str, Any]:
    """Provenance du MNT (5 m près du site, 80 m au-delà), avec source, citation et SHA-256 du fichier 5 m."""
    d = s["dem"]
    return {"product": f"{d['product']} + {LDEM_80M_INFO}", "resolution_m": d["resolution_m"], "source": d["source"],
            "license": d["license_note"], "citation": d["citation"], "file_sha256": d["sha256"],
            "position_source": s["center"]["source"]}
