# SOURCES — Lunar Holocron

Règle du hackathon : **citer toutes les sources** et documenter les licences. Ce fichier est mis à jour **au moment où** une source est utilisée, pas à la fin.
Statuts : `cité` (mentionné dans l'étude préalable, pas encore utilisé dans le code) · `utilisé` (données ou idées intégrées) · `vérifié` (lien, licence et conditions relevés sur la page officielle).
Les liens ci-dessous sont les adresses connues des services ; **les vérifier avant publication**. Les licences marquées « à relever » ne doivent pas être supposées.

## 1. Données

| Source | Usage prévu | Licence / conditions | Statut |
|---|---|---|---|
| LRO / LOLA — modèles numériques de terrain `LDEM_*` (PDS Geosciences Node, imbrium.mit.edu) | MNT pour masques d'horizon et terrain 3D | à relever sur la page du produit (données NASA) | cité |
| PGDA (Planetary Geodesy Data Archive, Goddard) — produit 69 (illumination moyenne et visibilité Terre) | Comparaison de validation | à relever | cité |
| **PGDA — produit 90** « A New View of the Lunar South Pole from LOLA » (M. K. Barker) : `LDEM_80S_80MPP_ADJ` (sur le serveur : `LDEM_80S_80MPP_ADJ.TIF`, 181 Mo ; reçu par l'humain sous le nom `.tiff`, 189 158 392 octets, dans `data/raw/`, hors Git). https://pgda.gsfc.nasa.gov/products/90 | Aperçu du relief réel (M-014 étape B) ; plus tard horizons et ombrage du pôle Sud | **Aucune licence indiquée** sur la page (lue le 2026-11-14). Seule consigne : « Please cite this paper when using these products: Barker et al., 2023 Planet. Sci. J., 4, 183. https://doi.org/10.3847/PSJ/acf3e1 » ; DOI des données 10.60903/gsfcpgda-lola-spole. Les liens « Reproduction Guidelines » de nasa.gov n'ont pas été lus | **utilisé** (aperçu local, non versionné ; captures dérivées dans `docs/captures/b-*.png`) |
| PGDA — produit 78 (MNT à 5 m de sites du pôle Sud) https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | Sites réels du niveau 1 (D-016) | **aucune licence indiquée** (index et README lus le 2026-11-14) ; renvoi à Barker et al. 2021, PSS 203, 105119, https://doi.org/10.1016/j.pss.2020.105119 (et Mazarico et al. 2011 pour la numérotation) | cité ; fichiers non téléchargés |

**Contrôle du MNT 80 m (2026-11-14, M-014 § 4)**, lu avec rasterio/GDAL :
- projection `+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +x_0=0 +y_0=0 +R=1737400` : identique à `PolarProjection` par défaut (k0 = 1, FE = FN = 0) ; sur 8 points, `PolarProjection` et GDAL concordent à 1e-11 m ;
- 7 600 × 7 600 pixels de 80 m, float32, Deflate, tuiles 512, aperçus réduits ×2 à ×16 ; `nodata` = NaN, **aucun NaN** dans le fichier ;
- valeurs en **mètres** (−7 295,5 à +7 026,3 ; moyenne −1 500,6) : l'historique GMT multiplie des km par 1 000 ;
- **convention de pixel** : `AREA_OR_POINT = Area` (clé GeoTIFF de type raster « PixelIsArea ») et GMT `node_offset = 1` (« pixel-registered ») ; le point d'attache (−304 000 ; +304 000) est le **coin** haut-gauche, et le centre du pixel (ligne r, colonne c) est en x = −304 000 + 80·(c + ½), y = 304 000 − 80·(r + ½). Le README du produit 78 dit de même que les x/y des 5 m sont les centres (« pixel-registered ») ;
- **orientation vérifiée sur Shackleton** : le point le plus bas autour de (−89,67° ; 129,5°) est à −2 869 m, à 2,4 km de ce point ; profil radial : rebord à ≈ 11 km (diamètre ≈ 22 km), profondeur ≈ 3,7 km ; le pôle tombe sur le rebord ; aux positions miroir (−x ou −y) il n'y a pas de fond de cratère.
| NAIF / SPICE — noyaux génériques (`naif0012.tls`, `de440s.bsp`, orientation lunaire `moon_pa_de440_*`, `moon_de440_*.tf`) | Éphémérides Soleil et Terre | à relever (règles NAIF ; reconnaissance demandée) | cité |
| JPL Horizons (ssd.jpl.nasa.gov/horizons) | Valeurs de contrôle (validation) | à relever | cité |
| Données fournies par le défi Space Apps 2026 | À déterminer (`Q-004`) | à relever | à recevoir |
| Constantes de `pipeline/config.py` : rayon nominal du Soleil 695 700 km (résolution B3 de l'UAI, 2015) ; rayon moyen de la Terre 6 371,0 km ; sphère LOLA 1 737,4 km | Rayons angulaires, géométrie | — | utilisé ; **valeurs écrites de mémoire** (reprises de `docs/PIPELINE.md`), à vérifier dans les sources primaires |

## 2. Outils et idées étudiés (étude comparative)

| Source | Ce qui en inspire le projet | Statut |
|---|---|---|
| Lunar QuickMap (LROC / ASU) — TerrainShadows, Compute Visibility, boussole, panoramas | Vue des ombres selon la date, visibilité depuis un point, panorama au sol | cité |
| NASA Moon Trek — outil de ligne de vue, angle solaire | Verdict de ligne de vue, lecture de l'angle du Soleil | cité |
| NASA SVS 4930 (vidéos d'éclairement du pôle Sud, 2023-2030) | Lecture animée de la frise | cité |
| NASA Ames Celestial Mapping System | Idée de trace du Soleil et de la Terre dans le ciel | cité |
| Documents Artemis sur les critères de sélection de sites | Pastilles de conformité (pente, distance au pôle, visibilité Terre) | cité |
| Étude préalable du projet (document Claude du projet Hackathon NASA) | Base de toutes les décisions ; liste complète des sources consultées | https://claude.ai/artifact/TCNQdQscckhiwyZNUBC67E |

On reprend des **idées de fonctionnalité**, pas du code ni des textes. Tout élément repris littéralement devrait être cité ici avec sa licence.

## 3. Logiciels

| Composant | Rôle | Licence | Version retenue |
|---|---|---|---|
| three.js | Vue 3D | MIT (`web/vendor/three/LICENSE`, copié du paquet) | **0.170.0** (paquet npm officiel `three@0.170.0`, téléchargé le 2026-11-12 par `npm pack`). Copiés tels quels (empreintes ci-dessous) : `build/three.module.js`, `examples/jsm/controls/OrbitControls.js`, `LICENSE` |
| NumPy | Calcul numérique | BSD | 2.5.4 (installée le 2026-11-12, `requirements.txt` : ≥ 1.26) |
| SpiceyPy (CSPICE) | Éphémérides | MIT (SpiceyPy) ; CSPICE : conditions NAIF à relever | 8.4.0 (≥ 6.0) |
| rasterio / GDAL | Lecture des MNT | BSD / MIT (X11) | rasterio 1.5.2 (≥ 1.3) |
| Pillow | Aperçus d'images uniquement | MIT-CMU (HPND) — à relever | 13.0.0 (≥ 10.0) |
| jsonschema, pytest | Validation, tests | MIT | jsonschema 4.26.0 (≥ 4.20), pytest 9.2.0 (≥ 8.0) |
| Playwright | Test de fumée | Apache-2.0 | à noter (T-15) |

Empreintes SHA-256 des fichiers three.js copiés dans `web/vendor/three/` :
`three.module.js` `CE1FA418DE16A19495A9F72495580E3015D7745C296D3CE0485897F902DDEDFB` ·
`addons/controls/OrbitControls.js` `80EFAADEA4F8A636A65FB0BD08BFEF62F3D93A0BB94E2E7500F23176C5C07F4E` ·
`LICENSE` `4C40A1EF62450B857C3B2AAF294936304CD552D965FBCD9D32D4C5BCF4BA4454`.

Environnement de construction : Python 3.12.8, Node v24.11.1, Git 2.54.0 (Windows 11), relevés le 2026-11-12.

Licence du projet : **Apache 2.0** (`LICENSE`). Depuis le 2026-11-12, `LICENSE` est le texte créé par GitHub à l'ouverture du dépôt
https://github.com/VictoireNdala/Lunar_Holocron (conditions + annexe facultative). Les conditions sont **identiques** à la copie livrée avec pip utilisée auparavant
(`git diff` : seules différences, une ligne vide initiale et l'annexe). Les champs `[yyyy] [name of copyright owner]` de l'annexe restent vides : titulaire à fixer (`Q-010`).

## 4. Usage de l'IA (transparence)

Règle du hackathon sur l'IA : non confirmée à ce jour (`Q-002`). Ce paragraphe est tenu à jour dans tous les cas.

- **Claude (Anthropic), conversation de projet** : étude préalable, comparaison des outils, choix d'architecture, rédaction des fichiers de pilotage de ce dépôt (2026-11-12), revue critique des résultats.
- **Claude Code** : construction du code, des tests et de la documentation technique selon `PLAN.md`.
- **Vérifié par un humain** : _à compléter_ (valeurs d'or relues, coordonnées des sites, résultats de validation, choix scientifiques de `DECISIONS.md`).
- **Non vérifié** : _à compléter_ au fur et à mesure.

Format d'une ligne à ajouter : `AAAA-MM-JJ — outil — tâche — ce qui a été relu et par qui`.
