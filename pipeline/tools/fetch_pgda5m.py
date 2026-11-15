"""Télécharge les produits PGDA 78 (LOLA 5 m/pixel) listés sur https://pgda.gsfc.nasa.gov/products/78 et les inscrit dans config/sites_real.json.

Outil hors ligne du pipeline (jamais lancé par l'application ni par les tests). Pour chaque produit : téléchargement vers data/raw/ (ignoré par Git),
SHA-256, contrôle de la projection (celle de PolarProjection) et de la maille (5 m), position = centre de l'emprise du GeoTIFF (règle D-016).
Un produit déjà présent dans la configuration n'est ni retéléchargé ni modifié. Un échec de téléchargement n'est pas bloquant : le produit
n'est pas inscrit (le site reste couvert par le LDEM 80 m dans le catalogue).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

import rasterio

from pipeline.dem_geotiff import _check_crs
from pipeline.projection import DEFAULT_PROJECTION

BASE_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/"
READ_DATE = "2026-11-15"  # date de lecture de la page https://pgda.gsfc.nasa.gov/products/78 (liste des produits et descriptions)
RAW_DIR = Path("data/raw")
CONFIG = Path("config/sites_real.json")
CITATION = "Barker et al. 2021, Planet. Space Sci. 203, 105119, https://doi.org/10.1016/j.pss.2020.105119"
LICENSE_NOTE = "aucune licence indiquée sur les pages PGDA (lues le 2026-11-14) ; citation demandée, voir SOURCES.md"

# (identifiant PGDA, description de la page PGDA, libellé français). Descriptions recopiées de la page, libellés français = traduction.
PRODUCTS: list[tuple[str, str, str]] = [
    ("Site06", "Nobile rim 1", "Bord de Nobile 1"),
    ("Site20", "Leibnitz beta plateau", "Plateau Leibnitz bêta"),
    ("Site20v2", "Leibnitz beta plateau, extended boundaries", "Plateau Leibnitz bêta, limites étendues"),
    ("Site23", "Malapert massif", "Massif Malapert"),
    ("Site42", "de Gerlache-Kocher massif", "Massif de Gerlache-Kocher"),
    ("Haworth", "Haworth", "Haworth"),
    ("Shoemaker", "Shoemaker", "Shoemaker"),
    ("DM1", "Amundsen rim", "Bord d'Amundsen"),
    ("DM2", "Nobile rim 2", "Bord de Nobile 2"),
    ("SL2", "de Gerlache rim", "Bord de Gerlache"),
    ("SL3", "Connecting ridge extension", "Extension de la crête de liaison"),
    ("NPA", "Cabeus exterior wall 1", "Paroi extérieure de Cabeus 1"),
    ("NPB", "Amundsen 1", "Amundsen 1"),
    ("NPC", "Idel'son L crater 1", "Cratère Idel'son L 1"),
    ("NPD", "Malapert crater 1", "Cratère Malapert 1"),
    ("LM1", "Shackleton Rim B", "Bord de Shackleton B"),
    ("LM2", "Shoemaker Rim A", "Bord de Shoemaker A"),
    ("LM3", "Shoemaker Rim B", "Bord de Shoemaker B"),
    ("LM4", "Shoemaker Rim C", "Bord de Shoemaker C"),
    ("LM5", "Shoemaker Rim D", "Bord de Shoemaker D"),
    ("LM6", "Shoemaker Rim E", "Bord de Shoemaker E"),
    ("LM7", "Faustini Rim A", "Bord de Faustini A"),
    ("LM8", "Shoemaker Rim F", "Bord de Shoemaker F"),
]


def _slug(pgda_id: str, description: str) -> str:
    """Identifiant de site : `<pgda-id>-<description>` en minuscules ASCII, séparé par des tirets."""
    text = (pgda_id if description == pgda_id else f"{pgda_id} {description}").lower().replace("'", "")
    return "".join(c if c.isalnum() else "-" for c in text).strip("-").replace("--", "-").replace("--", "-")


def _download(url: str, dest: Path) -> None:
    """Téléchargement en flux vers un fichier .part, renommé à la fin (jamais de fichier partiel sous le bon nom)."""
    part = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url, timeout=120) as r, part.open("wb") as f:  # noqa: S310 (URL fixe, https)
        while chunk := r.read(1 << 20):
            f.write(chunk)
    part.replace(dest)


def _sha256(path: Path) -> str:
    """SHA-256 hexadécimal (majuscules, comme dans la configuration existante)."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest().upper()


