"""Construction des `SiteSpec` depuis config/sites.json (démonstration) et config/sites_real.json (relief et éphémérides réels)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pipeline import geodesy
from pipeline.dem import Dem, MultiResDem
from pipeline.dem_geotiff import read_geotiff_window
from pipeline.dem_synthetic import make_synthetic_dem
from pipeline.ephemeris_spice import kernels_available
from pipeline.export import PipelineConfig, SiteSpec

DEMO_NEAR_RES_M, DEMO_NEAR_HALF_KM = 20.0, 25.0  # MNT de démonstration : fin autour du site…
DEMO_FAR_RES_M = 120.0  # …et grossier jusqu'à far_max_km (docs/PIPELINE.md § dem_synthetic)
REAL_NEAR_HALF_KM = 8.5  # le MNT 5 m couvre 16 km ; marge d'interpolation
REAL_FAR_HALF_KM_MARGIN = 5.0  # le MNT 80 m couvre far_max_km + marge
RAW_DIR = Path("data/raw")
LDEM_80M = RAW_DIR / "LDEM_80S_80MPP_ADJ.tiff"
LDEM_80M_INFO = "LDEM_80S_80MPP_ADJ (PGDA 90, LOLA, 80 m ; Barker et al. 2023, Planet. Sci. J. 4, 183, https://doi.org/10.3847/PSJ/acf3e1)"


def demo_specs(path: Path, cfg: PipelineConfig, only: set[str] | None = None) -> list[SiteSpec]:
    """Sites de démonstration : terrain synthétique déterministe (fin + grossier), éphémérides fictives."""
    specs = []
    for s in json.loads(path.read_text(encoding="utf-8"))["sites"]:
        if only is not None and s["id"] not in only:
            continue
        t = s["terrain"]
        off = t["dem_center_from_site"]
        c_lat, c_lon = (float(v) for v in geodesy.destination(s["lat_deg"], s["lon_deg"], off["az_deg"], off["dist_m"]))
        near = make_synthetic_dem(t["kind"], t["seed"], DEMO_NEAR_RES_M, c_lat, c_lon, DEMO_NEAR_HALF_KM)
        far = make_synthetic_dem(t["kind"], t["seed"], DEMO_FAR_RES_M, c_lat, c_lon, cfg.horizon.far_max_km + REAL_FAR_HALF_KM_MARGIN)
        specs.append(SiteSpec(
            id=s["id"], name=s["name"], lat_deg=s["lat_deg"], lon_deg=s["lon_deg"], dem=MultiResDem([near, far]),
            dem_info={"product": "SYNTHETIC", "resolution_m": near.resolution_m, "source": None, "license": "n/a"},
            engine="demo-analytic", terrain_real=False, verified=bool(s["verified"])))
    return specs


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
