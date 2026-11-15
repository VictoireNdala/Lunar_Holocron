"""Test de couture 5 m / 80 m (M-051 § 2.4) : la référence publiée respecte les seuils de CHAT pour les 4 sites de niveau 1 (RMS < 5 m, maximum ≤ 20 m)."""
import json
from pathlib import Path

REF = Path(__file__).resolve().parents[2] / "tests" / "reference" / "seam_5m_80m.json"


def test_couture_niveau_1_dans_les_seuils():
    sites = {s["pgda_id"]: s for s in json.loads(REF.read_text(encoding="utf-8"))["sites"]}
    assert len(sites) == 27
    for pid in ("Site01", "Site04", "Site07", "Site11"):
        assert sites[pid]["rms_m"] < 5.0 and sites[pid]["max_abs_m"] <= 20.0, (pid, sites[pid])
    assert all(s["rms_m"] < 5.0 for s in sites.values())  # le RMS reste faible partout ; les maxima dépassant 20 m sont publiés dans VALIDATION-RESULTATS
