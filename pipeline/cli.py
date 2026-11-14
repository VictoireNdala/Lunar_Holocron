"""Ligne de commande du pipeline (docs/PIPELINE.md § cli) : `demo`, `build`, `validate`.

`fetch` (téléchargement) n'existe volontairement pas : les noyaux SPICE et les MNT sont déposés dans data/raw/ (hors Git),
sources et sommes de contrôle dans SOURCES.md. Aucun accès réseau ici.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from pipeline import golden, validate
from pipeline.export import PipelineConfig, SiteSpec, build_site, write_index
from pipeline.ephemeris_spice import kernels_available
from pipeline.global_state import build_global, write_global
from pipeline.sites import demo_specs, real_specs

CONFIG_DIR = Path("config")
DEFAULT_OUT = Path("web/data")
GOLDEN_PATH = Path("tests/golden/body_state_cases.json")


def _build(specs: list[SiteSpec], cfg: PipelineConfig, out: Path) -> list[dict]:
    """Construit chaque site et affiche un résumé (durée, tailles, azimuts tronqués)."""
    entries = []
    for spec in specs:
        t0 = time.perf_counter()
        entry = build_site(spec, cfg, out)
        site_kb = (out / entry["site_file"]).stat().st_size / 1024
        trunc = sum(json.loads((out / entry["site_file"]).read_text(encoding="utf-8"))["horizon"]["truncated"])
        print(f"  {spec.id:<28} {time.perf_counter() - t0:5.1f} s  site {site_kb:7.0f} Ko  azimuts tronqués {trunc:3d}  "
              f"synthetic={entry['synthetic']} (relief réel={entry['terrain_real']}, éphémérides fictives={entry['ephemeris_synthetic']})")
        entries.append(entry)
    return entries


def main(argv: list[str] | None = None) -> int:
    """Point d'entrée ; renvoie le code de sortie."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    p = argparse.ArgumentParser(prog="pipeline.cli", description="Pipeline Lunar Holocron (hors ligne).")
    sub = p.add_subparsers(dest="command", required=True)
    for name, help_ in (("demo", "génère les sites de démonstration (fictifs) puis valide"),
                        ("build", "construit les sites de démonstration et les sites réels disponibles, puis valide")):
        s = sub.add_parser(name, help=help_)
        s.add_argument("--out", type=Path, default=DEFAULT_OUT)
        s.add_argument("--config", type=Path, default=CONFIG_DIR / "pipeline.json")
        if name == "build":
            s.add_argument("--site", action="append", help="identifiant à construire (répétable) ; défaut : tous")
        else:
            s.add_argument("--write-golden", action="store_true", help="écrit aussi tests/golden/body_state_cases.json (à relire par un humain avant de le figer)")
    v = sub.add_parser("validate", help="valide un dossier de données (contrat § 7)")
    v.add_argument("data_dir", nargs="?", type=Path, default=DEFAULT_OUT)
    args = p.parse_args(argv)

    if args.command == "validate":
        return validate.main([str(args.data_dir)])

    cfg = PipelineConfig.load(args.config)
    t0 = time.perf_counter()
    only = set(args.site) if args.command == "build" and args.site else None
    specs = demo_specs(CONFIG_DIR / "sites.json", cfg, only)
    if args.command == "build":
        real, skipped = real_specs(CONFIG_DIR / "sites_real.json", cfg, only)
        specs += real
        for reason in skipped:
            print(f"  ignoré : {reason}")
        unknown = (only or set()) - {s.id for s in specs}
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
    engine = "spice" if args.command == "build" and kernels_available(cfg.kernel_dir) else "demo-analytic"
    write_global(build_global(cfg, engine), args.out)
    print(f"  global.json (Atlas) : moteur {engine}")
    if args.command == "demo" and args.write_golden:
        print(f"  fichier d'or écrit : {golden.write_golden(args.out, GOLDEN_PATH)} (À RELIRE)")
    print(f"terminé en {time.perf_counter() - t0:.0f} s ; validation :")
    return validate.main([str(args.out)])


if __name__ == "__main__":
    sys.exit(main())
