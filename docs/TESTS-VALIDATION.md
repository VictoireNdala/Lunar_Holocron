# Tests et validation

Principe : on distingue **tests** (le code fait ce qu'on a spécifié) et **validation** (ce qu'on a spécifié correspond à la réalité physique).
Les tests tournent sans réseau et sans données NASA. La validation exige les données réelles (§ 6).

Valeurs de référence : fichiers dans `tests/golden/`, lus par **pytest et par `node --test`** (même contenu, deux implémentations).
Les valeurs ci-dessous ont été calculées à la main avec les formules de `ARCHITECTURE.md` § 3 ; les recalculer indépendamment avant de s'y fier est un bon réflexe.

## 1. Fraction visible — `tests/golden/visible_fraction.json`

Rayon `r = 0,27°`, `d = el − h` (degrés). Tolérance absolue 1e-6.

| `d` (°) | `f` attendue | Remarque |
|---|---|---|
| 0,27 | 1,000000 | disque entièrement au-dessus |
| 0,135 | 0,804499 | |
| 0,0675 | 0,657481 | |
| 0,0 | 0,500000 | centre exactement sur l'horizon |
| -0,0675 | 0,342519 | |
| -0,135 | 0,195501 | |
| -0,27 | 0,000000 | disque tangent, entièrement sous l'horizon |
| 0,5 | 1,000000 | saturation |
| -0,5 | 0,000000 | saturation |

Propriétés à tester en plus : monotonie croissante en `d` ; symétrie `f(d) + f(−d) = 1` ; `strict` ⇔ `d ≥ 0` ; `any` ⇔ `d > −r` ; `r` très petit (1e-9) ne produit ni `NaN` ni division par zéro.

## 2. Masque d'horizon (`pipeline/tests/test_horizon.py`)

Constantes : `R_REF = 1 737 400 m`, observateur de hauteur 0 sauf indication.

