# Résultats de validation (T-24, en cours)

> Ce document ne contient que des **résultats mesurés**, avec la commande qui les produit. Ce qui n'est pas encore validé est listé en fin de page.

## 1. Soleil et Terre : SPICE contre JPL Horizons

**Ce qui est comparé.** Azimut et élévation **apparents** du centre du Soleil et de la Terre, vus d'un site à la surface de la Lune (hauteur 0), toutes les heures UTC d'un jour entier.
- Notre chaîne : `pipeline/ephemeris_spice.py`, SPICE, noyau `de440s.bsp`, `spkpos(…, "MOON_ME", "LT+S", "MOON")`.
- Référence : JPL Horizons (DE441), `CENTER='coord@301'`, `QUANTITIES='4'`, repère MEAN_ME, Lune sphérique de 1 737,4 km, sans réfraction (paramètres exacts : `docs/INVENTAIRE-DONNEES.md` § 3.2).

**Étendue.** 5 sites (le point de référence de CHAT à 129,5° E / −89,67°, et les centres des 4 sites réels Site01, Site04, Site07, Site11) × 3 dates (2026-12-21, 2028-06-15, 2030-09-10) × 2 corps × 24 instants = **30 cas, 720 échantillons (360 par corps), chacun avec un azimut et une élévation : 1 440 valeurs comparées**.

**Commande.** `py -m pipeline.tools.horizons_validate` interroge l'API d'Horizons (lecture seule, seules des coordonnées et des dates sont envoyées), garde les réponses brutes dans `data/cache/horizons/` (hors Git) et écrit `tests/reference/horizons_validation.json` (versionné, 78 Ko, relevé le 2026-11-14). Le test `pipeline/tests/test_horizons_validation.py` relit ce fichier **sans réseau**.

**Résultats (écart maximal sur les 24 instants de chaque cas).**

| Corps | Grandeur | Écart maximal mesuré | Tolérance du test | Remarque |
|---|---|---|---|---|
| Soleil | azimut | 5,2·10⁻⁷ ° | 1,5·10⁻⁶ ° | Horizons imprime 6 décimales : 5·10⁻⁷ ° est l'arrondi de la référence ; l'écart mesuré est donc **à la limite de la précision de la référence** |
| Soleil | élévation | 5,0·10⁻⁷ ° | 1,5·10⁻⁶ ° | idem |
| Terre | azimut | 9,0·10⁻⁷ ° | 2·10⁻⁶ ° | |
| Terre | **élévation** | **2,44·10⁻⁵ °** (≈ 0,09″) | 5·10⁻⁵ ° | **Écart réel, supérieur à l'arrondi** ; voir ci-dessous |

Les tolérances valent environ **deux fois l'écart maximal mesuré** de chaque catégorie. Elles ne sont pas des valeurs présumées : si elles étaient desserrées, le test cesserait de protéger quoi que ce soit.

