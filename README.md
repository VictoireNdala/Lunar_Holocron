# Lunar Holocron

**A landing-site navigator for the lunar South Pole: see where the Sun and the Earth stand relative to the *real* terrain horizon, for any site and any date.**

*NASA Space Apps Challenge 2026 — “Lunar Landing Site Navigator” (CLPS Lunar Mission Browser).*

> [!IMPORTANT]
> **Read this before trusting a number.**
> - Four sites (Site01, Site04, Site07, Site11) use **real** LOLA terrain models and **real** SPICE ephemerides. **No fictional data ships with the product**: synthetic test sets live in `pipeline/fixtures` and `tests/fixtures` only
>   (a data file flagged `"synthetic": true` would still be shown with a permanent honesty chip that cannot be hidden).
> - A real site is evaluated at the **centre of its terrain model’s extent**, not at a chosen landing point. Those positions are **unverified** (`"verified": false`).
> - This is an independent hackathon project, **not endorsed by NASA**, and not a mission planning tool. The limits are listed [below](#limitations) and in the application’s *Sources and method* tab.

---

## Why

Near the lunar South Pole the Sun skims the horizon and the Earth rises and sets with the Moon’s libration.
A few hundred metres of crater rim can decide whether a lander has power and a direct link home — or neither.
Lunar Holocron makes that question visual and quantitative for:

- **Mission planners** — compare candidate sites for solar power and direct-to-Earth line of sight;
- **Educators** — show why polar illumination is so different from the rest of the Moon;
- **The general public** — explore the sky as seen from the ground at a future landing site.

## What it does

The application is **static and fully offline** (no server logic, no CDN, no remote API at run time). All heavy computation is done beforehand by an offline Python pipeline.

| Area | What you get |
|---|---|
| **Atlas** | A 3D globe and three 2D maps (world, South Pole, North Pole) with the day/night limit, the sub-solar and sub-Earth points, and the sites. Click a site for its sheet; a guided tour visits the four priority sites. The Atlas uses a smooth sphere and a flat horizon: **it shows no visibility verdict**. |
| **Site: verdict** | Strict / optimistic threshold, the share of time with the Sun and the Earth visible, both together, the longest period without Sun and without Earth, a month-by-month heat map and its table. |
| **Site: readings** | For each body: Hidden / Partial / Visible (independent of the threshold), azimuth, elevation, **horizon at the body’s azimuth**, **signed margin**, angular radius, and a geometric “direct link possible” sentence. |
| **Site: views** | 360° panorama of the real horizon, a 3D terrain view, and a **timeline** with elevation curves, the terrain horizon at each body’s azimuth and visibility bands (7 days to the whole 2026–2030 period). |
| **Link** | Is the Earth above the site's horizon now? Countdown to Earth/Sun set and rise, propagation delay (computed from the oblique distance), windows and outages over 7 days to the whole period with CSV export, a user-set minimum useful angle, a landing-window planner (user-entered stay and constraints) and a site-link layer on the Atlas. **Geometry only**: relays, ground stations and link budget are not modelled. |
| **Free point** | Type any latitude/longitude (or click the map): Sun, Earth, horizon and indicators are computed **in your browser** (SPICE positions with parallax; horizon from a 480 m LOLA grid south of 80° S, flat horizon north of it). The approximation is measured and stated. |
| **Compare** | Site B against site A at the same instant and threshold: indicators, difference B − A, no ranking. |
| **Time** | One clock for every view: UTC field, ±1 h / ±1 day, play / pause at ×1, ×60, ×3600, ×86 400, “Now”. |
| **Sources and method** | Provenance read from the data file, formulas, definitions of every indicator, limits, validation, credits, use of AI. |
| **Links** | Buttons to open the site in Quickmap or Moon Trek (external, opened by your click only). |

The interface is available in French and English. The state (view, sites A/B, instant, threshold, window, language) lives in the URL fragment.

## How it works

```
NASA data (LOLA DEMs from PGDA, SPICE kernels from NAIF)      local files, never committed
        │
        ▼
pipeline/  (Python, offline, run once per site)
   terrain model ─► horizon mask (360 azimuths, curvature included)
   ephemerides   ─► Sun / Earth azimuth, elevation, angular radius (hourly, 2026–2030)
   shared visibility formulas ─► indicators ─► export
        │
        ▼
web/data/  (static JSON + compact binary terrain grids — the data contract, version 1.1)
        │
        ▼
web/  (static app, native ES modules, three.js vendored locally, no build step)
```

Key methodological choices (details in [`docs/`](docs/) and in the application’s method tab):

- **Horizon mask** — for each azimuth, the maximum elevation of the surrounding terrain seen from the observer (2.0 m eye height, provisional), **including lunar curvature**:
  `elev = atan2((R+hₜ)·cos δ − (R+hₒ), (R+hₜ)·sin δ)`, with `δ = d / R` and `R = 1,737.4 km`, out to 150 km.
- **Visible fraction of a disk** — `f = 1 − (acos x − x·√(1−x²)) / π`, with `x = clamp((el − h) / r, −1, 1)`; the horizon is read at the azimuth of the disk centre.
- **Two explicit thresholds** — *strict* (`f ≥ 0.5`, default) and *optimistic* (`f > 0`). The state Hidden / Partial / Visible (`f = 0`, `0 < f < 1`, `f = 1`) does not depend on the threshold.
- **Lunar frame** — `MOON_ME`, not `IAU_MOON`.
- **Conventions** — azimuth 0° = North, 90° = East, clockwise; geometric elevation without refraction; selenocentric latitude (negative south); all times in UTC.
- **One formula, two implementations** — every visibility formula exists in Python *and* JavaScript, checked against the **same reference values** ([`tests/golden/`](tests/golden/)).
- **Reproducibility** — identical inputs give byte-identical outputs; provenance (terrain product, kernels, pipeline version) is written into every data file.

## Project status

| Area | State |
|---|---|
| Data contract, schemas, validator | ✅ version 1.1, validated on every build |
| Pipeline: terrain, horizon, visibility, indicators, SPICE ephemerides, export | ✅ 4 real sites (fictional test sets isolated in `fixtures`) |
| Atlas: globe, three 2D maps, site sheet, guided tour, playback | ✅ |
| Site view: verdict, readings, panorama, 3D, timeline, compare, method tab, deep links | ✅ |
| Validation: SPICE against JPL Horizons (5 sites × 3 dates × Sun and Earth, 1,440 values) | ✅ see [`docs/VALIDATION-RESULTATS.md`](docs/VALIDATION-RESULTATS.md) |
| Python / JavaScript agreement file for body positions (`body_state_cases.json`) | ⏳ generated, **awaiting human review** ([`docs/REVUE-FICHIER-OR.md`](docs/REVUE-FICHIER-OR.md)) |
| Horizon mask against an official tool, LOLA average illumination, sensitivity analysis | ❌ not done |
| Browser smoke test (Playwright), mobile layout, accessibility audit, command palette | ❌ not done |
| Level-2 sites (NASA 2024 regions without 5 m terrain), LOLA hillshade layer, polar-map zoom | ❌ not done |

Test suites: **296 Python tests** and **255 JavaScript tests**, all passing at the last run (see [`STATUS.md`](STATUS.md) for the dated evidence).
The detailed task plan is in [`PLAN.md`](PLAN.md); the live status is in [`STATUS.md`](STATUS.md); the exchange with the reviewing assistant is in [`LIAISON.md`](LIAISON.md).

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

### Run the application

```powershell
py -m pipeline.tools.serve              # http://localhost:8000, served without browser caching (recommended)
py -m http.server 8000 -d web           # alternative; the browser may keep stale JS modules: hard-reload with Ctrl+Shift+R
```

The committed `web/data/` already contains the four real sites. The Atlas textures (NASA SVS) are **not** committed
(licence to be settled, `Q-013`): without them the globe falls back to a plain sphere and says so.

### Run the tests

```powershell
py -m pytest pipeline/tests -q          # Python (SPICE tests are skipped when the kernels are absent)
node --test "web/tests/**/*.test.js"    # JavaScript
```

### Rebuild the data

```powershell
py -m pipeline.cli build                # every real site whose files are present in data/raw/ (stops if the SPICE kernels are missing: no fictional fallback)
py -m pipeline.cli build --site site04-shackleton-rim   # one site, other sites kept in the index
py -m pipeline.cli validate             # check web/data against the data contract
py -m pipeline.fixtures.demo_sites --site demo-b   # FICTIONAL test fixtures, written to tests/fixtures/web-data (never under web/)
```

### Raw data: NOT in this repository, and how to get it

The GitHub repository contains the application, the code and the **computed outputs** (`web/data/`, about 103 MB). It does **not** contain the raw NASA files (about 1.9 GB, some above GitHub's 100 MB per-file limit; they are in `.gitignore`). **The application and `web/data/` work without them**; you only need them to rebuild the data (`py -m pipeline.cli build`). Without them, `pytest` skips 44 tests (251 pass on a clean clone) and `node --test` is unaffected.

Put every file below in `data/raw/` (SPICE kernels in `data/raw/spice/`). Sizes and SHA-256 sums were measured on the files used for the committed data.

| File | Where to download | Size | SHA-256 |
|---|---|---|---|
| `LDEM_80S_80MPP_ADJ.tiff` (PGDA product 90, polar LDEM 80 m) | <https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF> — **save it under the name `.tiff`** | 189,158,392 B | `82030DCBDD7C4BB0C7D858E9B4B293B9F2CDA5A543BA31EC0F42784BD6BEEE5A` |
| `spice/naif0012.tls` | <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls> | 5,257 B | `678E32BDB5A744117A467CD9601CD6B373F0E9BC9BBDE1371D5EEE39600A039B` |
| `spice/de440s.bsp` | <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp> | 32,726,016 B | `C1C7FEEAB882263FC493A9D5A5B2DDD71B54826CDF65D8D17A76126B260A49F2` |
| `spice/moon_pa_de440_200625.bpc` | <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc> | 12,863,488 B | `60CD55AA401EA2EA97360636F567554BFE4E37BB829F901B4460A455DFAF783F` |
| `spice/moon_de440_250416.tf` | <https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf> | 19,478 B | `A47C71E9C9F33796BDAFB2C9D69A7EE447B6016ECAD80F71CD6F3E479F9CF768` |
| 27 PGDA 5 m products (`Site01_final_adj_5mpp_surf.tif`, …, 41 to 142 MB each, about 1.7 GB) | `py -m pipeline.tools.fetch_pgda5m` downloads the 23 products missing locally from `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/<Id>/<file>` and records their SHA-256; the four first products (Site01, Site04, Site07, Site11) are fetched the same way from the same URLs | see `config/sites_real.json` | in `config/sites_real.json` (`dem.sha256`) |

The pipeline reads the 5 m products and the 80 m LDEM only from `data/raw/`; the web application never downloads anything. No licence is stated on the PGDA and NAIF pages that were read: cite Barker et al. (2021, 2023) and NAIF (see [`SOURCES.md`](SOURCES.md)).

### Validate against JPL Horizons

```powershell
py -m pipeline.tools.horizons_validate  # read-only requests to the public Horizons API; the results are committed
```

The tests read the committed results and need no network.

## Repository layout

```
├─ pipeline/          Offline Python pipeline (geodesy, projection, DEM readers, horizon, visibility, kpi, SPICE, export, CLI, validation)
│  ├─ schema/           JSON Schemas: index, site, terrain, global
│  ├─ fixtures/         FICTIONAL test generators only (synthetic terrain and ephemerides); never imported by production code
│  ├─ tools/            site catalogue, DEM cropping, icon sprite, dev server, Horizons validation
│  └─ tests/            pytest suite
├─ web/               Static application (native ES modules, no bundler)
│  ├─ js/               state, data loading, verdicts, timeline, compare, playback, links; atlas/ (globe, maps, sheets); ui/ (panels)
│  ├─ css/  vendor/     design tokens, shell; three.js, fonts, icons (all local)
│  ├─ data/             committed outputs: index, global, sites/, terrain/
│  └─ tests/            node --test suite
├─ config/            pipeline period and grids, real-site catalogue
├─ tests/
│  ├─ fixtures/         fictional test data (never served by the application)
│  ├─ golden/           reference values shared by Python and JavaScript
│  └─ reference/        independent recomputation scripts, Horizons values
├─ docs/              Architecture, data contract, pipeline, interface, Atlas, real sites, validation results, UI design
├─ PLAN.md  STATUS.md  DECISIONS.md  SOURCES.md  LIAISON.md
└─ LICENSE            Apache License 2.0
```

## Documentation

| Document | Content |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Overview, glossary, angular conventions, reference formulas |
| [`docs/CONTRAT-DONNEES.md`](docs/CONTRAT-DONNEES.md) | Exact format of the data files exchanged between pipeline and application |
| [`docs/PIPELINE.md`](docs/PIPELINE.md) | Computations: terrain, horizon, ephemerides, indicators, export |
| [`docs/INTERFACE.md`](docs/INTERFACE.md), [`docs/UI-DESIGN.md`](docs/UI-DESIGN.md), [`docs/ATLAS.md`](docs/ATLAS.md) | Application design: views, state, accessibility, design system, Atlas |
| [`docs/SITES-REELS.md`](docs/SITES-REELS.md), [`docs/INVENTAIRE-DONNEES.md`](docs/INVENTAIRE-DONNEES.md) | Real sites and data inventory |
| [`docs/TESTS-VALIDATION.md`](docs/TESTS-VALIDATION.md), [`docs/VALIDATION-RESULTATS.md`](docs/VALIDATION-RESULTATS.md) | Reference values, tests, validation plan and **measured results** |
| [`docs/REVUE-FICHIER-OR.md`](docs/REVUE-FICHIER-OR.md) | The Python/JavaScript agreement file awaiting human review |
| [`DECISIONS.md`](DECISIONS.md) | Decision log and open questions |

The design documents are written in French; code identifiers and data fields are in English.

## Data sources

| Source | Use |
|---|---|
| LRO / LOLA digital elevation models, NASA Goddard PGDA (products 78 and 90) | Terrain, horizon masks |
| NAIF SPICE generic kernels (DE440, lunar orientation) | Sun and Earth positions in `MOON_ME` |
| NASA/JPL Horizons System | **Validation only** (never used by the pipeline, the application or the tests) |
| NASA Scientific Visualization Studio, CGI Moon Kit | Illustrative Atlas textures, kept local and uncommitted; used in no calculation |

Licences, citations and checksums are recorded in [`SOURCES.md`](SOURCES.md). Several source pages state **no explicit licence**; the rule followed is to cite them and to commit only derived results.

## Limitations

- Hourly sampling: events shorter than one hour are not resolved.
- The horizon is read at the azimuth of the disk centre only.
- Terrain resolution and coverage are limited; azimuths where the horizon is a lower bound are flagged (`truncated`).
- No modelling of dust, scattered light, or thermal effects.
- Earth visibility is **geometric** line of sight: it says nothing about ground-station availability or link budget.
- The strict and optimistic thresholds are documented choices, not physical truths.
- Real-site indicators are computed at the centre of the terrain model, with a provisional 2 m eye height.
- The monthly heat map exists for the strict threshold only (that is what the data contract provides).
- SPICE and Horizons share the same ephemeris family, so the validation checks our geometry, not the ephemerides; one Earth-elevation difference of 2.4·10⁻⁵° is unexplained.

## Use of AI

This project is built with the help of AI tools, used transparently:
**Claude** (Anthropic) for the preliminary study, architecture, and review, and **Claude Code** for implementation, tests, and technical documentation.
Reference values are recomputed independently where possible, and the points that still need a human check (the Python/JavaScript agreement file, the site positions, the scientific choices)
are listed in [`STATUS.md`](STATUS.md) and in [`SOURCES.md`](SOURCES.md#4-usage-de-lia-transparence).

## License

Released under the [Apache License 2.0](LICENSE).
This project is not endorsed by NASA. NASA data remain subject to their own terms of use, listed in [`SOURCES.md`](SOURCES.md).

---

### Résumé en français

**Lunar Holocron** est un navigateur des sites d’alunissage du pôle Sud lunaire. Pour un site et une date, il montre où se trouvent le Soleil et la Terre par rapport à
**l’horizon réel du terrain**, afin de juger l’énergie solaire disponible et la liaison directe avec la Terre ; il permet de comparer deux sites.
Projet réalisé pour le NASA Space Apps Challenge 2026. **Quatre sites utilisent des données réelles (relief LOLA, éphémérides SPICE) ; aucune donnée fictive n’est livrée avec le produit (les jeux fictifs ne servent qu’aux tests).**
Les indicateurs des sites réels sont calculés au centre du modèle de terrain, pas à un point d’alunissage choisi. Le projet n’est pas approuvé par la NASA.
La documentation de conception est dans [`docs/`](docs/) ; l’état d’avancement dans [`STATUS.md`](STATUS.md) ; les résultats de validation mesurés dans [`docs/VALIDATION-RESULTATS.md`](docs/VALIDATION-RESULTATS.md).
