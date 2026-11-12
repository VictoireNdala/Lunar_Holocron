# Lunar Holocron

**A landing-site navigator for the lunar South Pole: see where the Sun and the Earth stand relative to the *real* terrain horizon, for any site and any date.**

*NASA Space Apps Challenge 2026 — “Lunar Landing Site Navigator” (CLPS Lunar Mission Browser).*

> [!WARNING]
> **Work in progress — demonstration data only.**
> NASA datasets (LOLA terrain models, SPICE ephemerides) are not connected yet. Every value currently produced by this repository is **synthetic**,
> flagged `"synthetic": true` in the data files, and the application will display a permanent *“DEMONSTRATION DATA — fictitious values”* banner.
> No synthetic value is ever presented as real.

---

## Why

Near the lunar South Pole the Sun skims the horizon and the Earth rises and sets with the Moon’s libration.
A few hundred metres of crater rim can decide whether a lander has power and a direct link home — or neither.
Lunar Holocron makes that question visual and quantitative for:

- **Mission planners** — compare candidate sites for solar power and direct-to-Earth line of sight;
- **Educators** — show why polar illumination is so different from the rest of the Moon;
- **The general public** — explore the sky as seen from the ground at a future landing site.

## What it does

For a selected site and date (UTC), the application will show:

| View | Purpose |
|---|---|
| **360° panorama** | Terrain horizon silhouette with the Sun and the Earth at their true azimuth and elevation, plus their ±24 h track. |
| **3D terrain view** | 20 × 20 km regional mesh, lit from the Sun’s direction (illustrative), ground-level and overview cameras. |
| **Timeline** | Sun and Earth elevation against the horizon *at their own azimuth*, with visibility bands. |
| **Verdicts and readings** | Hidden / Partial / Visible for each body, with the signed margin above the horizon. |
| **Site indicators** | Percentage of time with Sun, Earth, or both visible; longest night; longest Earth outage; monthly heat map. |
| **A/B comparison** | Two sites side by side at the same instant, with a comparison table. |
| **Sources and method page** | Data provenance, formulas, definitions of every indicator, and known limitations. |

The application is **static and fully offline**: no server, no CDN, no remote API. All heavy computation is done beforehand by an offline Python pipeline.

## How it works

```
NASA data (LOLA DEMs, SPICE kernels)      ← not connected yet: synthetic stand-ins for now
        │
        ▼
pipeline/  (Python, offline, run once per site)
   terrain model ─► horizon mask (360 azimuths, curvature included)
   ephemerides   ─► Sun / Earth azimuth, elevation, angular radius (hourly, 2026–2030)
   shared visibility formulas ─► indicators ─► export
        │
        ▼
web/data/  (static JSON + compact binary terrain grids — the data contract)
        │
        ▼
web/  (static app, native ES modules, three.js vendored locally)
```

Key methodological choices (details in [`docs/`](docs/)):

- **Horizon mask** — for each azimuth, the maximum elevation of the surrounding terrain seen from the observer, **including lunar curvature**:
  `elev = atan2((R+hₜ)·cos δ − (R+hₒ), (R+hₜ)·sin δ)`, with `δ = d / R` and `R = 1,737.4 km`.
- **Visible fraction of a disk** — the share of the Sun’s or Earth’s disk above the horizon:
  `f = 1 − (acos x − x·√(1−x²)) / π`, with `x = clamp((el − h) / r, −1, 1)`.
- **Two explicit thresholds** — *strict* (disk centre above the horizon, `f ≥ 0.5`, default) and *optimistic* (any part of the disk visible, `f > 0`). Both are computed and exposed.
- **Lunar frame** — `MOON_ME` (the LOLA frame), not `IAU_MOON`.
- **Conventions** — azimuth 0° = North, 90° = East, clockwise; geometric elevation without refraction; selenocentric latitude (negative south); all times in UTC.
- **One formula, two implementations** — every visibility formula exists in Python *and* JavaScript, and both are checked against the **same reference values** ([`tests/golden/`](tests/golden/)).
- **Reproducibility** — identical inputs give byte-identical outputs; provenance (terrain product, kernels, pipeline version) is written into every data file.

## Project status

| Milestone | Content | Status |
|---|---|---|
| **J0 — Foundations** | Repository, data contract and JSON Schema validator, geodesy and polar projection, JS constants, hand-made sample dataset | ✅ Done |
| **J1 — Demo computations** | Synthetic terrain, horizon mask, shared visibility formulas, indicators, demo ephemerides, export | ⏳ Next |
| **J2 — Core interface** | Data loading, state, panorama, 3D view, timeline, verdicts | ⏳ Planned |
| **J3 — Complete P0 product** | Polar map, A/B comparison, method page, smoke tests, performance | ⏳ Planned |
| **J4 — Real data** | SPICE kernels, LOLA DEMs, verified site coordinates, scientific validation | ⏳ Waiting for NASA data |

Current test suite: **85 Python tests** and **3 JavaScript tests**, all passing.
The detailed task plan is in [`PLAN.md`](PLAN.md); the live status is in [`STATUS.md`](STATUS.md).

## Getting started

### Requirements