**L'écart d'élévation de la Terre.** Il vaut 1,8·10⁻⁵ ° (2026-12-21), 2,4·10⁻⁵ ° (2028-06-15) et 1,1·10⁻⁵ ° (2030-09-10), **identique à 5 % près sur les 5 sites** : il dépend de la **date**, pas du lieu. L'azimut de la Terre et les deux angles du Soleil, eux, sont à l'arrondi. **Cause non établie.** Hypothèse non vérifiée : Horizons applique la déviation relativistique de la lumière par le Soleil (« Rel. light bend: Sun, EARTH » dans l'en-tête de sa réponse), que `LT+S` de SPICE n'inclut pas ; elle dépend de l'élongation Terre–Soleil vue de la Lune, donc de la phase, donc de la date. Pour trancher il faudrait recalculer la déviation ou comparer avec une option SPICE sans correction. **Impact** : 2,4·10⁻⁵ ° est environ 40 000 fois plus petit que le rayon angulaire de la Terre (0,97°) ; une erreur d'élévation de cet ordre ne peut changer le verdict d'un jour de visibilité que si le corps est à moins de 10⁻⁴ ° de l'horizon, et reste très inférieure à l'incertitude de l'horizon (MNT 5 m).

**Sensibilité du test (contrôle négatif, fait le 2026-11-15).** Sur le cas « Terre, Site04, 2028-06-15 » : écart normal 8,7·10⁻⁷ ° (azimut) et 1,8·10⁻⁵ ° (élévation) ; **site décalé de 0,01°** (≈ 300 m) → 2,8·10⁻⁴ ° et **9,8·10⁻³ °** ; **instants décalés d'une minute** → 1,2·10⁻³ ° et 1,9·10⁻⁴ °. Le test détecte donc un décalage de site de moins de 10 m ou de moins de 2 secondes de temps.

**Limites de cette validation.**
- Les deux outils partagent la même famille d'éphémérides (DE440 / DE441) : elle valide **notre géométrie** (repère MOON_ME, base locale, unités, temps de lumière, aberration), pas les éphémérides elles-mêmes.
- Horizons suppose aucune nouvelle seconde intercalaire après la dernière connue (négligeable ici, `INVENTAIRE-DONNEES` § 3.2).
- Hauteur de l'observateur 0 : la hauteur de 2 m des sites n'est pas comparée (effet négligeable pour la direction du Soleil et de la Terre).
- Jours choisis pour couvrir la période, pas pour des cas extrêmes (éclipses, plus petites élongations).

## 2. Point libre calculé dans le navigateur (V2-02b, D-027)

**Ce qui est comparé.** Pour chacun des 4 sites réels, on traite sa position comme un point saisi par l'utilisateur et on recalcule **dans le navigateur** (module `web/js/freepoint.js`, exécuté ici sous Node avec les mêmes fichiers que l'application : `global.json` et `polar/ldem_south_500m.*`), puis on compare au pipeline. Tests : `web/tests/freepoint.test.js` (mesures du 2026-11-15).

| Mesure | Résultat | Exigence | Commentaire |
|---|---|---|---|
| Soleil et Terre (azimut, élévation, rayon angulaire) contre la série du pipeline, **43 824 heures × 4 sites × 2 corps**, avec **parallaxe** | écart maximal **0,001 °** (arrondi au millidegré) sur les trois grandeurs, que l'on prenne la hauteur du sol du pipeline (5 m) ou celle de la grille 480 m | < 0,01 ° | y compris l'élévation de la Terre (parallaxe ≈ 0,26 °) |
| Indicateurs (port de `kpi.py`) alimentés par les séries et l'horizon du pipeline | **égalité exacte** (`deepEqual`) des `kpis` et du `monthly`, strict et optimiste, 4 sites | égalité | une première version a montré **1 échantillon d'écart** (Site01, Terre) : voir D-031 |
| Horizon approché (grille 480 m) contre l'horizon du pipeline (5 m + 80 m) | Site01 : **RMS 1,93 °, maximum 4,36 °**, biais −1,41 ° · Site04 : RMS 0,37 °, max 1,14 °, biais −0,28 ° · Site07 : RMS 0,81 °, max 2,47 °, biais +0,32 ° · Site11 : RMS 1,01 °, max 2,66 °, biais +0,40 ° | RMS et maximum publiés ; si max > 1 °, le dire dans la fiche | **le maximum dépasse 1 ° sur les 4 sites** (la moyenne par blocs lisse les crêtes et les cuvettes) : c'est écrit dans la carte « Point libre » et dans la pastille |
| Hauteur du sol : grille 480 m contre MNT 5 m | Site01 1937,0 m / 1944,8 m · Site04 769,3 / 769,7 · Site07 1622,3 / 1645,3 · Site11 1777,0 / 1793,7 | — | écart ≤ 23 m ; effet négligeable sur le Soleil et la Terre (< 10⁻⁶ °) |
| **Test de cohérence de la NASA** : point à −89,9 ° avec horizon plat, 2026-2030, seuil strict | Terre au-dessus de 0 ° **50,28 %** du temps (Soleil 52,64 % ; Terre en optimiste 54,82 %) | ≈ 50 % ± 5 points | la NASA écrit que la Terre n'est visible qu'environ la moitié de chaque mois sidéral au pôle : cohérent |
| Temps de calcul d'un point (horizon 360 azimuts + 2 × 43 824 heures + indicateurs + terrain 3D), Node | ≈ 0,4 s (horizon seul : 0,1 s) | rapide | mesuré sans interface graphique |

