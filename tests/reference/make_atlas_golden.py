"""Valeurs d'or de l'Atlas (A-02, docs/ATLAS.md § 6), calculées par des méthodes INDÉPENDANTES du code JavaScript.

- vecteurs : produit de matrices de rotation (R_y(lon)·R_z(lat) appliquée à l'axe +x), pas les formules cos/sin directes ;
- distance angulaire : angle entre deux vecteurs unitaires (arccos du produit scalaire), pas la formule de haversine ;
- pôle Sud : `pipeline.projection` (déjà confrontée à GDAL en M-019) ;
- pôle Nord : construction géométrique (projection stéréographique depuis le pôle Sud sur le plan tangent au pôle Nord) ;
- terminateur : points du grand cercle à 90° du point sub-solaire, obtenus par rotation de Rodrigues.
Convention de l'Atlas (écrite dans sphere.js et ici) : lat 0 / lon 0 → +x ; nord → +y ; l'Est apparaît à DROITE quand on regarde
le globe depuis l'extérieur ⇒ lon +90° → −z. Usage : `.venv\\Scripts\\python.exe tests/reference/make_atlas_golden.py`.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

from pipeline.config import R_REF_M
from pipeline.projection import lonlat_to_xy

OUT = Path(__file__).resolve().parents[1] / "golden" / "atlas_sphere.json"


def rotation_vector(lat_deg: float, lon_deg: float) -> list[float]:
    """+x tourné de lat autour de l'axe horizontal puis de lon autour de l'axe y (l'Est va vers −z)."""
    la, lo = math.radians(lat_deg), math.radians(lon_deg)
    # Rotation de lat autour de l'axe z (monte vers +y), puis de lon autour de l'axe y (+x → −z pour lon > 0 : l'Est va vers −z).
    rz = np.array([[math.cos(la), -math.sin(la), 0], [math.sin(la), math.cos(la), 0], [0, 0, 1]])
    ry = np.array([[math.cos(lo), 0, math.sin(lo)], [0, 1, 0], [-math.sin(lo), 0, math.cos(lo)]])
    v = ry @ rz @ np.array([1.0, 0.0, 0.0])
    return [float(c) for c in v]


def angle_between(a: list[float], b: list[float]) -> float:
    """Angle (°) entre deux vecteurs unitaires par arccos du produit scalaire."""
    return math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(a, b))))))


def north_polar_xy(lat_deg: float, lon_deg: float, radius_m: float) -> tuple[float, float]:
    """Pôle Nord par construction géométrique : projection depuis le pôle Sud sur le plan z = +R ; lon 0 vers −y."""
    v = np.array(rotation_vector(lat_deg, lon_deg))  # repère de l'Atlas : y = Nord ; (x, z) dans le plan équatorial
    # Dans le plan équatorial, l'angle de longitude se lit dans (x, −z) ; la projection depuis le pôle Sud (0, −R, 0) sur y = +R :
    t = 2.0 * radius_m / (v[1] * radius_m + radius_m)
    px, pz = t * v[0] * radius_m, t * v[2] * radius_m
    # Convention de la carte du pôle Nord : x = ρ sin λ, y = −ρ cos λ ; sin λ ∝ −pz, cos λ ∝ px.
    return float(-pz), float(-px)


def main() -> None:
    """Écrit tests/golden/atlas_sphere.json."""
    points = [(0, 0), (0, 90), (90, 0), (-89, 45), (-90, 0), (45, -135), (0, 180)]
    vectors = [{"lat_deg": la, "lon_deg": lo, "v": rotation_vector(la, lo)} for la, lo in points]
    pairs = [((0, 0), (0, 90)), ((0, 0), (90, 0)), ((-89, 0), (-89, 180)), ((10, 20), (10, 20)), ((-30, 170), (-30, -170)), ((0, 0), (0, 180))]
    distances = [{"a": list(a), "b": list(b), "deg": angle_between(rotation_vector(*a), rotation_vector(*b))} for a, b in pairs]
    terminators = []
    for sub in [(0, 0), (0, 90), (20, 40), (-60, -100)]:
        s = np.array(rotation_vector(*sub))
        helper = np.array([0.0, 1.0, 0.0]) if abs(s[1]) < 0.9 else np.array([1.0, 0.0, 0.0])
        e1 = np.cross(s, helper); e1 /= np.linalg.norm(e1)
        e2 = np.cross(s, e1)
        terminators.append({"sub": list(sub), "checks": [{"angle_deg": a, "v": [float(c) for c in (math.cos(math.radians(a)) * e1 + math.sin(math.radians(a)) * e2)]}
                                                         for a in (0, 45, 90, 135, 180, 225, 270, 315)]})
    south_cases = [(-90, 0), (-89, 0), (-89, 90), (-89, 180), (-89, -90), (-85, 45), (-80, -135), (-60, 30)]
    south = [{"lat_deg": la, "lon_deg": lo, "x_m": float(lonlat_to_xy(la, lo)[0]), "y_m": float(lonlat_to_xy(la, lo)[1])} for la, lo in south_cases]
    north_cases = [(90, 0), (89, 0), (89, 90), (89, 180), (89, -90), (85, 45), (80, -135), (60, 30)]
    north = [{"lat_deg": la, "lon_deg": lo, "x_m": north_polar_xy(la, lo, R_REF_M)[0], "y_m": north_polar_xy(la, lo, R_REF_M)[1]} for la, lo in north_cases]
    doc = {
        "description": "Valeurs d'or de web/js/atlas/sphere.js (ATLAS § 6). Générées par tests/reference/make_atlas_golden.py, méthodes indépendantes du JavaScript.",
        "convention": "lat 0 / lon 0 → +x ; nord → +y ; lon +90° → −z (l'Est apparaît à droite vu de l'extérieur)",
        "radius_m": R_REF_M, "tolerance_vector": 1e-12, "tolerance_deg": 1e-9, "tolerance_m": 1e-6,
        "vectors": vectors, "distances": distances, "terminators": terminators, "south_polar": south, "north_polar": north,
        "equirect": {"width": 2048, "height": 1024, "cases": [
            # x et y par interpolation linéaire NumPy (méthode indépendante de la formule fermée du JavaScript) ; le dernier cas est Tycho.
            {"lat_deg": la, "lon_deg": lo, "x": float(np.interp(lo, [-180, 180], [0, 2048])), "y": float(np.interp(-la, [-90, 90], [0, 1024]))}  # xp croissant exigé par np.interp : on interpole sur −lat
            for la, lo in [(0, 0), (90, -180), (-90, 180), (-43.3, -11.4), (30, 120)]]},
        "lon_interpolation": {"series": {"lat_mdeg": [10000, 20000], "lon_mdeg": [179900, -179900]}, "t": 0.5, "lat_deg": 15.0, "lon_abs_deg": 180.0},
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(f"écrit {OUT} ({len(vectors)} vecteurs, {len(distances)} distances, {len(south)} points sud, {len(north)} points nord)")


if __name__ == "__main__":
    main()
