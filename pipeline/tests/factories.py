"""Fabriques de documents valides (contrat 1.0), petites et lisibles, pour les tests."""

from __future__ import annotations

import copy
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

UTC_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def _utc(dt: datetime) -> str:
    """Formate une date UTC au format du contrat."""
    return dt.strftime(UTC_FORMAT)


def _months(start: datetime, end: datetime) -> list[str]:
    """Liste des mois civils 'AAAA-MM' couverts par [start, end]."""
    out: list[str] = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _kpi_block() -> dict[str, Any]:
    """Bloc d'indicateurs plausible (les valeurs ne sont pas recalculées en T-01)."""
    return {"visible_pct": 50.0, "longest_gap_h": 12.0, "n_gaps": 2}


def make_site(site_id: str = "demo-x", count: int = 48,
              start_utc: str = "2026-01-01T00:00:00Z", synthetic: bool = True) -> dict[str, Any]:
    """Document sites/<id>.json valide, de `count` échantillons horaires."""
    start = datetime.strptime(start_utc, UTC_FORMAT).replace(tzinfo=timezone.utc)
    end = start + timedelta(hours=count - 1)
    pair = {"strict": _kpi_block(), "any": _kpi_block()}
    return {
        "schema_version": "1.0",
        "id": site_id,
        "name": {"fr": "Site de test", "en": "Test site"},
        "synthetic": synthetic,
        "location": {"lat_deg": -89.0, "lon_deg": 0.0, "ground_height_m": 0.0,
                     "observer_height_m": 2.0, "frame": "MOON_ME", "r_ref_m": 1737400.0},
        "provenance": {
            "dem": {"product": "SYNTHETIC" if synthetic else "LDEM_TEST", "resolution_m": 20.0,
                    "source": None, "license": "n/a"},
            "ephemeris": {"engine": "demo-analytic" if synthetic else "spice",
                          "kernels": [], "abcorr": None},
            "pipeline_version": "0.1.0",
            "generated_utc": "2026-11-12T21:00:00Z",
        },
        "horizon": {"az_step_deg": 1.0, "elev_deg": [0.5] * 360,
                    "truncated": [False] * 360, "max_distance_km": 150.0},
        "time": {"start_utc": start_utc, "step_s": 3600, "count": count},
        "bodies": {
            "sun": {"az_mdeg": [(i * 15000) % 360000 for i in range(count)],
                    "el_mdeg": [1000] * count, "radius_mdeg": [267] * count},
            "earth": {"az_mdeg": [(359000 + i * 100) % 360000 for i in range(count)],
                      "el_mdeg": [-2000] * count, "radius_mdeg": [950] * count},
        },
        "kpis": {
            "window": {"start_utc": _utc(start), "end_utc": _utc(end)},
            "sun": copy.deepcopy(pair), "earth": copy.deepcopy(pair), "both": copy.deepcopy(pair),
            "sun_el_deg": {"min": 1.0, "max": 1.0},
            "earth_el_deg": {"min": -2.0, "max": -2.0},
        },
        "monthly": [{"ym": ym, "sun_strict_pct": 50.0, "earth_strict_pct": 0.0, "both_strict_pct": 0.0}
                    for ym in _months(start, end)],
    }


def make_terrain(site_id: str = "demo-x", n: int = 5, synthetic: bool = True) -> dict[str, Any]:
    """Document terrain/<id>.json valide pour une grille n × n."""
    size_m = 20000.0
    return {
        "schema_version": "1.0",
        "id": site_id,
        "synthetic": synthetic,
        "center": {"lat_deg": -89.0, "lon_deg": 0.0},
        "grid": {"n": n, "size_m": size_m, "spacing_m": size_m / (n - 1)},
        "frame": "local-enu",
        "z": {"encoding": "uint16-linear", "min_m": -250.0, "max_m": 1800.0, "file": f"{site_id}.bin",
              "byte_order": "little", "row_order": "north-to-south", "col_order": "west-to-east"},
    }


def make_index(site_ids: list[str] | None = None, synthetic: bool = True) -> dict[str, Any]:
    """Document index.json valide référençant `site_ids`."""
    ids = site_ids or ["demo-x"]
    return {
        "schema_version": "1.0",
        "generated_utc": "2026-11-12T21:00:00Z",
        "synthetic": synthetic,
        "sites": [{"id": i, "name": {"fr": "Site de test", "en": "Test site"}, "lat_deg": -89.0, "lon_deg": 0.0,
                   "synthetic": synthetic, "verified": True,
                   "site_file": f"sites/{i}.json", "terrain_file": f"terrain/{i}.json"} for i in ids],
    }


def write_data_dir(root: Path, site_ids: list[str] | None = None, n: int = 5) -> Path:
    """Écrit un dossier web/data complet et valide sous `root` ; renvoie son chemin."""
    ids = site_ids or ["demo-x"]
    (root / "sites").mkdir(parents=True, exist_ok=True)
    (root / "terrain").mkdir(parents=True, exist_ok=True)
    (root / "index.json").write_text(json.dumps(make_index(ids)), encoding="utf-8")
    for i in ids:
        (root / "sites" / f"{i}.json").write_text(json.dumps(make_site(i)), encoding="utf-8")
        (root / "terrain" / f"{i}.json").write_text(json.dumps(make_terrain(i, n)), encoding="utf-8")
        (root / "terrain" / f"{i}.bin").write_bytes(b"\x00\x00" * n * n)
    return root
