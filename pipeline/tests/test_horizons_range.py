"""Distance Terre – site et délai de propagation (V2-05) : l'application déduit la distance du rayon angulaire de la Terre (arrondi au millidegré) ;
on la compare à la portée d'Horizons (valeurs relevées dans tests/reference/horizons_range.json, AUCUN réseau). Exigence de BUILD-V2 § 8 : écart de délai < 1 ms."""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import pytest

from pipeline.config import R_EARTH_KM

ROOT = Path(__file__).resolve().parents[2]
REF = json.loads((ROOT / "tests" / "reference" / "horizons_range.json").read_text(encoding="utf-8"))
C_KM_S = 299792.458


def _distance_from_site_series(site: dict, utc: str) -> float:
    """Distance (km) = R_Terre / sin(rayon angulaire du fichier de site), au pas horaire correspondant à `utc`."""
    t0 = datetime.strptime(site["time"]["start_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    t = datetime.strptime(utc, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    i = int((t - t0).total_seconds() // site["time"]["step_s"])
    radius_deg = site["bodies"]["earth"]["radius_mdeg"][i] / 1000.0
    return R_EARTH_KM / math.sin(math.radians(radius_deg))


@pytest.mark.parametrize("case", REF["cases"], ids=lambda c: f"{c['site_id']}-{c['day']}")
def test_delay_matches_horizons_within_one_millisecond(case: dict) -> None:
    """Écart de distance ≤ 300 km, soit moins de 1 ms de délai aller simple (limite : le rayon angulaire du fichier est arrondi à 1 millidegré)."""
    site = json.loads((ROOT / "web" / "data" / "sites" / f"{case['site_id']}.json").read_text(encoding="utf-8"))
    worst_ms = max(abs(_distance_from_site_series(site, s["utc"]) - s["range_km"]) / C_KM_S * 1000.0 for s in case["samples"])
    assert worst_ms < 1.0, f"écart de délai {worst_ms:.3f} ms"


def test_reference_file_is_complete_and_plausible() -> None:
    """12 cas de 24 heures ; la portée de la Terre reste dans [356 000 ; 407 000] km."""
    assert len(REF["cases"]) == 12 and all(len(c["samples"]) == 24 for c in REF["cases"])
    assert all(356000 < s["range_km"] < 407000 for c in REF["cases"] for s in c["samples"])
