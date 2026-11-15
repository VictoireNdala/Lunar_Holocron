"""Raffinement autour du meilleur point du balayage d'illumination (M-051 § 2.7) : grille de 50 m sur ±600 m, hauteur d'œil de 1 m, période 2024-01-01 → 2026-01-01, seuil strict.
Teste si une maille de 500 m cache de petits maxima (> 70 % de l'abstract de Barker et al. 2021). Usage : py -m tests.reference.illumination_refine [site-id]"""
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

site_id = sys.argv[1] if len(sys.argv) > 1 else "site01-connecting-ridge"
ref = json.loads(Path(f"tests/reference/illumination_{site_id}.json").read_text(encoding="utf-8"))
run = ref["runs"]["barker_2024_2026|eye1"]["strict"]
cfg = PipelineConfig.load(Path("config/pipeline.json"))
ephemeris_spice.load_kernels(cfg.kernel_dir)
(spec,), _ = real_specs(Path("config/sites_real.json"), cfg, {site_id})
import spiceypy as sp  # noqa: E402

name, radius_km = BODIES["sun"]
utc = utc_grid("2024-01-01T00:00:00Z", 3600, 17545)
et = np.array([sp.str2et(t.rstrip("Z")) for t in utc])
sun_km = np.asarray(sp.spkpos(name, et, MOON_FRAME, ABCORR, "MOON")[0])
e0, n0 = run["best_offset_east_m"], run["best_offset_north_m"]
offs = np.arange(-600.0, 601.0, 50.0)
best = (-1.0, None)
vals = []
for dn in offs:
    for de in offs:
        e, n = e0 + de, n0 + dn
        dist = float(np.hypot(e, n))
        lat, lon = (spec.lat_deg, spec.lon_deg) if dist == 0 else (float(v) for v in geodesy.destination(spec.lat_deg, spec.lon_deg, np.degrees(np.arctan2(e, n)), dist))
        ground = float(np.asarray(spec.dem.height_m(lat, lon)))
        if not np.isfinite(ground):
            continue
        east, north, up = geodesy.enu_basis(lat, lon)
        elev, _ = compute_horizon(spec.dem, lat, lon, 1.0, cfg.horizon)
        v = sun_km - (R_REF_M + ground + 1.0) * SITE_UNIT_KM_PER_M * up
        az, el = geodesy.az_el_from_vector(v, east, north, up)
        rad = np.degrees(np.arcsin(radius_km / np.linalg.norm(v, axis=-1)))
        pct = 100.0 * float(is_visible(visible_fraction(el, rad, horizon_at(elev, az)), "strict").mean())
        vals.append(pct)
        if pct > best[0]:
            best = (pct, (e, n))
vals = np.array(vals)
out = {"site_id": site_id, "center_of_refinement_m": [e0, n0], "step_m": 50.0, "half_m": 600.0, "eye_m": 1.0, "n_points": int(vals.size), "max_pct": round(float(vals.max()), 2),
       "median_pct": round(float(np.median(vals)), 2), "share_above_70_pct": round(100.0 * float((vals > 70).mean()), 2), "best_offset_m": list(best[1])}
Path(f"tests/reference/illumination_refine_{site_id}.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")
print(out)