def _extent_center(path: Path) -> tuple[float, float, int, int, float]:
    """Centre de l'emprise du GeoTIFF (lat, lon en degrés), dimensions en pixels et maille en m ; refuse une projection inattendue."""
    with rasterio.open(path) as ds:
        _check_crs(ds)
        t = ds.transform
        point = ds.tags().get("AREA_OR_POINT", "Area").lower() == "point"
        x0 = t.c - (0 if point else 0)  # coin ou centre du premier pixel selon la convention ; le centre de l'emprise est le même à ½ pixel près
        x_mid = x0 + (ds.width - 1 if point else ds.width) * t.a / 2
        y_mid = t.f - (ds.height - 1 if point else ds.height) * t.a / 2
        lat, lon = DEFAULT_PROJECTION.xy_to_lonlat(x_mid, y_mid)
        return round(float(lat), 4), round(float(lon), 4), ds.width, ds.height, float(t.a)


def main(argv: list[str] | None = None) -> int:
    """Télécharge et inscrit les produits manquants ; code de sortie 0 même si certains téléchargements échouent (ils sont listés)."""
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--only", action="append", help="identifiant PGDA à traiter (répétable) ; défaut : tous")
    ap.add_argument("--no-download", action="store_true", help="n'inscrit que les fichiers déjà présents dans data/raw")
    args = ap.parse_args(argv)
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    known = {s["pgda_id"] for s in cfg["sites"]}
    failed: list[str] = []
    for pgda_id, desc, label_fr in PRODUCTS:
        if (args.only and pgda_id not in args.only) or pgda_id in known:
            continue
        name = f"{pgda_id}_final_adj_5mpp_surf.tif"
        dest = RAW_DIR / name
        try:
            if not dest.is_file() and not args.no_download:
                print(f"téléchargement {name} ...", flush=True)
                _download(f"{BASE_URL}{pgda_id}/{name}", dest)
            if not dest.is_file():
                continue
            lat, lon, w, h, pix = _extent_center(dest)
            if abs(pix - 5.0) > 1e-9:
                raise ValueError(f"maille {pix} m au lieu de 5 m")
            digest = _sha256(dest)
        except Exception as exc:  # échec non bloquant : le produit n'est pas inscrit
            failed.append(f"{pgda_id} : {exc}")
            print(f"  ÉCHEC {pgda_id} : {exc}", flush=True)
            continue
        cfg["sites"].append({
            "center": {"lat_deg": lat, "lon_deg": lon,
                       "source": f"centre de l'emprise du GeoTIFF {name} ({w} px × {h} px × 5 m), lu le {READ_DATE}"},
            "dem": {"citation": CITATION, "file": name, "license_note": LICENSE_NOTE, "pixel_registration": "Area",
                    "product": f"{pgda_id} 5 m (PGDA 78, LOLA)", "resolution_m": 5.0, "sha256": digest, "source": f"{BASE_URL}{pgda_id}/"},
            "id": _slug(pgda_id, desc), "label_en": desc if desc == pgda_id else f"{desc} ({pgda_id})", "label_fr": label_fr if desc == pgda_id else f"{label_fr} ({pgda_id})",
            "lola_priority_site": False, "nasa_2024_region": None, "pgda_id": pgda_id, "terrain_real": True, "tier": 2, "verified": False,
            "pgda_description": desc,
        })
        CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
        print(f"  inscrit {pgda_id} : centre ({lat}, {lon}), {w}×{h} px, sha256 {digest[:12]}…", flush=True)
    if failed:
        print("produits non inscrits (le site reste en 80 m) :", *failed, sep="\n  ")
    return 0


if __name__ == "__main__":
    sys.exit(main())
