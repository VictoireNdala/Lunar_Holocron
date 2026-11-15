"""Référence indépendante de la pyramide de tuiles : décode avec Python (zlib) quelques tuiles réelles de web/data/polar/tiles et enregistre des échantillons de codes.

Usage : py -m tests.reference.make_polar_tile_probe  → tests/reference/polar_tile_probe.json (lu par web/tests/pyramid.test.js)
"""
import json
from pathlib import Path

from pipeline.polar_tiles import STORED_PX, decode_tile

ROOT = Path("web/data/polar")
manifest = json.loads((ROOT / "tiles.json").read_text(encoding="utf-8"))
cases = []
for lv in manifest["levels"]:
    spacing = int(lv["spacing_m"])
    for tx, ty in (lv["tiles"][0], lv["tiles"][len(lv["tiles"]) // 2], lv["tiles"][-1]):
        data = (ROOT / "tiles" / str(spacing) / f"{tx}_{ty}.bin").read_bytes()
        codes = decode_tile(data)
        picks = [[r, c, int(codes[r, c])] for r, c in ((0, 0), (2, 2), (60, 17), (STORED_PX // 2, STORED_PX // 2), (STORED_PX - 3, 100), (STORED_PX - 1, STORED_PX - 1))]
        cases.append({"spacing_m": spacing, "tx": tx, "ty": ty, "bytes": len(data), "code_sum": int(codes.astype("int64").sum()), "samples": picks})
out = Path("tests/reference/polar_tile_probe.json")
out.write_text(json.dumps({"z": manifest["z"], "stored_px": STORED_PX, "cases": cases}, indent=1) + "\n", encoding="utf-8", newline="\n")
print(len(cases), "tuiles de référence ->", out)
