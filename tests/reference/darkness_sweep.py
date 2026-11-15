"""Balayage « nuit la plus longue » d'un site 5 m (M-051 § 2.7, suite : abstract de Mazarico et al. 2011, NTRS 20120010094) : « une fois par an, un lieu près du bord de Shackleton est
éclairé en continu pendant 240 jours et sa plus longue période d'obscurité totale est d'environ 1,5 jour ». Pour chaque point d'une grille de 500 m de l'emprise 5 m, sur une année
(2026, une valeur par heure) : part du temps éclairé, plus longue période éclairée et plus longue obscurité (seuil strict puis « any »). Usage : py -m tests.reference.darkness_sweep [site-id]"""
import json
import sys
from pathlib import Path

import numpy as np

from pipeline import ephemeris_spice, geodesy
from pipeline.config import MOON_FRAME, R_REF_M
from pipeline.ephemeris_spice import ABCORR, BODIES, SITE_UNIT_KM_PER_M
from pipeline.export import PipelineConfig
from pipeline.horizon import compute_horizon
from pipeline.sites import real_specs
from pipeline.timegrid import utc_grid
from pipeline.visibility import horizon_at, is_visible, visible_fraction

site_id = sys.argv[1] if len(sys.argv) > 1 else "site04-shackleton-rim"
EYES = [2.0, 5.0]
cfg = PipelineConfig.load(Path("config/pipeline.json"))
ephemeris_spice.load_kernels(cfg.kernel_dir)
(spec,), _ = real_specs(Path("config/sites_real.json"), cfg, {site_id})
import spiceypy as sp  # noqa: E402

name, radius_km = BODIES["sun"]
utc = utc_grid("2026-01-01T00:00:00Z", 3600, 8760)
et = np.array([sp.str2et(t.rstrip("Z")) for t in utc])
sun_km = np.asarray(sp.spkpos(name, et, MOON_FRAME, ABCORR, "MOON")[0])


def longest_run(mask: np.ndarray) -> int:
    """Plus longue suite de True consécutifs (en échantillons)."""
    best = cur = 0
    for v in mask:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best


offs = np.arange(-8000.0, 8001.0, 500.0)
res = {f"eye{e:g}": {m: [] for m in ("strict", "any")} for e in EYES}
for n in offs[::-1]:
    for e_ in offs:
        dist = float(np.hypot(e_, n))
        lat, lon = (spec.lat_deg, spec.lon_deg) if dist == 0 else (float(v) for v in geodesy.destination(spec.lat_deg, spec.lon_deg, np.degrees(np.arctan2(e_, n)), dist))
        ground = float(np.asarray(spec.dem.height_m(lat, lon)))
        if not np.isfinite(ground):
            continue
        east, north, up = geodesy.enu_basis(lat, lon)
        for eye in EYES:
            elev, _ = compute_horizon(spec.dem, lat, lon, eye, cfg.horizon)
            v = sun_km - (R_REF_M + ground + eye) * SITE_UNIT_KM_PER_M * up
            az, el = geodesy.az_el_from_vector(v, east, north, up)
            rad = np.degrees(np.arcsin(radius_km / np.linalg.norm(v, axis=-1)))
            f = visible_fraction(el, rad, horizon_at(elev, az))
            for mode in ("strict", "any"):
                lit = is_visible(f, mode)
                res[f"eye{eye:g}"][mode].append({"east_m": float(e_), "north_m": float(n), "lit_pct": round(100.0 * float(lit.mean()), 2),
                                                  "longest_lit_days": round(longest_run(lit) / 24.0, 2), "longest_dark_h": int(longest_run(~lit))})
out = {"site_id": site_id, "period": "2026-01-01 .. 2026-12-31, 8760 hourly samples", "step_m": 500.0, "summary": {}, "points": res}
for k, modes in res.items():
    out["summary"][k] = {}
    for mode, pts in modes.items():
        best_dark = min(pts, key=lambda p: p["longest_dark_h"])
        best_lit = max(pts, key=lambda p: p["longest_lit_days"])
        out["summary"][k][mode] = {"n_points": len(pts), "min_longest_dark_h": best_dark["longest_dark_h"], "at_min_dark": [best_dark["east_m"], best_dark["north_m"]],
                                   "max_longest_lit_days": best_lit["longest_lit_days"], "at_max_lit": [best_lit["east_m"], best_lit["north_m"]], "max_lit_pct": max(p["lit_pct"] for p in pts)}
        print(k, mode, out["summary"][k][mode], flush=True)
Path(f"tests/reference/darkness_{site_id}.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")
