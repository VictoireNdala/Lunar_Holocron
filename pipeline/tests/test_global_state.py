"""Tests de l'état global (A-03, ATLAS § 3.3) : points sub-solaire et sub-terrestre, démo et SPICE, cohérence avec les séries de site."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline import ephemeris_spice, validate
from pipeline.fixtures import ephemeris_demo
from pipeline.fixtures.global_demo import demo_points
from pipeline.export import PipelineConfig, dump_json
from pipeline.global_state import build_global, write_global

ROOT = Path(__file__).resolve().parents[2]
KERNEL_DIR = ROOT / "data" / "raw" / "spice"
spice_ok = pytest.mark.skipif(not ephemeris_spice.kernels_available(KERNEL_DIR), reason="noyaux SPICE absents de data/raw/spice")


def _cfg(count: int = 96) -> PipelineConfig:
    """Configuration réduite : 4 jours horaires."""
    return PipelineConfig.from_dict({
        "period": {"start_utc": "2027-03-11T00:00:00Z", "end_utc": "2027-03-11T00:00:00Z", "step_s": 3600},
        "horizon": {}, "terrain": {"size_m": 20000.0, "n": 33}, "build_utc": "2026-11-14T00:00:00Z"}, count=count)


def test_demo_structure_and_flags() -> None:
    """Format du contrat (ATLAS § 3.3) : millidegrés entiers, synthetic vrai, moteur démo, longueurs = n."""
    g = build_global(_cfg(), "demo-analytic", demo_points)
    assert g["synthetic"] is True and g["provenance"]["ephemeris"]["engine"] == "demo-analytic"
    assert g["time"] == {"t0_utc": "2027-03-11T00:00:00Z", "step_s": 3600, "n": 96}
    for body in ("sun", "earth"):
        for key in ("lat_mdeg", "lon_mdeg", "radius_mdeg"):
            arr = g[body][key]
            assert len(arr) == 96 and all(isinstance(v, int) for v in arr)
        assert min(g[body]["lon_mdeg"]) >= -180000 and max(g[body]["lon_mdeg"]) < 180000


def test_demo_matches_site_series() -> None:
    """Cohérence démo : un site posé au point sub-solaire du modèle voit le Soleil au zénith (élévation ≈ 90°)."""
    g = build_global(_cfg(), "demo-analytic", demo_points)
    utc = ephemeris_demo.utc_grid("2027-03-11T00:00:00Z", 3600, 96)
    for k in (0, 30, 77):
        lat, lon = g["sun"]["lat_mdeg"][k] / 1000.0, g["sun"]["lon_mdeg"][k] / 1000.0
        el = ephemeris_demo.body_series("sun", lat, lon, [utc[k]])["el_deg"][0]
        assert el > 89.99, (k, el)


def test_deterministic_and_bytes(tmp_path: Path) -> None:
    """Deux écritures identiques octet pour octet ; le fichier passe validate."""
    for name in ("a", "b"):
        write_global(build_global(_cfg(), "demo-analytic", demo_points), tmp_path / name)
    assert (tmp_path / "a" / "global.json").read_bytes() == (tmp_path / "b" / "global.json").read_bytes()
    assert validate.validate_global(json.loads((tmp_path / "a" / "global.json").read_text(encoding="utf-8"))) == []


def test_validate_refuses_bad_global() -> None:
    """Longueur fausse, latitude hors plage, drapeau synthetic incohérent : refusés, avec le champ nommé."""
    g = build_global(_cfg(), "demo-analytic", demo_points)
    bad = json.loads(json.dumps(g)); bad["sun"]["lat_mdeg"].pop()
    assert any("sun.lat_mdeg" in e for e in validate.validate_global(bad))
    bad = json.loads(json.dumps(g)); bad["earth"]["lat_mdeg"][3] = 95000
    assert any("earth.lat_mdeg[3]" in e for e in validate.validate_global(bad))
    bad = json.loads(json.dumps(g)); bad["synthetic"] = False
    assert any("synthetic" in e for e in validate.validate_global(bad))


@spice_ok
def test_spice_subsolar_site_sees_zenith() -> None:
    """Contrôle indépendant : un site posé à (lat, lon) du point sub-solaire SPICE voit le Soleil à plus de 89,99° d'élévation."""
    cfg = _cfg()
    g = build_global(cfg, "spice")
    assert g["synthetic"] is False and g["provenance"]["ephemeris"]["kernels"] == list(ephemeris_spice.KERNEL_NAMES)
    ephemeris_spice.load_kernels(KERNEL_DIR)
    utc = ephemeris_demo.utc_grid("2027-03-11T00:00:00Z", 3600, 96)
    for k in (0, 20, 50, 95):
        lat, lon = g["sun"]["lat_mdeg"][k] / 1000.0, g["sun"]["lon_mdeg"][k] / 1000.0
        el = ephemeris_spice.body_series("sun", lat, lon, 0.0, [utc[k]])["el_deg"][0]
        assert el > 89.99, (k, lat, lon, el)


@spice_ok
def test_spice_ranges() -> None:
    """Plausibilité : |lat sub-solaire| < 1,7° (obliquité 1,54° + libration) ; |lat sub-terrestre| < 7° ; |lon sub-terrestre| < 10° ; rayons plausibles."""
    cfg = PipelineConfig.from_dict({"period": {"start_utc": "2026-01-01T00:00:00Z", "end_utc": "2026-12-31T23:00:00Z", "step_s": 3600},
                                    "horizon": {}, "terrain": {"size_m": 20000.0, "n": 33}, "build_utc": "2026-11-14T00:00:00Z"})
    g = build_global(cfg, "spice")
    assert np.max(np.abs(g["sun"]["lat_mdeg"])) < 1700
    assert np.max(np.abs(g["earth"]["lat_mdeg"])) < 7000 and np.max(np.abs(g["earth"]["lon_mdeg"])) < 10000
    half_step = 0.0005  # les rayons sont des millidegrés entiers : demi-pas de quantification
    assert 0.2613 - half_step < min(g["sun"]["radius_mdeg"]) / 1000 and max(g["sun"]["radius_mdeg"]) / 1000 < 0.2718 + half_step  # bornes de D-020
    assert 0.88 < min(g["earth"]["radius_mdeg"]) / 1000 and max(g["earth"]["radius_mdeg"]) / 1000 < 1.06
    lon = np.array(g["sun"]["lon_mdeg"]) / 1000.0
    assert -180 <= lon.min() and lon.max() < 180 and np.sum(np.abs(np.diff(lon)) > 180) >= 10  # le Soleil fait 12 tours par an
