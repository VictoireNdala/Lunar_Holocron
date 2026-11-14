"""Tests du schéma et du validateur (T-01) : documents valides acceptés, cas invalides refusés en nommant le champ."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from pipeline import validate
from pipeline.tests.factories import make_index, make_site, make_terrain, write_data_dir


def _joined(errors: list[str]) -> str:
    """Concatène les messages pour les recherches de sous-chaînes."""
    return "\n".join(errors)


# --- Schémas eux-mêmes ---------------------------------------------------------------------------

@pytest.mark.parametrize("name", ["site", "index", "terrain"])
def test_schema_files_are_valid_json_schema(name: str) -> None:
    """Chaque fichier de schéma est un JSON Schema 2020-12 valide."""
    Draft202012Validator.check_schema(validate.load_schema(name))


# --- Documents valides ---------------------------------------------------------------------------

def test_valid_documents_are_accepted() -> None:
    """Les fabriques produisent des documents sans erreur."""
    assert validate.validate_site(make_site()) == []
    assert validate.validate_index(make_index()) == []
    assert validate.validate_terrain(make_terrain()) == []


def test_minor_version_and_unknown_fields_are_accepted() -> None:
    """Version mineure inconnue (1.3) et champ optionnel inconnu : acceptés (CONTRAT § 8)."""
    site = make_site()
    site["schema_version"] = "1.3"
    site["future_optional_field"] = {"x": 1}
    assert validate.validate_site(site) == []


def test_lat_minus_89_99_is_accepted() -> None:
    """-89.99 est la latitude de test près du pôle (ARCHITECTURE § 2) : acceptée."""
    site = make_site()
    site["location"]["lat_deg"] = -89.99
    assert validate.validate_site(site) == []


# --- Cas invalides exigés par T-01 ---------------------------------------------------------------

def test_wrong_horizon_length_names_field() -> None:
    """Masque d'horizon de 359 valeurs : refusé, le champ est nommé, le message reste court."""
    site = make_site()
    site["horizon"]["elev_deg"] = site["horizon"]["elev_deg"][:359]
    errors = validate.validate_site(site)
    assert "horizon.elev_deg" in _joined(errors)
    assert all(len(e) < 300 for e in errors)


def test_wrong_series_length_names_field() -> None:
    """Série plus courte que time.count : refusée en nommant la série."""
    site = make_site()
    site["bodies"]["earth"]["el_mdeg"].pop()
    assert "bodies.earth.el_mdeg" in _joined(validate.validate_site(site))


def test_azimuth_360000_is_refused() -> None:
    """Azimut ≥ 360000 mdeg : refusé, avec l'indice fautif."""
    site = make_site()
    site["bodies"]["sun"]["az_mdeg"][7] = 360000
    assert "bodies.sun.az_mdeg[7]" in _joined(validate.validate_site(site))


@pytest.mark.parametrize("version", ["2.0", "0.9", "abc", ""])
def test_unknown_schema_version_is_refused(version: str) -> None:
    """Version majeure inconnue ou mal formée : refusée, message clair et unique."""
    site = make_site()
    site["schema_version"] = version
    errors = validate.validate_site(site)
    assert len(errors) == 1
    assert errors[0].startswith("schema_version")


def test_synthetic_inconsistent_with_provenance_is_refused() -> None:
    """MNT SYNTHETIC mais synthetic=false : refusé (CONTRAT § 7.5)."""
    site = make_site(synthetic=False)
    site["provenance"]["dem"]["product"] = "SYNTHETIC"
    assert "synthetic" in _joined(validate.validate_site(site))
    site = make_site(synthetic=False)
    site["provenance"]["ephemeris"]["engine"] = "demo-analytic"
    assert "synthetic" in _joined(validate.validate_site(site))


def test_real_site_with_real_provenance_is_accepted() -> None:
    """Un site réel (synthetic=false, SPICE, MNT réel) est accepté."""
    assert validate.validate_site(make_site(synthetic=False)) == []


def test_index_root_synthetic_must_reflect_sites() -> None:
    """Racine synthetic=false alors qu'un site est synthétique : refusé ; l'inverse aussi."""
    index = make_index()
    index["synthetic"] = False
    assert "synthetic" in _joined(validate.validate_index(index))
    index = make_index(synthetic=False)
    index["synthetic"] = True
    assert "synthetic" in _joined(validate.validate_index(index))


# --- Autres contrôles ----------------------------------------------------------------------------

def test_missing_english_name_names_field() -> None:
    """name.en manquant : refusé."""
    site = make_site()
    del site["name"]["en"]
    assert "name" in _joined(validate.validate_site(site))


def test_non_boolean_truncated_is_refused() -> None:
    """truncated doit être booléen."""
    site = make_site()
    site["horizon"]["truncated"][3] = 1
    assert "horizon.truncated[3]" in _joined(validate.validate_site(site))


def test_radius_must_be_positive() -> None:
    """radius_mdeg = 0 : refusé."""
    site = make_site()
    site["bodies"]["earth"]["radius_mdeg"][0] = 0
    assert "bodies.earth.radius_mdeg[0]" in _joined(validate.validate_site(site))


