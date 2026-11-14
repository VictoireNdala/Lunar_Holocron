"""Tests des éphémérides de démonstration (T-07, TESTS-VALIDATION § 4) : déterminisme, plages, périodes, rayons."""

from __future__ import annotations

import numpy as np
import pytest

from pipeline.ephemeris_demo import SUN_RADIUS_DEG, EARTH_RADIUS_DEG, body_series, utc_grid

T0 = "2026-01-01T00:00:00Z"
N = 43824


def test_utc_grid_period() -> None:
    """43 824 instants horaires du 2026-01-01T00:00Z au 2030-12-31T23:00Z (2028 bissextile)."""
    g = utc_grid(T0, 3600, N)
    assert len(g) == N and g[0] == "2026-01-01T00:00:00" and g[-1] == "2030-12-31T23:00:00"


def test_deterministic() -> None:
    """Mêmes entrées, mêmes sorties."""
    g = utc_grid(T0, 3600, 500)
    a, b = body_series("sun", -89.0, 0.0, g), body_series("sun", -89.0, 0.0, g)
    assert all(np.array_equal(a[k], b[k]) for k in a)


def test_ranges_at_pole() -> None:
    """À −89,99° : |él. Soleil| ≤ 1,54° + marge ; |él. Terre| ≤ 6,7° + marge."""
    g = utc_grid(T0, 3600, N)
    assert np.max(np.abs(body_series("sun", -89.99, 0.0, g)["el_deg"])) < 1.54 + 0.05
    assert np.max(np.abs(body_series("earth", -89.99, 0.0, g)["el_deg"])) < 6.7 + 0.1


def test_radii_constant() -> None:
    """Rayons constants : 0,2665° et 0,95°."""
    g = utc_grid(T0, 3600, 100)
    assert (SUN_RADIUS_DEG, EARTH_RADIUS_DEG) == (0.2665, 0.95)
    assert np.all(body_series("sun", -89.0, 0.0, g)["radius_deg"] == 0.2665)
    assert np.all(body_series("earth", -89.0, 0.0, g)["radius_deg"] == 0.95)


def test_sun_period_about_29_53_days() -> None:
    """Périodicité du Soleil ≈ 29,53 j (pic de l'autocorrélation de la composante est du Soleil)."""
    g = utc_grid(T0, 3600, 24 * 200)
    s = body_series("sun", -88.0, 0.0, g)
    x = np.sin(np.radians(s["az_deg"]))
    x = x - x.mean()
    ac = np.correlate(x, x, mode="full")[x.size - 1:]
    lag = np.argmax(ac[24 * 20:24 * 40]) + 24 * 20
    assert lag / 24.0 == pytest.approx(29.53, abs=0.6)


def test_earth_period_between_27_2_and_27_6_days() -> None:
    """Terre : libration en latitude de période 27,212 j (≈ 27,2 à 27,6 j)."""
    g = utc_grid(T0, 3600, 24 * 300)
    e = body_series("earth", -89.99, 0.0, g)["el_deg"]
    e = e - e.mean()
    ac = np.correlate(e, e, mode="full")[e.size - 1:]
    lag = np.argmax(ac[24 * 20:24 * 35]) + 24 * 20
    assert 27.0 <= lag / 24.0 <= 27.8


def test_azimuth_range_and_inputs() -> None:
    """Azimuts dans [0, 360) ; pôle exact et corps inconnu refusés."""
    az = body_series("earth", -89.5, 30.0, utc_grid(T0, 3600, 2000))["az_deg"]
    assert az.min() >= 0 and az.max() < 360
    with pytest.raises(ValueError):
        body_series("sun", -90.0, 0.0, [T0])
    with pytest.raises(ValueError):
        body_series("mars", -89.0, 0.0, [T0])
