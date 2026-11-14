"""Fichier d'or `tests/golden/body_state_cases.json` (T-08) : côté Python. Le côté JavaScript est `web/tests/bodystate-golden.test.js`."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from pipeline import golden

ROOT = Path(__file__).resolve().parents[2]
GOLDEN = json.loads((ROOT / "tests" / "golden" / "body_state_cases.json").read_text(encoding="utf-8"))
SITE = json.loads((ROOT / GOLDEN["site_file"]).read_text(encoding="utf-8"))
CASES = GOLDEN["cases"]
FIELDS = [f"{b}_{k}" for b in ("sun", "earth") for k in ("az_deg", "el_deg", "radius_deg", "horizon_deg")] + ["f_sun", "f_earth"]


def test_golden_is_marked_synthetic_with_20_cases() -> None:
    """Site de démonstration, donc fictif : le drapeau est écrit dans le fichier ; 20 instants."""
    assert GOLDEN["synthetic"] is True
    assert SITE["synthetic"] is True
    assert len(CASES) == 20
    assert GOLDEN["tolerance_angle_deg"] == 0.001


def test_expected_values_recompute_exactly() -> None:
    """Chaque valeur du fichier est celle que le pipeline calcule aujourd'hui à cet instant (arrondi à 9 décimales)."""
    for c in CASES:
        values = golden.expected_values(SITE, c["utc"].rstrip("Z"))
        for field in FIELDS:
            assert abs(values[field] - c[field]) < 1e-8, f"{c['utc']} {field}"


def test_instant_selection_is_deterministic() -> None:
    """La règle de choix redonne exactement les mêmes 20 instants et les mêmes motifs (reproductibilité)."""
    assert [(c["utc"].rstrip("Z"), c["motif"]) for c in CASES] == golden.select_instants(SITE)


def test_cases_cover_every_state_and_the_azimuth_wrap() -> None:
    """Partiel / masqué / visible pour les deux corps, instants hors nœuds horaires, passage de l'azimut par 0° / 360°."""
    for body in ("sun", "earth"):
        f = np.array([c[f"f_{body}"] for c in CASES])
        assert ((f > 0) & (f < 1)).sum() >= 3, f"{body} : pas assez de cas partiels"
        assert (f == 0).sum() >= 2 and (f == 1).sum() >= 2, f"{body} : cas masqués / visibles manquants"
    assert sum(not c["utc"].endswith(":00:00Z") for c in CASES) >= 4  # interpolation entre nœuds
    assert any("359° à 0°" in c["motif"] for c in CASES)
    sun_az = np.array([c["sun_az_deg"] for c in CASES])
    assert ((sun_az < 1) | (sun_az > 359)).sum() >= 3


def test_values_are_physically_plausible() -> None:
    """Contrôle indépendant des formules : rayons angulaires dans leurs bornes géométriques, élévations et fractions dans leur domaine."""
    for c in CASES:
        assert 0.2613 <= c["sun_radius_deg"] <= 0.2672, c["utc"]  # 695 700 km à 147,1–152,1 millions de km (D-020)
        assert 0.89 <= c["earth_radius_deg"] <= 1.03, c["utc"]  # 6 371 km à 356 000–407 000 km
        assert 0 <= c["sun_az_deg"] < 360 and 0 <= c["earth_az_deg"] < 360
        assert 0 <= c["f_sun"] <= 1 and 0 <= c["f_earth"] <= 1
        for body in ("sun", "earth"):
            d = c[f"{body}_el_deg"] - c[f"{body}_horizon_deg"]
            assert (c[f"f_{body}"] == 0) == (d <= -c[f"{body}_radius_deg"]), f"{c['utc']} {body} : état incohérent avec la marge"
            assert (c[f"f_{body}"] == 1) == (d >= c[f"{body}_radius_deg"]), f"{c['utc']} {body} : état incohérent avec la marge"
