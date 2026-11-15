"""Test de couture 5 m / 80 m (M-051 § 2.4) : différence de hauteur entre le MNT 5 m (PGDA 78) et le LDEM 80 m (PGDA 90) sur la couronne de recouvrement.

Pour chaque site 5 m : points d'une grille de 40 m dans la couronne 6,5 – 8 km (distance de Tchebychev au centre, plan stéréographique polaire), hauteurs interpolées
bilinéairement dans les deux produits ; on publie le biais, l'écart RMS et l'écart maximal. Usage : py -m tests.reference.seam_5m_80m  (écrit seam_5m_80m.json).
"""
import json
from pathlib import Path

import numpy as np

from pipeline.dem_geotiff import read_geotiff_window
from pipeline.projection import DEFAULT_PROJECTION
from pipeline.sites import LDEM_80M, RAW_DIR

BAND_M = (6500.0, 8000.0)
STEP_M = 40.0

sites = json.loads(Path("config/sites_real.json").read_text(encoding="utf-8"))["sites"]
rows = []
for s in sites:
    lat0, lon0 = s["center"]["lat_deg"], s["center"]["lon_deg"]
    d5 = read_geotiff_window(RAW_DIR / s["dem"]["file"], lat0, lon0, 8.6, product="5m")
    d80 = read_geotiff_window(LDEM_80M, lat0, lon0, 9.5, product="80m")
    x0, y0 = (float(v) for v in DEFAULT_PROJECTION.lonlat_to_xy(lat0, lon0))
    offs = np.arange(-BAND_M[1], BAND_M[1] + 1, STEP_M)
    ex, ey = np.meshgrid(offs, offs)
    cheb = np.maximum(np.abs(ex), np.abs(ey))
    keep = (cheb >= BAND_M[0]) & (cheb <= BAND_M[1])
    lat, lon = DEFAULT_PROJECTION.xy_to_lonlat(x0 + ex[keep], y0 + ey[keep])
    h5 = np.asarray(d5.height_m(lat, lon), dtype=float)
    h80 = np.asarray(d80.height_m(lat, lon), dtype=float)
    ok = np.isfinite(h5) & np.isfinite(h80)
    diff = h5[ok] - h80[ok]
    rows.append({"id": s["id"], "pgda_id": s["pgda_id"], "n_points": int(ok.sum()), "n_total": int(keep.sum()),
                 "bias_m": round(float(diff.mean()), 3), "rms_m": round(float(np.sqrt((diff ** 2).mean())), 3),
                 "std_m": round(float(diff.std()), 3), "max_abs_m": round(float(np.abs(diff).max()), 3)})
    print(f"{s['pgda_id']:10s} n={ok.sum():6d}/{keep.sum():6d}  biais {rows[-1]['bias_m']:7.2f}  RMS {rows[-1]['rms_m']:7.2f}  max {rows[-1]['max_abs_m']:7.2f}")
Path("tests/reference/seam_5m_80m.json").write_text(json.dumps({"band_m": BAND_M, "step_m": STEP_M, "sites": rows}, indent=1) + "\n", encoding="utf-8", newline="\n")
