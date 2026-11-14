"""Fichier d'or `tests/golden/body_state_cases.json` (T-08, TESTS-VALIDATION § 5) : 20 instants d'un site de démonstration.

Les valeurs attendues sont calculées DIRECTEMENT à l'instant demandé (éphémérides de démonstration + masque d'horizon du site,
formules de `pipeline/visibility.py`), sans passer par les séries horaires exportées : le JavaScript, lui, interpole ces séries
(`bodyStateAt`). Les deux chemins doivent donc s'accorder à la tolérance près, ce qui teste aussi l'interpolation et le déroulement d'azimut.
Le choix des instants est une règle déterministe (pas de hasard) ; le fichier doit être RELU PAR UN HUMAIN avant d'être figé.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np

from pipeline import visibility
from pipeline.fixtures import ephemeris_demo

GOLDEN_SITE_ID = "demo-b"  # massif à l'est : Soleil et Terre passent par tous les états (masqué, partiel, visible)
HALF_HOUR = timedelta(minutes=30)
PARTIAL_QUANTILES = (0.15, 0.5, 0.85)
__all__ = ["GOLDEN_SITE_ID", "expected_values", "select_instants", "build_golden", "write_golden"]


def _iso(when: datetime) -> str:
    """Instant UTC au format ISO 8601 sans `Z` (celui des éphémérides)."""
    return when.strftime("%Y-%m-%dT%H:%M:%S")


def expected_values(site: dict[str, Any], utc: str) -> dict[str, float]:
    """(az, él, rayon) du Soleil et de la Terre et fractions visibles à l'instant `utc`, calculés directement (degrés)."""
    loc = site["location"]
    mask = np.asarray(site["horizon"]["elev_deg"], dtype=float)
    out: dict[str, float] = {}
    for body in ("sun", "earth"):
        s = ephemeris_demo.body_series(body, loc["lat_deg"], loc["lon_deg"], [utc])
        az, el, radius = float(s["az_deg"][0]), float(s["el_deg"][0]), float(s["radius_deg"][0])
        horizon = float(visibility.horizon_at(mask, az))
        out[f"{body}_az_deg"] = az
        out[f"{body}_el_deg"] = el
        out[f"{body}_radius_deg"] = radius
        out[f"{body}_horizon_deg"] = horizon
        out[f"f_{body}"] = float(visibility.visible_fraction(el, radius, horizon))
    return out


def _series(site: dict[str, Any]) -> tuple[list[datetime], dict[str, dict[str, np.ndarray]]]:
    """Instants horaires du site et séries directes (sans quantification) de chaque corps : sert seulement à CHOISIR les cas."""
    t = site["time"]
    start = datetime.strptime(t["start_utc"], "%Y-%m-%dT%H:%M:%SZ")
    times = [start + timedelta(seconds=t["step_s"] * k) for k in range(t["count"])]
    mask = np.asarray(site["horizon"]["elev_deg"], dtype=float)
    loc = site["location"]
    data: dict[str, dict[str, np.ndarray]] = {}
    for body in ("sun", "earth"):
        s = ephemeris_demo.body_series(body, loc["lat_deg"], loc["lon_deg"], [_iso(x) for x in times])
        data[body] = {**s, "f": visibility.visible_fraction(s["el_deg"], s["radius_deg"], visibility.horizon_at(mask, s["az_deg"]))}
    return times, data


def select_instants(site: dict[str, Any]) -> list[tuple[str, str]]:
    """20 couples (instant UTC, motif) choisis par règle : états partiels (nœuds et demi-heures), passages de l'azimut par 0°/360°, masqué, visible."""
    times, data = _series(site)
    chosen: list[tuple[int, int, str]] = []  # (indice du nœud horaire, décalage en demi-heures, motif)

    def partial(body: str) -> np.ndarray:
        f = data[body]["f"]
        return np.flatnonzero((f > 0.05) & (f < 0.95))

    for body in ("sun", "earth"):
        idx = partial(body)
        for q in PARTIAL_QUANTILES:
            chosen.append((int(idx[int(q * (len(idx) - 1))]), 0, f"{body} partiellement visible"))
    for body in ("sun", "earth"):
        idx = partial(body)
        for q in (0.3, 0.7):
            chosen.append((int(idx[int(q * (len(idx) - 1))]), 1, f"{body} partiel, entre deux nœuds horaires (interpolation)"))
    az = data["sun"]["az_deg"]
    wraps = np.flatnonzero(np.abs(np.diff(az)) > 180)  # l'azimut saute de ~360° à ~0°
    for k, i in enumerate((int(wraps[0]), int(wraps[len(wraps) // 2]))):
        chosen.append((i, 1, "sun : l'azimut passe de 359° à 0° entre les nœuds (déroulement d'azimut)"))
    chosen.append((int(wraps[-1]) + 1, 0, "sun : nœud juste après le passage 360° → 0°"))
    for body, hidden_q, shown_q in (("sun", (0.25, 0.75), (0.25, 0.75)), ("earth", (0.25, 0.75), (0.5,))):
        f = data[body]["f"]
        hidden = np.flatnonzero(f <= 0)
        shown = np.flatnonzero(f >= 1)
        for pool, label, quantiles in ((hidden, "masqué", hidden_q), (shown, "visible", shown_q)):
            for q in quantiles:
                chosen.append((int(pool[int(q * (len(pool) - 1))]), 0, f"{body} {label}"))
    return [(_iso(times[i] + shift * HALF_HOUR), label) for i, shift, label in chosen]


def build_golden(site_path: Path) -> dict[str, Any]:
    """Document du fichier d'or pour le site de démonstration `site_path` (JSON exporté par le pipeline)."""
    site = json.loads(site_path.read_text(encoding="utf-8"))
    cases = []
    for utc, motif in select_instants(site):
        values = expected_values(site, utc)
        cases.append({"utc": utc + "Z", "motif": motif, **{k: round(v, 9) for k, v in values.items()}})
    return {
        "description": "Soleil et Terre vus d'un site de démonstration (FICTIF) : (azimut, élévation, rayon angulaire, horizon à l'azimut, fraction visible) à 20 instants. "
                       "Généré par `py -m pipeline.fixtures.golden`, RELU par un humain avant d'être figé. Lu par pytest et par node --test.",
        "synthetic": True,
        "site_id": site["id"],
        "site_file": f"tests/fixtures/web-data/sites/{site['id']}.json",
        "method": "Valeurs calculées directement à l'instant (éphémérides de démonstration, masque du site, pipeline/visibility.py) ; "
                  "le JavaScript interpole les séries horaires exportées (bodyStateAt) puis applique horizonAt et visibleFraction.",
        "tolerance_angle_deg": 0.001,
        "tolerance_fraction": 0.002,
        "cases": cases,
    }


def write_golden(data_dir: Path, out_path: Path) -> Path:
    """Écrit le fichier d'or à partir du site de démonstration déjà exporté dans `data_dir`."""
    doc = build_golden(data_dir / "sites" / f"{GOLDEN_SITE_ID}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    return out_path


def main() -> None:
    """`py -m pipeline.fixtures.golden` : régénère le fichier d'or depuis tests/fixtures/web-data/. ATTENTION : le fichier signé (SHA-256 dans docs/REVUE-FICHIER-OR.md) ne doit PAS être régénéré."""
    path = write_golden(Path("tests/fixtures/web-data"), Path("tests/golden/body_state_cases.json"))
    print(f"fichier d'or écrit : {path} (A RELIRE par un humain avant d'etre fige)")


if __name__ == "__main__":
    main()
