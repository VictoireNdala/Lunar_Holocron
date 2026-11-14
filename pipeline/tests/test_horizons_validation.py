"""Validation SPICE contre Horizons sur 5 sites, 3 dates, Soleil et Terre (T-24). Lit `tests/reference/horizons_validation.json` : AUCUN réseau.

Les valeurs ont été relevées par `py -m pipeline.tools.horizons_validate` (voir ce module). Ignoré sans les noyaux SPICE.
Tolérances : environ 2 fois l'écart maximal MESURÉ par catégorie (le 14/11/2026), jamais une valeur présumée ; Horizons imprime 6 décimales,
donc 5e-7° est l'arrondi irréductible de la référence.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import ephemeris_spice as eph
from pipeline.tools.horizons_validate import compare

ROOT = Path(__file__).resolve().parents[2]
KERNEL_DIR = ROOT / "data" / "raw" / "spice"
REFERENCE = json.loads((ROOT / "tests" / "reference" / "horizons_validation.json").read_text(encoding="utf-8"))
CASES = REFERENCE["cases"]

# Mesuré : Soleil Δaz, Δél < 5,2e-7° ; Terre Δaz < 9,1e-7° ; Terre Δél < 2,44e-5° (voir docs/VALIDATION-RESULTATS.md).
TOL_AZ_DEG = {"sun": 1.5e-6, "earth": 2e-6}
TOL_EL_DEG = {"sun": 1.5e-6, "earth": 5e-5}

pytestmark = [pytest.mark.spice, pytest.mark.skipif(not eph.kernels_available(KERNEL_DIR), reason="noyaux SPICE absents de data/raw/spice")]


@pytest.fixture(scope="module", autouse=True)
def kernels() -> list[str]:
    """Charge les noyaux une fois pour le module."""
    return eph.load_kernels(KERNEL_DIR)


def test_reference_file_is_complete() -> None:
    """5 sites × 3 dates × 2 corps = 30 cas de 24 échantillons horaires, couvrant 2026-2030."""
    assert len(CASES) == 30
    assert {c["body"] for c in CASES} == {"sun", "earth"}
    assert len({c["site_id"] for c in CASES}) == 5
    assert sorted({c["day"] for c in CASES}) == ["2026-12-21", "2028-06-15", "2030-09-10"]
    assert all(len(c["samples"]) == 24 for c in CASES)


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"{c['site_id']}-{c['day']}-{c['body']}")
def test_spice_matches_horizons(case: dict) -> None:
    """SPICE (DE440s, LT+S) contre Horizons (DE441, apparent) : écarts d'azimut et d'élévation sous les tolérances mesurées."""
    az_err, el_err = compare(case)
    assert az_err < TOL_AZ_DEG[case["body"]], f"azimut : {az_err:.2e}°"
    assert el_err < TOL_EL_DEG[case["body"]], f"élévation : {el_err:.2e}°"
