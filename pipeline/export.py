"""Construction et écriture d'un site (docs/PIPELINE.md § export ; T-07) : horizon, séries, indicateurs, terrain 3D, index.

JSON compact (`separators`, clés triées, UTF-8, saut de ligne final) ; aucune horloge dans les sorties (D-013) :
`generated_utc` = `build_utc` de la configuration. Deux exécutions donnent des fichiers identiques octet pour octet.
Version écrite : 1.2 (champs optionnels de 1.1 : `terrain_real`, `ephemeris_synthetic`, `tier`… ; de 1.2 : `kind`, `terrain_tier`, `terrain_modeled`, `sources`… ; CONTRAT § 7 ter, D-021, D-026).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np

from pipeline import __version__, ephemeris_spice
from pipeline.timegrid import BODIES, utc_grid
from pipeline.config import MOON_FRAME, R_REF_M
from pipeline.dem import Dem
from pipeline.horizon import HorizonConfig, compute_horizon
from pipeline.kpi import compute_kpis
from pipeline.terrain_grid import build_terrain_grid, encode_uint16

SCHEMA_VERSION = "1.2"
UTC_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
GROUND_HEIGHT_DECIMALS = 2


@dataclass(frozen=True)
class PipelineConfig:
    """Lecture de config/pipeline.json (période, horizon, terrain, date de build)."""

    start_utc: str
    step_s: int
    count: int
    horizon: HorizonConfig
    terrain_size_m: float
    terrain_n: int
    build_utc: str
    kernel_dir: Path = Path("data/raw/spice")

    @staticmethod
    def from_dict(d: dict[str, Any], count: int | None = None) -> "PipelineConfig":
        """`count` force le nombre d'échantillons (tests) ; sinon il est déduit de la période."""
        p = d["period"]
        if count is None:
            t0 = datetime.strptime(p["start_utc"], UTC_FORMAT).replace(tzinfo=timezone.utc)
            t1 = datetime.strptime(p["end_utc"], UTC_FORMAT).replace(tzinfo=timezone.utc)
            count = int((t1 - t0).total_seconds() // p["step_s"]) + 1
        return PipelineConfig(p["start_utc"], p["step_s"], count, HorizonConfig.from_dict(d["horizon"]),
                              d["terrain"]["size_m"], d["terrain"]["n"], d["build_utc"])

    @staticmethod
    def load(path: Path) -> "PipelineConfig":
        """Lit un fichier de configuration JSON."""
        return PipelineConfig.from_dict(json.loads(path.read_text(encoding="utf-8")))


@dataclass
class SiteSpec:
    """Tout ce qu'il faut pour construire un site (le MNT est déjà ouvert)."""

    id: str
    name: dict[str, str]
    lat_deg: float
    lon_deg: float
    dem: Dem
    dem_info: dict[str, Any]  # product, resolution_m, source, license (+ citation…)
    engine: str  # 'spice' (production) ; tout autre moteur exige `series_fn` (jeux de test : pipeline/fixtures)
    terrain_real: bool
    verified: bool
    observer_height_m: float | None = None
    index_extra: dict[str, Any] = field(default_factory=dict)  # tier, pgda_id, lola_priority_site, nasa_2024_region…
    terrain_modeled: bool = True  # False : relief NON MODÉLISÉ (horizon plat) ; ni réel ni fictif (D-026)
    extra: dict[str, Any] = field(default_factory=dict)  # champs optionnels 1.2 (kind, position_basis, sources…) : site ET index
    series_fn: Callable[[str, float, float, Sequence[str]], dict[str, Any]] | None = None  # (corps, lat, lon, instants) → az/el/rayon ; hors SPICE


def dump_json(path: Path, doc: Any) -> None:
    """JSON compact, clés triées, UTF-8, saut de ligne final."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")


def _series(spec: SiteSpec, cfg: PipelineConfig, eye_height_m: float) -> dict[str, dict[str, list[int]]]:
    """Séries Soleil et Terre en millidegrés entiers, par le moteur demandé."""
    utc = utc_grid(cfg.start_utc, cfg.step_s, cfg.count)
    out = {}
    for body in BODIES:
        if spec.engine == "spice":
            raw = ephemeris_spice.body_series(body, spec.lat_deg, spec.lon_deg, eye_height_m, utc)
        elif spec.series_fn is not None:
            raw = spec.series_fn(body, spec.lat_deg, spec.lon_deg, utc)
        else:
            raise ValueError(f"moteur {spec.engine!r} sans fonction de séries : seul « spice » est un moteur de production")
        out[body] = {k: [int(v) for v in arr] for k, arr in ephemeris_spice.to_millidegrees(raw).items()}
    return out


def build_site(spec: SiteSpec, cfg: PipelineConfig, out_dir: Path) -> dict[str, Any]:
    """Écrit sites/<id>.json, terrain/<id>.json et .bin ; renvoie l'entrée d'index du site."""
    if spec.engine == "spice":
        ephemeris_spice.load_kernels(cfg.kernel_dir)
    eye = cfg.horizon.observer_height_m if spec.observer_height_m is None else spec.observer_height_m
    ground = float(np.asarray(spec.dem.height_m(spec.lat_deg, spec.lon_deg)))
    if not np.isfinite(ground):
        raise ValueError(f"{spec.id} : le site est hors du MNT")
    elev, truncated = compute_horizon(spec.dem, spec.lat_deg, spec.lon_deg, eye, cfg.horizon)
    bodies = _series(spec, cfg, ground + eye)
    kpis, monthly = compute_kpis(elev, bodies, cfg.start_utc, cfg.step_s)
    grid = build_terrain_grid(spec.dem, spec.lat_deg, spec.lon_deg, cfg.terrain_size_m, cfg.terrain_n)
    z_min, z_max, raw = encode_uint16(grid.z_m)

    ephemeris_synthetic = spec.engine != "spice"
    synthetic = ephemeris_synthetic or (not spec.terrain_real and spec.terrain_modeled)  # un relief non modélisé n'est pas « fictif »
    flags = {"terrain_real": spec.terrain_real, "ephemeris_synthetic": ephemeris_synthetic, "terrain_modeled": spec.terrain_modeled, **spec.extra}
    site = {
        "schema_version": SCHEMA_VERSION, "id": spec.id, "name": spec.name, "synthetic": synthetic, **flags,
        "location": {"lat_deg": spec.lat_deg, "lon_deg": spec.lon_deg, "ground_height_m": round(ground, GROUND_HEIGHT_DECIMALS),
                     "observer_height_m": eye, "frame": MOON_FRAME, "r_ref_m": R_REF_M},
        "provenance": {
            "dem": {**spec.dem_info, "filled_nodes": grid.filled_nodes},
            "ephemeris": {"engine": spec.engine, "kernels": list(ephemeris_spice.KERNEL_NAMES) if spec.engine == "spice" else [],
                          "abcorr": ephemeris_spice.ABCORR if spec.engine == "spice" else None},
            "pipeline_version": __version__, "generated_utc": cfg.build_utc,
        },
        "horizon": {"az_step_deg": 1.0, "elev_deg": [float(v) for v in elev], "truncated": [bool(v) for v in truncated],
                    "max_distance_km": cfg.horizon.far_max_km},
        "time": {"start_utc": cfg.start_utc, "step_s": cfg.step_s, "count": cfg.count},
        "bodies": bodies, "kpis": kpis, "monthly": monthly,
    }
    terrain = {
        "schema_version": SCHEMA_VERSION, "id": spec.id, "synthetic": synthetic,
        "center": {"lat_deg": spec.lat_deg, "lon_deg": spec.lon_deg},
        "grid": {"n": grid.n, "size_m": grid.size_m, "spacing_m": grid.spacing_m},
        "frame": "local-enu",
        "z": {"encoding": "uint16-linear", "min_m": z_min, "max_m": z_max, "file": f"{spec.id}.bin",
              "byte_order": "little", "row_order": "north-to-south", "col_order": "west-to-east"},
    }
    dump_json(out_dir / "sites" / f"{spec.id}.json", site)
    dump_json(out_dir / "terrain" / f"{spec.id}.json", terrain)
    (out_dir / "terrain").mkdir(parents=True, exist_ok=True)
    (out_dir / "terrain" / f"{spec.id}.bin").write_bytes(raw)
    return {"id": spec.id, "name": spec.name, "lat_deg": spec.lat_deg, "lon_deg": spec.lon_deg, "synthetic": synthetic,
            "verified": spec.verified, "site_file": f"sites/{spec.id}.json", "terrain_file": f"terrain/{spec.id}.json",
            **flags, **spec.index_extra}


def write_index(entries: list[dict[str, Any]], out_dir: Path, cfg: PipelineConfig) -> None:
    """index.json : `synthetic` racine = au moins un site synthétique ; ordre stable (niveau puis id)."""
    ordered = sorted(entries, key=lambda e: (e.get("tier", 99), e["id"]))
    dump_json(out_dir / "index.json", {"schema_version": SCHEMA_VERSION, "generated_utc": cfg.build_utc,
                                       "synthetic": any(e["synthetic"] for e in ordered), "sites": ordered})