1. **Sol parfaitement lisse** (hauteur 0 partout) : le masque vaut `-(δ_min)/2` en radians avec `δ_min = near_step_m / R_REF`, soit ≈ -0,0003° ; on exige `|masque| < 0,01°` à tous les azimuts.
2. **Marche verticale** (plateau de hauteur `H` commençant à la distance `D`, dans un seul secteur d'azimut, sol à 0 ailleurs) :
   le **masque** dans ce secteur vaut `degrés(atan2((R+H)·cos(D/R) − R, (R+H)·sin(D/R)))`. Tolérance 0,005° (pas d'échantillonnage).

   | `H` (m) | `D` (m) | masque attendu (°) |
   |---|---|---|
   | 2000 | 20000 | 5,377488 |
   | 2000 | 50000 | 1,464689 |
   | 500 | 5000 | 5,627328 |

   Hors du secteur du plateau, le masque reste ≈ 0 (voir le test 1).
2 bis. **Fonction d'élévation d'un point** (test unitaire direct de la formule, hors masque, observateur à 0 m). Ces cas négatifs ne se testent pas au niveau du masque,
   car le masque est un **maximum** et le sol proche (≈ 0°) l'emporte :

   | `h_t` (m) | `d` (m) | élévation du point (°) |
   |---|---|---|
   | 1000 | 100000 | -1,076279 |
   | 0 | 10000 | -0,164889 |
   | 0 | 100000 | -1,648894 |

   Elles contrôlent la courbure seule : à 100 km, un sol à la hauteur de l'observateur est vu 1,65° **sous** l'horizon géométrique.
3. **Convention d'azimut** : une montagne isolée **au nord** du site donne un pic du masque à `az ≈ 0°` ; **à l'est** : pic à `≈ 90°` ; **au sud** : `≈ 180°` ; **à l'ouest** : `≈ 270°`.
   Ce test bloque la confusion la plus fréquente (azimut mesuré depuis l'est, ou sens trigonométrique).
4. **Symétrie** : cratère de révolution centré sur le site : écart-type du masque sur les 360 azimuts < 0,02°.
5. **Drapeau `truncated`** : un MNT qui s'arrête à 60 km avec `far_max_km = 150` donne `truncated = true` à tous les azimuts ; un MNT qui couvre 160 km : `false` partout.
6. **Trous `NaN`** : un trou dans le MNT n'efface pas le masque (le maximum ignore les `NaN`) ; un site entièrement hors MNT donne `-90` et `truncated = true`.
7. **Bouclage** : `horizonAt(h, 359.5)` interpole entre `h[359]` et `h[0]` (pas entre `h[359]` et `h[360]` inexistant).

## 3. Géodésie et projection (`test_geodesy.py`, `test_projection.py`)

Avec `R_REF = 1 737 400 m` ; 1° d'arc = `30 323,35 m`.

| Départ (lat, lon) | Azimut | Distance | Arrivée attendue |
|---|---|---|---|
| (-89, 0) | 0° (nord) | 1° d'arc | lat = -88,000000, lon = 0,000000 |
| (-89, 0) | 90° (est) | 1° d'arc | lat ≈ -88,585822, lon ≈ 45,004364 |
| (-89, 0) | 270° (ouest) | 1° d'arc | lat ≈ -88,585822, lon ≈ -45,004364 |
| (-89, 0) | 180° (sud) | 2° d'arc | lat ≈ -89,000000, lon = ±180 (passage par le pôle) |

Projection stéréographique polaire Sud (convention par défaut, `lon 0` vers +y), tolérance 0,01 m :

| (lat, lon) | x (m) | y (m) |
|---|---|---|
| (-90, 0) | 0 | 0 |
| (-89, 0) | 0 | 30 324,12 |
| (-89, 90) | 30 324,12 | 0 |
| (-89, 180) | 0 | -30 324,12 |
| (-89, -90) | -30 324,12 | 0 |
| (-85, 45) | 107 277,323 | 107 277,323 |

Aller-retour `lonlat → xy → lonlat` : erreur < 1e-9° sur 1000 points aléatoires (graine fixe) entre -90° et -80°.
Base ENU : `east·north = 0`, `|east| = |north| = |up| = 1`, `east × north = up` (à 1e-12).

## 4. Éphémérides

### Mode démonstration (`test_ephemeris_demo.py`)
- Déterminisme : deux exécutions donnent des tableaux identiques.
- Plages : `|el_sun| ≤ 1,54° + marge` à `lat = -89,99` ; `|el_earth| ≤ 6,7° + marge` ; périodicité du Soleil ≈ 29,53 j (pic de l'autocorrélation de l'azimut), de la Terre ≈ 27,2 à 27,6 j.
- Rayons constants (0,2665° et 0,95°) convertis en millidegrés entiers.

### Mode réel SPICE (`test_ephemeris_spice.py`, marqué `@pytest.mark.spice`, ignoré si les noyaux sont absents)
Contrôles de plausibilité **indépendants de toute référence externe**, à `lat = -89,99`, sur toute la période :
- `max |el_sun| < 1,8°` (obliquité de l'équateur lunaire sur l'écliptique ≈ 1,54°, plus le rayon angulaire et une marge).
- `max |el_earth| < 7,6°` (libration en latitude ≈ ±6,7°, plus parallaxe ≈ 0,26°).
- Nombre de changements de signe de `el_earth` sur 5 ans compris entre 120 et 145 (≈ 2 par période de 27,2 j ; **indicatif** : ajuster seulement après vérification manuelle).
- Rayon angulaire du Soleil entre 0,262° et 0,274° ; de la Terre entre 0,89° et 1,05°.
- Comparaison `MOON_ME` vs `IAU_MOON` : l'écart de position de surface est ≈ 875 m (~ 0,03° d'orientation) ; vérifier qu'on utilise bien `MOON_ME`.

## 5. Intégration

- `test_kpi.py` : séries synthétiques construites à la main (toujours visible ; jamais visible ; alternance 1 h oui / 1 h non ; intervalle collé au début ; intervalle collé à la fin ;
  trou unique de 24 h) ; vérifier `visible_pct`, `longest_gap_h`, `n_gaps`, `both`, et le total des mois = `count`.
- `test_export.py` : relecture des fichiers écrits ; décodage `uint16` → `z_m` (erreur < `(max−min)/65535`) ; longueurs ; `index.json` cohérent ; `synthetic` propagé.
- `test_schema.py` : un JSON valide passe ; un JSON avec une longueur fausse, un azimut ≥ 360000, un `schema_version` inconnu échoue avec un message clair.
- `test_demo_end_to_end.py` : `python -m pipeline.cli demo` produit les trois sites ; `validate` retourne 0 ; deux exécutions donnent des fichiers **identiques octet pour octet**.
- Tests JavaScript (`web/tests/`) : `visibility.test.js` (mêmes valeurs d'or), `geometry.test.js` (déroulement d'azimut, `enuToThree`), `data.test.js` (`bodyStateAt` : interpolation, saut 359°→1°, bornes de période),
  `urlstate.test.js` (aller-retour, valeurs invalides ignorées).
- **Accord Python/JavaScript** : un fichier `tests/golden/body_state_cases.json` donne, pour un site de démonstration, 20 instants et les `(az, el, radius, f_sun, f_earth)` attendus ;
  pytest ET `node --test` doivent le satisfaire (tolérance 0,001°). Ce fichier est régénéré par le pipeline (`cli demo --write-golden`) puis **relu par un humain** avant d'être figé.
- Test de fumée Playwright (`tests/e2e/smoke.spec.ts`) : charger l'application servie en local ; attendre la bannière « DONNÉES DE DÉMONSTRATION » ; aucun `console.error` ;
  vue 3D affichée (pixels non uniformes dans le canvas) ; déplacer le curseur change l'élévation affichée ; basculer strict/optimiste change au moins un indicateur ; capture d'écran enregistrée.

## 6. Validation scientifique (à faire quand les données réelles sont branchées)

Ces contrôles ne se simulent pas : ils nécessitent des sources externes. Résultats à publier dans la page « Sources et méthode ».

1. **Éphémérides vs Horizons** : pour 3 sites et 3 dates (hors minuit pour éviter les cas limites), relever à la main dans l'interface web Horizons l'azimut et l'élévation
   du Soleil et de la Terre, et les consigner dans `tests/reference/horizons_samples.json` avec la date de consultation et les paramètres (centre sur site lunaire, géodésique,
   sans réfraction). Écart attendu faible (quelques centièmes de degré) ; documenter les causes d'écart (repère, correction d'aberration).
2. **Illumination et visibilité Terre vs PGDA (produit 69)** : comparer `sun_*` et `earth_*` de nos sites avec les cartes de moyennes sur 18,6 ans (résolution 60 à 240 m).
   Attendus : **même classement des sites**, valeurs du même ordre. Les écarts sont **normaux** (définition de la Terre « visible » plus optimiste chez PGDA, période différente,
   résolution) : les expliquer, ne pas les cacher.
3. **Masque d'horizon vs un outil officiel** : pour 2 sites, comparer au résultat de l'outil de ligne de vue ou d'ombres de Moon Trek / QuickMap à quelques dates
   (observation visuelle documentée par capture). Objectif : détecter une erreur grossière de convention (azimut, hauteur d'œil).
4. **Sensibilité** : refaire un site avec un MNT à plus basse résolution (ex. 80 m au lieu de 20 m) et noter l'effet sur les indicateurs : c'est l'incertitude d'échantillonnage du MNT à afficher.
5. **Registre** : un tableau `site / date / grandeur / notre valeur / valeur de référence / écart / commentaire` dans `docs/VALIDATION-RESULTATS.md`.

## 7. Revue par un agent vérificateur

À chaque tâche terminée, un agent distinct du constructeur relit selon cette liste et écrit ses constats dans `STATUS.md` :
- Azimut : 0 = Nord, sens horaire. Élévation : au-dessus du plan horizontal local. Aucune confusion avec colatitude ou angle zénithal.
- Unités dans les noms ; millidegrés entiers dans les séries ; pas de mélange degrés/radians.
- Latitude négative au Sud ; longitude Est positive ; bouclage ±180.
- Même formule de fraction visible en Python et en JS (tests d'or verts).
- Rien de réseau dans l'application ; rien de réel affiché sans drapeau correct.
- Cas limites : 359°→0°, minuit UTC, premier et dernier échantillon, `NaN`.
