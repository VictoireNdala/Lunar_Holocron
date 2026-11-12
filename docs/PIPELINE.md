# Pipeline de calcul (Python)

Rappels : conventions et formules dans `docs/ARCHITECTURE.md` §§ 2-3 ; format de sortie dans `docs/CONTRAT-DONNEES.md`.
Aucun accès réseau dans les calculs. Le téléchargement est isolé dans `pipeline/cli.py fetch` (mode réel uniquement).

## 1. Configuration

### `config/pipeline.json`
```json
{
  "period": { "start_utc": "2026-01-01T00:00:00Z", "end_utc": "2030-12-31T23:00:00Z", "step_s": 3600 },
  "horizon": {
    "az_step_deg": 1.0,
    "near_max_km": 25.0,
    "far_max_km": 150.0,
    "near_step_m": 20.0,
    "far_step_m": 120.0,
    "observer_height_m": 2.0
  },
  "terrain": { "size_m": 20000.0, "n": 257 },
  "ephemeris": { "engine": "demo-analytic" }
}
```
`engine` vaut `"demo-analytic"` (défaut tant qu'il n'y a pas de noyaux) ou `"spice"`.

### `config/sites.json`
Liste d'objets `{ id, name:{fr,en}, lat_deg, lon_deg, ground_height_m?, synthetic, verified, dem?, note? }`.

Sites de **démonstration** (toujours présents, `synthetic: true`, `verified: true`) :

| id | Latitude | Longitude | Terrain synthétique |
|---|---|---|---|
| `demo-a` | -89.0 | 0.0 | Cratère de 8 km de diamètre, rebord à +900 m, dorsale au nord |
| `demo-b` | -87.5 | 45.0 | Plateau avec massif de 1,8 km de haut à 12 km à l'est |
| `demo-c` | -88.3 | -120.0 | Terrain peu accidenté (cas « horizon bas ») |

Sites **réels candidats** (à ajouter seulement après vérification, `verified: false` tant que non confirmé dans une source citée dans `SOURCES.md`) :
Shackleton, de Gerlache, Haworth, Nobile, Malapert. **Les coordonnées ne sont pas écrites ici** : les récupérer dans le *Gazetteer of Planetary Nomenclature* (USGS)
ou la liste officielle des régions candidates Artemis, puis les consigner avec leur source. Ne jamais recopier de mémoire sans `verified: false`.

## 2. Modules

### `geodesy.py`
- `destination(lat_deg, lon_deg, az_deg, dist_m) -> (lat_deg, lon_deg)` : trajet sphérique (formule `ARCHITECTURE.md` § 3). Vectorisé (tableaux NumPy).
- `enu_basis(lat_deg, lon_deg) -> (east, north, up)` : trois vecteurs unitaires dans `MOON_ME` :
  ```
  up    = ( cosφ·cosλ,  cosφ·sinλ,  sinφ)
  east  = (    -sinλ,       cosλ,      0 )
  north = (-sinφ·cosλ, -sinφ·sinλ,  cosφ)
  ```
- `az_el_from_vector(v, east, north, up) -> (az_deg, el_deg)` : `az = atan2(v·east, v·north)` ramené dans [0, 360) ; `el = asin(v·up / |v|)`.
- `site_position_moon_me(lat_deg, lon_deg, height_m) -> vecteur (km ou m, unité documentée)` : `(R_REF + height) · up`.

### `projection.py`
- `lonlat_to_xy(lat_deg, lon_deg)` et `xy_to_lonlat(x_m, y_m)` : stéréographique polaire Sud (formules § 3 d'ARCHITECTURE). Aller-retour exact à 1e-6 m près.
- Le mode réel lit les paramètres de l'étiquette du MNT (`CenterLatitude`, `CenterLongitude`, rayon, éventuel facteur d'échelle) : la fonction prend un objet `PolarProjection` paramétrable.

### `dem.py`
Interface commune (classe de base `Dem`) :
- `height_m(lat_deg, lon_deg) -> np.ndarray` : hauteur au-dessus de `R_REF`, **interpolation bilinéaire**, `NaN` hors couverture ou pour les trous.
- `resolution_m` (float), `product` (str), `license` (str), `covers(lat_deg, lon_deg) -> bool array`.
- `MultiResDem([near, far])` : interroge `near` d'abord, retombe sur `far` si `NaN`.
- `RasterDem` (mode réel) : lecture **par fenêtres** via `rasterio` (jamais le fichier entier, un MNT à 20 m fait ~ 2 Go) ;
  `SCALING_FACTOR` et `OFFSET` sont **lus dans l'étiquette**, jamais écrits en dur. Voir `BRANCHEMENT-DONNEES-REELLES.md`.

