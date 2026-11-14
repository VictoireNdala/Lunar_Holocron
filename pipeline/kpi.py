"""Indicateurs d'un site (docs/CONTRAT-DONNEES.md §§ 4-5), calculés sur toute la période à partir des fractions visibles.

« Visible » : seuil strict (f ≥ 0,5) ou optimiste (f > 0), formules de pipeline/visibility.py.
Intervalle d'absence : suite maximale d'échantillons consécutifs non visibles ; ceux qui touchent le début ou la fin
de la période sont comptés (tronqués ; à dire dans la page méthode).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np
from numpy.typing import ArrayLike, NDArray

from pipeline.config import MDEG_PER_DEG, THRESHOLD_MODES
from pipeline.visibility import horizon_at, is_visible, visible_fraction

UTC_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
BODIES = ("sun", "earth")


def gap_stats(visible: NDArray[np.bool_], step_s: int) -> tuple[float, int]:
    """(plus long intervalle d'absence en heures, nombre d'intervalles), détection vectorisée des transitions."""
    hidden = np.concatenate(([0], (~np.asarray(visible, bool)).astype(np.int8), [0]))
    edges = np.diff(hidden)
    starts, ends = np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)
    if starts.size == 0:
        return 0.0, 0
    return float(np.max(ends - starts)) * step_s / 3600.0, int(starts.size)


def month_labels(start_utc: str, step_s: int, count: int) -> NDArray[np.str_]:
    """Mois civil UTC « AAAA-MM » de chaque échantillon."""
    t0 = np.datetime64(datetime.strptime(start_utc, UTC_FORMAT).replace(tzinfo=None), "s")
    times = t0 + np.arange(count, dtype=np.int64) * np.timedelta64(step_s, "s")
    return np.datetime_as_string(times.astype("datetime64[M]"), unit="M")


def body_fraction(horizon_elev_deg: ArrayLike, series: dict[str, ArrayLike]) -> NDArray[np.float64]:
    """Fraction visible du corps à chaque échantillon, horizon lu à l'azimut du corps."""
    az = np.asarray(series["az_mdeg"], dtype=np.float64) / MDEG_PER_DEG
    el = np.asarray(series["el_mdeg"], dtype=np.float64) / MDEG_PER_DEG
    r = np.asarray(series["radius_mdeg"], dtype=np.float64) / MDEG_PER_DEG
    return visible_fraction(el, r, horizon_at(horizon_elev_deg, az))


def compute_kpis(horizon_elev_deg: ArrayLike, bodies: dict[str, dict[str, ArrayLike]], start_utc: str,
                 step_s: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Renvoie (`kpis`, `monthly`) au format du contrat."""
    vis: dict[str, dict[str, NDArray[np.bool_]]] = {}
    for body in BODIES:
        f = body_fraction(horizon_elev_deg, bodies[body])
        vis[body] = {mode: is_visible(f, mode) for mode in THRESHOLD_MODES}
    vis["both"] = {mode: vis["sun"][mode] & vis["earth"][mode] for mode in THRESHOLD_MODES}
    count = vis["sun"]["strict"].size
    start = datetime.strptime(start_utc, UTC_FORMAT).replace(tzinfo=timezone.utc)
    end = start + timedelta(seconds=step_s * (count - 1))
    kpis: dict[str, Any] = {"window": {"start_utc": start_utc, "end_utc": end.strftime(UTC_FORMAT)}}
    for key, modes in vis.items():
        kpis[key] = {}
        for mode in THRESHOLD_MODES:
            longest, n_gaps = gap_stats(modes[mode], step_s)
            kpis[key][mode] = {"visible_pct": 100.0 * int(modes[mode].sum()) / count, "longest_gap_h": longest, "n_gaps": n_gaps}
    for body in BODIES:
        el = np.asarray(bodies[body]["el_mdeg"], dtype=np.float64) / MDEG_PER_DEG
        kpis[f"{body}_el_deg"] = {"min": float(el.min()), "max": float(el.max())}
    labels = month_labels(start_utc, step_s, count)
    monthly = []
    for ym in np.unique(labels):
        sel = labels == ym
        n = int(sel.sum())
        monthly.append({"ym": str(ym), **{f"{k}_strict_pct": 100.0 * int(vis[k]["strict"][sel].sum()) / n for k in ("sun", "earth", "both")}})
    return kpis, monthly
