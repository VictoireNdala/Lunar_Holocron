# Architecture et conventions

> **Avis de mise à jour (V2, 2026-11-15, D-029).** Ce document a été écrit pendant la phase « démonstration » : les passages sur le mode démonstration (`demo-a/b/c`, `data/sample`, `ephemeris_demo`, `dem_synthetic`, `cli demo`) sont **historiques**. Ces générateurs ne sont plus que des **fixtures de tests** (`pipeline/fixtures/`), jamais servies ni importées par le produit. Le produit n'a que des **données réelles** (SPICE, LOLA) : commande `py -m pipeline.cli build` (puis `validate`). L'état à jour est dans `STATUS.md`, `README.md`, `docs/CONTRAT-DONNEES.md` (1.2) et `docs/VALIDATION-RESULTATS.md`.

## 1. Vue d'ensemble

```
Données NASA (MNT LOLA, noyaux SPICE)                 [pas encore disponibles : voir mode démonstration]
        │
        ▼
pipeline/ (Python, hors ligne, exécuté une fois par site)
   dem ──► horizon ───────────┐
   ephemeris (SPICE | démo) ──┼──► kpi ──► export
   visibility (formules) ─────┘
        │
        ▼
web/data/  (fichiers statiques : index.json, sites/<id>.json, terrain/<id>.json + .bin)
        │
        ▼
web/ (application statique, aucun serveur, aucun réseau)
   data ► store ► [panorama | terrain3d | timeline | verdicts | polarmap | compare]
```

Le **contrat de données** (`docs/CONTRAT-DONNEES.md`) est la seule interface entre le pipeline et l'application.
Il permet de construire les deux côtés en parallèle.

### Deux modes de données

| Mode | Éphémérides | MNT | Drapeau | Usage |
|---|---|---|---|---|
| **Démonstration** (actuel) | Modèle analytique simplifié (`ephemeris_demo.py`) | Terrain synthétique (`dem_synthetic.py`) | `synthetic: true` | Construire et tester toute la chaîne sans données NASA |
| **Réel** (à brancher) | SPICE (DE440 + orientation lunaire) | LOLA (PDS / PGDA) | `synthetic: false` | Livrable final |

Le passage de l'un à l'autre ne doit **modifier ni le contrat, ni l'application** : seule la commande du pipeline change
(`docs/BRANCHEMENT-DONNEES-REELLES.md`).

## 2. Glossaire et conventions (valables partout)

| Terme | Définition |
|---|---|
| **Site** | Un point d'observation à la surface : latitude, longitude, hauteur de l'œil au-dessus du sol (`observer_height_m`, par défaut 2,0 m : D-008, provisoire). |
| **Corps** | Le Soleil (`sun`) ou la Terre (`earth`). |
| **Élévation** | Angle, en degrés, entre la direction du centre du corps et le **plan horizontal local** (perpendiculaire à la verticale locale, c'est-à-dire la direction radiale). Positive au-dessus. **Géométrique, sans réfraction** (pas d'atmosphère). |
| **Azimut** | Degrés, **0 = Nord, 90 = Est**, sens horaire vu d'en haut, dans [0, 360). Le Nord est la direction locale vers le pôle Nord lunaire. |
| **Masque d'horizon** | Pour chaque azimut, l'élévation maximale du relief visible depuis le site (`horizon.elev_deg`, un point par degré d'azimut). |
| **Rayon angulaire** | Demi-diamètre apparent du disque du corps, en degrés (`radius_mdeg` en millidegrés dans les séries). |
| **Fraction visible** `f` | Part de la surface du disque au-dessus du masque d'horizon, dans [0, 1] (formule en § 3). |
| **Seuil strict** | Corps considéré visible si `f ≥ 0,5`, c'est-à-dire **le centre du disque est au-dessus de l'horizon**. |
| **Tolérance numérique (D-031)** | `VISIBILITY_TOLERANCE = 1e-9` : strict ⇔ `f ≥ 0,5 − 1e-9`, optimiste ⇔ `f > 1e-9`, pour qu'un cas exactement sur la limite ne dépende pas de la bibliothèque mathématique (numpy ou V8). |
| **Seuil optimiste** | Corps considéré visible si `f > 0`, c'est-à-dire **une partie quelconque du disque est visible** (définition proche de PGDA pour la Terre). |
| **Repère lunaire** | `MOON_ME` (axe moyen / axe de rotation moyen), celui de LOLA. Pas `IAU_MOON`. |
| **Rayon de référence** | `R_REF = 1 737 400 m`. Les hauteurs de terrain sont des mètres au-dessus de cette sphère. |
| **Latitude** | Sélénocentrique (planétocentrique), degrés, **négative au Sud**. |
| **Longitude** | Est positive, degrés, [-180, 180] dans les JSON. |
| **Temps** | UTC, ISO 8601 avec `Z`. Pas d'échantillonnage : 3600 s. |
| **Repère local ENU** | x = Est, y = Nord, z = verticale locale (radiale, vers le haut). |

Suffixes d'unités des champs : `_deg` degrés (flottants), `_mdeg` millidegrés (entiers), `_m` mètres, `_km` kilomètres,
`_s` secondes, `_h` heures, `_pct` pourcentage [0, 100].

Cas limites imposés :
- **Pôle exact interdit** : `-89.99 ≤ lat_deg ≤ 89.99`, bornes **incluses** (D-012) : l'azimut n'est pas défini au pôle. Pour tester près du pôle, utiliser `-89.99`.
- **Azimut 0/360** : toute interpolation d'azimut gère le saut (interpoler sur l'angle « déroulé »).
- **Masque d'horizon** : interpolation linéaire entre les points voisins, avec bouclage 359° → 0°.

