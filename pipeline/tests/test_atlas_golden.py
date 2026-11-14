"""Le fichier d'or de l'Atlas reste indépendant du JavaScript : le Sud vient de pipeline.projection, le Nord est symétrique du Sud."""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from pipeline.projection import lonlat_to_xy

GOLDEN = json.loads((Path(__file__).resolve().parents[2] / "tests" / "golden" / "atlas_sphere.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", GOLDEN["south_polar"], ids=lambda c: f"{c['lat_deg']},{c['lon_deg']}")
def test_south_matches_pipeline_projection(case: dict) -> None:
    """Pôle Sud : x, y = pipeline.projection (vérifiée contre GDAL, SOURCES.md)."""
    x, y = lonlat_to_xy(case["lat_deg"], case["lon_deg"])
    assert (float(x), float(y)) == pytest.approx((case["x_m"], case["y_m"]), abs=1e-6)


@pytest.mark.parametrize("case", GOLDEN["north_polar"], ids=lambda c: f"{c['lat_deg']},{c['lon_deg']}")
def test_north_is_mirror_of_south(case: dict) -> None:
    """Pôle Nord : ρ_nord(+φ) = ρ_sud(−φ) ; longitude 0° vers le bas (y négatif), x = ρ·sin λ, y = −ρ·cos λ."""
    xs, ys = lonlat_to_xy(-case["lat_deg"], case["lon_deg"])
    rho = math.hypot(float(xs), float(ys))
    lam = math.radians(case["lon_deg"])
    assert (case["x_m"], case["y_m"]) == pytest.approx((rho * math.sin(lam), -rho * math.cos(lam)), abs=1e-6)


def test_convention_and_vectors() -> None:
    """Convention écrite dans le fichier ; (0, 90) → −z ; vecteurs unitaires."""
    assert "−z" in GOLDEN["convention"]
    by_key = {(v["lat_deg"], v["lon_deg"]): v["v"] for v in GOLDEN["vectors"]}
    assert by_key[(0, 90)] == pytest.approx([0, 0, -1], abs=1e-12)
    for v in by_key.values():
        assert math.sqrt(sum(c * c for c in v)) == pytest.approx(1.0, abs=1e-12)
