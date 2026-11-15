"""Balayage d'illumination de Site01 (M-051 § 2.7) : la valeur au centre du balayage est celle du fichier de site (même géométrie, même horizon, mêmes éphémérides)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_centre_du_balayage_egal_aux_kpis_du_site():
    sweep = json.loads((ROOT / "tests" / "reference" / "illumination_site01-connecting-ridge.json").read_text(encoding="utf-8"))
    site = json.loads((ROOT / "web" / "data" / "sites" / "site01-connecting-ridge.json").read_text(encoding="utf-8"))
    run = sweep["runs"]["projet_2026_2030|eye2"]
    assert abs(run["strict"]["center_pct"] - site["kpis"]["sun"]["strict"]["visible_pct"]) < 0.01
    assert abs(run["any"]["center_pct"] - site["kpis"]["sun"]["any"]["visible_pct"]) < 0.01
    grid = run["strict"]["grid_pct"]
    assert len(grid) == len(grid[0]) == 33 and run["strict"]["n_points"] == 33 * 33
    assert run["strict"]["max_pct"] >= run["strict"]["center_pct"]
