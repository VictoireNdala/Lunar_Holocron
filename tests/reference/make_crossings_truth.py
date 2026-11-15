"""Vérité-terrain des levers et couchers (V2-05, BUILD-V2 § 8) : SPICE à la MINUTE, horizon du pipeline, seuil strict.

Pour chaque site réel du niveau 1 et chaque corps, sur 61 jours (2027-03-01 → 2027-04-30), on calcule la visibilité minute par minute (mêmes fonctions
que le pipeline : `ephemeris_spice.body_series`, `kpi.body_fraction`, `visibility.is_visible`) et on note chaque changement d'état. Le fichier produit
(`tests/reference/crossings_spice.json`) sert à mesurer l'erreur des instants de coucher/lever calculés dans le navigateur à partir des séries HORAIRES.
Usage : `.venv\\Scripts\\python.exe tests/reference/make_crossings_truth.py` (noyaux SPICE requis dans data/raw/spice).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from pipeline import ephemeris_spice as eph
from pipeline.timegrid import utc_grid
from pipeline.kpi import body_fraction
from pipeline.visibility import is_visible

ROOT = Path(__file__).resolve().parents[2]
SITES = ("site01-connecting-ridge", "site04-shackleton-rim", "site07-peak-near-shackleton", "site11-de-gerlache-rim")
START, DAYS = "2027-03-01T00:00:00", 61
CHATTER_MIN = 10  # minutes : en dessous, deux changements consécutifs sont un frôlement de l'horizon
OUT = Path(__file__).resolve().parent / "crossings_spice.json"


def main() -> None:
    """Écrit crossings_spice.json."""
    eph.load_kernels(ROOT / "data" / "raw" / "spice")
    utc = utc_grid(START, 60, DAYS * 1440)
    doc = {"description": "Changements d'état (strict) minute par minute, SPICE + horizon du pipeline ; `t_utc` = première minute du nouvel état ; les couples de changements distants de moins de 10 minutes (frôlement de l'horizon, bruit de quantification) sont retirés. Généré par tests/reference/make_crossings_truth.py.",
           "start_utc": START + "Z", "minutes": DAYS * 1440, "sites": {}}
    for sid in SITES:
        site = json.loads((ROOT / "web" / "data" / "sites" / f"{sid}.json").read_text(encoding="utf-8"))
        loc = site["location"]
        events = []
        for body in ("sun", "earth"):
            raw = eph.body_series(body, loc["lat_deg"], loc["lon_deg"], loc["ground_height_m"] + loc["observer_height_m"], utc)
            series = {"az_mdeg": np.rint(raw["az_deg"] * 1000), "el_mdeg": np.rint(raw["el_deg"] * 1000), "radius_mdeg": np.rint(raw["radius_deg"] * 1000)}
            vis = is_visible(body_fraction(site["horizon"]["elev_deg"], series), "strict")
            flips = list(np.flatnonzero(vis[1:] != vis[:-1]) + 1)
            # Rasant : la quantification au millidegré fait osciller l'état quelques minutes autour de l'horizon (coucher, lever, coucher en 2 min).
            # On retire les couples de changements distants de moins de CHATTER_MIN minutes : ce n'est pas un vrai lever, c'est un frôlement.
            k = 0
            while k < len(flips) - 1:
                if flips[k + 1] - flips[k] < CHATTER_MIN:
                    del flips[k:k + 2]
                    k = max(k - 1, 0)
                else:
                    k += 1
            for k in flips:
                events.append({"body": body, "type": "rise" if vis[k] else "set", "t_utc": utc[k] + "Z"})
        doc["sites"][sid] = sorted(events, key=lambda e: e["t_utc"])
    OUT.write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8", newline="\n")
    print({sid: len(ev) for sid, ev in doc["sites"].items()}, OUT.name)


if __name__ == "__main__":
    main()
