# Contrat de données (version 1.1)

C'est la **seule interface** entre le pipeline et l'application. Toute modification passe par le processus décrit à la fin.
Le schéma exécutable est `pipeline/schema/site.schema.json` (à écrire en T-01 d'après ce document). Ce document fait foi en cas de doute.

## 1. Fichiers produits (dans `web/data/`)

| Fichier | Rôle | Taille visée |
|---|---|---|
| `index.json` | Liste des sites disponibles | < 10 Ko |
| `sites/<id>.json` | Horizon, séries Soleil/Terre, indicateurs d'un site | < 700 Ko compressé (≤ 2,5 Mo brut) |
| `terrain/<id>.json` | Métadonnées de la grille de terrain 3D | < 5 Ko |
| `terrain/<id>.bin` | Hauteurs de la grille, `uint16` | 257² × 2 o ≈ 132 Ko |

`<id>` : minuscules, chiffres et tirets (`demo-a`, `shackleton`). Identique dans les trois fichiers et dans l'index.

## 2. `index.json`

```json
{
  "schema_version": "1.0",
  "generated_utc": "2026-11-12T21:00:00Z",
  "synthetic": true,
  "sites": [
    {
      "id": "demo-a",
      "name": { "fr": "Site de démonstration A", "en": "Demo site A" },
      "lat_deg": -89.0,
      "lon_deg": 0.0,
      "synthetic": true,
      "verified": true,
      "site_file": "sites/demo-a.json",
      "terrain_file": "terrain/demo-a.json"
    }
  ]
}
```
- `synthetic` (racine) vaut `true` si **au moins un** site est synthétique.
- `verified` : `false` si les coordonnées ont été écrites de mémoire et pas encore vérifiées dans une source.

## 3. `sites/<id>.json`

```json
{
  "schema_version": "1.0",
  "id": "demo-a",
  "name": { "fr": "...", "en": "..." },
  "synthetic": true,

  "location": {
    "lat_deg": -89.0,
    "lon_deg": 0.0,
    "ground_height_m": 0.0,
    "observer_height_m": 2.0,
    "frame": "MOON_ME",
    "r_ref_m": 1737400.0
  },

  "provenance": {
    "dem": { "product": "SYNTHETIC", "resolution_m": 20.0, "source": null, "license": "n/a" },
    "ephemeris": { "engine": "demo-analytic", "kernels": [], "abcorr": null },
    "pipeline_version": "0.1.0",
    "generated_utc": "2026-11-12T21:00:00Z"
  },

  "horizon": {
    "az_step_deg": 1.0,
    "elev_deg": [ /* 360 flottants, index i = azimut i degrés */ ],
    "truncated": [ /* 360 booléens : le rayon a quitté la zone couverte par le MNT avant la distance maximale */ ],
    "max_distance_km": 150.0
  },

  "time": { "start_utc": "2026-01-01T00:00:00Z", "step_s": 3600, "count": 43824 },

  "bodies": {
    "sun":   { "az_mdeg": [ /* count entiers */ ], "el_mdeg": [ ], "radius_mdeg": [ ] },
    "earth": { "az_mdeg": [ ], "el_mdeg": [ ], "radius_mdeg": [ ] }
  },

  "kpis": { /* § 4 */ },
  "monthly": [ /* § 5 */ ]
}
```

### Règles

- `time.count` = nombre d'échantillons ; **toutes** les listes de `bodies` ont exactement `count` éléments. Pas de valeur manquante.
- Période par défaut : `2026-01-01T00:00:00Z` à `2030-12-31T23:00:00Z` inclus, pas de 3600 s, soit **43 824** échantillons (2028 est bissextile).
- Séries en **millidegrés entiers** : `az_mdeg` dans [0, 360000), `el_mdeg` dans [-90000, 90000], `radius_mdeg` > 0.
  Le rayon est en millidegrés car 0,01° donnerait une erreur de 3,7 % sur le rayon du Soleil (≈ 0,266°).
- `horizon.elev_deg` : degrés, arrondis à 0,01. `horizon.truncated[i] = true` signale que le masque à cet azimut est un **minorant**.
  L'interface affiche un avertissement si ce drapeau est vrai à l'azimut d'un corps.
- Le tableau `horizon.elev_deg` est **indépendant du temps** (relief fixe).
- Les noms `name` contiennent au moins `fr` et `en` ; `sw` (swahili) est optionnel.
- `provenance.generated_utc` : valeur **fixée par la configuration** (`config/pipeline.json` → `build_utc`), jamais l'horloge, pour garder des sorties identiques octet pour octet (D-013).

### Lecture côté application

Pour un instant `t` (ms UTC) : `i = (t - start) / (step_s * 1000)` ; interpolation linéaire entre `floor(i)` et `ceil(i)` ;
pour l'azimut, interpoler l'angle **déroulé** (ajouter ou retrancher 360000 mdeg si l'écart dépasse 180000). Hors période : ne pas extrapoler,
borner et signaler « date hors de la période couverte ».

## 4. `kpis`

Calculés par `pipeline/kpi.py` sur **toute la période** à partir des fractions visibles aux 43 824 échantillons.

```json
"kpis": {
  "window": { "start_utc": "...", "end_utc": "..." },
  "sun": {
    "strict": { "visible_pct": 0.0, "longest_gap_h": 0.0, "n_gaps": 0 },
    "any":    { "visible_pct": 0.0, "longest_gap_h": 0.0, "n_gaps": 0 }
  },
  "earth": {
    "strict": { "visible_pct": 0.0, "longest_gap_h": 0.0, "n_gaps": 0 },
    "any":    { "visible_pct": 0.0, "longest_gap_h": 0.0, "n_gaps": 0 }
  },
  "both": {
    "strict": { "visible_pct": 0.0, "longest_gap_h": 0.0, "n_gaps": 0 },
    "any":    { "visible_pct": 0.0, "longest_gap_h": 0.0, "n_gaps": 0 }
  },
  "sun_el_deg":   { "min": 0.0, "max": 0.0 },
  "earth_el_deg": { "min": 0.0, "max": 0.0 }
}
```

Définitions :
- `visible_pct` = 100 × (nombre d'échantillons visibles) / `count`.
- « visible » : seuil **strict** ⇒ `f ≥ 0,5` ; seuil **any** (optimiste) ⇒ `f > 0` (formules : `ARCHITECTURE.md` § 3).
- `both` : Soleil **et** Terre visibles au même échantillon, avec le même seuil.
- **Intervalle d'absence** (« gap ») : suite maximale d'échantillons consécutifs **non visibles**.
  `longest_gap_h` = durée du plus long intervalle en heures (nombre d'échantillons × 1 h). `n_gaps` = nombre d'intervalles.
  Un intervalle qui touche le début ou la fin de la période est compté (il est tronqué : le préciser dans la page méthode).
- `sun_el_deg` / `earth_el_deg` : min et max de l'élévation du centre sur la période, en degrés.

## 5. `monthly`

Liste triée par mois, une entrée par mois civil UTC couvert (60 entrées pour 2026-2030) :

```json
{ "ym": "2026-11", "sun_strict_pct": 0.0, "earth_strict_pct": 0.0, "both_strict_pct": 0.0 }
```
Pourcentage sur les échantillons du mois. Sert à la carte de chaleur et au conseil « et si on décale ? ».

## 6. `terrain/<id>.json` et `.bin`

```json
{
  "schema_version": "1.0",
  "id": "demo-a",
  "synthetic": true,
  "center": { "lat_deg": -89.0, "lon_deg": 0.0 },
  "grid": { "n": 257, "size_m": 20000.0, "spacing_m": 78.125 },
  "frame": "local-enu",
  "z": {
    "encoding": "uint16-linear",
    "min_m": -250.0,
    "max_m": 1800.0,
    "file": "demo-a.bin",
    "byte_order": "little",
    "row_order": "north-to-south",
    "col_order": "west-to-east"
  }
}
```
- Grille carrée de `n × n` points, centrée sur le site, côté `size_m`. Ligne 0 = nord, colonne 0 = ouest.
- `spacing_m = size_m / (n - 1)`.
- Valeur décodée : `z_m = min_m + (v / 65535) × (max_m - min_m)`.
- `z_m` est la **hauteur verticale locale** du point par rapport au plan tangent au site, **courbure incluse** :
  `z = (R_REF + h) · cos(d / R_REF) − (R_REF + h_site)` avec `d` = distance au sol depuis le site et `h` la hauteur du MNT en ce point.
  (À 10 km du site la courbure vaut ≈ 29 m : indispensable de l'inclure.)
- Position horizontale du sommet : `(E, N)` de la grille.

## 7. Validations obligatoires (pipeline `validate` et chargement JavaScript)

1. `schema_version` : le **majeur** doit être connu (`1`). Sinon l'interface affiche une erreur claire et ne plante pas.
2. Longueurs : `horizon.elev_deg` et `horizon.truncated` = 360 ; chaque série de `bodies` = `time.count`.
3. Plages : azimuts dans [0, 360000), élévations dans [-90000, 90000], rayons > 0, `visible_pct` dans [0, 100].
4. Cohérence : `index.json` ne référence que des fichiers existants ; `id` identique partout.
5. `synthetic` : si `provenance.dem.product == "SYNTHETIC"` ou `provenance.ephemeris.engine == "demo-analytic"`, alors `synthetic` **doit** être `true`.
6. Les indicateurs `kpis` sont **recalculables** à partir des séries : `validate` les recalcule et compare (tolérance 1e-9).

## 7 bis. Version 1.1 : champs optionnels (D-021)

Ajoutés sans rien retirer (l'interface ignore les champs inconnus ; un fichier 1.0 reste valide) :
- `sites/<id>.json` et chaque entrée de `index.json` : **`terrain_real`** (le relief vient d'un MNT réel) et **`ephemeris_synthetic`** (les positions du Soleil et de la Terre sont fictives). Deux drapeaux distincts, pour ne pas mentir par omission (D-016). Règle : `synthetic` = `ephemeris_synthetic` OU NON `terrain_real` ; `ephemeris_synthetic` est vrai si et seulement si `provenance.ephemeris.engine == "demo-analytic"`.
- Entrée d'index : **`tier`** (entier, ordre de construction, D-016), **`lola_priority_site`** (booléen) et **`nasa_2024_region`** (texte ou `null`) (D-018), **`pgda_id`** (texte).
- `provenance.dem` peut porter `citation` et `filled_nodes`.
- **`web/data/global.json`** (Atlas, A-03, facultatif) : points sub-solaire et sub-terrestre sur la même période et le même pas que les sites (`time.t0_utc`, `step_s`, `n`), `lat_mdeg`, `lon_mdeg` (dans [-180000, 180000)) et `radius_mdeg` entiers pour `sun` et `earth`, avec `synthetic` et `provenance.ephemeris` ; schéma `global.schema.json`, vérifié par `validate` (longueurs = `time.n`, `synthetic` cohérent avec le moteur). Même vecteur Lune vers corps que les séries de site. Spécification : `docs/ATLAS.md` § 3.3.
- **Seuil « any »** : `is_visible(f, 'any')` dépend de la fraction visible `f` (> 0), pas de l'écart d'élévation `d` : pour `d` à peine supérieur à `-r`, `f` peut s'arrondir à 0 en double précision (sans effet pratique).

## 7 ter. Version 1.2 : catalogue étendu (D-026), champs optionnels

Ajoutés sans rien retirer (un fichier 1.0 ou 1.1 reste valide ; l'interface ignore les champs inconnus). Présents dans `sites/<id>.json` **et** dans chaque entrée de `index.json` :
- **`kind`** : `lola_site` (produit PGDA 78 à 5 m) · `feature` (entité nommée, nomenclature IAU) · `nasa_region` · `mission` · `apollo`. (`custom` est réservé au point libre du navigateur, D-027 : **interdit** dans tout fichier de site, vérifié par `validate`.)
- **`position_basis`** : d'où vient la coordonnée (`dem_center` : centre de l'emprise du GeoTIFF ; `feature_center` : centre de l'entité d'après sa fiche IAU ; `apollo_nssdc` : module lunaire d'après le NSSDC).
- **`approximate`** (booléen) et **`position_uncertainty_km`** (rayon de l'entité, pour dessiner l'empreinte) ; **`status`** (`landed` · `planned` · `failed` · `candidate` · `reference`) ; **`mission`** (texte) ; **`interest[]`** (`{kind, ref}` : `h_enhanced`, `psr`, `illumination`, `dte`, `lcross`, avec la référence ; jamais « contient de l'eau »).
- **`sources[]`** : `{label, url, read_utc}`. **Une coordonnée n'entre au catalogue que si sa source est citée** (le pipeline refuse l'entrée sinon).
- **`terrain_tier`** : `5m` (MNT PGDA 78, `provenance.dem.resolution_m == 5` vérifié) · `80m` (LDEM polaire 80 m, partout au sud de 80° S) · `flat` (relief **non modélisé**).
- **`terrain_modeled`** (booléen). Un site `flat` a `terrain_modeled: false` **et** `terrain_real: false`, mais `synthetic: false` : **un relief non modélisé n'est pas un relief fictif**. Règle de 1.2 : `synthetic` = `ephemeris_synthetic` OU (NON `terrain_real` ET `terrain_modeled`). `provenance.dem.resolution_m` peut valoir 0 (pas de MNT).
- Le niveau `tier` de l'index (entier) devient : 1 = sites prioritaires LOLA, 3 = entités nommées, 4 = sites Apollo (ordre de tri et de visite).
- **`footprint_half_km`** (entrée d'`index.json`, optionnel, 1.2, sites `5m`) : demi-côté en km du **carré** du MNT 5 m réellement utilisé (moitié de la plus petite dimension du GeoTIFF, plafonnée à 8,5 km, la fenêtre de lecture) : 8,0 pour les produits de 16 km, 8,5 pour ceux de 20 km. Le carré est aligné sur les axes du plan stéréographique polaire (y = longitude 0°). Sert à dessiner l'empreinte réelle sur les cartes.
- **`link_bits`** (entrée d'`index.json`, optionnel, 1.2) : visibilité horaire **stricte** du Soleil et de la Terre, `{ encoding: "bitset-lsb-first-base64", mode: "strict", n, sun_strict, earth_strict }` (bit 0 = premier échantillon, poids faible d'abord ; 5 478 octets par corps pour 43 824 heures). Sert à la couche « Liaison » de l'Atlas sans charger les fichiers de site. **`validate` le recalcule** depuis le fichier de site et refuse tout écart.
- Azimuts `truncated` : au nord de 80° S le LDEM ne couvre plus le disque de 150 km ; les azimuts concernés sont marqués (minorant), pas masqués.

## 7 quater. Pyramide de tuiles du fond polaire (`polar/tiles.json`, M-051 § 2.2)

Dérivé du LDEM 80 m (PGDA 90), hors des fichiers de site, **optionnel** (sans elle l'interface garde la grille 480 m). Manifeste `polar/tiles.json` : `tile` (`core_px` 128, `border_px` 2, `stored_px` 132, chemin `tiles/{spacing_m}/{tx}_{ty}.bin`), `z` (`min_m`, `max_m`, `nodata_code` 65535, `max_code` 65534), `levels[]` (`spacing_m` 240 / 160 / 80, `x0_m`, `y0_m` : centre de l'échantillon (0, 0) dans le plan stéréographique polaire Sud, `n_rows`, `n_cols`, `window_half_km`, `tiles` : liste des `[tx, ty]` existants, `bytes`) et `total_bytes`. Un niveau ne couvre que des **fenêtres autour des sites** du catalogue (±40 km à 240 m, ±20 km à 160 m, ±10 km à 80 m) ; ailleurs, le repli est un niveau plus grossier puis la grille 480 m. Tuile = 132 × 132 codes uint16 linéaires (cœur 128 + bordure de 2 échantillons, pour des gradients sans couture) ; codage : différences horizontales modulo 65536, octets de poids faible puis de poids fort séparés, deflate brut (RFC 1951). `tx` croît vers l'est (x), `ty` vers le sud (y décroissant). Reproductible octet pour octet ; décodage JavaScript = décodage Python vérifié sur 9 tuiles réelles.

## 8. Évolution du contrat

- Ajouter un champ **optionnel** : version mineure (`1.1`), l'interface ignore les champs inconnus.
- Modifier ou retirer un champ existant : version majeure (`2.0`).
- Dans les deux cas, dans le **même commit** : ce document, le schéma, `export.py`, `data.js`, les tests, et une ligne dans `DECISIONS.md`.
