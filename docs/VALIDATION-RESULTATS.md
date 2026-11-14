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

## 2. Pas encore validé (reste de T-24)

| Contrôle | État |
|---|---|
| Horizon (masque) contre un outil officiel (Quickmap, Moon Trek) | **non fait** |
| Éclairement moyen LOLA (GDRVIS `AVGVISIB`) : comparaison de méthode | **non fait** |
| Résultats publiés (Barker et al. 2021) : cohérence qualitative | **non fait** |
| Analyse de sensibilité (hauteur de l'œil, résolution du MNT, seuil) | **non faite** |
| Valeurs de référence du fichier d'or `body_state_cases.json` (T-08) | **non faites**, relecture humaine requise |
