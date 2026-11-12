"""Contrôles du contrat de données (docs/CONTRAT-DONNEES.md § 7) : schéma JSON puis contrôles croisés.

Usage : `py -m pipeline.validate [dossier]` (par défaut `web/data`). Code de sortie 0 si tout est valide, 1 sinon.
Le recalcul des indicateurs (§ 7.6) sera branché en T-07, quand `pipeline/kpi.py` existera.
"""

from __future__ import annotations

import argparse
import itertools
import json
import math
import sys
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

SUPPORTED_MAJOR = 1  # Version majeure du contrat comprise par ce code.
MAX_ERRORS = 20  # Nombre maximal d'erreurs de schéma rapportées par document.
SCHEMA_DIR = Path(__file__).resolve().parent / "schema"
UTC_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
SPACING_REL_TOL = 1e-9  # Tolérance relative sur spacing_m = size_m / (n - 1).
COORD_ABS_TOL_DEG = 1e-9  # Tolérance sur l'égalité des coordonnées entre fichiers.
MAX_SHOWN_CHARS = 60  # Longueur maximale d'une valeur citée dans un message.


@lru_cache(maxsize=None)
def load_schema(name: str) -> dict[str, Any]:
    """Charge `pipeline/schema/<name>.schema.json`."""
    return json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=None)
def _validator(name: str) -> Draft202012Validator:
    """Validateur JSON Schema mis en cache."""
    return Draft202012Validator(load_schema(name))


def _short(value: Any) -> str:
    """Représentation courte d'une valeur (jamais un tableau entier dans un message)."""
    if isinstance(value, list):
        return f"liste de {len(value)} éléments"
    if isinstance(value, dict):
        return "objet"
    text = json.dumps(value, ensure_ascii=False)
    return text if len(text) <= MAX_SHOWN_CHARS else text[:MAX_SHOWN_CHARS] + "…"


def _path(parts: Any) -> str:
    """Chemin lisible : bodies.sun.az_mdeg[7]."""
    out = ""
    for p in parts:
        out += f"[{p}]" if isinstance(p, int) else (f".{p}" if out else str(p))
    return out or "(racine)"


def _describe(err: ValidationError) -> str:
    """Message court en français qui nomme le champ fautif."""
    where, v, val = _path(err.absolute_path), err.validator, err.validator_value
    if v == "required":
        missing = [k for k in val if not isinstance(err.instance, dict) or k not in err.instance]
        return f"{where}: champ obligatoire manquant {missing}"
    if v in ("minItems", "maxItems"):
        return f"{where}: longueur {len(err.instance)}, attendu {'au moins' if v == 'minItems' else 'au plus'} {val}"
    if v == "type":
        return f"{where}: type attendu {val}, reçu {_short(err.instance)}"
    if v in ("minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"):
        return f"{where}: valeur {_short(err.instance)} hors limite ({v} = {val})"
    if v in ("const", "enum", "pattern"):
        return f"{where}: valeur {_short(err.instance)} non conforme ({v} = {_short(val)})"
    return f"{where}: {err.message[:200]}"


def check_schema_version(doc: Any) -> list[str]:
    """Le majeur de schema_version doit être connu (CONTRAT § 7.1)."""
    version = doc.get("schema_version") if isinstance(doc, dict) else None
    if not isinstance(version, str):
        return [f"schema_version: absent ou non textuel ({_short(version)})"]
    major, _, minor = version.partition(".")
    if not (major.isdigit() and minor.isdigit()):
        return [f"schema_version: format invalide {_short(version)} (attendu « majeur.mineur »)"]
    if int(major) != SUPPORTED_MAJOR:
        return [f"schema_version: version majeure inconnue {_short(version)} (attendu {SUPPORTED_MAJOR}.x)"]
    return []


def _schema_errors(name: str, doc: Any) -> list[str]:
    """Erreurs de schéma, plafonnées à MAX_ERRORS (+ une ligne de résumé)."""
    errors = sorted(_validator(name).iter_errors(doc), key=lambda e: list(map(str, e.absolute_path)))
    out = [_describe(e) for e in itertools.islice(errors, MAX_ERRORS)]
    if len(errors) > MAX_ERRORS:
        out.append(f"… et {len(errors) - MAX_ERRORS} autres erreurs de schéma")
    return out