**Ce que la mesure n'établit pas.** Le biais de l'horizon est de signe variable : la grille 480 m peut **sous-estimer ou surestimer** l'horizon réel d'un à quelques degrés. Les indicateurs d'un point libre sont donc **moins fiables** que ceux des sites du catalogue, surtout près des crêtes ; l'application le dit. Aucune comparaison n'a été faite avec un outil officiel.

## 3. Liaison : coupures, levers et couchers, délai de propagation (V2-05, D-028)

Géométrie seulement (relais, stations au sol, bilan de liaison et trajectoire non modélisés).

| Mesure | Résultat | Exigence | Commentaire |
|---|---|---|---|
| Plus longue coupure, nombre de coupures et % couvert du module (Soleil, Terre, les deux ; strict et optimiste ; 4 sites) contre `kpis` du pipeline | **égalité exacte** (`assert.equal` sur `longest_gap_h` et `n_gaps`, écart < 10⁻⁹ sur le %) | égalité exacte | `web/tests/link.test.js` |
| Instants de coucher et de lever (strict) calculés dans le navigateur à partir des **séries horaires** (interpolation d'Hermite, bissection à 0,5 s) contre SPICE **minute par minute** avec l'horizon du pipeline, 4 sites, 2027-03-01 → 04-30 | **65 événements** : écart médian **32 s**, 90e centile 66 s, **maximum 150 s**, biais moyen −27 s | médiane < 1 min ; maximum publié | la vérité est « la première minute du nouvel état » (arrondie à la minute) : l'écart attendu d'une interpolation parfaite est de 0 à 60 s, moyenne 30 s ; le biais de −27 s en est la signature. Le maximum de 150 s vient de rasants où la marge reste presque nulle pendant des minutes. Précision annoncée à l'écran : ± 2,5 min |
| Délai de propagation aller simple (distance ÷ c) contre la portée Horizons (`QUANTITIES='20'`), 4 sites × 3 dates × 24 h = 288 valeurs | écart maximal **0,738 ms**, moyen 0,342 ms | < 1 ms | borné par l'**arrondi au millidegré du rayon angulaire** de la Terre dans le fichier de site (± 5·10⁻⁴ de la distance) : on ne peut pas faire mieux avec ce format |
| Délais calculés sur 5 ans (Site01) | entre 1,18 s et 1,37 s (aller simple) | plausible | distance Terre–Lune 356 000 – 407 000 km |

**Vue 3D : disques du Soleil et de la Terre, et sonde (M-051 § 2.5).**

Mesure dans Edge (SwiftShader), caméra au sol, ouverture 60°, canvas de 900 × 600 px, Soleil de rayon angulaire 0,2665° et Terre de 0,95° (valeurs de test ; script `tests/reference/browser_measure_3d_discs.js`). Diamètre du **disque** (sans halo) projeté par la caméra réelle, comparé à (rayon angulaire × agrandissement) × pixels par radian au centre de l'image ; largeur lue sur les pixels rendus (≥ 55 % du maximum de luminosité de la rangée).

| Cas | Projection (px) | Attendu (px) | Écart | Largeur lue sur les pixels |
|---|---|---|---|---|
| Soleil ×1 (taille réelle, plancher de lisibilité 0,25° < rayon réel) | 4,86 | 4,83 | 0,03 | 4 px |
| Soleil ×4 (illustratif) | 19,44 | 19,34 | 0,11 | 18 px |
| Soleil ×8 (illustratif) | 38,90 | 38,69 | 0,21 | 38 px |
| Terre ×1 | 17,27 | 17,23 | 0,04 | non lu |

Lecture : par projection l'écart est **inférieur à 0,25 px** (tolérance 1 px respectée) ; sur les pixels rendus, l'écart va de 0,8 à 1,3 px (bord adouci et assombrissement centre-bord : un seuil à 55 % n'est pas un bord exact), **donc la tolérance de 1 px n'est établie que par projection**, pas par lecture de pixels. Le plancher du sprite de la vue 3D est passé de 1° à 0,25° : à ×1 le Soleil est **à l'échelle** (seul le halo déborde).

Sonde dans la vue 3D : mêmes mots et mêmes unités que sur la carte (`formatProbe`, testé : `probetext.test.js`) ; **souris** (raycast sur le maillage central et l'anneau) et **clavier** (flèches de 500 m, Échap) ; marqueur magenta au point sondé ; contrôle Edge : au clavier 0,7 km au cap 45°, pente 30,1°, horizon dans cette direction 26,8°, « Soleil visible non, Terre visible non » ; à la souris 5,1 km au cap 140°. Limite : l'altitude et la pente viennent de la **grille 480 m** (comme sur la carte) ; seul « écart de hauteur au site » vient du maillage 3D ; au clavier, la sonde reste dans le terrain central (±10 km).

**Couture 5 m / 80 m (M-051 § 2.4).** Différence de hauteur MNT 5 m (PGDA 78) − LDEM 80 m (PGDA 90) sur la couronne de recouvrement (distance de Tchebychev de 6,5 à 8 km du centre, grille de 40 m, interpolation bilinéaire dans les deux produits) ; script `tests/reference/seam_5m_80m.py`, résultats `tests/reference/seam_5m_80m.json`, test `pipeline/tests/test_seam_reference.py`.

| Site (niveau 1) | Points | Biais (m) | RMS (m) | Maximum (m) |
|---|---|---|---|---|
| Site01 | 53576 | -0.14 | 1.10 | 13.3 |
| Site04 | 53576 | -0.21 | 1.04 | 13.3 |
| Site07 | 53576 | -0.22 | 0.95 | 19.4 |
| Site11 | 53576 | +0.17 | 0.95 | 14.4 |

Sur les **27** sites 5 m : biais de −0,3 à +0,5 m, **RMS de 0.68 à 1.32 m** (seuil de CHAT : 5 m, respecté partout). **Maximum au-dessus de 20 m (seuil de CHAT) pour 5 sites** : Site20 (22 m), Site23 (21 m), Site42 (68 m), DM1 (72 m), NPB (45 m) ; les 4 sites de niveau 1 restent ≤ 20 m. Je n'ai pas retouché les données. Explication **probable, non vérifiée** : les écarts maximaux sont locaux, là où le relief est raide (le LDEM 80 m lisse ce que le 5 m résout). À lire comme : le raccord est bon en moyenne (RMS ≈ 1 m) mais peut présenter des marches locales de plusieurs dizaines de mètres au bord de l'emprise 5 m sur ces 5 sites.

**Vue Site 3D : anneau de contexte (M-051 § 2.3, partie « sans bord net »).** `web/js/terrainring.js` : autour du terrain central (20 × 20 km) un maillage de 250 m jusqu'à ±60 km (hauteurs de la pyramide de tuiles, niveau 240 m, puis grille 480 m), recalé verticalement sur le bord du terrain central, **raccordé** (le résidu centre − anneau du bord est reporté puis s'éteint sur 1,5 km), jupes sous les deux bords, bord extérieur fondu vers le noir. Écart RMS anneau / centre au bord avant raccord : Site01 2,3 m (profil mesuré : la pente réelle du flanc atteint 200 m par km). Tests : recalage exact, aucun triangle dans le carré central, nœuds du bord à moins de 1 mm du terrain central après raccord (contrôle négatif : sans raccord, le test échoue), bord extérieur noir, hauteurs inconnues, anneau refusé si plus de la moitié des hauteurs manque. Captures Edge : `atlas-v206-site3d-anneau.png`, `atlas-v206-site3d-sol.png` (non versionnées, texture NASA). Limites : le contexte est du LDEM 80 m **moyenné à 250 m**, pas du 5 m ; le terrain central reste la grille de 78 m du site (le patch 5 m décimé à 20 / 40 m **n'est pas fait**) ; relief `flat` : pas d'anneau (relief non modélisé) ; rendu illustratif.

**Fond polaire : pyramide de tuiles (M-051 § 2.2).**

| Mesure | Résultat |
|---|---|
| Décodage JavaScript = décodage Python (codes exacts et somme de contrôle de chaque tuile), 9 tuiles réelles des 3 niveaux | **égal** (`pyramid.test.js`, référence `tests/reference/polar_tile_probe.json` produite par `make_polar_tile_probe.py`) |
| Gradient d'un plan incliné de part et d'autre d'une frontière de tuiles | exact à 10⁻³ près (pas de couture) |
| Reconstruction deux fois | tuiles et manifeste **identiques octet pour octet** |
| Poids de la pyramide | **8,7 Mo** autour des 30 sites commités (240 m : 143 tuiles, 2,8 Mo ; 160 m : 148 tuiles, 2,8 Mo ; 80 m : 176 tuiles, 3,0 Mo ; fenêtres ±40 / ±20 / ±10 km) ; 11,4 Mo avec les fenêtres plus larges (±45 / ±25 / ±12 km) autour de 40 sites ; 2 octets par échantillon avant compression, ≈ 1 après |
| Poids de `web/data` (30 sites : 17 + 10 entités + 3 missions, avec la pyramide) | **60,9 Mo = 58,1 Mio** (`du -sb`) ; avec les 23 sites 5 m supplémentaires (non commités, Q-017) : ≈ 96 Mo |
| Vue réelle à ×43 (Edge) | craters et petits reliefs nets, **sans strie** (capture `docs/captures/atlas-v206-pyramide-x43.png`, non versionnée : texture NASA, Q-013) comparée à la grille 480 m seule (`atlas-v206-avant-pyramide-x43.png`) |

Limites : le détail n'existe que **dans les fenêtres autour des sites** (ailleurs le fond reste à 480 m, plus flou) ; les niveaux sont des moyennes par blocs du LDEM 80 m, sans reconstruction de relief plus fin ; passage d'un niveau à l'autre sans fondu (la netteté change à la frontière d'une tuile) ; l'ombrage reste illustratif (azimut réel du Soleil, élévation d'étude de 15°, sans ombres portées) ; la **sonde** (altitude, pente au survol) lit encore la grille 480 m ; la cause exacte des « stries radiales » vues par CHAT sur la grille 480 m n'a pas été isolée : la pyramide les fait disparaître dans les fenêtres couvertes, elles peuvent subsister ailleurs à fort zoom.

**Planificateur et couche « Liaison » de l'Atlas (V2-05 §§ 7.3-7.4).**

| Mesure | Résultat |
|---|---|
| Séjour de toute la période : parts Soleil, Terre, les deux et plus longues coupures du planificateur = `kpis` (3 sites réels, strict) | **égalité** (écart < 10⁻⁹ sur les %, égalité exacte sur les durées) |
| Bitsets de l'index décodés en JavaScript = visibilité stricte calculée sur les séries, **échantillon par échantillon**, 17 sites × Soleil et Terre | **0 écart** ; popcount / n = `kpis.<corps>.strict.visible_pct` à 10⁻⁹ près ; test Python : recalcul identique et `validate` refuse un bit modifié |
| Temps d'un calcul de planification (7 277 instants candidats, séjour de 7 jours, 1 site) | ≈ 80 ms mesurés dans Edge sans GPU |

Limites : la couche « Liaison » est un **échantillonnage par sites** (entre les sites, on ne sait rien) en seuil **strict** seulement (c'est le seul dans l'index) ; le planificateur compare des instants d'alunissage sur un seul site à la fois (pas de tableau multi-sites) ; paramètres de séjour, contraintes et transfert **saisis par l'utilisateur**.

**Nettoyage de la vérité-terrain.** Aux instants où le corps frôle l'horizon, la quantification au millidegré fait osciller l'état (coucher, lever, coucher en 2 minutes). Ces couples de changements distants de moins de 10 minutes sont retirés de la référence (`tests/reference/make_crossings_truth.py`), sinon la mesure compterait du bruit de quantification comme une erreur de calcul. Sans ce nettoyage, 2 événements sur 71 auraient été mal appariés.

**Limites.** Un double franchissement de l'horizon à l'intérieur d'une même heure (frôlement) n'est pas vu : les séries sont horaires. L'angle minimal utile est un paramètre de l'utilisateur (0 à 5°), pas une valeur normative.

## 4. Pas encore validé (reste de T-24)

| Contrôle | État |
|---|---|
| Horizon (masque) contre un outil officiel (Quickmap, Moon Trek) | **non fait** |
| Éclairement moyen LOLA (GDRVIS `AVGVISIB`) : comparaison de méthode | **non fait** |
| Résultats publiés (Barker et al. 2021) : cohérence qualitative | **non fait** |
| Analyse de sensibilité (hauteur de l'œil, résolution du MNT, seuil) | **non faite** |
| Valeurs de référence du fichier d'or `body_state_cases.json` (T-08) | **non faites**, relecture humaine requise |
