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
| PGDA — produit 78 (MNT à 5 m de sites du pôle Sud) https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | Sites réels du niveau 1 (D-016) | **aucune licence indiquée** (index et README lus le 2026-11-14) ; renvoi à Barker et al. 2021, PSS 203, 105119, https://doi.org/10.1016/j.pss.2020.105119 (et Mazarico et al. 2011 pour la numérotation) | **utilisé** : `Site04_final_adj_5mpp_surf.tif` téléchargé le 2026-11-14 (40 980 806 octets, SHA-256 `38FF70DBDF2F066C2CFA94A646C3A59D653CE7F6B4528B15FC1B43EE397CE758`, hors Git) ; en-tête lu : 3 200 × 3 200 pixels de 5 m, float32, NaN = nodata, `AREA_OR_POINT = Area`, projection identique à `PolarProjection` ; **23 autres produits** téléchargés le 2026-11-15 (liste lue sur https://pgda.gsfc.nasa.gov/products/78, liens `LOLA_5mpp/<Id>/<fichier>`) : Site06, Site20, Site20v2, Site23, Site42, Haworth, Shoemaker, DM1, DM2, SL2, SL3, NPA, NPB, NPC, NPD, LM1 à LM8 ; fichiers de 41 à 142 Mo (≈ 1,7 Go au total, hors Git) ; SHA-256 et centres d'emprise dans `config/sites_real.json`, outil `pipeline/tools/fetch_pgda5m.py` ; même citation et même absence de licence indiquée |
| **NAIF / SPICE — noyaux génériques** https://naif.jpl.nasa.gov/pub/naif/generic_kernels/ (téléchargés le 2026-11-14 dans `data/raw/spice/`, hors Git) | Éphémérides Soleil et Terre vus d'un site (T-20, T-07) | **conditions NAIF non lues** (à relever) ; NAIF demande une reconnaissance (citation) | **utilisé** |

