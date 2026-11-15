"""Catalogue étendu (V2-02, D-026) : entités nommées (relief 80 m au sud de 80° S) et sites Apollo (relief non modélisé).

Entrée : `config/catalog_features.json` (coordonnées LUES à la source, avec URL et date de lecture). Aucune coordonnée n'est écrite de mémoire :
une entrée sans `sources[]` est refusée. Les sites LOLA 5 m restent construits par `pipeline.sites.real_specs` (centre de l'emprise du GeoTIFF).
Trois niveaux de terrain, dits à l'écran : `5m` (PGDA 78), `80m` (LDEM polaire, tout point au sud de 80° S), `flat` (relief non modélisé).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pipeline.dem import Dem, FlatDem
from pipeline.dem_geotiff import read_geotiff_window
from pipeline.ephemeris_spice import kernels_available
from pipeline.export import PipelineConfig, SiteSpec
from pipeline.sites import LDEM_80M, LDEM_80M_INFO, REAL_FAR_HALF_KM_MARGIN

LDEM_COVERAGE_LAT_DEG = -80.0  # le LDEM polaire 80 m couvre le sud de 80° S
FLAT_INFO = {"product": "FLAT (relief non modélisé)", "resolution_m": 0.0, "source": None, "license": "n/a"}


def _require_sources(entry: dict[str, Any]) -> list[dict[str, str]]:
    """Refuse une entrée sans source citée (D-026) ; renvoie ses `sources`."""
    sources = entry.get("sources")
    if not sources or not all(s.get("url") and s.get("read_utc") and s.get("label") for s in sources):
        raise ValueError(f"{entry.get('id')} : sources[] (label, URL, date de lecture) obligatoires : une coordonnée sans source n'entre pas au catalogue")
    return sources


def _terrain_for(lat_deg: float, lon_deg: float, cfg: PipelineConfig) -> tuple[Dem, dict[str, Any], str, bool]:
    """(MNT, dem_info, niveau, relief modélisé) : 80 m au sud de 80° S si le fichier est là, sinon relief non modélisé."""
    if lat_deg <= LDEM_COVERAGE_LAT_DEG and LDEM_80M.is_file():
        dem = read_geotiff_window(LDEM_80M, lat_deg, lon_deg, cfg.horizon.far_max_km + REAL_FAR_HALF_KM_MARGIN, product="LDEM_80S_80MPP_ADJ")
        info = {"product": LDEM_80M_INFO, "resolution_m": dem.resolution_m, "source": "https://pgda.gsfc.nasa.gov/products/90",
                "license": "aucune licence indiquée sur les pages PGDA (lues le 2026-11-14) ; citation demandée, voir SOURCES.md",
                "citation": "Barker et al. 2023, Planet. Sci. J. 4, 183, https://doi.org/10.3847/PSJ/acf3e1"}
        return dem, info, "80m", True
    return FlatDem(), dict(FLAT_INFO), "flat", False


def catalog_specs(path: Path, cfg: PipelineConfig, only: set[str] | None = None) -> tuple[list[SiteSpec], list[str]]:
    """`SiteSpec` des entités nommées et des sites Apollo ; renvoie aussi les entrées ignorées (avec la raison)."""
    skipped: list[str] = []
    if not kernels_available(cfg.kernel_dir):
        return [], [f"noyaux SPICE absents de {cfg.kernel_dir}"]
    doc = json.loads(path.read_text(encoding="utf-8"))
    specs: list[SiteSpec] = []

    def add(entry: dict[str, Any], kind: str, basis: str, sources: list[dict[str, str]], extra_fields: dict[str, Any], tier_rank: int) -> None:
        if only is not None and entry["id"] not in only:
            return
        dem, info, tier, modeled = _terrain_for(entry["lat_deg"], entry["lon_deg"], cfg)
        extra = {"kind": kind, "position_basis": basis, "approximate": False, "terrain_tier": tier, "sources": sources, **extra_fields}
        specs.append(SiteSpec(
            id=entry["id"], name={"fr": entry["name"], "en": entry["name"]}, lat_deg=entry["lat_deg"], lon_deg=entry["lon_deg"], dem=dem, dem_info=info,
            engine="spice", terrain_real=modeled, terrain_modeled=modeled, verified=False, extra=extra, index_extra={"tier": tier_rank}))

    for f in doc["features"]:
        fields: dict[str, Any] = {"status": "reference"}
        if f.get("diameter_km"):
            fields["position_uncertainty_km"] = round(f["diameter_km"] / 2, 2)  # rayon de l'entité : taille de l'empreinte à dessiner
        add(f, "feature", f["position_basis"], _require_sources(f), fields, 3)
    for m in doc.get("missions", []):  # missions : coordonnées lues sur les pages LROC citées ; `approximate` et `status` viennent de la source
        fields = {"status": m["status"], "mission": m["mission"], "approximate": bool(m.get("approximate", False))}
        add(m, "mission", m["position_basis"], _require_sources(m), fields, 4)
    apollo = doc["apollo"]
    apollo_sources = [{**apollo["source"], "label": apollo["source"]["label"]}]
    apollo_sources = [{"label": s["label"], "url": s["url"], "read_utc": s["read_utc"]} for s in apollo_sources]
    for a in apollo["sites"]:
        add({**a, "sources": apollo_sources}, "apollo", "apollo_nssdc", apollo_sources, {"status": "landed", "mission": a["name"]}, 4)
    return specs, skipped
