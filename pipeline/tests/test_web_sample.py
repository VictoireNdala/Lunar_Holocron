"""Tests de T-03 : jeu d’exemple de tests/fixtures/sample (FICTIF), constantes JS = constantes Python, fichier d'or de la fraction visible."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from pipeline import config, validate

ROOT = Path(__file__).resolve().parents[2]
SAMPLE_DIR = ROOT / "tests" / "fixtures" / "sample"
CONSTANTS_JS = ROOT / "web" / "js" / "constants.js"
GOLDEN_FRACTION = ROOT / "tests" / "golden" / "visible_fraction.json"


def _js_constants() -> dict[str, float]:
    """Lit les `export const NOM = nombre;` de constants.js."""
    text = CONSTANTS_JS.read_text(encoding="utf-8")
    pairs = re.findall(r"^export const ([A-Z0-9_]+) = (-?[0-9_.]+);", text, flags=re.MULTILINE)
    return {name: float(value.replace("_", "")) for name, value in pairs}


@pytest.mark.parametrize("name", ["R_REF_M", "R_SUN_KM", "R_EARTH_KM", "TIME_STEP_S", "AZ_STEP_DEG", "N_AZIMUTHS",
                                  "MDEG_PER_DEG", "LAT_MIN_DEG", "LAT_MAX_DEG", "DEFAULT_OBSERVER_HEIGHT_M",
                                  "STRICT_MIN_FRACTION"])
def test_js_constants_match_python(name: str) -> None:
    """Une seule définition : chaque constante numérique a la même valeur en Python et en JavaScript."""
    js = _js_constants()
    assert name in js, f"{name} absent de web/js/constants.js"
    assert js[name] == getattr(config, name)


def test_js_supported_schema_major_matches_validator() -> None:
    """La version majeure du contrat comprise par l'interface est celle du validateur."""
    assert _js_constants()["SUPPORTED_SCHEMA_MAJOR"] == validate.SUPPORTED_MAJOR


def test_js_string_constants_match_python() -> None:
    """Constantes textuelles : repère, modes de seuil, seuil par défaut."""
    text = CONSTANTS_JS.read_text(encoding="utf-8")
    assert f"export const MOON_FRAME = '{config.MOON_FRAME}';" in text
    assert f"export const DEFAULT_THRESHOLD = '{config.DEFAULT_THRESHOLD}';" in text
    modes = ", ".join(f"'{m}'" for m in config.THRESHOLD_MODES)
    assert f"export const THRESHOLD_MODES = Object.freeze([{modes}]);" in text


def test_sample_passes_validate() -> None:
    """Le jeu d'exemple respecte le contrat (CONTRAT § 7)."""
    assert validate.validate_data_dir(SAMPLE_DIR) == []


def test_sample_is_flagged_synthetic() -> None:
    """Tous les fichiers du jeu d'exemple portent synthetic: true."""
    index = json.loads((SAMPLE_DIR / "index.json").read_text(encoding="utf-8"))
    assert index["synthetic"] is True
    for entry in index["sites"]:
        assert entry["synthetic"] is True
        for key in ("site_file", "terrain_file"):
            doc = json.loads((SAMPLE_DIR / entry[key]).read_text(encoding="utf-8"))
            assert doc["synthetic"] is True


def test_sample_exercises_edge_cases() -> None:
    """L'exemple contient un passage 359°→0° d'azimut, des azimuts truncated et des corps tantôt visibles tantôt masqués."""
    site = json.loads((SAMPLE_DIR / "sites" / "sample-a.json").read_text(encoding="utf-8"))
    for body in ("sun", "earth"):
        az = site["bodies"][body]["az_mdeg"]
        assert any(abs(b - a) > 180_000 for a, b in zip(az, az[1:])), f"{body} : pas de passage 359°→0°"
        pct = site["kpis"][body]["strict"]["visible_pct"]
        assert 0.0 < pct < 100.0
    assert any(site["horizon"]["truncated"]) and not all(site["horizon"]["truncated"])


def test_golden_visible_fraction_file() -> None:
    """Fichier d'or : valeurs de TESTS-VALIDATION § 1, cohérentes avec les définitions strict/any."""
    golden = json.loads(GOLDEN_FRACTION.read_text(encoding="utf-8"))
    assert golden["radius_deg"] == 0.27 and golden["tolerance_abs"] == 1e-6
    cases = golden["cases"]
    assert len(cases) >= 9
    for c in cases:
        d = c["el_deg"] - c["horizon_deg"]
        assert 0.0 <= c["f"] <= 1.0
        assert c["strict"] == (c["f"] >= 0.5)
        assert c["any"] == (c["f"] > 0.0)
        assert c["strict"] == (d >= -1e-12)
