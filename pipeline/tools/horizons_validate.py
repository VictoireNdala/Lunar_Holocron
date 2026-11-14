"""Validation des éphémérides SPICE contre JPL Horizons (T-24) : `py -m pipeline.tools.horizons_validate`.

OUTIL HORS LIGNE DE VALIDATION (jamais appelé par le pipeline, l'application ni les tests) : il interroge l'API publique d'Horizons
(lecture seule ; seules des coordonnées de sites lunaires et des dates sont envoyées), garde chaque réponse brute dans
`data/cache/horizons/` (hors Git) et écrit les valeurs relevées dans `tests/reference/horizons_validation.json` (petit, versionné),
que le test `test_horizons_validation.py` relit SANS réseau. Soleil et Terre, 5 sites, 3 dates, 24 instants horaires chacun.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from pipeline import ephemeris_spice as eph

ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = ROOT / "data" / "cache" / "horizons"
OUT = ROOT / "tests" / "reference" / "horizons_validation.json"
ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api"
USER_AGENT = "lunar-holocron-validation/0.1"  # client générique : aucune information personnelle
BODIES = {"sun": "10", "earth": "399"}
# Trois dates réparties sur 2026-2030 (jour entier, 24 échantillons horaires UTC).
DATES = ("2026-12-21", "2028-06-15", "2030-09-10")
PAUSE_S = 0.6  # politesse envers le service
SOE = re.compile(r"\$\$SOE\n(.*?)\$\$EOE", re.S)


def sites() -> list[dict[str, float | str]]:
    """Sites de validation : le point de référence de CHAT (M-024) et les sites réels de `config/sites_real.json` (centres lus dans les MNT)."""
    out: list[dict[str, float | str]] = [{"id": "ref-chat-129e", "lat_deg": -89.67, "lon_deg": 129.5}]
    for s in json.loads((ROOT / "config" / "sites_real.json").read_text(encoding="utf-8"))["sites"]:
        out.append({"id": s["id"], "lat_deg": s["center"]["lat_deg"], "lon_deg": s["center"]["lon_deg"]})
    return out


def request_url(body: str, lat_deg: float, lon_deg: float, day: str) -> str:
    """URL de l'API Horizons (tableau OBSERVER, azimut/élévation apparents, 24 pas de 1 h, centre = site sur la Lune)."""
    params = {
        "format": "text", "COMMAND": f"'{BODIES[body]}'", "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'coord@301'",
        "SITE_COORD": f"'{lon_deg % 360:.6f},{lat_deg:.6f},0'", "START_TIME": f"'{day} 00:00'", "STOP_TIME": f"'{day} 23:00'",
        "STEP_SIZE": "'1 h'", "QUANTITIES": "'4'", "MAKE_EPHEM": "'YES'", "OBJ_DATA": "'NO'", "CSV_FORMAT": "'YES'",
    }
    return f"{ENDPOINT}?{urllib.parse.urlencode(params, quote_via=urllib.parse.quote)}"


def fetch(url: str) -> str:
    """Réponse brute (mise en cache disque : une même requête n'est jamais refaite)."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{hashlib.sha256(url.encode()).hexdigest()[:16]}.txt"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    time.sleep(PAUSE_S)
    text = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": USER_AGENT}), timeout=60).read().decode("utf-8", "replace")
    path.write_text(text, encoding="utf-8", newline="\n")
    return text


def parse(text: str) -> list[dict[str, float | str]]:
    """Lignes `date, , flag, azimut, élévation` entre $$SOE et $$EOE → échantillons (UTC ISO, degrés). Lève ValueError si la réponse est inattendue."""
    m = SOE.search(text)
    if not m:
        raise ValueError("réponse Horizons sans bloc $$SOE/$$EOE : " + text[:300])
    samples = []
    for line in m.group(1).strip().splitlines():
        cells = [c.strip() for c in line.split(",")]
        when = datetime.strptime(cells[0], "%Y-%b-%d %H:%M")
        samples.append({"utc": when.strftime("%Y-%m-%dT%H:%M:%S"), "az_deg": float(cells[3]), "el_deg": float(cells[4])})
    return samples


def compare(case: dict) -> tuple[float, float]:
    """Écarts maximaux (azimut, élévation) en degrés entre SPICE et les valeurs Horizons d'un cas."""
    ref = case["samples"]
    s = eph.body_series(case["body"], case["lat_deg"], case["lon_deg"], 0.0, [r["utc"] for r in ref])
    az_err = np.abs(((s["az_deg"] - np.array([r["az_deg"] for r in ref]) + 180) % 360) - 180)
    el_err = np.abs(s["el_deg"] - np.array([r["el_deg"] for r in ref]))
    return float(az_err.max()), float(el_err.max())


def main() -> None:
    """Interroge Horizons, compare à SPICE, écrit le fichier de référence et affiche le tableau des écarts."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kernels", type=Path, default=ROOT / "data" / "raw" / "spice")
    args = parser.parse_args()
    eph.load_kernels(args.kernels)
    cases = []
    for site in sites():
        for day in DATES:
            for body in BODIES:
                samples = parse(fetch(request_url(body, site["lat_deg"], site["lon_deg"], day)))
                cases.append({"site_id": site["id"], "lat_deg": site["lat_deg"], "lon_deg": site["lon_deg"], "body": body, "day": day, "samples": samples})
    rows = []
    for case in cases:
        az, el = compare(case)
        case["max_az_err_deg"], case["max_el_err_deg"] = round(az, 9), round(el, 9)
        rows.append((case["site_id"], case["day"], case["body"], len(case["samples"]), az, el))
        print(f"{case['site_id']:<30} {case['day']} {case['body']:<5} n={len(case['samples'])}  d_az={az:.2e} deg  d_el={el:.2e} deg")
    doc = {
        "description": "Valeurs JPL Horizons (apparent, centre du corps) pour valider SPICE (T-24). Générées par `py -m pipeline.tools.horizons_validate`, à ne pas modifier à la main.",
        "source": "NASA/JPL Horizons System, " + ENDPOINT,
        "consulted_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "parameters": "COMMAND='10' (Soleil) ou '399' (Terre), EPHEM_TYPE='OBSERVER', CENTER='coord@301', SITE_COORD='lon_E,lat,0', STEP_SIZE='1 h', QUANTITIES='4'; source DE441, repère MEAN_ME, Lune sphère 1 737,4 km, sans réfraction.",
        "max_az_err_deg": max(r[4] for r in rows),
        "max_el_err_deg": max(r[5] for r in rows),
        "cases": cases,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"\n{len(cases)} cas, {sum(len(c["samples"]) for c in cases)} echantillons ; max d_az = {doc["max_az_err_deg"]:.2e} deg, max d_el = {doc["max_el_err_deg"]:.2e} deg -> {OUT.name}")


if __name__ == "__main__":
    main()