## 3. Formules de référence (à implémenter à l'identique en Python et JavaScript)

**Fraction visible d'un disque** de rayon angulaire `r` (> 0), dont le centre est à l'élévation `el`, au-dessus d'un horizon plat à l'élévation `h`
(horizon pris à l'azimut du centre) :

```
d = el - h
x = clamp(d / r, -1, 1)
f = 1 - (acos(x) - x * sqrt(1 - x²)) / π
```
Propriétés : `f = 1` si `d ≥ r` ; `f = 0,5` si `d = 0` ; `f = 0` si `d ≤ -r`.
Strict ⇔ `d ≥ 0`. Optimiste ⇔ `d > -r`.
Approximation assumée : l'horizon est lu au seul azimut du centre du disque (le disque couvre ±r/cos(el) en azimut, ≤ 1° pour la Terre).

**Élévation d'un point du relief** vu de l'observateur (courbure incluse), pour un point de hauteur `h_t` à distance au sol `d`,
observateur de hauteur `h_o`, `δ = d / R_REF` :

```
elev = atan2( (R_REF + h_t) * cos(δ) - (R_REF + h_o) ,  (R_REF + h_t) * sin(δ) )
```
Le masque à l'azimut `a` est le **maximum** de `elev` sur toutes les distances échantillonnées dans cette direction.

**Trajet sphérique** (point d'arrivée depuis `(lat, lon)`, azimut `a`, distance `d`, `δ = d / R_REF`) :
```
lat2 = asin( sin(lat)·cos(δ) + cos(lat)·sin(δ)·cos(a) )
lon2 = lon + atan2( sin(a)·sin(δ)·cos(lat) ,  cos(δ) - sin(lat)·sin(lat2) )
```

**Projection stéréographique polaire Sud** (sphère de rayon `R_REF`, échelle vraie au pôle, `λ0 = 0`) :
```
ρ = 2·R_REF·tan( (lat + 90°) / 2 )        # lat en degrés, négatif au Sud
x = ρ·sin(lon)    y = ρ·cos(lon)
```
> Cette convention (`lon 0` vers +y, `lon 90 E` vers +x) est celle **par défaut pour les données synthétiques**.
> Pour un MNT réel, les paramètres viennent de l'étiquette du fichier (`.LBL`) et **priment**.
> Vérifier la convention sur le produit réel est une étape obligatoire (`docs/BRANCHEMENT-DONNEES-REELLES.md`).

## 4. Arborescence du dépôt (état du 2026-11-15, après le lot V2)

```
Lunar Holocron/
├─ CLAUDE.md  PLAN.md  DECISIONS.md  STATUS.md  LIAISON.md  SOURCES.md  README.md
├─ docs/                       ARCHITECTURE, CONTRAT-DONNEES (1.2), PIPELINE, INTERFACE, TESTS-VALIDATION, VALIDATION-RESULTATS, BUILD-V2, ATLAS, SITES-REELS, REVUE-FICHIER-OR…
├─ config/
│   ├─ pipeline.json           période, pas de temps, distances d'horizon, taille des tuiles de terrain
│   ├─ sites_real.json         27 produits PGDA 5 m (SHA-256, centre d'emprise, étiquette de région NASA)
│   └─ catalog_features.json   entités IAU, missions (LROC), régions NASA, Apollo : chaque coordonnée a `sources[]`
├─ pipeline/                   (hors ligne ; Python ≥ 3.10)
│   ├─ cli.py                  commandes : build | validate
│   ├─ config.py  geodesy.py  projection.py  timegrid.py  visibility.py  horizon.py  kpi.py
│   ├─ dem.py  dem_geotiff.py  terrain_grid.py   MNT (MultiResDem 5 m + 80 m), lecture GeoTIFF, grille 3D d'un site
│   ├─ ephemeris_spice.py      Soleil/Terre via SPICE (seul moteur de production)
│   ├─ sites.py  catalog.py    sites 5 m réels, catalogue (entités, missions, régions, Apollo)
│   ├─ global_state.py         éphémérides globales de l'Atlas
│   ├─ polar_grid.py  polar_tiles.py   grille 480 m et pyramide de tuiles (240 / 160 / 80 m) du fond polaire
│   ├─ export.py  validate.py  schema/   écriture des JSON, contrôles du contrat
│   ├─ tools/                  fetch_pgda5m (téléchargement des produits 5 m), serve (serveur local sans cache), horizons_validate…
│   ├─ fixtures/               générateurs FICTIFS réservés aux tests (jamais importés par le produit : test AST)
│   └─ tests/
├─ tests/
│   ├─ golden/                 valeurs de référence partagées Python / JavaScript
│   ├─ reference/              recalculs indépendants (Horizons, croisements, couture 5 m / 80 m, illumination de Site01, tuiles) et leurs sorties
│   └─ e2e/smoke_cdp.mjs       test de fumée sans dépendance (Edge piloté par CDP)
├─ web/                        (application statique, aucune étape de compilation)
│   ├─ index.html  css/  vendor/ (three.js figé, polices, icônes : aucun CDN)
│   ├─ js/                     modules purs : constants, visibility, geometry, data, store, urlstate, i18n, freepoint, link, planner, bodies, terrainmesh, terrainring, timeline…
│   │   ├─ atlas/              cartes 2D, globe, marqueurs, relief, pyramide de tuiles, sonde, fiche des sites, couche Liaison
│   │   └─ ui/                 panneaux : verdict, panorama, frise, comparaison, point libre, liaison, planificateur, méthode…
│   ├─ data/                   sorties générées : index.json, global.json, sites/, terrain/, polar/ (grille 480 m + tuiles) ; budget de 60 Mo (Q-017)
│   └─ tests/                  node --test (fonctions pures, sans dépendance)
├─ data/raw/  data/cache/      ignorés par Git (MNT, noyaux SPICE)
└─ .gitignore  LICENSE (Apache-2.0)
```

## 5. Décisions d'architecture (résumé ; détail et dates dans DECISIONS.md)

- Application **statique** et **hors ligne** : fiabilité en démonstration, aucune panne réseau possible.
- Pipeline **hors ligne** : les calculs lourds sont faits une fois, l'application ne fait que lire et interpoler.
- Pas de moteur 3D à niveaux de détail (trop risqué en 48 h) : **un maillage régional par site**, 20 × 20 km.
- Contrat de données figé en premier, pour travailler en parallèle.
- Formules partagées et vérifiées par les mêmes valeurs de référence.
