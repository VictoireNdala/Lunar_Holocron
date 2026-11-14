"""Sites de démonstration FICTIFS (tests uniquement, D-029) : terrain synthétique déterministe, éphémérides analytiques.

`py -m pipeline.fixtures.demo_sites --out tests/fixtures/web-data [--site demo-b]` écrit un jeu de test ; refuse d'écrire sous `web/`.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from pipeline import geodesy, validate
from pipeline.dem import MultiResDem
from pipeline.export import PipelineConfig, SiteSpec, build_site, write_index
from pipeline.fixtures import ephemeris_demo
from pipeline.fixtures.dem_synthetic import make_synthetic_dem
from pipeline.fixtures.global_demo import demo_points
from pipeline.global_state import build_global, write_global

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEMO_NEAR_RES_M, DEMO_NEAR_HALF_KM = 20.0, 25.0  # MNT de démonstration : fin autour du site…
DEMO_FAR_RES_M = 120.0  # …et grossier jusqu'à far_max_km (docs/PIPELINE.md § dem_synthetic)
REAL_FAR_HALF_KM_MARGIN = 5.0
ENGINE = "demo-analytic"


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
            engine=ENGINE, terrain_real=False, verified=bool(s["verified"]), series_fn=ephemeris_demo.body_series))
    return specs


def main(argv: list[str] | None = None) -> int:
    """Génère les sites de démonstration (ou ceux de `--site`) puis valide ; jamais sous web/."""
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, default=ROOT / "tests" / "fixtures" / "web-data")
    p.add_argument("--config", type=Path, default=ROOT / "config" / "pipeline.json")
    p.add_argument("--sites", type=Path, default=HERE / "sites_demo.json")
    p.add_argument("--site", action="append", help="identifiant à construire (répétable) ; défaut : tous")
    args = p.parse_args(argv)
    if "web" in args.out.resolve().relative_to(ROOT).parts[:1] if args.out.resolve().is_relative_to(ROOT) else False:
        print("ERREUR : les données fictives ne s'écrivent jamais sous web/ (D-029)")
        return 2
    cfg = PipelineConfig.load(args.config)
    specs = demo_specs(args.sites, cfg, set(args.site) if args.site else None)
    entries = [build_site(spec, cfg, args.out) for spec in specs]
    write_index(entries, args.out, cfg)
    write_global(build_global(cfg, ENGINE, demo_points), args.out)
    return validate.main([str(args.out)])


if __name__ == "__main__":
    sys.exit(main())
