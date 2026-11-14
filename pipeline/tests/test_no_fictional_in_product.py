"""D-029 : plus aucune donnée fictive dans le produit. Les jeux fictifs n'existent que comme fixtures de test (`pipeline/fixtures`, `tests/fixtures`)."""

from __future__ import annotations

import ast
import json
import re
from pathlib import Path

from pipeline import cli

ROOT = Path(__file__).resolve().parents[2]
FICTIONAL_MODULES = ("pipeline.fixtures", "pipeline.ephemeris_demo", "pipeline.dem_synthetic")
PATTERN = re.compile(r"demo-|data/sample|sample-a|ephemeris_demo|dem_synthetic", re.IGNORECASE)


def _imports(path: Path) -> list[str]:
    """Noms de modules importés par un fichier Python (y compris les importations tardives dans les fonctions)."""
    names: list[str] = []
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.append(node.module)
            names += [f"{node.module}.{a.name}" for a in node.names]
    return names


def test_production_code_never_imports_the_fictional_modules() -> None:
    """Le pipeline de production (hors `tests/` et `fixtures/`) n'importe jamais les générateurs fictifs."""
    files = [p for p in (ROOT / "pipeline").glob("*.py")] + [p for p in (ROOT / "pipeline" / "tools").glob("*.py")]
    assert files
    for path in files:
        bad = [n for n in _imports(path) if n.startswith(FICTIONAL_MODULES)]
        assert not bad, f"{path.relative_to(ROOT)} importe {bad}"


def test_web_data_holds_only_real_sites() -> None:
    """`web/data/` : aucun site, terrain ou jeu d'exemple fictif ; chaque entrée de l'index est réelle (relief et éphémérides)."""
    data = ROOT / "web" / "data"
    index = json.loads((data / "index.json").read_text(encoding="utf-8"))
    assert index["synthetic"] is False
    assert index["sites"]
    for entry in index["sites"]:
        assert entry["synthetic"] is False and entry["terrain_real"] is True and entry["ephemeris_synthetic"] is False, entry["id"]
        assert not re.match(r"demo-|sample-", entry["id"])
    assert not (data / "sample").exists()
    assert not list(data.rglob("demo-*"))
    assert json.loads((data / "global.json").read_text(encoding="utf-8"))["synthetic"] is False


def test_web_code_has_no_fictional_reference() -> None:
    """Ni le HTML, ni le JavaScript, ni le CSS, ni les JSON servis ne désignent un site ou un module fictif (hors tests et dépendances)."""
    hits = []
    for path in (ROOT / "web").rglob("*"):
        rel = path.relative_to(ROOT / "web").parts
        if not path.is_file() or rel[0] in ("tests", "vendor", "assets", "local") or path.suffix not in (".js", ".html", ".css", ".json"):
            continue
        if PATTERN.search(path.read_text(encoding="utf-8")):
            hits.append("/".join(rel))
    assert not hits, hits


def test_build_without_kernels_produces_nothing_instead_of_falling_back(tmp_path: Path, capsys, monkeypatch) -> None:
    """Sans noyaux SPICE, `build` s'arrête (code 2) : aucun repli sur des éphémérides fictives."""
    monkeypatch.setattr(cli, "kernels_available", lambda _dir: False)
    out = tmp_path / "out"
    assert cli.main(["build", "--out", str(out), "--config", str(ROOT / "config" / "pipeline.json")]) == 2
    assert not out.exists() or not list(out.rglob("*.json"))
    assert "pas de repli fictif" in capsys.readouterr().out


def test_demo_command_is_gone_and_fixtures_refuse_web() -> None:
    """`cli demo` n'existe plus ; le générateur de fixtures refuse d'écrire sous `web/`."""
    import pytest

    with pytest.raises(SystemExit):
        cli.main(["demo"])
    from pipeline.fixtures import demo_sites

    assert demo_sites.main(["--out", str(ROOT / "web" / "data_fictif")]) == 2
    assert not (ROOT / "web" / "data_fictif").exists()
