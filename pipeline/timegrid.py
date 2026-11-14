"""Grille temporelle commune du pipeline : instants UTC ISO 8601 et liste des corps."""

from __future__ import annotations

import numpy as np

BODIES = ("sun", "earth")


def utc_grid(start_utc: str, step_s: int, count: int) -> list[str]:
    """`count` instants UTC ISO 8601 sans `Z`, espacés de `step_s`."""
    t0 = np.datetime64(start_utc.rstrip("Z"), "s")
    return [str(t0 + np.timedelta64(k * step_s, "s")) for k in range(count)]
