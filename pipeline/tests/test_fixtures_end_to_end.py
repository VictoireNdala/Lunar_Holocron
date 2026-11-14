"""Bout en bout (T-07, T-08) : le générateur de fixtures produit les sites FICTIFS, `validate` renvoie 0, deux exécutions sont identiques octet pour octet.

Configuration réduite (3 jours, MNT de 10 km) pour rester rapide ; la configuration complète est exercée à la main
(`py -m pipeline.cli build`, voir STATUS.md).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

from pipeline import cli
from pipeline.fixtures import demo_sites as sites


@pytest.fixture()
def small_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Fichier de configuration réduit + constantes de MNT de démonstration réduites."""
    cfg = {
        "period": {"start_utc": "2027-03-11T00:00:00Z", "end_utc": "2027-03-13T23:00:00Z", "step_s": 3600},
        "horizon": {"near_max_km": 5.0, "far_max_km": 20.0, "near_step_m": 100.0, "far_step_m": 400.0, "observer_height_m": 2.0},
        "terrain": {"size_m": 10000.0, "n": 33},
        "ephemeris": {"engine": "demo-analytic"},
        "build_utc": "2026-11-14T00:00:00Z",
    }
    path = tmp_path / "pipeline.json"
    path.write_text(json.dumps(cfg), encoding="utf-8")
    monkeypatch.setattr(sites, "DEMO_NEAR_RES_M", 200.0)
    monkeypatch.setattr(sites, "DEMO_NEAR_HALF_KM", 8.0)
    monkeypatch.setattr(sites, "DEMO_FAR_RES_M", 1000.0)
    return path


def _run(out: Path, config: Path) -> int:
    """Lance le générateur de sites FICTIFS de test dans `out`."""
    return sites.main(["--out", str(out), "--config", str(config)])


def test_demo_builds_three_sites_and_validates(small_config: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    """Trois sites de démonstration, tous `synthetic: true`, index cohérent, `validate` → 0."""
    out = tmp_path / "out"
    assert _run(out, small_config) == 0
    index = json.loads((out / "index.json").read_text(encoding="utf-8"))
    assert index["synthetic"] is True and [s["id"] for s in index["sites"]] == ["demo-a", "demo-b", "demo-c"]
    for entry in index["sites"]:
        assert entry["synthetic"] is True and entry["terrain_real"] is False and entry["ephemeris_synthetic"] is True
        site = json.loads((out / entry["site_file"]).read_text(encoding="utf-8"))
        assert site["synthetic"] is True and site["time"]["count"] == 72
    assert "validate" in capsys.readouterr().out
    assert cli.main(["validate", str(out)]) == 0


def test_two_runs_are_byte_identical(small_config: Path, tmp_path: Path) -> None:
    """Principe 5 de CLAUDE.md : mêmes entrées, mêmes octets (tous les fichiers produits)."""
    for name in ("a", "b"):
        assert _run(tmp_path / name, small_config) == 0
    files = sorted(p.relative_to(tmp_path / "a") for p in (tmp_path / "a").rglob("*") if p.is_file())
    assert len(files) == 1 + 1 + 3 * 3  # index + global.json (Atlas) + (site, terrain json, terrain bin) × 3
    for rel in files:
        assert (tmp_path / "a" / rel).read_bytes() == (tmp_path / "b" / rel).read_bytes(), str(rel)


def test_demo_a_is_on_the_crater_rim(small_config: Path, tmp_path: Path) -> None:
    """D-014 : demo-a est sur la CRÊTE du rebord, pas au fond du cratère.

    Au centre du cratère l'horizon serait ≈ 20° partout (atan(1500/4000), voir Q-011) : Soleil et Terre jamais visibles.
    Sur la crête, le site surplombe l'intérieur du cratère : horizon bas (≤ 3°) à tous les azimuts. L'ombre du rebord se voit
    dans le terrain 3D (intérieur du cratère), pas dans le masque d'horizon.
    """
    out = tmp_path / "out"
    _run(out, small_config)
    h = json.loads((out / "sites" / "demo-a.json").read_text(encoding="utf-8"))["horizon"]["elev_deg"]
    assert max(h) < 3.0, max(h)
    z = (out / "terrain" / "demo-a.bin").read_bytes()
    meta = json.loads((out / "terrain" / "demo-a.json").read_text(encoding="utf-8"))
    assert meta["z"]["min_m"] < -300.0  # l'intérieur du cratère est bien plus bas que le site (z = 0)
    assert len(z) == 2 * 33 * 33


@pytest.mark.skipif(not (ROOT / "data" / "raw" / "spice" / "de440s.bsp").is_file() or not (ROOT / "data" / "raw" / "LDEM_80S_80MPP_ADJ.tiff").is_file()
                    or not (ROOT / "data" / "raw" / "Site01_final_adj_5mpp_surf.tif").is_file() or not (ROOT / "data" / "raw" / "Site04_final_adj_5mpp_surf.tif").is_file(),
                    reason="noyaux SPICE ou MNT réels absents de data/raw")
def test_partial_build_keeps_other_sites_in_index(small_config: Path, tmp_path: Path) -> None:
    """Régression : `build --site X` ne doit pas retirer les autres sites de l'index (défaut découvert le 14 nov.). Sites RÉELS, données locales requises."""
    out = tmp_path / "out"
    for site_id in ("site01-connecting-ridge", "site04-shackleton-rim"):
        assert cli.main(["build", "--site", site_id, "--out", str(out), "--config", str(small_config)]) == 0
    assert cli.main(["build", "--site", "site04-shackleton-rim", "--out", str(out), "--config", str(small_config)]) == 0
    ids = [s["id"] for s in json.loads((out / "index.json").read_text(encoding="utf-8"))["sites"]]
    assert ids == ["site01-connecting-ridge", "site04-shackleton-rim"]


def test_unknown_site_is_an_error(small_config: Path, tmp_path: Path) -> None:
    """`build --site` inconnu : code de sortie 2 et message."""
    assert cli.main(["build", "--site", "nope", "--out", str(tmp_path / "o"), "--config", str(small_config)]) == 2