def _parse_utc(text: str) -> datetime:
    """Lit une date du contrat (déjà validée par le schéma)."""
    return datetime.strptime(text, UTC_FORMAT).replace(tzinfo=timezone.utc)


def _months_between(start: datetime, end: datetime) -> list[str]:
    """Mois civils 'AAAA-MM' couverts par [start, end]."""
    out, y, m = [], start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _site_cross_checks(doc: dict[str, Any]) -> list[str]:
    """Contrôles que le schéma ne sait pas exprimer pour un site."""
    errors: list[str] = []
    count = doc["time"]["count"]
    for body in ("sun", "earth"):
        for key in ("az_mdeg", "el_mdeg", "radius_mdeg"):
            n = len(doc["bodies"][body][key])
            if n != count:
                errors.append(f"bodies.{body}.{key}: longueur {n}, attendu time.count = {count}")
    prov = doc["provenance"]
    if (prov["dem"]["product"] == "SYNTHETIC" or prov["ephemeris"]["engine"] == "demo-analytic") and not doc["synthetic"]:
        errors.append("synthetic: doit valoir true (MNT SYNTHETIC ou éphémérides demo-analytic)")
    start = _parse_utc(doc["time"]["start_utc"])
    end = start + timedelta(seconds=doc["time"]["step_s"] * (count - 1))
    window = doc["kpis"]["window"]
    if window["start_utc"] != doc["time"]["start_utc"]:
        errors.append(f"kpis.window.start_utc: {window['start_utc']} différent de time.start_utc")
    if window["end_utc"] != end.strftime(UTC_FORMAT):
        errors.append(f"kpis.window.end_utc: {window['end_utc']}, attendu {end.strftime(UTC_FORMAT)} (dernier échantillon)")
    for key in ("sun_el_deg", "earth_el_deg"):
        if doc["kpis"][key]["min"] > doc["kpis"][key]["max"]:
            errors.append(f"kpis.{key}: min > max")
    got = [m["ym"] for m in doc["monthly"]]
    expected = _months_between(start, end)
    if got != expected:
        errors.append(f"monthly: mois {_short(got)} ; attendu {len(expected)} mois triés de {expected[0]} à {expected[-1]}")
    return errors


def validate_site(doc: Any) -> list[str]:
    """Valide un document sites/<id>.json ; renvoie la liste des erreurs (vide si valide)."""
    errors = check_schema_version(doc) or _schema_errors("site", doc)
    return errors or _site_cross_checks(doc)


def validate_index(doc: Any) -> list[str]:
    """Valide index.json : schéma, identifiants uniques, chemins, drapeau synthetic racine."""
    errors = check_schema_version(doc) or _schema_errors("index", doc)
    if errors:
        return errors
    ids = [s["id"] for s in doc["sites"]]
    for dup in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f"sites: identifiant en double {dup!r}")
    for k, s in enumerate(doc["sites"]):
        if s["site_file"] != f"sites/{s['id']}.json":
            errors.append(f"sites[{k}].site_file: {s['site_file']!r}, attendu 'sites/{s['id']}.json'")
        if s["terrain_file"] != f"terrain/{s['id']}.json":
            errors.append(f"sites[{k}].terrain_file: {s['terrain_file']!r}, attendu 'terrain/{s['id']}.json'")
    any_synthetic = any(s["synthetic"] for s in doc["sites"])
    if doc["synthetic"] != any_synthetic:
        errors.append(f"synthetic: racine = {doc['synthetic']}, attendu {any_synthetic} (vrai si au moins un site est synthétique)")
    return errors


