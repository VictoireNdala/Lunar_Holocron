"""Aperçu du relief réel (M-014 étape B, M-017 § 4) : découpe d'une fenêtre du MNT LOLA autour d'un point.

Écrit dans un dossier IGNORÉ PAR GIT (par défaut `web/data/local/`) :
- `terrain/<id>.json` + `.bin` au format du contrat (§ 6), `synthetic: false` (relief réel) ;
- `preview.json` : liste des aperçus avec leur provenance. Aucun horizon, aucun Soleil ni Terre :
  ce n'est pas un site du contrat, seulement un aperçu du relief (outil de développement, pas un livrable P0).
Usage : `py -m pipeline.tools.crop_real_dem --id shackleton --lat -89.67 --lon 129.5`
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline.dem_geotiff import read_geotiff_window
from pipeline.terrain_grid import build_terrain_grid, encode_uint16
from pipeline.validate import validate_terrain

DEFAULT_DEM = Path("data/raw/LDEM_80S_80MPP_ADJ.tiff")
DEFAULT_OUT = Path("web/data/local")
# Provenance du produit 80 m (page https://pgda.gsfc.nasa.gov/products/90, lue le 2026-11-14).
LDEM80_PROVENANCE = {
    "product": "LDEM_80S_80MPP_ADJ (PGDA 90, LOLA, Barker et al. 2023)",
    "resolution_m": 80.0,
    "source": "https://pgda.gsfc.nasa.gov/products/90",
    "citation": "Barker et al., 2023, Planet. Sci. J., 4, 183, https://doi.org/10.3847/PSJ/acf3e1 ; data DOI 10.60903/gsfcpgda-lola-spole",
    "license": "non indiquée sur la page du produit (citation demandée) ; voir SOURCES.md",
}


def _dump(path: Path, doc: dict) -> None:
    """JSON compact, clés triées, UTF-8, saut de ligne final."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")


def crop(site_id: str, lat_deg: float, lon_deg: float, label_fr: str, label_en: str, dem_path: Path = DEFAULT_DEM,
         out_dir: Path = DEFAULT_OUT, half_size_km: float = 25.0, n: int = 257) -> dict:
    """Découpe, écrit les fichiers et renvoie l'entrée de `preview.json`."""
    size_m = 2.0 * half_size_km * 1000.0
    dem = read_geotiff_window(dem_path, lat_deg, lon_deg, half_size_km * 1.5 + 1.0, product=LDEM80_PROVENANCE["product"])
    grid = build_terrain_grid(dem, lat_deg, lon_deg, size_m=size_m, n=n)
    z_min, z_max, raw = encode_uint16(grid.z_m)
    terrain = {
        "schema_version": "1.0", "id": site_id, "synthetic": False,
        "center": {"lat_deg": lat_deg, "lon_deg": lon_deg},
        "grid": {"n": n, "size_m": size_m, "spacing_m": grid.spacing_m},
        "frame": "local-enu",
        "z": {"encoding": "uint16-linear", "min_m": z_min, "max_m": z_max, "file": f"{site_id}.bin",
              "byte_order": "little", "row_order": "north-to-south", "col_order": "west-to-east"},
    }
    errors = validate_terrain(terrain)
    if errors:
        raise ValueError(f"terrain non conforme : {errors}")
    _dump(out_dir / "terrain" / f"{site_id}.json", terrain)
    (out_dir / "terrain" / f"{site_id}.bin").write_bytes(raw)
    return {"id": site_id, "name": {"fr": label_fr, "en": label_en}, "lat_deg": lat_deg, "lon_deg": lon_deg,
            "terrain_file": f"terrain/{site_id}.json", "terrain_real": True, "ephemeris": None,
            "site_height_m": grid.site_height_m, "filled_nodes": grid.filled_nodes,
            "dem": {**LDEM80_PROVENANCE, "file": dem_path.name, "resampling": f"bilinéaire, {n}² nœuds sur {size_m / 1000:.0f} km"}}


def main(argv: list[str] | None = None) -> int:
    """Ligne de commande : ajoute (ou remplace) un aperçu dans `preview.json`."""
    p = argparse.ArgumentParser(description="Aperçu du relief réel LOLA autour d'un point (dossier ignoré par Git).")
    p.add_argument("--id", required=True)
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--label-fr", default=None)
    p.add_argument("--label-en", default=None)
    p.add_argument("--half-km", type=float, default=25.0)
    p.add_argument("--n", type=int, default=257)
    p.add_argument("--dem", type=Path, default=DEFAULT_DEM)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    a = p.parse_args(argv)
    entry = crop(a.id, a.lat, a.lon, a.label_fr or a.id, a.label_en or a.id, a.dem, a.out, a.half_km, a.n)
    index_path = a.out / "preview.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {"previews": []}
    index["previews"] = [e for e in index["previews"] if e["id"] != a.id] + [entry]
    _dump(index_path, index)
    print(f"aperçu {a.id} écrit dans {a.out} : hauteur du site {entry['site_height_m']:.0f} m, nœuds remplis {entry['filled_nodes']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
