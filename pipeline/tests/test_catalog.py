"""Catalogue étendu (V2-02, D-026) : sources obligatoires, relief non modélisé ni réel ni fictif, contrat 1.2."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline import validate
from pipeline.catalog import _require_sources, catalog_specs
from pipeline.dem import FlatDem
from pipeline.export import PipelineConfig, SCHEMA_VERSION

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "config" / "catalog_features.json"
DATA = ROOT / "web" / "data"


def test_flat_dem_is_zero_everywhere_and_covers_everything() -> None:
    """Relief non modélisé : hauteur nulle, couverture totale, formes conservées."""
    dem = FlatDem()
    assert np.all(dem.height_m(np.array([-89.0, 10.0]), np.array([0.0, 20.0])) == 0)
    assert dem.covers(-85.0, 40.0)
    assert dem.height_m(np.zeros((2, 3)), np.zeros((2, 3))).shape == (2, 3)


def test_every_catalogue_entry_has_a_cited_source() -> None:
    """Aucune coordonnée sans source (URL, date de lecture) : règle de D-026."""
    doc = json.loads(CATALOG.read_text(encoding="utf-8"))
    for f in doc["features"]:
        assert _require_sources(f)
    with pytest.raises(ValueError, match="sources"):
        _require_sources({"id": "sans-source", "lat_deg": -85.0, "lon_deg": 0.0})
    with pytest.raises(ValueError, match="sources"):
        _require_sources({"id": "sans-url", "sources": [{"label": "x", "read_utc": "2026-11-14"}]})


def test_contract_version_is_1_2_and_index_carries_the_new_fields() -> None:
    """Index et sites écrits en 1.2 : famille, niveau de terrain, base de la position, sources ; Apollo en relief non modélisé et NON fictif."""
    assert SCHEMA_VERSION == "1.2"
    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    assert index["schema_version"] == "1.2"
    kinds = {e["kind"] for e in index["sites"]}
    assert {"lola_site", "feature", "apollo"} <= kinds
    for e in index["sites"]:
        assert e["terrain_tier"] in ("5m", "80m", "flat") and e["sources"] and e["position_basis"]
        site = json.loads((DATA / e["site_file"]).read_text(encoding="utf-8"))
        assert site["terrain_tier"] == e["terrain_tier"] and site["kind"] == e["kind"]
        if e["terrain_tier"] == "flat":
            assert e["terrain_modeled"] is False and e["terrain_real"] is False and e["synthetic"] is False
            assert set(site["horizon"]["elev_deg"]) and max(site["horizon"]["elev_deg"]) <= 0.0  # horizon plat : seule la courbure l'abaisse
        if e["terrain_tier"] == "5m":
            assert site["provenance"]["dem"]["resolution_m"] == 5.0


def test_validate_rejects_inconsistent_tier_and_custom_kind() -> None:
    """`validate` refuse `terrain_tier: 5m` avec une autre résolution, un `flat` modélisé, et un `kind: custom` dans un fichier de site."""
    site = json.loads((DATA / "sites" / "site01-connecting-ridge.json").read_text(encoding="utf-8"))
    assert validate.validate_site(site) == []
    bad = json.loads(json.dumps(site))
    bad["provenance"]["dem"]["resolution_m"] = 80.0
    assert any("terrain_tier 5m" in e for e in validate.validate_site(bad))
    bad = json.loads(json.dumps(site))
    bad["terrain_tier"] = "flat"
    assert any("flat" in e for e in validate.validate_site(bad))
    bad = json.loads(json.dumps(site))
    bad["kind"] = "custom"
    assert validate.validate_site(bad)


def test_catalogue_builds_one_spec_per_entry_with_the_right_tier() -> None:
    """Sans noyaux le catalogue ne produit rien ; avec les fichiers locaux : entités au sud de 80° S en 80 m, Apollo en relief non modélisé."""
    cfg = PipelineConfig.load(ROOT / "config" / "pipeline.json")
    specs, skipped = catalog_specs(CATALOG, cfg)
    if not specs:
        pytest.skip(f"fichiers locaux absents : {skipped}")
    by_id = {s.id: s for s in specs}
    assert by_id["feature-faustini"].extra["terrain_tier"] == "80m" and by_id["feature-faustini"].terrain_modeled
    assert by_id["apollo-11"].extra["terrain_tier"] == "flat" and not by_id["apollo-11"].terrain_modeled and not by_id["apollo-11"].terrain_real
    assert all(s.extra["sources"] for s in specs)


def test_nasa_regions_names_from_ntrs_and_always_approximate() -> None:
    """Régions Artemis III (NTRS 20250011660) : noms lus à la source, position TOUJOURS approximative et sourcée ; celles qui n'ont ni produit PGDA ni entité IAU ne sont pas placées."""
    doc = json.loads(CATALOG.read_text(encoding="utf-8"))
    placed = {r["region"] for r in doc["nasa_regions"]}
    assert placed == {"Mons Mouton", "de Gerlache Rim 2"}
    for r in doc["nasa_regions"]:
        assert _require_sources(r) and r["approximate"] is True and r["position_basis"] == "feature_center" and r["radius_km"] > 0
        assert any("20250011660" in s["url"] for s in r["sources"]) and any("planetarynames" in s["url"] for s in r["sources"])
        assert r["name_fr"] != r["name_en"]
    tagged = {s["pgda_id"]: s["nasa_2024_region"] for s in json.loads((ROOT / "config" / "sites_real.json").read_text(encoding="utf-8"))["sites"] if s["nasa_2024_region"]}
    assert tagged == {"Site06": "Nobile Rim 1", "DM2": "Nobile Rim 2", "Site23": "Malapert Massif", "Haworth": "Haworth"}
    names = {"Peak near Cabeus B", "Mons Mouton Plateau", "Slater Plain"}  # sans source de position : non placées
    assert not names & (placed | set(tagged.values()))
