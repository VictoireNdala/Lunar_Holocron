"""Écrit le jeu d'exemple fait main de web/data/sample (T-03) : 1 site, 7 jours, horizon simple, séries sinusoïdales.

VALEURS FICTIVES (synthetic: true). Ce jeu sert seulement à débloquer l'interface avant que le pipeline existe.
Il est indépendant du pipeline : les indicateurs sont calculés ici par un code minimal, puis recontrôlés
par `pipeline.validate` dès que le recalcul des KPI y sera branché (T-07).
Usage : `.venv\\Scripts\\python.exe tests/reference/make_web_sample.py` (déterministe, sorties identiques à chaque exécution).
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "data" / "sample"
SITE_ID = "sample-a"
LAT_DEG, LON_DEG = -89.5, 30.0
START = datetime(2027, 3, 11, tzinfo=timezone.utc)  # couvre l'instant par défaut de l'interface (2027-03-14T06:00Z)
COUNT = 7 * 24
STEP_S = 3600
R_REF_M = 1737400.0
BUILD_UTC = "2026-11-12T00:00:00Z"  # date fixe (esprit de D-013), jamais l'horloge
GRID_N, GRID_SIZE_M = 65, 20000.0
UTC = "%Y-%m-%dT%H:%M:%SZ"


def horizon_mask() -> tuple[list[float], list[bool]]:
    """Masque fictif : relief bas (≈ 0,3°), dorsale à l'est-sud-est (jusqu'à ≈ 2,3°), azimuts 200-219 tronqués."""
    az = np.arange(360.0)
    ridge = 2.0 * np.clip(np.cos(np.radians(az - 120.0)), 0.0, None) ** 3
    elev = np.round(0.3 + ridge + 0.15 * np.sin(np.radians(3.0 * az)), 2)
    truncated = (az >= 200) & (az < 220)
    return [float(e) for e in elev], [bool(t) for t in truncated]


def series() -> dict[str, dict[str, list[int]]]:
    """Séries fictives en millidegrés : azimuts qui passent par 359°→0°, élévations qui croisent l'horizon."""
    t_d = np.arange(COUNT) * STEP_S / 86400.0
    sun_az = (30.0 - 360.0 * t_d / 29.530589) % 360.0  # dérive vers l'ouest, passe 0° vers le 3e jour
    sun_el = 1.2 + 1.0 * np.sin(2.0 * np.pi * t_d / 3.5)
    earth_az = (350.0 + 15.0 * np.sin(2.0 * np.pi * t_d / 6.0)) % 360.0
    earth_el = 1.0 + 3.0 * np.sin(2.0 * np.pi * t_d / 6.8 + 1.0)

    def mdeg(a: np.ndarray) -> list[int]:
        return [int(v) for v in np.rint(a * 1000.0).astype(np.int64)]

    def az_mdeg(a: np.ndarray) -> list[int]:
        return [v % 360000 for v in mdeg(a)]

    return {
        "sun": {"az_mdeg": az_mdeg(sun_az), "el_mdeg": mdeg(sun_el), "radius_mdeg": [267] * COUNT},
        "earth": {"az_mdeg": az_mdeg(earth_az), "el_mdeg": mdeg(earth_el), "radius_mdeg": [950] * COUNT},
    }


def fraction(el_deg: np.ndarray, r_deg: np.ndarray, h_deg: np.ndarray) -> np.ndarray:
    """Fraction visible (ARCHITECTURE § 3), écrite ici indépendamment du pipeline."""
    x = np.clip((el_deg - h_deg) / r_deg, -1.0, 1.0)
    return 1.0 - (np.arccos(x) - x * np.sqrt(1.0 - x * x)) / np.pi


def horizon_at(elev: list[float], az_deg: np.ndarray) -> np.ndarray:
    """Interpolation linéaire du masque avec bouclage 359° → 0°."""
    h = np.asarray(elev)
    i0 = np.floor(az_deg).astype(int) % 360
    w = az_deg - np.floor(az_deg)
    return h[i0] * (1.0 - w) + h[(i0 + 1) % 360] * w


def gaps(visible: np.ndarray) -> tuple[float, int]:
    """(plus long intervalle d'absence en heures, nombre d'intervalles)."""
    runs, current = [], 0
    for v in visible:
        if v:
            if current:
                runs.append(current)
            current = 0
        else:
            current += 1
    if current:
        runs.append(current)
    return (max(runs) * STEP_S / 3600.0 if runs else 0.0), len(runs)


def kpis_and_monthly(elev: list[float], bodies: dict) -> tuple[dict, list[dict]]:
    """Indicateurs (CONTRAT § 4) et bilan mensuel (§ 5) calculés à partir des séries entières."""
    vis: dict[str, dict[str, np.ndarray]] = {}
    for body in ("sun", "earth"):
        s = bodies[body]
        az, el, r = (np.asarray(s[k]) / 1000.0 for k in ("az_mdeg", "el_mdeg", "radius_mdeg"))
        f = fraction(el, r, horizon_at(elev, az))
        vis[body] = {"strict": f >= 0.5, "any": f > 0.0}
    vis["both"] = {m: vis["sun"][m] & vis["earth"][m] for m in ("strict", "any")}
    end = START + timedelta(seconds=STEP_S * (COUNT - 1))
    kpis: dict = {"window": {"start_utc": START.strftime(UTC), "end_utc": end.strftime(UTC)}}
    for key, modes in vis.items():
        kpis[key] = {}
        for mode, v in modes.items():
            longest, n = gaps(v)
            kpis[key][mode] = {"visible_pct": 100.0 * int(v.sum()) / COUNT, "longest_gap_h": longest, "n_gaps": n}
    for body in ("sun", "earth"):
        el = np.asarray(bodies[body]["el_mdeg"]) / 1000.0
        kpis[f"{body}_el_deg"] = {"min": float(el.min()), "max": float(el.max())}
    months = np.array([(START + timedelta(seconds=STEP_S * i)).strftime("%Y-%m") for i in range(COUNT)])
    monthly = []
    for ym in sorted(set(months.tolist())):
        sel = months == ym
        monthly.append({"ym": ym, **{f"{k}_strict_pct": 100.0 * int(vis[k]["strict"][sel].sum()) / int(sel.sum())
                                     for k in ("sun", "earth", "both")}})
    return kpis, monthly


