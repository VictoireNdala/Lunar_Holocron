"""Bitsets de visibilité de l'index (V2-05 § 7.4) : cohérents avec les séries et les indicateurs du site."""

from __future__ import annotations

import base64
import json
from pathlib import Path

import numpy as np

from pipeline import validate
from pipeline.kpi import visibility_bits

DATA = Path(__file__).resolve().parents[2] / "web" / "data"


def _decode(text: str, n: int) -> np.ndarray:
    return np.unpackbits(np.frombuffer(base64.b64decode(text), dtype=np.uint8), bitorder="little")[:n].astype(bool)


def test_index_bits_give_the_strict_percentages_of_the_site_files() -> None:
    """Pour chaque site : popcount / n × 100 = `kpis.<corps>.strict.visible_pct` (égalité à 1e-9 près)."""
    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    assert index["sites"]
    for entry in index["sites"]:
        site = json.loads((DATA / entry["site_file"]).read_text(encoding="utf-8"))
        bits = entry["link_bits"]
        assert bits["n"] == site["time"]["count"] and bits["mode"] == "strict"
        for body in ("sun", "earth"):
            flags = _decode(bits[f"{body}_strict"], bits["n"])
            assert abs(100.0 * flags.sum() / bits["n"] - site["kpis"][body]["strict"]["visible_pct"]) < 1e-9, (entry["id"], body)


def test_bits_are_a_pure_function_of_the_site_series() -> None:
    """Recalcul identique (déterministe) ; `validate` refuse un bit modifié."""
    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    entry = index["sites"][0]
    site = json.loads((DATA / entry["site_file"]).read_text(encoding="utf-8"))
    assert visibility_bits(site["horizon"]["elev_deg"], site["bodies"]) == entry["link_bits"]
    assert validate.validate_data_dir(DATA) == []
    raw = bytearray(base64.b64decode(entry["link_bits"]["earth_strict"]))
    raw[0] ^= 1
    bad = json.loads(json.dumps(index))
    bad["sites"][0]["link_bits"]["earth_strict"] = base64.b64encode(bytes(raw)).decode("ascii")
    tmp = DATA.parent / "_tmp_bits_check"
    try:
        tmp.mkdir(exist_ok=True)
        (tmp / "index.json").write_text(json.dumps(bad), encoding="utf-8")
        (tmp / "sites").mkdir(exist_ok=True)
        (tmp / "sites" / f"{entry['id']}.json").write_text((DATA / entry["site_file"]).read_text(encoding="utf-8"), encoding="utf-8")
        errors = validate.validate_data_dir(tmp)
        assert any("link_bits" in e for e in errors), errors
    finally:
        for path in sorted(tmp.rglob("*"), reverse=True):
            path.unlink() if path.is_file() else path.rmdir()
        tmp.rmdir()
