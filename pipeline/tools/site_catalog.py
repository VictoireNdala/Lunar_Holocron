"""Catalogue des sites réels (S-01, D-016, D-018) : `config/sites_real.json`.

La position d'un site est le **centre de l'emprise de son MNT 5 m**, lue dans l'en-tête du GeoTIFF (règle de D-016 :
jamais de mémoire). Le centre est converti en (lat, lon) par `PolarProjection` ; la source (fichier, date) est écrite à côté.
`verified` reste faux tant qu'un contrôle visuel n'a pas été fait. Usage :
`py -m pipeline.tools.site_catalog --id site04-shackleton-rim --pgda Site04 --tier 1 --label-fr "…" --label-en "…"`
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import date
from pathlib import Path
from typing import Any

import rasterio

from pipeline.projection import DEFAULT_PROJECTION

CATALOG = Path("config/sites_real.json")
RAW_DIR = Path("data/raw")
DEM_SOURCE = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/"
CITATION = "Barker et al. 2021, Planet. Space Sci. 203, 105119, https://doi.org/10.1016/j.pss.2020.105119"
LICENSE_NOTE = "aucune licence indiquée sur les pages PGDA (lues le 2026-11-14) ; citation demandée, voir SOURCES.md"


def extent_center(path: Path) -> tuple[float, float, dict[str, Any]]:
    """(lat, lon, infos) du centre de l'emprise d'un GeoTIFF polaire Sud (bord à bord, pixels « Area »)."""
    with rasterio.open(path) as ds:
        t, w, h = ds.transform, ds.width, ds.height
        info = {"width": w, "height": h, "pixel_m": float(t.a), "x_min_m": float(t.c), "y_max_m": float(t.f),
                "area_or_point": ds.tags().get("AREA_OR_POINT", "Area")}
    xc, yc = t.c + w * t.a / 2.0, t.f + h * t.e / 2.0
    lat, lon = DEFAULT_PROJECTION.xy_to_lonlat(xc, yc)
    return float(lat), float(lon), info


def sha256_of(path: Path) -> str:
    """Somme SHA-256 du fichier, lue par blocs."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest().upper()


def make_entry(site_id: str, pgda_id: str, path: Path, label_fr: str, label_en: str, tier: int,
               lola_priority_site: bool, nasa_2024_region: str | None, read_date: str) -> dict[str, Any]:
    """Entrée du catalogue pour un MNT 5 m déjà présent dans data/raw/."""
    lat, lon, info = extent_center(path)
    return {
        "id": site_id, "label_fr": label_fr, "label_en": label_en, "pgda_id": pgda_id, "tier": tier,
        "nasa_2024_region": nasa_2024_region, "lola_priority_site": lola_priority_site,
        "center": {"lat_deg": round(lat, 4), "lon_deg": round(lon, 4),
                   "source": f"centre de l'emprise du GeoTIFF {path.name} (3 200 px × 5 m = {info['width'] * info['pixel_m'] / 1000:.0f} km), lu le {read_date}"},
        "dem": {"product": f"{pgda_id} 5 m (PGDA 78, LOLA)", "resolution_m": info["pixel_m"], "file": path.name,
                "sha256": sha256_of(path), "source": DEM_SOURCE, "citation": CITATION, "license_note": LICENSE_NOTE,
                "pixel_registration": info["area_or_point"]},
        "terrain_real": True,
        "ephemeris_synthetic": True,  # passe à faux dès que T-07 produit les séries avec SPICE
        "verified": False,
    }


def update_catalog(catalog: Path, entry: dict[str, Any]) -> None:
    """Ajoute ou remplace l'entrée (même id) ; JSON stable (clés triées, saut de ligne final)."""
    doc = json.loads(catalog.read_text(encoding="utf-8")) if catalog.exists() else {"sites": []}
    doc["sites"] = sorted([s for s in doc["sites"] if s["id"] != entry["id"]] + [entry], key=lambda s: (s["tier"], s["id"]))
    catalog.parent.mkdir(parents=True, exist_ok=True)
    catalog.write_text(json.dumps(doc, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8", newline="\n")


def main(argv: list[str] | None = None) -> int:
    """Ligne de commande."""
    p = argparse.ArgumentParser(description="Ajoute un site 5 m au catalogue (centre lu dans le GeoTIFF).")
    p.add_argument("--id", required=True)
    p.add_argument("--pgda", required=True, help="identifiant PGDA, ex. Site04")
    p.add_argument("--tier", type=int, required=True)
    p.add_argument("--label-fr", required=True)
    p.add_argument("--label-en", required=True)
    p.add_argument("--lola-priority", action="store_true")
    p.add_argument("--nasa-2024-region", default=None)
    p.add_argument("--catalog", type=Path, default=CATALOG)
    a = p.parse_args(argv)
    path = RAW_DIR / f"{a.pgda}_final_adj_5mpp_surf.tif"
    entry = make_entry(a.id, a.pgda, path, a.label_fr, a.label_en, a.tier, a.lola_priority, a.nasa_2024_region, date.today().isoformat())
    update_catalog(a.catalog, entry)
    print(f"{a.id}: centre ({entry['center']['lat_deg']}, {entry['center']['lon_deg']}) → {a.catalog}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