- Python ≥ 3.10 (developed with 3.12)
- Node.js ≥ 22 (tests only; the application itself needs no build step)
- Windows PowerShell commands are shown; adapt the venv activation on macOS/Linux.

### Install

```powershell
git clone https://github.com/VictoireNdala/Lunar_Holocron.git
cd Lunar_Holocron
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r pipeline/requirements.txt
```

### Run the tests

```powershell
py -m pytest pipeline/tests -q          # Python: schema, geodesy, projection, sample dataset
node --test "web/tests/**/*.test.js"    # JavaScript: constants and shared reference values
```

### Validate a dataset against the data contract

```powershell
py -m pipeline.validate web/data/sample   # exit code 0 if valid, 1 otherwise
```

### Coming with the next milestones

```powershell
py -m pipeline.cli demo                 # generate the three demonstration sites (J1)
py -m http.server 8000 -d web           # serve the application at http://localhost:8000 (J2)
```

## Repository layout

```
├─ pipeline/          Offline Python pipeline
│  ├─ config.py         physical constants and conventions (single source, with references)
│  ├─ geodesy.py        great-circle destination, ENU basis, azimuth/elevation, terrain elevation
│  ├─ projection.py     south polar stereographic projection (parametrisable)
│  ├─ validate.py       data-contract validator (JSON Schema + cross-checks)
│  ├─ schema/           JSON Schemas: index, site, terrain
│  └─ tests/            pytest suite
├─ web/               Static application (native ES modules, no bundler)
│  ├─ js/               constants.js (mirror of config.py) — more modules to come
│  ├─ data/sample/      hand-made synthetic sample dataset
│  └─ tests/            node --test suite
├─ tests/
│  ├─ golden/           reference values shared by Python and JavaScript
│  └─ reference/        independent recomputation scripts and sample generator
├─ docs/              Architecture, data contract, pipeline, interface, tests & validation, real-data plan
├─ PLAN.md  STATUS.md  DECISIONS.md  SOURCES.md
└─ LICENSE            Apache License 2.0
```

## Documentation

| Document | Content |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Overview, glossary, angular conventions, reference formulas |
| [`docs/CONTRAT-DONNEES.md`](docs/CONTRAT-DONNEES.md) | Exact format of the data files exchanged between pipeline and application |
| [`docs/PIPELINE.md`](docs/PIPELINE.md) | Computations: terrain, horizon, ephemerides, indicators, export |
| [`docs/INTERFACE.md`](docs/INTERFACE.md) | Application design: views, state, accessibility, performance budget |
| [`docs/TESTS-VALIDATION.md`](docs/TESTS-VALIDATION.md) | Reference values, tests, and the scientific validation plan |
| [`docs/BRANCHEMENT-DONNEES-REELLES.md`](docs/BRANCHEMENT-DONNEES-REELLES.md) | Step-by-step plan to switch from synthetic to NASA data |
| [`DECISIONS.md`](DECISIONS.md) | Decision log and open questions |

The design documents are currently written in French; code identifiers and data fields are in English.

## Data sources (planned)

| Source | Use |
|---|---|
| LRO / LOLA digital elevation models (PDS Geosciences Node) | Terrain, horizon masks |
| NAIF SPICE generic kernels (DE440, lunar orientation) | Sun and Earth positions in `MOON_ME` |
| NASA Goddard PGDA products | Validation of illumination and Earth visibility |
| JPL Horizons | Spot checks of ephemerides |

None of these sources is used yet. Licences and citations are recorded in [`SOURCES.md`](SOURCES.md) as each source is integrated.

## Limitations

- Hourly sampling: events shorter than one hour are not resolved.
- The horizon is read at the azimuth of the disk centre only.
- Terrain resolution and coverage are limited; azimuths where the horizon is a lower bound are flagged (`truncated`).
- No modelling of dust, scattered light, or thermal effects.
- Earth visibility is **geometric** line of sight: it says nothing about ground-station availability or link budget.
- The strict and optimistic thresholds are documented choices, not physical truths.

## Use of AI

This project is built with the help of AI tools, used transparently:
**Claude** (Anthropic) for the preliminary study, architecture, and scientific review, and **Claude Code** for implementation, tests, and technical documentation.
Every reference value is recomputed independently before it is used in a test, and every human verification is logged in [`SOURCES.md`](SOURCES.md#4-usage-de-lia-transparence).

## License

Released under the [Apache License 2.0](LICENSE).
This project is not endorsed by NASA. NASA data, once integrated, remain subject to their own terms of use, listed in [`SOURCES.md`](SOURCES.md).

---

### Résumé en français

**Lunar Holocron** est un navigateur des sites d’alunissage du pôle Sud lunaire. Pour un site et une date, il montre où se trouvent le Soleil et la Terre par rapport à
**l’horizon réel du terrain**, afin de juger l’énergie solaire disponible et la liaison directe avec la Terre ; il permet de comparer deux sites.
Projet réalisé pour le NASA Space Apps Challenge 2026. **En construction : toutes les données actuelles sont synthétiques (fictives).**
La documentation de conception est dans [`docs/`](docs/) ; l’état d’avancement dans [`STATUS.md`](STATUS.md).