### `dem_synthetic.py`
`make_synthetic_dem(kind: str, seed: int, resolution_m: float, center_lat, center_lon, half_size_km) -> Dem`.
Construit un terrain en coordonnées locales puis le rend interrogeable par `height_m`. **Déterministe** (graine fixe).
- `crater` : paraboloïde creusé + rebord gaussien + bruit fractal faible (amplitude ~ 20 m).
- `massif` : plateau + montagne gaussienne.
- `flat` : relief doux, amplitude < 80 m.
Le bruit fractal est un bruit de valeur multi-octaves écrit en NumPy (pas de dépendance).
Doit couvrir au moins `far_max_km` autour du site ; au-delà, `NaN` (pour exercer le drapeau `truncated`).

### `horizon.py`
`compute_horizon(dem, lat_deg, lon_deg, observer_height_m, cfg) -> (elev_deg[360], truncated[360])`

Algorithme (vectorisé : tous les azimuts × toutes les distances d'un coup, ou par bandes pour la mémoire) :
1. Hauteur de l'observateur : `h_o = dem.height_m(site) + observer_height_m`.
2. Distances d'échantillonnage : de `near_step_m` à `near_max_km` par pas de `near_step_m`, puis jusqu'à `far_max_km` par pas de `far_step_m`.
3. Pour chaque azimut entier `a` (0…359) et chaque distance `d` : point `(lat, lon) = destination(site, a, d)` ; `h_t = dem.height_m(lat, lon)`.
4. Élévation du point : `elev = atan2((R+h_t)·cos δ − (R+h_o), (R+h_t)·sin δ)`, `δ = d / R`.
5. `elev_deg[a] = max` des `elev` valides (les `NaN` sont ignorés). Si **aucun** point valide : `-90` et `truncated = true`.
6. `truncated[a] = true` si au moins un échantillon à l'azimut `a` est `NaN` **avant** `far_max_km` (le rayon est sorti du MNT).
7. Plancher : la valeur renvoyée n'est jamais inférieure à l'élévation du « sol plat à courbure » la plus proche (≈ 0 à -0,01°) — pas de traitement spécial,
   le maximum le fournit naturellement.
8. Arrondi final à 0,01°.

Complexité attendue : ≈ 360 × 2300 ≈ 830 000 lectures bilinéaires par site, quelques secondes en NumPy.

### `visibility.py`
- `visible_fraction(el_deg, radius_deg, horizon_deg)` : vectorisé, formule `ARCHITECTURE.md` § 3.
- `horizon_at(horizon_elev_deg, az_deg)` : interpolation linéaire avec bouclage.
- `is_visible(fraction, mode)` : `mode ∈ {"strict","any"}` ; `strict ⇒ fraction ≥ 0.5` ; `any ⇒ fraction > 0`.
Cette unité est **testée avec les valeurs de `tests/golden/visible_fraction.json`**, les mêmes que côté JavaScript.

### `ephemeris_spice.py` (mode réel)
Noyaux nécessaires (récupérés par `cli fetch`, rangés dans `data/raw/spice/`) :

| Rôle | Fichier (motif) |
|---|---|
| Secondes intercalaires | `naif0012.tls` (ou plus récent) |
| Éphémérides planétaires et Lune | `de440s.bsp` (1849–2150) |
| Orientation lunaire haute précision | `moon_pa_de440_*.bpc` |
| Définition du repère `MOON_ME` | `moon_de440_*.tf` |
| Constantes (rayons) | `pck00011.tpc` (facultatif ; on utilise nos constantes de `config.py`) |

Les noms exacts changent avec les versions : `fetch` doit **lister le répertoire NAIF et choisir par motif** (le plus récent), puis écrire le nom retenu
dans `provenance.ephemeris.kernels`. À vérifier au moment du téléchargement (le réseau n'était pas accessible pendant la rédaction).

Calcul, pour chaque instant `et` (`spiceypy.str2et` sur la liste des ISO UTC) :
1. `p_sun, _ = spiceypy.spkpos("SUN", et, "MOON_ME", "LT+S", "MOON")` (km, du centre de la Lune au centre du Soleil, dans `MOON_ME`). Idem `"EARTH"`.
   `spkpos` est vectorisable en tableau d'instants ; sinon boucle (≈ 88 000 appels, quelques secondes).
2. Vecteur du site au corps : `v = p_body − r_site` avec `r_site = (R_REF + h) · up` (en km). **Ne pas négliger la parallaxe pour la Terre** (≈ 0,26°).
3. `az, el = az_el_from_vector(v, east, north, up)`.
4. Rayon angulaire : `asin(R_corps / |v|)` avec `R_sun = 695 700 km`, `R_earth = 6 371,0 km` (rayon moyen). Converti en millidegrés.
5. Pas de réfraction (pas d'atmosphère).
Repère : `MOON_ME` (pas `IAU_MOON`, écart ≈ 0,03° ≈ 875 m de position de surface).

### `ephemeris_demo.py` (mode démonstration)
**Valeurs fictives mais plausibles, jamais présentées comme réelles** (`engine: "demo-analytic"`, `synthetic: true`).
Pour un site `(φ, λs)` et un temps `t` en jours depuis `2026-01-01T00:00Z` :
- Soleil : latitude subsolaire `δ(t) = 1,54° · sin(2π t / 346,62 + 0,7)` ; longitude subsolaire `λ_ss(t) = 40° − 360° · t / 29,530589` (décroît : le Soleil se déplace vers l'ouest) ;
  rayon angulaire constant 0,2665°.
- Terre : latitude sous-terrestre `b(t) = 6,7° · sin(2π t / 27,212 + 1,3)` ; longitude `l(t) = 7,9° · sin(2π t / 27,555 + 2,1)` ; rayon 0,95°. Pas de parallaxe.
- Pour un corps de direction `(δ, λ_c)` : `Δλ = λ_c − λs` ;
  `sin(el) = sinφ·sinδ + cosφ·cosδ·cosΔλ` ;
  `az = atan2( cosδ·sinΔλ , cosφ·sinδ − sinφ·cosδ·cosΔλ )` ramené dans [0, 360).
- Aucun aléa : mêmes entrées, mêmes sorties.

### `kpi.py`
- Entrées : horizon, séries `az/el/radius` des deux corps, `count`, `start_utc`.
- Fractions : `f = visible_fraction(el, radius, horizon_at(az))` pour chaque corps et chaque instant.
- Indicateurs et bilan mensuel : définitions exactes dans `CONTRAT-DONNEES.md` §§ 4-5.
- Intervalles : détection vectorisée des transitions (`np.diff` sur le masque booléen). Cas limites testés : série entièrement visible, entièrement masquée,
  intervalle en début ou en fin de période.

### `export.py`
- Écrit `web/data/sites/<id>.json` (JSON compact : `separators=(",", ":")`, clés triées, `ensure_ascii=False`, saut de ligne final), `terrain/<id>.json` + `.bin`, `index.json`.
- Génère la grille de terrain 3D : pour chaque nœud `(E, N)` de la grille, distance `d = hypot(E,N)`, azimut `atan2(E,N)`, point `destination(site, az, d)`,
  hauteur du MNT, puis `z = (R+h)·cos(d/R) − (R+h_site)`. Quantification `uint16` linéaire sur `[min, max]` (calculés sur la grille), little-endian.
- Si le MNT est `NaN` sur un nœud : remplacer par la valeur du voisin valide le plus proche, et compter les nœuds remplacés (affiché dans les logs, et `provenance.dem.filled_nodes`).

### `cli.py`
| Commande | Action |
|---|---|
| `demo` | Génère tous les sites `synthetic: true` de `config/sites.json` en mode démonstration, puis valide. |
| `fetch` | Télécharge les noyaux SPICE et les MNT listés dans la config (mode réel). Ne s'exécute jamais dans les tests. |
| `build --site ID [--engine spice\|demo-analytic]` | Construit un site (ou `--all`). |
| `validate` | Applique les contrôles de `CONTRAT-DONNEES.md` § 7 à `web/data/`. Code de sortie non nul en cas d'erreur. |

Chaque commande affiche un résumé : sites traités, durée, taille des fichiers, drapeaux `truncated` à vrai (nombre d'azimuts).

## 3. Indicateurs P1 (après le noyau)

- **Pente** : sur le MNT, pente maximale sur une base de 100 m autour du site ; pastille « pente < 10° » (critère de sélection Artemis cité dans l'étude préalable).
- **Distance au pôle** : pastille « à moins de 6° du pôle ».
- **Prochaine fenêtre** « Soleil et Terre visibles » : calculée dans l'interface à partir des séries (pas dans le pipeline).
- **Export CSV** des séries (`time_utc, sun_az_deg, sun_el_deg, earth_az_deg, earth_el_deg, sun_f, earth_f`) depuis l'interface.

## 4. Limites à écrire dans la page « Sources et méthode »

1. Échantillonnage horaire : des événements plus courts qu'une heure ne sont pas vus.
2. Horizon pris au seul azimut du centre du disque.
3. MNT : résolution et couverture limitées ; `truncated` indique les azimuts où le masque est un minorant.
4. Pas de modélisation de la poussière, de la lumière diffuse ni du rayonnement thermique.
5. La visibilité de la Terre est géométrique : elle ne dit rien de la disponibilité d'une station au sol (DSN) ni de la marge de liaison.
6. Définitions strict/optimiste : choix documentés, pas des vérités.
