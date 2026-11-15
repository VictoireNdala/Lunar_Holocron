"""Outil de téléchargement PGDA 5 m (V2-07) : identifiants, libellés et configuration produite (aucun accès réseau)."""
import json
import re
from pathlib import Path

from pipeline.tools.fetch_pgda5m import PRODUCTS, _slug

CONFIG = Path(__file__).resolve().parents[2] / "config" / "sites_real.json"


def test_slug_sans_doublon_et_ascii():
    assert _slug("Haworth", "Haworth") == "haworth"
    assert _slug("NPC", "Idel'son L crater 1") == "npc-idelson-l-crater-1"
    assert _slug("Site20v2", "Leibnitz beta plateau, extended boundaries") == "site20v2-leibnitz-beta-plateau-extended-boundaries"


def test_produits_connus_sans_doublon():
    ids = [p[0] for p in PRODUCTS]
    assert len(ids) == len(set(ids)) == 23


def test_configuration_des_sites_reels_coherente():
    sites = json.loads(CONFIG.read_text(encoding="utf-8"))["sites"]
    assert len({s["id"] for s in sites}) == len(sites)
    assert len({s["pgda_id"] for s in sites}) == len(sites)
    for s in sites:
        assert re.fullmatch(r"[0-9A-F]{64}", s["dem"]["sha256"]), s["id"]
        assert s["dem"]["file"] == f"{s['pgda_id']}_final_adj_5mpp_surf.tif"
        assert s["dem"]["resolution_m"] == 5.0 and s["terrain_real"] is True
        assert s["verified"] is False  # centres d'emprise lus par CODE, non confirmés par un humain
        assert -90.0 < s["center"]["lat_deg"] < -80.0
        assert "GeoTIFF" in s["center"]["source"]
    assert {p[0] for p in PRODUCTS} <= {s["pgda_id"] for s in sites}  # tous inscrits (aucun échec de téléchargement)
