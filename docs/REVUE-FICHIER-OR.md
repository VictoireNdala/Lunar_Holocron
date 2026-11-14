# Revue du fichier d'or `tests/golden/body_state_cases.json` (T-08)

> **État : généré, NON FIGÉ — en attente de relecture humaine** (TESTS-VALIDATION § 5). Tant que ce document n'est pas signé en bas, ne pas considérer ces valeurs comme une référence.

## Ce que c'est

20 instants d'un site de démonstration **fictif** (`demo-b`, 87,5° S, 45° E, massif à l'est) avec, pour le Soleil et la Terre : azimut, élévation, rayon angulaire, **horizon à l'azimut du corps** et **fraction visible**.
- Python (`pipeline/golden.py`) calcule ces valeurs **directement à l'instant demandé**, avec les éphémérides de démonstration et `pipeline/visibility.py`.
- JavaScript (`web/tests/bodystate-golden.test.js`) **n'a pas ces formules sous les yeux** : il interpole les séries horaires exportées (`bodyStateAt`), lit le masque (`horizonAt`) et applique `visibleFraction`. Les deux doivent s'accorder.
- Régénération : `py -m pipeline.golden` (n'écrase pas l'index ; ne pas utiliser `cli demo --write-golden` pour cela, `demo` reconstruit `index.json` avec les seuls sites de démonstration).

## Tolérances (mesurées, pas présumées)

| Grandeur | Tolérance du fichier | Écart maximal mesuré (JS contre fichier) | Cause |
|---|---|---|---|
| azimut, élévation, rayon | 0,001° (spec) | 4,9·10⁻⁴° / 4,7·10⁻⁴° / 5,0·10⁻⁴° | quantification au millidegré des séries exportées (demi-pas = 5·10⁻⁴°) |
| fraction visible | 0,002 (choix de CODE : la spec ne le précise pas) | 9,8·10⁻⁴ | propagation de l'écart d'élévation dans la formule |

## Contrôles déjà faits par CODE

- Les 20 cas passent côté Python (valeurs recalculées à 1e-8 près ; règle de choix déterministe ; plausibilité : rayon du Soleil dans [0,2613° ; 0,2672°], de la Terre dans [0,89° ; 1,03°] ; état « masqué / visible » cohérent avec la marge élévation − horizon) et côté JavaScript.
- **Contrôle négatif** : si l'on retire le déroulement d'azimut de `bodyStateAt` (interpolation naïve entre 359° et 0°), les cas 11 et 12 échouent, les 18 autres passent.
- Couverture : Soleil et Terre **partiels** (≥ 3 cas chacun), **masqués** et **visibles** (≥ 2 chacun), 5 instants hors nœuds horaires, passage de l'azimut du Soleil par 0° / 360° (cas 11 à 13).

## Ce que l'humain (ou CHAT) doit faire