def test_monthly_must_match_period() -> None:
    """La liste monthly doit couvrir exactement les mois de la période, triés."""
    site = make_site(count=24 * 40)  # 40 jours depuis le 1er janvier : janvier et février
    assert validate.validate_site(site) == []
    site["monthly"].reverse()
    assert "monthly" in _joined(validate.validate_site(site))
    site = make_site()
    site["monthly"].append(dict(site["monthly"][0], ym="2026-02"))
    assert "monthly" in _joined(validate.validate_site(site))


def test_kpi_window_must_match_period() -> None:
    """La fenêtre des indicateurs = premier et dernier échantillon."""
    site = make_site()
    site["kpis"]["window"]["end_utc"] = "2026-01-03T00:00:00Z"
    assert "kpis.window.end_utc" in _joined(validate.validate_site(site))


def test_kpi_recomputed_and_compared() -> None:
    """CONTRAT § 7.6 : un indicateur qui ne correspond pas aux séries est refusé."""
    site = make_site()
    assert validate.validate_site(site) == []
    site["kpis"]["sun"]["strict"]["visible_pct"] += 0.5
    assert "kpis.sun" in _joined(validate.validate_site(site))
    site = make_site(count=24 * 40)
    site["monthly"][1]["both_strict_pct"] = 99.0
    assert "monthly[1]" in _joined(validate.validate_site(site))


def test_kpi_min_max_order() -> None:
    """min ≤ max pour les élévations extrêmes."""
    site = make_site()
    site["kpis"]["sun_el_deg"] = {"min": 2.0, "max": 1.0}
    assert "kpis.sun_el_deg" in _joined(validate.validate_site(site))


def test_terrain_spacing_and_file_name() -> None:
    """spacing_m = size_m / (n - 1) et fichier .bin nommé d'après l'id."""
    terrain = make_terrain()
    terrain["grid"]["spacing_m"] = 78.0
    assert "grid.spacing_m" in _joined(validate.validate_terrain(terrain))
    terrain = make_terrain()
    terrain["z"]["file"] = "other.bin"
    assert "z.file" in _joined(validate.validate_terrain(terrain))
    terrain = make_terrain()
    terrain["z"]["min_m"], terrain["z"]["max_m"] = 10.0, -10.0
    assert "z.min_m" in _joined(validate.validate_terrain(terrain))


def test_many_errors_are_capped() -> None:
    """Une série entièrement fausse ne produit pas des dizaines de milliers de messages."""
    site = make_site(count=5000)
    site["bodies"]["sun"]["az_mdeg"] = [400000] * 5000
    errors = validate.validate_site(site)
    assert 0 < len(errors) <= validate.MAX_ERRORS + 1


# --- Dossier complet -----------------------------------------------------------------------------

def test_valid_data_dir(tmp_path: Path) -> None:
    """Un dossier cohérent est accepté et la commande renvoie 0."""
    root = write_data_dir(tmp_path, ["demo-a", "demo-b"])
    assert validate.validate_data_dir(root) == []
    assert validate.main([str(root)]) == 0


def test_missing_referenced_file(tmp_path: Path) -> None:
    """Un fichier référencé par l'index et absent : erreur qui nomme le fichier ; code de sortie 1."""
    root = write_data_dir(tmp_path)
    (root / "terrain" / "demo-x.json").unlink()
    assert "terrain/demo-x.json" in _joined(validate.validate_data_dir(root))
    assert validate.main([str(root)]) == 1


def test_bin_size_checked(tmp_path: Path) -> None:
    """Le .bin doit faire n × n × 2 octets."""
    root = write_data_dir(tmp_path, n=5)
    (root / "terrain" / "demo-x.bin").write_bytes(b"\x00" * 10)
    assert "demo-x.bin" in _joined(validate.validate_data_dir(root))


def test_id_and_synthetic_consistency_across_files(tmp_path: Path) -> None:
    """id et synthetic identiques dans l'index, le site et le terrain."""
    root = write_data_dir(tmp_path)
    site_path = root / "sites" / "demo-x.json"
    site = json.loads(site_path.read_text(encoding="utf-8"))
    site["id"] = "demo-y"
    site_path.write_text(json.dumps(site), encoding="utf-8")
    assert "id" in _joined(validate.validate_data_dir(root))

    root2 = write_data_dir(tmp_path / "b")
    terrain_path = root2 / "terrain" / "demo-x.json"
    terrain = json.loads(terrain_path.read_text(encoding="utf-8"))
    terrain["synthetic"] = False
    terrain_path.write_text(json.dumps(terrain), encoding="utf-8")
    assert "synthetic" in _joined(validate.validate_data_dir(root2))


def test_missing_index(tmp_path: Path) -> None:
    """Dossier sans index.json : erreur claire, pas d'exception."""
    errors = validate.validate_data_dir(tmp_path)
    assert errors and "index.json" in errors[0]


def test_invalid_json_file(tmp_path: Path) -> None:
    """JSON illisible : erreur claire, pas d'exception."""
    root = write_data_dir(tmp_path)
    (root / "sites" / "demo-x.json").write_text("{ pas du json", encoding="utf-8")
    assert "sites/demo-x.json" in _joined(validate.validate_data_dir(root))
