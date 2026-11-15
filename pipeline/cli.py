"""Ligne de commande du pipeline (docs/PIPELINE.md § cli) : `build`, `validate`.

PRODUCTION : seuls les sites RÉELS sont construits (relief LOLA, éphémérides SPICE) ; les jeux fictifs de test vivent dans `pipeline/fixtures`
et ne s'écrivent jamais sous `web/` (D-029). `fetch` (téléchargement) n'existe volontairement pas dans cette commande : les noyaux SPICE et les MNT
sont déposés dans data/raw/ (hors Git), sources et sommes de contrôle dans SOURCES.md.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from pipeline import validate
from pipeline.ephemeris_spice import kernels_available
from pipeline.export import PipelineConfig, SiteSpec, build_site, write_index
from pipeline.global_state import build_global, write_global
from pipeline.polar_grid import build_polar_grid, DEFAULT_SOURCE
from pipeline.catalog import catalog_specs
from pipeline.sites import real_specs

CONFIG_DIR = Path("config")
DEFAULT_OUT = Path("web/data")


def _build(specs: list[SiteSpec], cfg: PipelineConfig, out: Path) -> list[dict]:
    """Construit chaque site et affiche un résumé (durée, tailles, azimuts tronqués)."""
    entries = []
    for spec in specs:
        t0 = time.perf_counter()
        entry = build_site(spec, cfg, out)
        site_kb = (out / entry["site_file"]).stat().st_size / 1024
        trunc = sum(json.loads((out / entry["site_file"]).read_text(encoding="utf-8"))["horizon"]["truncated"])
        print(f"  {spec.id:<28} {time.perf_counter() - t0:5.1f} s  site {site_kb:7.0f} Ko  azimuts tronqués {trunc:3d}")
        entries.append(entry)
    return entries


def main(argv: list[str] | None = None) -> int:
    """Point d'entrée ; renvoie le code de sortie."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    p = argparse.ArgumentParser(prog="pipeline.cli", description="Pipeline Lunar Holocron (hors ligne).")
    sub = p.add_subparsers(dest="command", required=True)
    s = sub.add_parser("build", help="construit les sites réels (5 m), les entités nommées (80 m) et les sites Apollo (relief non modélisé), puis valide")
    s.add_argument("--out", type=Path, default=DEFAULT_OUT)
    s.add_argument("--config", type=Path, default=CONFIG_DIR / "pipeline.json")
    s.add_argument("--site", action="append", help="identifiant à construire (répétable) ; défaut : tous")
    v = sub.add_parser("validate", help="valide un dossier de données (contrat § 7)")
    v.add_argument("data_dir", nargs="?", type=Path, default=DEFAULT_OUT)
    args = p.parse_args(argv)

    if args.command == "validate":
        return validate.main([str(args.data_dir)])

    cfg = PipelineConfig.load(args.config)
    if not kernels_available(cfg.kernel_dir):
        print(f"ERREUR noyaux SPICE absents de {cfg.kernel_dir} : aucune donnée n'est produite (pas de repli fictif, D-029)")
        return 2
    t0 = time.perf_counter()
    only = set(args.site) if args.site else None
    specs, skipped = real_specs(CONFIG_DIR / "sites_real.json", cfg, only)
    extra_specs, extra_skipped = catalog_specs(CONFIG_DIR / "catalog_features.json", cfg, only)
    specs, skipped = specs + extra_specs, skipped + extra_skipped
    for reason in skipped:
        print(f"  ignoré : {reason}")
    unknown = (only or set()) - {sp.id for sp in specs}
    if unknown:
        print(f"ERREUR sites inconnus ou indisponibles : {sorted(unknown)}")
        return 2
    print(f"construction de {len(specs)} site(s) → {args.out}")
    entries = _build(specs, cfg, args.out)
    if only is not None and (args.out / "index.json").is_file():
        # Construction partielle : on garde les autres sites de l'index (ceux dont les fichiers existent encore).
        old = json.loads((args.out / "index.json").read_text(encoding="utf-8"))["sites"]
        built = {e["id"] for e in entries}
        entries += [e for e in old if e["id"] not in built and (args.out / e["site_file"]).is_file()]
    write_index(entries, args.out, cfg)
    write_global(build_global(cfg, "spice"), args.out)
    print("  global.json (Atlas) : moteur spice")
    if DEFAULT_SOURCE.is_file() and only is None:
        build_polar_grid(DEFAULT_SOURCE, args.out / "polar")
        print("  polar/ldem_south_500m : grille 480 m (point libre, fond polaire)")
    print(f"terminé en {time.perf_counter() - t0:.0f} s ; validation :")
    return validate.main([str(args.out)])


if __name__ == "__main__":
    sys.exit(main())
