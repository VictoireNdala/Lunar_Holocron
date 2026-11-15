"""Balayage d'illumination de l'emprise 5 m d'un site (M-051 § 2.7) : part du temps où le Soleil est visible (seuil strict : au moins la moitié du disque), en chaque point
d'une grille de 500 m, avec le masque d'horizon du pipeline (MNT 5 m près, LDEM 80 m au-delà, courbure incluse) et les éphémérides SPICE.

Deux périodes : celle du projet (2026-01-01 → 2030-12-31, hauteur d'œil du projet 2 m) et celle de l'abstract de Barker et al. (2021) lu sur la page PGDA 78
(2024-01-01 → 2026-01-01, hauteurs d'œil de 1 m et de 5 m). Le Soleil est calculé une seule fois (spkpos) puis projeté au point (même géométrie que ephemeris_spice.body_series).

Usage : py -m tests.reference.illumination_sweep [site-id]   (écrit tests/reference/illumination_<id>.json et docs/illumination-<id>.png)
"""
import json
import sys
from pathlib import Path

import numpy as np

from pipeline import ephemeris_spice, geodesy
from pipeline.config import R_REF_M
from pipeline.export import PipelineConfig
from pipeline.horizon import compute_horizon
from pipeline.sites import real_specs
from pipeline.config import MOON_FRAME
from pipeline.ephemeris_spice import ABCORR, BODIES, SITE_UNIT_KM_PER_M
from pipeline.timegrid import utc_grid
from pipeline.visibility import horizon_at, is_visible, visible_fraction

STEP_M = 500.0
HALF_M = 8000.0
PERIODS = {
    "projet_2026_2030": {"start": "2026-01-01T00:00:00Z", "count": 43824, "eyes_m": [2.0]},
    "barker_2024_2026": {"start": "2024-01-01T00:00:00Z", "count": 17545, "eyes_m": [1.0, 5.0]},
}

site_id = sys.argv[1] if len(sys.argv) > 1 else "site01-connecting-ridge"
cfg = PipelineConfig.load(Path("config/pipeline.json"))
ephemeris_spice.load_kernels(cfg.kernel_dir)
(spec,), _ = real_specs(Path("config/sites_real.json"), cfg, {site_id})
import spiceypy as sp  # noqa: E402

name, radius_km = BODIES["sun"]
sun_cache = {}
for key, per in PERIODS.items():
    utc = utc_grid(per["start"], 3600, per["count"])
    et = np.array([sp.str2et(t.rstrip("Z")) for t in utc])
    pos_km, _ = sp.spkpos(name, et, MOON_FRAME, ABCORR, "MOON")
    sun_cache[key] = np.asarray(pos_km)

offs = np.arange(-HALF_M, HALF_M + 1, STEP_M)
rows = {}
points = []
for j, n in enumerate(offs[::-1]):  # ligne 0 = nord
    for i, e in enumerate(offs):
        dist = float(np.hypot(e, n))
        lat, lon = (spec.lat_deg, spec.lon_deg) if dist == 0 else (float(v) for v in geodesy.destination(spec.lat_deg, spec.lon_deg, np.degrees(np.arctan2(e, n)), dist))
        points.append((j, i, e, n, lat, lon))
print(f"{site_id} : {len(points)} points, pas {STEP_M:.0f} m", flush=True)

results = {f"{k}|eye{eye:g}": {"strict": np.full((len(offs), len(offs)), np.nan), "any": np.full((len(offs), len(offs)), np.nan)}
           for k, per in PERIODS.items() for eye in per["eyes_m"]}
for count, (j, i, e, n, lat, lon) in enumerate(points):
    ground = float(np.asarray(spec.dem.height_m(lat, lon)))
    if not np.isfinite(ground):
        continue
    east, north, up = geodesy.enu_basis(lat, lon)
    for key, per in PERIODS.items():
        for eye in per["eyes_m"]:
            elev, _ = compute_horizon(spec.dem, lat, lon, eye, cfg.horizon)
            site_km = (R_REF_M + ground + eye) * SITE_UNIT_KM_PER_M * up
            v = sun_cache[key] - site_km
            az, el = geodesy.az_el_from_vector(v, east, north, up)
            rad = np.degrees(np.arcsin(radius_km / np.linalg.norm(v, axis=-1)))
            f = visible_fraction(el, rad, horizon_at(elev, az))
            for mode in ("strict", "any"):
                results[f"{key}|eye{eye:g}"][mode][j, i] = 100.0 * float(is_visible(f, mode).mean())
    if count % 100 == 0:
        print(f"  {count}/{len(points)}", flush=True)

out = {"site_id": site_id, "center": {"lat_deg": spec.lat_deg, "lon_deg": spec.lon_deg}, "step_m": STEP_M, "half_m": HALF_M, "offsets_m": offs.tolist(), "runs": {}}
for key, modes in results.items():
    out["runs"][key] = {}
    for mode, grid in modes.items():
        ok = np.isfinite(grid)
        jj, ii = np.unravel_index(np.nanargmax(grid), grid.shape)
        c = len(offs) // 2
        out["runs"][key][mode] = {
            "n_points": int(ok.sum()), "max_pct": round(float(np.nanmax(grid)), 2), "median_pct": round(float(np.nanmedian(grid)), 2), "min_pct": round(float(np.nanmin(grid)), 2),
            "p90_pct": round(float(np.nanpercentile(grid, 90)), 2), "center_pct": round(float(grid[c, c]), 2),
            "best_offset_east_m": float(offs[ii]), "best_offset_north_m": float(offs[::-1][jj]),
            "share_above_70_pct": round(100.0 * float((grid[ok] > 70).mean()), 2),
            "grid_pct": [[None if not np.isfinite(v) else round(float(v), 1) for v in row] for row in grid],
        }
        print(f"{key:24s} {mode:6s} max {out['runs'][key][mode]['max_pct']:6.2f}  médiane {out['runs'][key][mode]['median_pct']:6.2f}  centre {out['runs'][key][mode]['center_pct']:6.2f}  > 70 % : {out['runs'][key][mode]['share_above_70_pct']:5.1f} % des points", flush=True)
Path(f"tests/reference/illumination_{site_id}.json").write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")

try:  # aperçu de la carte (Pillow, aperçu seulement) : projet, seuil strict
    from PIL import Image

    g = np.array(results["projet_2026_2030|eye2"]["strict"])
    stops = [(0.0, (68, 1, 84)), (0.25, (59, 82, 139)), (0.5, (33, 145, 140)), (0.75, (94, 201, 98)), (1.0, (253, 231, 37))]  # viridis
    img = np.zeros((*g.shape, 3), dtype=np.uint8)
    for r in range(g.shape[0]):
        for c in range(g.shape[1]):
            if np.isfinite(g[r, c]):
                t = float(g[r, c]) / 100.0
                k = next(q for q in range(1, len(stops)) if t <= stops[q][0] or q == len(stops) - 1)
                (t0, c0), (t1, c1) = stops[k - 1], stops[k]
                w = (t - t0) / (t1 - t0)
                img[r, c] = [int(c0[x] + w * (c1[x] - c0[x])) for x in range(3)]
    Image.fromarray(img).resize((g.shape[1] * 16, g.shape[0] * 16), Image.NEAREST).save(f"docs/illumination-{site_id}.png")
except ImportError:
    pass