def terrain_heights() -> tuple[np.ndarray, float, float]:
    """Grille fictive (cratère simple + bosse au nord), z = hauteur locale avec courbure (CONTRAT § 6)."""
    coords = np.linspace(-GRID_SIZE_M / 2, GRID_SIZE_M / 2, GRID_N)
    east, north = np.meshgrid(coords, coords[::-1])  # ligne 0 = nord, colonne 0 = ouest
    d = np.hypot(east, north)
    h = 400.0 * (d / 4000.0) ** 2 - 400.0  # cuvette de 4 km de rayon
    h = np.where(d > 4000.0, 300.0 * np.exp(-((d - 4500.0) / 900.0) ** 2), h)  # rebord
    h = h + 600.0 * np.exp(-(east ** 2 + (north - 7000.0) ** 2) / 2500.0 ** 2)  # bosse au nord
    h_site = float(h[GRID_N // 2, GRID_N // 2])
    z = (R_REF_M + h) * np.cos(d / R_REF_M) - (R_REF_M + h_site)
    return z, float(np.floor(z.min())), float(np.ceil(z.max()))


def dump(path: Path, doc: dict) -> None:
    """JSON compact, clés triées, UTF-8, saut de ligne final (même règle que export.py)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n",
                    encoding="utf-8", newline="\n")


def main() -> None:
    """Écrit index.json, sites/sample-a.json, terrain/sample-a.json et .bin."""
    name = {"fr": "Exemple fait main (fictif)", "en": "Hand-made sample (fictitious)"}
    elev, truncated = horizon_mask()
    bodies = series()
    kpis, monthly = kpis_and_monthly(elev, bodies)
    z, z_min, z_max = terrain_heights()
    site = {
        "schema_version": "1.0", "id": SITE_ID, "name": name, "synthetic": True,
        "location": {"lat_deg": LAT_DEG, "lon_deg": LON_DEG, "ground_height_m": 0.0, "observer_height_m": 2.0,
                     "frame": "MOON_ME", "r_ref_m": R_REF_M},
        "provenance": {
            "dem": {"product": "SYNTHETIC", "resolution_m": GRID_SIZE_M / (GRID_N - 1), "source": None, "license": "n/a"},
            "ephemeris": {"engine": "demo-analytic", "kernels": [], "abcorr": None},
            "pipeline_version": "t03-hand-made-sample",
            "generated_utc": BUILD_UTC,
            "note": "Jeu d'exemple fait main (T-03) : horizon et séries sinusoïdales fictifs, pas issus du pipeline.",
        },
        "horizon": {"az_step_deg": 1.0, "elev_deg": elev, "truncated": truncated, "max_distance_km": 150.0},
        "time": {"start_utc": START.strftime(UTC), "step_s": STEP_S, "count": COUNT},
        "bodies": bodies, "kpis": kpis, "monthly": monthly,
    }
    terrain = {
        "schema_version": "1.0", "id": SITE_ID, "synthetic": True,
        "center": {"lat_deg": LAT_DEG, "lon_deg": LON_DEG},
        "grid": {"n": GRID_N, "size_m": GRID_SIZE_M, "spacing_m": GRID_SIZE_M / (GRID_N - 1)},
        "frame": "local-enu",
        "z": {"encoding": "uint16-linear", "min_m": z_min, "max_m": z_max, "file": f"{SITE_ID}.bin",
              "byte_order": "little", "row_order": "north-to-south", "col_order": "west-to-east"},
    }
    index = {
        "schema_version": "1.0", "generated_utc": BUILD_UTC, "synthetic": True,
        "sites": [{"id": SITE_ID, "name": name, "lat_deg": LAT_DEG, "lon_deg": LON_DEG, "synthetic": True,
                   "verified": True, "site_file": f"sites/{SITE_ID}.json", "terrain_file": f"terrain/{SITE_ID}.json"}],
    }
    dump(OUT / "index.json", index)
    dump(OUT / "sites" / f"{SITE_ID}.json", site)
    dump(OUT / "terrain" / f"{SITE_ID}.json", terrain)
    quant = np.rint((z - z_min) / (z_max - z_min) * 65535.0).astype("<u2")
    (OUT / "terrain" / f"{SITE_ID}.bin").write_bytes(quant.tobytes(order="C"))
    print(f"écrit dans {OUT} : sun strict {kpis['sun']['strict']['visible_pct']:.1f} %, "
          f"earth strict {kpis['earth']['strict']['visible_pct']:.1f} %, z [{z_min}, {z_max}] m")


if __name__ == "__main__":
    main()