1. **Recalculer 3 cas à la main ou avec un autre outil**, par exemple les cas 2 (marge faible, Soleil partiel à 39,7 %), 9 (horizon de 7,8° à l'azimut 85,8°) et 11 (passage par le nord) :
   - marge = élévation − horizon ; d = marge ; x = clamp(d / rayon, −1, 1) ; f = 1 − (arccos x − x·√(1 − x²)) / π ;
   - cas 2 (refait par CODE avec une réimplémentation séparée, sur les valeurs du fichier) : d = 0,533 − 0,577 = −0,044° ; rayon du Soleil 0,2665° ; x ≈ −0,165 ; f = 0,3966 ✔ ; cas 9 (Terre) : 0,858208 ✔ ; cas 11 : Soleil 1, Terre 0 ✔. Ce recalcul n'est **pas** indépendant au sens fort (même formule, écrite par la même main) : c'est à l'humain ou à CHAT de le refaire.
   - Note : les éphémérides de **démonstration** donnent des rayons angulaires **constants** (Soleil 0,2665°, Terre 0,95°) ; seuls les vrais calculs SPICE les font varier (T-24 les valide).
2. **Regarder le tableau** ci-dessous : les azimuts sont dans [0 ; 360[, la Terre reste dans le secteur 307°–323° (elle ne bouge que de ±8° près du pôle), le Soleil fait le tour de l'horizon, les élévations restent à quelques degrés.
3. **Décider** : « validé » (on fige, on note la date et le relecteur ci-dessous) ou « à corriger » avec les numéros de ligne.

## Les 20 cas

| # | Instant (UTC) | Soleil : az / él / horizon / f | Terre : az / él / horizon / f | Motif |
|--:|---|---|---|---|
| 1 | 2026-09-12 20:00 | 128,407° / −0,288° / −0,120° / 0,127 | 310,967° / 4,556° / −0,030° / 1,000 | Soleil partiel |
| 2 | 2028-06-24 18:00 | 113,270° / 0,533° / 0,577° / 0,397 | 322,567° / 1,643° / −0,010° / 1,000 | Soleil partiel |
| 3 | 2030-05-03 10:00 | 131,983° / −0,280° / −0,100° / 0,105 | 307,574° / −2,581° / −0,064° / 0,000 | Soleil partiel |
| 4 | 2026-09-25 16:00 | 331,899° / 3,234° / −0,019° / 1,000 | 317,379° / 0,041° / −0,000° / 0,528 | Terre partielle |
| 5 | 2028-06-12 12:00 | 262,511° / 1,104° / 0,035° / 1,000 | 307,151° / −0,225° / −0,068° / 0,395 | Terre partielle |
| 6 | 2030-03-27 15:00 | 220,490° / −1,216° / −0,040° / 0,000 | 316,852° / 0,034° / −0,000° / 0,523 | Terre partielle |
| 7 | 2027-07-05 13:30 | 123,259° / 0,093° / −0,115° / 0,941 | 322,296° / −0,518° / −0,010° / 0,176 | Soleil partiel, entre deux nœuds |
| 8 | 2029-07-03 14:30 | 235,640° / 0,045° / −0,020° / 0,653 | 307,384° / −5,135° / −0,066° / 0,000 | Soleil partiel, entre deux nœuds |
| 9 | 2027-06-09 02:30 | 85,829° / 1,261° / 7,783° / 0,000 | 321,268° / 0,568° / −0,003° / 0,858 | Terre partielle, entre deux nœuds |
| 10 | 2029-06-12 22:30 | 127,636° / 0,012° / −0,124° / 0,810 | 316,117° / 0,586° / −0,000° / 0,866 | Terre partielle, entre deux nœuds |
| 11 | 2026-01-30 02:30 | 0,198° / 1,050° / −0,160° / 1,000 | 320,177° / −4,690° / −0,000° / 0,000 | azimut du Soleil 359° → 0° entre les nœuds |
| 12 | 2028-07-04 00:30 | 0,211° / 4,040° / −0,160° / 1,000 | 312,759° / 7,520° / −0,022° / 1,000 | azimut du Soleil 359° → 0° entre les nœuds |
| 13 | 2030-12-06 23:00 | 359,969° / 1,058° / −0,160° / 1,000 | 307,725° / −2,762° / −0,063° / 0,000 | nœud juste après le passage 360° → 0° |
| 14 | 2027-03-13 05:00 | 77,258° / −0,573° / 3,934° / 0,000 | 321,946° / −4,711° / −0,009° / 0,000 | Soleil masqué |
| 15 | 2029-10-26 13:00 | 274,538° / −0,956° / 0,020° / 0,000 | 312,294° / −0,219° / −0,027° / 0,372 | Soleil masqué |
| 16 | 2027-04-21 17:00 | 315,737° / 1,635° / −0,003° / 1,000 | 310,195° / 7,823° / −0,038° / 1,000 | Soleil visible |
| 17 | 2029-08-26 22:00 | 293,521° / 1,384° / −0,075° / 1,000 | 307,311° / −5,114° / −0,067° / 0,000 | Soleil visible |
| 18 | 2027-04-08 14:00 | 115,721° / −1,599° / 0,258° / 0,000 | 320,627° / −4,517° / −0,000° / 0,000 | Terre masquée |
| 19 | 2029-09-28 14:00 | 255,361° / −1,145° / 0,016° / 0,000 | 311,660° / −1,314° / −0,030° / 0,000 | Terre masquée |
| 20 | 2028-06-30 20:00 | 39,138° / 3,478° / −0,069° / 1,000 | 318,341° / 8,413° / −0,000° / 1,000 | Terre visible |

## Signature

- Relu par : ______________________ (nom, rôle)  Date : ____________
- Décision : ☐ validé, fichier figé   ☐ à corriger (lignes : ________ )
