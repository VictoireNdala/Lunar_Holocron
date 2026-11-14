"""Tests des éphémérides SPICE (T-20, TESTS-VALIDATION § 4) : plausibilité indépendante + valeurs Horizons. Ignorés sans noyaux."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline import ephemeris_spice as eph

ROOT = Path(__file__).resolve().parents[2]
KERNEL_DIR = ROOT / "data" / "raw" / "spice"
HORIZONS = json.loads((ROOT / "tests" / "reference" / "horizons_samples.json").read_text(encoding="utf-8"))

pytestmark = [pytest.mark.spice, pytest.mark.skipif(not eph.kernels_available(KERNEL_DIR), reason="noyaux SPICE absents de data/raw/spice")]


@pytest.fixture(scope="module")
def kernels() -> list[str]:
    """Charge les noyaux une fois pour le module."""
    return eph.load_kernels(KERNEL_DIR)


def _utc_hours(start: str, n: int) -> list[str]:
    """n instants horaires UTC à partir de `start`."""
    t0 = np.datetime64(start)
    return [str(t0 + np.timedelta64(k, "h")) for k in range(n)]


def test_horizons_reference_values(kernels: list[str]) -> None:
    """Soleil vu de (−89,67 ; 129,5) : SPICE (LT+S) contre Horizons (DE441, apparent). Tolérance MESURÉE : voir `measured_max_deg`."""
    ref = HORIZONS["samples"]
    s = eph.body_series("sun", HORIZONS["site"]["lat_deg"], HORIZONS["site"]["lon_deg"], HORIZONS["site"]["height_m"], [r["utc"] for r in ref])
    az_err = np.abs(((s["az_deg"] - np.array([r["az_deg"] for r in ref]) + 180) % 360) - 180)
    el_err = np.abs(s["el_deg"] - np.array([r["el_deg"] for r in ref]))
    assert max(az_err.max(), el_err.max()) < HORIZONS["tolerance_deg"]


def test_sun_elevation_plausible_at_pole(kernels: list[str]) -> None:
    """À −89,99° : |élévation du Soleil| < 1,8° sur 2026-2030 (obliquité ≈ 1,54° + rayon + marge)."""
    t = _utc_hours("2026-01-01T00", 43824)
    s = eph.body_series("sun", -89.99, 0.0, 0.0, t)
    assert np.max(np.abs(s["el_deg"])) < 1.8


def test_earth_elevation_and_crossings(kernels: list[str]) -> None:
    """|élévation de la Terre| < 7,6° ; nombre de changements de signe sur 5 ans entre 120 et 145 (indicatif)."""
    t = _utc_hours("2026-01-01T00", 43824)
    e = eph.body_series("earth", -89.99, 0.0, 0.0, t)
    assert np.max(np.abs(e["el_deg"])) < 7.6
    crossings = int(np.sum(np.diff(np.sign(e["el_deg"])) != 0))
    assert 120 <= crossings <= 145, crossings


AU_KM = 149_597_870.7  # unité astronomique (valeur de l'UAI 2012)
MOON_APOGEE_KM = 406_700.0  # distance maximale Terre–Lune (ordre de grandeur, valeur usuelle)


def test_angular_radii(kernels: list[str]) -> None:
    """Rayon angulaire du Soleil et de la Terre, bornes calculées par géométrie (voir D-020).

    Soleil : distance Lune–Soleil entre (périhélie − apogée) et (aphélie + apogée) ; périhélie 0,98329 UA, aphélie 1,01671 UA.
    La borne basse 0,262° de TESTS-VALIDATION § 4 oubliait que la Lune peut être 0,4 million de km plus loin que la Terre.
    """
    t = _utc_hours("2026-01-01T00", 8760)
    sun = eph.body_series("sun", -89.99, 0.0, 0.0, t)["radius_deg"]
    earth = eph.body_series("earth", -89.99, 0.0, 0.0, t)["radius_deg"]
    sun_lo = np.degrees(np.arcsin(eph.R_SUN_KM / (1.01671 * AU_KM + MOON_APOGEE_KM)))  # ≈ 0,2613°
    sun_hi = np.degrees(np.arcsin(eph.R_SUN_KM / (0.98329 * AU_KM - MOON_APOGEE_KM)))  # ≈ 0,2718°
    assert sun_lo < sun.min() and sun.max() < sun_hi
    assert 0.89 < earth.min() and earth.max() < 1.05


def test_series_are_integer_millidegrees(kernels: list[str]) -> None:
    """`to_millidegrees` : entiers, azimut dans [0, 360000), rayon ≥ 1 ; déterministe."""
    t = _utc_hours("2026-03-14T00", 48)
    a = eph.to_millidegrees(eph.body_series("sun", -89.5, 30.0, 2.0, t))
    b = eph.to_millidegrees(eph.body_series("sun", -89.5, 30.0, 2.0, t))
    for key in ("az_mdeg", "el_mdeg", "radius_mdeg"):
        assert a[key].dtype.kind == "i" and np.array_equal(a[key], b[key])
    assert a["az_mdeg"].min() >= 0 and a["az_mdeg"].max() < 360000 and a["radius_mdeg"].min() >= 1


def test_units_km_not_mixed(kernels: list[str]) -> None:
    """Garde-fou M-008 : spkpos rend des km ; un site mal converti (m au lieu de km) donnerait un Soleil à ~0° de l'horizon réel."""
    import spiceypy as sp
    p, _ = sp.spkpos("SUN", sp.str2et("2027-03-14T06:00:00"), "MOON_ME", "LT+S", "MOON")
    assert 1.4e8 < np.linalg.norm(p) < 1.6e8  # ≈ 1 UA en km
    good = eph.body_series("sun", -89.67, 129.5, 0.0, ["2027-03-14T06:00:00"])["el_deg"][0]
    assert good == pytest.approx(-0.535050, abs=1e-4)
    assert eph.SITE_UNIT_KM_PER_M == 1e-3


def test_pole_and_bad_inputs(kernels: list[str]) -> None:
    """Pôle exact refusé (D-012) ; corps inconnu refusé."""
    with pytest.raises(ValueError):
        eph.body_series("sun", -90.0, 0.0, 0.0, ["2027-03-14T06:00:00"])
    with pytest.raises(ValueError):
        eph.body_series("mars", -89.5, 0.0, 0.0, ["2027-03-14T06:00:00"])


def test_kernel_list_and_provenance(kernels: list[str]) -> None:
    """La liste des noyaux (pour provenance) contient les 4 noms retenus."""
    assert [Path(k).name for k in kernels] == ["naif0012.tls", "de440s.bsp", "moon_pa_de440_200625.bpc", "moon_de440_250416.tf"]
