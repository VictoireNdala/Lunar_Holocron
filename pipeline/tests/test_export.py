"""Tests de l'export (T-07) : un site complet écrit dans un dossier temporaire, relu, validé, déterministe."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline import validate
from pipeline.config import R_REF_M
from pipeline.dem_synthetic import make_synthetic_dem
from pipeline.export import PipelineConfig, SiteSpec, build_site, write_index
from pipeline.terrain_grid import decode_uint16

LAT, LON = -89.0, 0.0


def _cfg(count_hours: int = 72) -> PipelineConfig:
    """Configuration réduite pour des tests rapides (3 jours, horizon à 30 km, grille 33²)."""
    return PipelineConfig.from_dict({
        "period": {"start_utc": "2027-03-11T00:00:00Z", "end_utc": f"2027-03-11T00:00:00Z", "step_s": 3600},
        "horizon": {"near_max_km": 10.0, "far_max_km": 30.0, "near_step_m": 100.0, "far_step_m": 300.0, "observer_height_m": 2.0},
        "terrain": {"size_m": 20000.0, "n": 33},
        "build_utc": "2026-11-14T00:00:00Z",
    }, count=count_hours)


def _spec(site_id: str = "test-demo") -> SiteSpec:
    """Site de démonstration au rebord d'un cratère synthétique."""
    dem = make_synthetic_dem("crater", seed=1, resolution_m=200.0, center_lat_deg=LAT, center_lon_deg=LON, half_size_km=35.0)
    return SiteSpec(id=site_id, name={"fr": "Site d'essai", "en": "Test site"}, lat_deg=LAT, lon_deg=LON, dem=dem,
                    dem_info={"product": "SYNTHETIC", "resolution_m": 200.0, "source": None, "license": "n/a"},
                    engine="demo-analytic", terrain_real=False, verified=True)


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict]:
    """Construit le site une fois et renvoie (dossier, entrée d'index)."""
    out = tmp_path_factory.mktemp("web_data")
    entry = build_site(_spec(), _cfg(), out)
    write_index([entry], out, _cfg())
    return out, entry


def test_output_validates(built: tuple[Path, dict]) -> None:
    """Le dossier produit passe validate (schéma, contrôles croisés, recalcul des KPI)."""
    out, _ = built
    assert validate.validate_data_dir(out) == []


def test_flags_and_provenance(built: tuple[Path, dict]) -> None:
    """Drapeaux d'honnêteté et provenance : démonstration ⇒ synthetic vrai ; date de build = configuration (D-013)."""
    out, entry = built
    site = json.loads((out / "sites" / "test-demo.json").read_text(encoding="utf-8"))
    assert site["synthetic"] is True and site["terrain_real"] is False and site["ephemeris_synthetic"] is True
    assert site["provenance"]["generated_utc"] == "2026-11-14T00:00:00Z"
    assert site["provenance"]["ephemeris"]["engine"] == "demo-analytic" and site["provenance"]["dem"]["product"] == "SYNTHETIC"
    assert entry["synthetic"] is True and entry["verified"] is True
    index = json.loads((out / "index.json").read_text(encoding="utf-8"))
    assert index["synthetic"] is True and index["generated_utc"] == "2026-11-14T00:00:00Z"


def test_series_lengths_and_units(built: tuple[Path, dict]) -> None:
    """Séries de `count` entiers en millidegrés ; horizon de 360 valeurs arrondies à 0,01°."""
    out, _ = built
    site = json.loads((out / "sites" / "test-demo.json").read_text(encoding="utf-8"))
    assert site["time"]["count"] == 72
    for body in ("sun", "earth"):
        s = site["bodies"][body]
        assert all(len(s[k]) == 72 and all(isinstance(v, int) for v in s[k]) for k in s)
        assert 0 <= min(s["az_mdeg"]) and max(s["az_mdeg"]) < 360000
    assert len(site["horizon"]["elev_deg"]) == 360 and site["horizon"]["max_distance_km"] == 30.0


def test_terrain_bin_decodes(built: tuple[Path, dict]) -> None:
    """`.bin` de 2·n² octets, décodage uint16 → z_m à moins d'un pas ; le site est à z = 0 (courbure incluse)."""
    out, _ = built
    meta = json.loads((out / "terrain" / "test-demo.json").read_text(encoding="utf-8"))
    raw = (out / "terrain" / "test-demo.bin").read_bytes()
    n = meta["grid"]["n"]
    assert len(raw) == 2 * n * n == 2 * 33 * 33
    z = decode_uint16(raw, meta["z"]["min_m"], meta["z"]["max_m"], (n, n))
    step = (meta["z"]["max_m"] - meta["z"]["min_m"]) / 65535
    assert abs(z[n // 2, n // 2]) <= step
    corner = R_REF_M * np.cos(np.hypot(10000.0, 10000.0) / R_REF_M) - R_REF_M
    assert z[0, 0] < 0 or meta["z"]["max_m"] > corner  # la courbure abaisse les bords d'un sol plat


def test_byte_for_byte_reproducible(tmp_path: Path) -> None:
    """Deux exécutions donnent des fichiers identiques octet pour octet (principe 5)."""
    for name in ("a", "b"):
        out = tmp_path / name
        write_index([build_site(_spec(), _cfg(), out)], out, _cfg())
    for rel in ("index.json", "sites/test-demo.json", "terrain/test-demo.json", "terrain/test-demo.bin"):
        assert (tmp_path / "a" / rel).read_bytes() == (tmp_path / "b" / rel).read_bytes(), rel


def test_compact_json_format(built: tuple[Path, dict]) -> None:
    """JSON compact (pas d'espace), saut de ligne final, UTF-8."""
    out, _ = built
    text = (out / "sites" / "test-demo.json").read_text(encoding="utf-8")
    assert text.endswith("\n") and ", " not in text[:200] and '": ' not in text[:200]


def test_real_flags_make_synthetic_false(tmp_path: Path) -> None:
    """Relief réel + éphémérides réelles ⇒ synthetic faux ; relief réel + démo ⇒ synthetic vrai (deux drapeaux distincts)."""
    spec = _spec("test-real")
    real_terrain_demo_eph = SiteSpec(**{**spec.__dict__, "terrain_real": True, "dem_info": {**spec.dem_info, "product": "LDEM_TEST"}})
    entry = build_site(real_terrain_demo_eph, _cfg(), tmp_path)
    assert entry["terrain_real"] is True and entry["ephemeris_synthetic"] is True and entry["synthetic"] is True