Noyaux retenus (noms exacts des dossiers NAIF au 2026-11-14 ; tailles = celles du serveur ; SHA-256 des fichiers reçus) :
| Fichier | Dossier | Octets | Dernière modification | SHA-256 |
|---|---|---|---|---|
| `naif0012.tls` (la plus récente : le dossier ne contient que `naif0011` et `naif0012`) | `lsk/` | 5 257 | 2016-07-15 | `678E32BDB5A744117A467CD9601CD6B373F0E9BC9BBDE1371D5EEE39600A039B` |
| `de440s.bsp` (couverture 1849-12-26 à 2150-01-22, lue par `spkcov`) | `spk/planets/` | 32 726 016 | 2020-12-21 | `C1C7FEEAB882263FC493A9D5A5B2DDD71B54826CDF65D8D17A76126B260A49F2` |
| `moon_pa_de440_200625.bpc` (couverture 1550–2650, `pckcov`) | `pck/` | 12 863 488 | 2021-06-26 | `60CD55AA401EA2EA97360636F567554BFE4E37BB829F901B4460A455DFAF783F` |
| `moon_de440_250416.tf` (la plus récente du dossier ; son en-tête la déclare compatible avec le `.bpc` ci-dessus) | `fk/satellites/` | 19 478 | 2025-04-16 | `A47C71E9C9F33796BDAFB2C9D69A7EE447B6016ECAD80F71CD6F3E479F9CF768` |
- `MOON_ME` y est défini comme alias de `MOON_ME_DE440_ME421` (rotation constante depuis `MOON_PA_DE440`) : le repère « Mean Earth » est donc **déjà aligné sur celui de DE421** utilisé par les MNT de PGDA, **par construction du noyau** (c'est ce que dit son en-tête). La variante de contrôle DE421 de M-024 n'a pas été téléchargée.
- **Validation Horizons** : `tests/reference/horizons_samples.json` (3 valeurs relevées par CHAT le 2026-11-14, NASA/JPL Horizons System) ; SPICE les retrouve à moins de 1e-6° (az et él.).
- Premier téléchargement de `de440s.bsp` interrompu (7,6 Mo reçus) : fichier repris jusqu'à la taille exacte annoncée par le serveur, puis vérifié par `spkcov` et par les tests.

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
| Liens profonds vers Quickmap (`https://quickmap.lroc.im-ldi.com/`) et Moon Trek (`https://trek.nasa.gov/moon/`), S-05 / D-019 | Deux liens `<a>` ouverts par un clic ; **rien n'est chargé** depuis ces sites (aucun fetch, iframe ni image). Adresses relevées par CHAT le 14/11/2026, **non rouvertes par CODE** ; le centrage par paramètres n'est **pas vérifié** (`centered: false`). **Crédits affichés écrits de mémoire (« LROC QuickMap (ASU / LROC, NASA) », « NASA Moon Trek ») : à remplacer par le texte exact lu sur leurs pages** | cité, crédit à vérifier |
| NASA/JPL Horizons System (`https://ssd.jpl.nasa.gov/api/horizons.api`), T-24 | **Validation seulement** : azimut et élévation apparents du Soleil et de la Terre, 5 sites × 3 dates, comparés à SPICE (`docs/VALIDATION-RESULTATS.md`). Appelé par l'outil hors ligne `pipeline/tools/horizons_validate.py` (lecture seule, coordonnées et dates seulement, client générique), jamais par le pipeline, l'application ou les tests ; valeurs relevées le 2026-11-14 dans `tests/reference/horizons_validation.json` | cité (« NASA/JPL Horizons System ») |
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
| Police **Inter** (variable, sous-ensemble latin) — paquet npm `@fontsource-variable/inter@5.3.0` | Texte de l'interface (U-01) | **SIL Open Font License 1.1** (lue : `web/vendor/fonts/LICENSE-Inter.txt`, « Copyright 2016 The Inter Project Authors ») | 5.3.0 ; `inter-latin-wght-normal.woff2` SHA-256 `3100E775E8616CD2611BEECFA23A4263D7037586789B43F035236A2E6FBD4C62` |
| Police **JetBrains Mono** (400 et 600, latin) — paquet npm `@fontsource/jetbrains-mono@5.3.0` | Valeurs numériques (U-01) | **SIL Open Font License 1.1** (lue : `web/vendor/fonts/LICENSE-JetBrainsMono.txt`, « Copyright 2020 The JetBrains Mono Project Authors ») | 5.3.0 ; SHA-256 400 : `14425BA9C695763C1547F48A206B7AA60350A33AE23DE09F0407877F3FCD89EB`, 600 : `400C6BFDA18D5D14ACAD1C15D6DCB9F8E13C015E7286317E0B9A482539BEF147` |
| Icônes **Lucide** (paquet npm `lucide-static@1.73.0`) : 14 icônes assemblées sans modification de tracé dans `web/vendor/icons/sprite.svg` par `pipeline/tools/build_icon_sprite.py` | Rail de navigation (U-02) | **ISC** (« Copyright (c) 2026 Lucide Icons and Contributors ») et **MIT** pour les icônes issues de Feather (dont `compass`, `info`, `search`, `x` ; « Copyright (c) 2013-present Cole Bemis ») ; texte lu et copié dans `web/vendor/icons/LICENSE` | 1.73.0 |
| **NASA SVS — CGI Moon Kit** (ID 4720) https://svs.gsfc.nasa.gov/4720 : `lroc_color_2k.jpg` (SHA-256 `F7130A1822681FA7512D7DCFD40DB8C10B9BA4F06777910348698260ED7A2170`, 457 942 octets) et `lroc_color_poles_1k.jpg` (SHA-256 `B246064F217F8D479DF78C49C7C8595A8F5FBDA008A72FD539978D2E121E0109`, 139 068 octets), téléchargés le 2026-11-14 dans `web/assets/moon/` | Texture du globe et des cartes 2D de l'Atlas (A-01) | **Crédit demandé : « NASA's Scientific Visualization Studio »**. **Aucune licence explicite** sur la page ; directives NASA lues (contenu « généralement » non soumis à droit d'auteur, citer la NASA, pas d'approbation implicite, logos exclus) mais **statut des données ASU (LROC) non précisé** → **Q-013** ; **texture non versionnée** en attendant. Avertissement à reprendre : « optimized for aesthetics, not science » | **utilisé en local** (voir `web/assets/moon/LICENSE-ASSETS.md`) |
| 21st.dev (catalogue de composants React) | **Modèles d'interaction seulement** (UI-DESIGN § 2) ; aucun code ni fichier copié | sans objet | cité |

Remarque de sécurité (2026-11-14) : l'environnement de la machine de construction définit `NODE_TLS_REJECT_UNAUTHORIZED=0` (vérification TLS de Node/npm désactivée). Les polices ont été téléchargées dans ces conditions ; seuls des fichiers `woff2` et leurs licences ont été copiés (aucun code exécutable).

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
