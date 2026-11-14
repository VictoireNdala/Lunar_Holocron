"""Tests des indicateurs (T-06, CONTRAT §§ 4-5) sur des séries construites à la main (TESTS-VALIDATION § 5)."""

from __future__ import annotations

import numpy as np
import pytest

from pipeline.kpi import compute_kpis, gap_stats, month_labels

START = "2026-01-31T00:00:00Z"  # la série chevauche janvier et février


def test_gap_stats_cases() -> None:
    """Toujours visible, jamais, alternance, trous collés au début et à la fin, trou unique de 24 h."""
    assert gap_stats(np.ones(10, bool), 3600) == (0.0, 0)
    assert gap_stats(np.zeros(10, bool), 3600) == (10.0, 1)
    assert gap_stats(np.array([1, 0] * 5, bool), 3600) == (1.0, 5)
    assert gap_stats(np.array([0, 0, 0, 1, 1, 1, 1], bool), 3600) == (3.0, 1)  # collé au début
    assert gap_stats(np.array([1, 1, 0, 0], bool), 3600) == (2.0, 1)  # collé à la fin
    v = np.ones(100, bool)
    v[30:54] = False
    assert gap_stats(v, 3600) == (24.0, 1)


def _bodies(n: int, sun_el_mdeg: np.ndarray, earth_el_mdeg: np.ndarray) -> dict:
    """Séries de test : azimut fixe, rayon 0,27° pour les deux corps."""
    return {b: {"az_mdeg": np.zeros(n, int), "el_mdeg": el, "radius_mdeg": np.full(n, 270)}
            for b, el in (("sun", sun_el_mdeg), ("earth", earth_el_mdeg))}


def test_compute_kpis_flat_horizon() -> None:
    """Horizon plat à 0 : Soleil au-dessus une heure sur deux, Terre toujours au-dessus ; both = Soleil."""
    n = 48
    sun = np.where(np.arange(n) % 2 == 0, 1000, -1000)
    earth = np.full(n, 2000)
    k, monthly = compute_kpis(np.zeros(360), _bodies(n, sun, earth), START, 3600)
    assert k["sun"]["strict"] == {"visible_pct": 50.0, "longest_gap_h": 1.0, "n_gaps": 24}
    assert k["earth"]["strict"] == {"visible_pct": 100.0, "longest_gap_h": 0.0, "n_gaps": 0}
    assert k["both"]["strict"] == k["sun"]["strict"]
    assert k["sun_el_deg"] == {"min": -1.0, "max": 1.0}
    assert k["window"] == {"start_utc": START, "end_utc": "2026-02-01T23:00:00Z"}
    assert [m["ym"] for m in monthly] == ["2026-01", "2026-02"]
    assert monthly[0]["earth_strict_pct"] == 100.0 and monthly[0]["sun_strict_pct"] == 50.0


def test_strict_vs_any_differ() -> None:
    """Centre 0,1° sous l'horizon (rayon 0,27°) : invisible en strict, visible en optimiste."""
    n = 10
    k, _ = compute_kpis(np.zeros(360), _bodies(n, np.full(n, -100), np.full(n, -100)), START, 3600)
    assert k["sun"]["strict"]["visible_pct"] == 0.0
    assert k["sun"]["any"]["visible_pct"] == 100.0


def test_horizon_uses_body_azimuth() -> None:
    """L'horizon est lu à l'azimut du corps (bouclage inclus) : une montagne à 359°–0° masque le Soleil."""
    n = 4
    mask = np.zeros(360)
    mask[359] = mask[0] = 5.0
    bodies = _bodies(n, np.full(n, 2000), np.full(n, 2000))
    bodies["sun"]["az_mdeg"] = np.array([359_500, 0, 180_000, 90_000])
    k, _ = compute_kpis(mask, bodies, START, 3600)
    assert k["sun"]["strict"]["visible_pct"] == 50.0


def test_monthly_counts_sum_to_count() -> None:
    """La somme des échantillons des mois égale count (pondération par mois)."""
    n = 24 * 70
    rng = np.random.default_rng(3)
    k, monthly = compute_kpis(np.zeros(360), _bodies(n, rng.integers(-3000, 3000, n), rng.integers(-3000, 3000, n)), START, 3600)
    labels = month_labels(START, 3600, n)
    counts = {m["ym"]: int(np.sum(labels == m["ym"])) for m in monthly}
    assert sum(counts.values()) == n
    assert set(monthly[0]) == {"ym", "sun_strict_pct", "earth_strict_pct", "both_strict_pct"}  # contrat § 5, rien de plus
    weighted = sum(m["sun_strict_pct"] * counts[m["ym"]] for m in monthly) / n
    assert weighted == pytest.approx(k["sun"]["strict"]["visible_pct"], abs=1e-9)