def validate_terrain(doc: Any) -> list[str]:
    """Valide terrain/<id>.json : schéma, pas de grille, bornes, nom du .bin."""
    errors = check_schema_version(doc) or _schema_errors("terrain", doc)
    if errors:
        return errors
    grid, z = doc["grid"], doc["z"]
    expected = grid["size_m"] / (grid["n"] - 1)
    if not math.isclose(grid["spacing_m"], expected, rel_tol=SPACING_REL_TOL):
        errors.append(f"grid.spacing_m: {grid['spacing_m']}, attendu size_m / (n - 1) = {expected}")
    if z["min_m"] > z["max_m"]:
        errors.append("z.min_m: supérieur à z.max_m")
    if z["file"] != f"{doc['id']}.bin":
        errors.append(f"z.file: {z['file']!r}, attendu '{doc['id']}.bin'")
    return errors


def _load_json(path: Path, label: str) -> tuple[Any, list[str]]:
    """Lit un JSON ; renvoie (document, erreurs) sans lever d'exception."""
    if not path.is_file():
        return None, [f"{label}: fichier absent"]
    try:
        return json.loads(path.read_text(encoding="utf-8")), []
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        return None, [f"{label}: JSON illisible ({exc})"]


def _same_coords(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Mêmes latitude et longitude à COORD_ABS_TOL_DEG près."""
    return all(abs(a[k] - b[k]) <= COORD_ABS_TOL_DEG for k in ("lat_deg", "lon_deg"))


def _check_entry(root: Path, entry: dict[str, Any]) -> list[str]:
    """Contrôles croisés d'une entrée de l'index avec ses fichiers."""
    errors: list[str] = []
    site_label, terrain_label = entry["site_file"], entry["terrain_file"]
    site, errs = _load_json(root / site_label, site_label)
    errors += errs
    if site is not None:
        errs = validate_site(site)
        errors += [f"{site_label}: {e}" for e in errs]
        if not errs:
            if site["id"] != entry["id"]:
                errors.append(f"{site_label}: id {site['id']!r} différent de l'index ({entry['id']!r})")
            if site["synthetic"] != entry["synthetic"]:
                errors.append(f"{site_label}: synthetic différent de l'index")
            if not _same_coords(site["location"], entry):
                errors.append(f"{site_label}: location différente des coordonnées de l'index")
    terrain, errs = _load_json(root / terrain_label, terrain_label)
    errors += errs
    if terrain is not None:
        errs = validate_terrain(terrain)
        errors += [f"{terrain_label}: {e}" for e in errs]
        if not errs:
            if terrain["id"] != entry["id"]:
                errors.append(f"{terrain_label}: id {terrain['id']!r} différent de l'index ({entry['id']!r})")
            if terrain["synthetic"] != entry["synthetic"]:
                errors.append(f"{terrain_label}: synthetic différent de l'index")
            if not _same_coords(terrain["center"], entry):
                errors.append(f"{terrain_label}: center différent des coordonnées de l'index")
            bin_path = (root / terrain_label).parent / terrain["z"]["file"]
            n = terrain["grid"]["n"]
            if not bin_path.is_file():
                errors.append(f"terrain/{terrain['z']['file']}: fichier absent")
            elif bin_path.stat().st_size != n * n * 2:
                errors.append(f"terrain/{terrain['z']['file']}: {bin_path.stat().st_size} octets, attendu n × n × 2 = {n * n * 2}")
    return errors


def validate_data_dir(root: Path) -> list[str]:
    """Valide un dossier de données complet (index, sites, terrains, .bin)."""
    index, errors = _load_json(root / "index.json", "index.json")
    if index is None:
        return errors
    errors = [f"index.json: {e}" for e in validate_index(index)]
    if errors:
        return errors
    for entry in index["sites"]:
        errors += _check_entry(root, entry)
    return errors


def main(argv: list[str] | None = None) -> int:
    """Point d'entrée en ligne de commande ; renvoie le code de sortie."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    parser = argparse.ArgumentParser(description="Valide un dossier de données (contrat 1.x).")
    parser.add_argument("data_dir", nargs="?", default="web/data", help="dossier contenant index.json")
    args = parser.parse_args(argv)
    root = Path(args.data_dir)
    errors = validate_data_dir(root)
    for e in errors:
        print(f"ERREUR {e}")
    print(f"validate {root}: {'OK' if not errors else f'{len(errors)} erreur(s)'}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
