"""Tests des formules de visibilité (T-06) : valeurs d'or partagées avec JavaScript, propriétés, cas limites."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline.visibility import horizon_at, is_visible, visible_fraction

GOLDEN = Path(__file__).resolve().parents[2] / "tests" / "golden"
FRACTION = json.loads((GOLDEN / "visible_fraction.json").read_text(encoding="utf-8"))
HORIZON = json.loads((GOLDEN / "horizon_at.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", FRACTION["cases"], ids=lambda c: f"el={c['el_deg']},h={c['horizon_deg']}")
def test_visible_fraction_golden(case: dict) -> None:
    """Mêmes valeurs d'or que web/tests/visibility.test.js."""
    f = visible_fraction(case["el_deg"], FRACTION["radius_deg"], case["horizon_deg"])
    assert float(f) == pytest.approx(case["f"], abs=FRACTION["tolerance_abs"])
    assert bool(is_visible(f, "strict")) == case["strict"]
    assert bool(is_visible(f, "any")) == case["any"]


@pytest.mark.parametrize("case", HORIZON["cases"], ids=lambda c: f"az={c['az_deg']}")
def test_horizon_at_golden(case: dict) -> None:
    """Interpolation du masque avec bouclage (mêmes valeurs qu'en JS)."""
    mask = np.arange(360) / 100.0
    assert float(horizon_at(mask, case["az_deg"])) == pytest.approx(case["h_deg"], abs=HORIZON["tolerance_abs"])


def test_monotonic_and_symmetric() -> None:
    """f croît avec d ; f(d) + f(−d) = 1."""
    d = np.linspace(-0.5, 0.5, 2001)
    f = visible_fraction(d, 0.27, 0.0)
    assert np.all(np.diff(f) >= 0)
    assert np.max(np.abs(f + visible_fraction(-d, 0.27, 0.0) - 1.0)) < 1e-12


def test_strict_and_any_definitions() -> None:
    """strict ⇔ d ≥ 0 ; any ⇔ d > −r (ARCHITECTURE § 3)."""
    r = 0.27
    for d, strict, any_ in [(0.0, True, True), (-1e-6, False, True), (-0.2699, False, True), (-0.27, False, False), (0.01, True, True)]:
        f = visible_fraction(d, r, 0.0)
        assert bool(is_visible(f, "strict")) is strict
        assert bool(is_visible(f, "any")) is any_


def test_tiny_radius_no_nan() -> None:
    """Rayon très petit (1e-9) : ni NaN ni division par zéro ; marche nette à d = 0."""
    f = visible_fraction(np.array([-1e-3, 0.0, 1e-3]), 1e-9, 0.0)
    assert np.all(np.isfinite(f))
    assert f.tolist() == [0.0, 0.5, 1.0]


def test_invalid_inputs() -> None:
    """Rayon non positif ou mode inconnu : refusés."""
    with pytest.raises(ValueError):
        visible_fraction(0.0, 0.0, 0.0)
    with pytest.raises(ValueError):
        is_visible(0.5, "maybe")
    with pytest.raises(ValueError):
        horizon_at(np.zeros(359), 10.0)


def test_vectorized_shapes() -> None:
    """Diffusion NumPy : séries entières en un appel."""
    el = np.linspace(-1, 1, 43824)
    f = visible_fraction(el, np.full_like(el, 0.27), horizon_at(np.zeros(360), np.linspace(0, 720, 43824)))
    assert f.shape == (43824,)


def test_numeric_tolerance_d031() -> None:
    """D-031 : le bruit d'un ulp à la limite est sans effet (mêmes cas qu'en JavaScript), un vrai écart est pris en compte."""
    assert bool(is_visible(0.5 - 1e-12, "strict")) is True
    assert bool(is_visible(0.5 - 1e-6, "strict")) is False
    assert bool(is_visible(1e-12, "any")) is False
    assert bool(is_visible(1e-6, "any")) is True
    assert bool(is_visible(0.0, "any")) is False
