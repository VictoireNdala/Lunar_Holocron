"""Valeurs de référence de la sonde (V2-06) recalculées de façon INDÉPENDANTE du JavaScript : lecture du fichier .bin, interpolation bilinéaire dans le plan
polaire avec `pipeline.projection` (pas la formule JS), pente par différences centrées sur la grille décodée, cap et distance par la formule haversine de `pipeline.geodesy`.
Écrit `tests/golden/probe_cases.json`. Usage : `PYTHONPATH=. .venv\\Scripts\\python.exe tests/reference/make_probe_cases.py`.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from pipeline import geodesy
from pipeline.config import R_REF_M
from pipeline.projection import DEFAULT_PROJECTION

ROOT = Path(__file__).resolve().parents[2]
POLAR = ROOT / "web" / "data" / "polar"
POINTS = [(-89.2, 30.0), (-86.5, -100.0), (-88.1, 123.0), (-84.0, 80.0)]  # quatre points dans la grille
SITE = "site04-shackleton-rim"


def main() -> None:
    """Écrit probe_cases.json."""
    meta = json.loads((POLAR / "ldem_south_500m.json").read_text(encoding="utf-8"))
    g = meta["grid"]
    q = np.frombuffer((POLAR / "ldem_south_500m.bin").read_bytes(), dtype="<u2").reshape(g["n_rows"], g["n_cols"]).astype(float)
    z = np.where(q == meta["z"]["nodata_code"], np.nan, meta["z"]["min_m"] + q / meta["z"]["max_code"] * (meta["z"]["max_m"] - meta["z"]["min_m"]))
    s = g["spacing_m"]

    def height(x: float, y: float) -> float:
        col, row = (x - g["x_min_m"]) / s, (g["y_max_m"] - y) / s
        c0, r0 = int(np.floor(col)), int(np.floor(row))
        wc, wr = col - c0, row - r0
        return float((1 - wr) * ((1 - wc) * z[r0, c0] + wc * z[r0, c0 + 1]) + wr * ((1 - wc) * z[r0 + 1, c0] + wc * z[r0 + 1, c0 + 1]))

    site = json.loads((ROOT / "web" / "data" / "sites" / f"{SITE}.json").read_text(encoding="utf-8"))
    lat0, lon0 = site["location"]["lat_deg"], site["location"]["lon_deg"]
    cases = []
    for lat, lon in POINTS:
        x, y = (float(v) for v in DEFAULT_PROJECTION.lonlat_to_xy(lat, lon))
        h = height(x, y)
        # gradient bilinéaire des différences centrées de la grille : recalculé par différences finies de la fonction bilinéaire elle-même (pas ± demi-maille)
        e = s
        gx = (height(x + e, y) - height(x - e, y)) / (2 * e)
        gy = (height(x, y + e) - height(x, y - e)) / (2 * e)
        dist, az = geodesy.distance_azimuth(lat0, lon0, lat, lon)
        h_az = site["horizon"]["elev_deg"]
        i0 = int(np.floor(az)) % 360
        w = az - np.floor(az)
        horizon = h_az[i0] * (1 - w) + h_az[(i0 + 1) % 360] * w
        cases.append({"lat_deg": lat, "lon_deg": lon, "height_m": h, "slope_deg": float(np.degrees(np.arctan(np.hypot(gx, gy)))),
                      "distance_km": float(dist) / 1000.0, "azimuth_deg": float(az), "horizon_deg": float(horizon)})
    doc = {"description": "Valeurs de la sonde recalculées par Python (bilinéaire dans le plan polaire, pente par différences finies de largeur 1 maille, haversine). Généré par tests/reference/make_probe_cases.py.",
           "site_id": SITE, "tolerance": {"height_m": 0.01, "slope_deg": 0.35, "distance_km": 0.001, "azimuth_deg": 0.001, "horizon_deg": 0.001}, "cases": cases}
    out = ROOT / "tests" / "golden" / "probe_cases.json"
    out.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(len(cases), "cas ->", out.name)


if __name__ == "__main__":
    main()
