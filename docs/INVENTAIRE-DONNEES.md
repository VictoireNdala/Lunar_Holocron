# INVENTAIRE-DONNEES — toutes les données réelles nécessaires, avec leur source

Rédigé par CHAT le 14 novembre 2026 après consultation de PGDA (NASA/GSFC), NAIF (JPL), Horizons (JPL), du serveur LOLA du MIT, de NASA.gov, de Moon Trek et de Quickmap (ouverts dans le navigateur intégré). Il complète `SOURCES.md` et `docs/BRANCHEMENT-DONNEES-REELLES.md`. **Légende :** ✅ vu par CHAT dans la source · ⚠️ non vérifié (à mesurer par CODE) · 🔎 déduit.

## 0. Trois constats qui changent des choses
1. **La liste des 13 régions de 2022 n'est plus la liste actuelle.** Le 28 octobre 2024, NASA a publié une liste mise à jour de **9 régions** : Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain ✅ (https://www.nasa.gov/?p=748006, publication du 28/10/2024). Les sites Connecting Ridge, Peak near Shackleton et de Gerlache Rim 1 n'en font plus partie. → **D-018**.
2. **Artemis III n'est plus une mission d'alunissage.** Depuis février 2026, Artemis III est un essai en orbite terrestre (rendez-vous/amarrage avec les atterrisseurs, été 2027) ; l'alunissage est reporté à **Artemis IV (2028)** ✅ (SpacePolicyOnline, 23/10/2026 : https://spacepolicyonline.com/news/nasa-is-full-steam-ahead-on-artemis-iii-iv-and-v/ ; SpaceLaunchSchedule). Notre interface ne doit donc **pas** affirmer que ces régions sont « les sites d'Artemis III » : écrire « régions candidates identifiées par NASA (liste d'octobre 2024) ; aucun site d'alunissage n'est choisi ». Le guide de l'événement peut le formuler autrement : il prime.
3. **Horizons répond depuis ici** (JPL) : un point de référence officiel pour valider notre calcul Soleil/Terre est obtenu (§ 3.3). Une validation **indépendante** (Horizons, DE441) de notre chaîne SPICE (DE440s) est donc possible dès que T-07 existe.

## 1. Ce que le produit consomme (contrat v1.0)
| Famille | Entrée | Sortie |
|---|---|---|
| Relief | MNT polaire stéréographique, mètres, sphère R = 1 737 400 m, repère MOON_ME | `terrain/<id>.bin` (257², uint16) et horizon 360 valeurs |
| Éphémérides | Soleil et Terre vus de chaque site, 2026–2030, pas horaire (43 824 échantillons) | séries en milli-degrés |
| Sites | position (lat, lon) et provenance de chaque site | `index.json`, `sites/<id>.json` |
| Validation | valeurs de référence indépendantes | `docs/VALIDATION-RESULTATS.md` (T-24) |

## 2. Relief (LOLA, PGDA / NASA GSFC)
| Besoin | Fichier | Taille | Source | Statut |
|---|---|---|---|---|
| Globe, Atlas, aperçu, horizon lointain | `LDEM_80S_80MPP_ADJ.TIF` (80–90°S, 80 m) | 181 Mo ✅ | https://pgda.gsfc.nasa.gov/products/90 | **déjà présent et contrôlé** (M-019) |
| Vue de site 5 m, niveau 1 (4 sites) | `SiteNN/SiteNN_final_adj_5mpp_surf.tif`, NN = 01, 04, 07, 11 | **39,1 Mo chacun, ≈ 156 Mo** (mesure HEAD de CODE, M-019) | https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ (page produit 78) | à télécharger |
| Idem, régions NASA 2024 couvertes par PGDA 78 | Site23 (Malapert massif), Site06 (Nobile rim 1), DM2 (Nobile rim 2), SL2 (de Gerlache rim), « Haworth » | ⚠️ tailles à mesurer (HEAD) | page produit 78 : identifiants listés ✅, liens non tous vus ⚠️ | à télécharger après le niveau 1 |
| Régions 2024 sans 5 m PGDA 78 identifié | Peak near Cabeus B, Mons Mouton, Mons Mouton Plateau, Slater Plain | — | aucun identifiant PGDA 78 trouvé ✅ | extraits du MNT 20 m (ci-dessous) ; positions à relever |
| Relief intermédiaire, tout le pôle | `LDEM_80S_20MPP_ADJ.TIF` (20 m, 80–90°S, COG) | **2,6 Go** ✅ | produit 90 | **optionnel** ; seulement si une région sans 5 m est retenue |
| Mosaïque 5 m 87–90°S | `ldem_87s_5mpp` | 3,3 Go ✅ | https://pgda.gsfc.nasa.gov/products/81 | **non nécessaire** (les fichiers par site suffisent) |
| 10 m, 83–90°S | `LDEM_83S_10MPP_ADJ.TIF` | 4,8 Go ✅ | produit 90 | non nécessaire |
| Relief amélioré par images (13 régions 2022) | modèles « shape-from-shading » 5 m | ⚠️ | https://pgda.gsfc.nasa.gov/products/104 ; Zenodo doi:10.5281/zenodo.17954508 | **hors périmètre** (mention seulement) |
- Format ✅ : GeoTIFF, projection stéréographique polaire sud (X/Y en mètres), repère MOON_ME, éphéméride DE421, pixels « registered » (centres) (README du produit 78 : https://core2.gsfc.nasa.gov/PGDA/LOLA_5mpp/README). Seul `*_surf.tif` est utile (les `_toterr`, `_slp`, `Clones/`, `.xyzi` ne le sont pas, M-019).
- Incertitudes ✅ : écart type résiduel typique 30–55 cm contre les champs individuels (produit 81) ; pente et hauteur : cf. Barker et al. 2021.

## 3. Éphémérides (NAIF / SPICE et Horizons)
### 3.1 Noyaux SPICE (dossier `https://naif.jpl.nasa.gov/pub/naif/generic_kernels/`)
| Rôle | Fichier | Taille | Statut |
|---|---|---|---|
| Secondes intercalaires | `lsk/naif0012.tls` | 5 257 octets ✅ (étiquette PDS d'une copie) | NAIF la donne comme la plus récente ✅ ; ⚠️ vérifier qu'aucune version plus récente n'existe en 2026 |
| Positions Soleil, Terre, Lune | `spk/planets/de440s.bsp` (1849–2150) | ⚠️ à mesurer (≈ 30 Mo de mémoire de CHAT, **non vérifié**) | liste NAIF non lue (page non accessible à CHAT) |
| Orientation lunaire (haute précision) | `pck/moon_pa_de440_200625.bpc` | **12 Mo** ✅ (liste NAIF WGC du même fichier) | à relever |
| Définition des repères lunaires | `fk/satellites/moon_de440_220930.tf` (ou version plus récente du même dossier) | quelques dizaines de Ko ; le fichier `moon_de440_250416.tf` (19 478 octets ✅) existe dans l'archive CLPS | ⚠️ **CODE lit le dossier `fk/satellites/` et prend la version la plus récente compatible avec `moon_pa_de440_200625.bpc`** |
- ✅ Le noyau `moon_de440_220930.tf` définit `MOON_PA`, `MOON_ME` (alias) et `MOON_ME_DE440_ME421` (rotation constante depuis le repère PA de DE440 vers le repère « Mean Earth » de DE421) ; il est compatible avec `moon_pa_de440_200625.bpc` (NAIF, https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/a_old_versions/moon_de440_220930.tf — chemin « a_old_versions » : un fichier plus récent existe).
- **Point de cohérence ⚠️ :** les MNT de PGDA sont dans MOON_ME **de DE421** ; notre chaîne utilise MOON_ME **issu de DE440** (`MOON_ME_DE440_ME421`). NAIF décrit cette différence (comparaison dans le noyau `moon_de440_200625.tf`). **CODE mesure l'écart d'orientation entre les deux sur 2026–2030 et le note** ; si l'écart est visible à notre échelle, utiliser la chaîne DE421 (`de421.bsp`, `moon_pa_de421_1900-2050.bpc` 1,7 Mo ✅, `moon_080317.tf`) comme variante de contrôle.
- Corrections : `LT+S` (temps de lumière et aberration stellaire) comme dans `docs/PIPELINE.md` § éphémérides.

### 3.2 Horizons (JPL) — service en ligne, pour valider
- ✅ Endpoint `https://ssd.jpl.nasa.gov/api/horizons.api` ; documentation : https://ssd-api.jpl.nasa.gov/doc/horizons.html. Résultat reçu en navigateur (la recherche web ne l'obtient pas : URL trop longue).
- Paramètres utilisés (✅ réponse reçue) : `format=text`, `COMMAND='10'` (Soleil ; `'399'` pour la Terre), `EPHEM_TYPE='OBSERVER'`, `CENTER='coord@301'`, `SITE_COORD='lon_E,lat,alt_km'`, `START_TIME`, `STOP_TIME`, `STEP_SIZE='1 h'`, `QUANTITIES='4'` (azimut et élévation apparents), `MAKE_EPHEM='YES'`, `OBJ_DATA='NO'`. Les valeurs entre apostrophes sont encodées en URL (`%27`, espaces `%20`).
- Ce que la réponse déclare ✅ : source DE441 ; centre « Moon (301) » ; repère du centre « MEAN_ME (high precision) » ; rayon de la Lune 1 737,4 km (sphère) ; « Atmos refraction: NO (AIRLESS) » ; azimut compté depuis le nord, vers l'est ; élévation par rapport au plan perpendiculaire à la verticale locale ; direction du **centre** du corps ; corrections : temps de lumière, déviation gravitationnelle, aberration stellaire, précession, nutation.
- Limite connue ✅ : au-delà du prochain 1er janvier/juillet, Horizons suppose **aucune** nouvelle seconde intercalaire pour convertir UTC (négligeable ici).
- Utilisation : **validation seulement** (T-24), pas source de production : le pipeline reste hors ligne et reproductible (SPICE). Les réponses Horizons utilisées en validation sont **sauvegardées** dans `data/cache/horizons/` (hors Git) avec la date de requête.

### 3.3 Valeur de référence obtenue (Horizons, requête du 14/11/2026)
Site (longitude 129,5° E, latitude −89,67°, altitude 0), **Soleil**, apparent, UTC :
| Instant | Azimut (°) | Élévation (°) |
|---|---|---|
| 2027-03-14 06:00 | 334,390842 | −0,535050 |
| 2027-03-14 07:00 | 333,883055 | −0,537365 |
| 2027-03-14 08:00 | 333,375278 | −0,539705 |
Ces trois lignes sont un **premier jeu d'essai** pour T-24 ; la tolérance se **mesure** (nous comparons SPICE DE440s `LT+S` à Horizons DE441 avec déviation de lumière) et se **note**, on ne la présume pas.

## 4. Sites : catalogue (D-018)
- **Régions NASA, octobre 2024 (9)** ✅ : voir § 0. Critères cités par NASA : intérêt scientifique, fenêtres de lancement, terrain, communications avec la Terre, éclairage, capacités de trajectoire SLS/Orion/Starship ✅.
- **Sites LOLA étudiés par Barker et al. 2021 (4)** ✅ : Site01 (Connecting ridge), Site04 (Shackleton rim), Site07 (Peak near Shackleton), Site11 (de Gerlache rim) ; ce sont ceux dont les MNT 5 m ont été produits d'abord et dont l'éclairement est le mieux documenté. **Ils ne sont plus tous dans la liste NASA de 2024** : nous les gardons comme « sites étudiés (LOLA) » et le disons.
- **Liste de 2022 (13)** : historique, à ne plus présenter comme actuelle.
- **Correspondances PGDA 78 ↔ régions 2024** (lecture croisée de CHAT, **à confirmer** par l'emprise des fichiers) : Malapert Massif = Site23 ; Nobile Rim 1 = Site06 ; Nobile Rim 2 = DM2 ; de Gerlache Rim 2 = SL2 (la page PGDA indique aussi « de Gerlache rim » pour Site11 : ambiguïté) ; Haworth = « Haworth ». **Aucun identifiant trouvé** pour Peak near Cabeus B, Mons Mouton, Mons Mouton Plateau, Slater Plain.
- **Positions** : la règle de D-016 reste (centre de l'emprise du MNT 5 m, source écrite, jamais de mémoire). Pour les régions sans 5 m : relever la position d'une source officielle (NASA SVS https://svs.gsfc.nasa.gov/5013 — page de **2022** ; image de **2024** de NASA.gov ; Quickmap) et la recouper sur le MNT 20 m.

## 5. Validation et recoupements
| Contrôle | Données | Taille | Remarque |
|---|---|---|---|
| Soleil/Terre vus d'un site (apparent) | Horizons (§ 3) | quelques Ko par requête | **principal** ; T-24 |
| Illumination moyenne du Soleil | LOLA GDRVIS `AVGVISIB_85S_060M_201608` (60 m, 85–90°S) ; `_EARTH` pour la Terre ; 75S 120 m ; 65S 240 m | 49 Mo (IMG) ✅ chacun ; JP2 28 Mo et 21 Mo ✅ | https://imbrium.mit.edu/BROWSE/EXTRAS/ILLUMINATION ; **moyenne sur 18,6 ans (cycle de précession)**, pas sur 2026–2030 : **comparaison de méthode, pas de valeurs**. Citation demandée : Mazarico et al. 2011, Icarus 211, 1066–1081, doi:10.1016/j.icarus.2010.10.030 ✅ |
| Résultats publiés des sites | Barker et al. 2021, PSS 203, 105119 | — | ex. « Site 1 a la plus grande surface d'éclairement moyen > 70 % à 1 m au-dessus de la surface » ✅ (page du produit 78) : contrôle de cohérence qualitatif, sur 18,6 ans à 1 m |
| Outil officiel | Quickmap, Moon Trek (§ 6) | — | contrôle visuel de la position des sites et de l'éclairage |

## 6. Moon Trek, Quickmap, Horizons : état d'accès (14/11/2026)
- **Moon Trek** (https://trek.nasa.gov/moon/) : ouvert dans le navigateur intégré, interface chargée ✅.
- **Quickmap** : l'ancien site (`quickmap.lroc.asu.edu`) redirige vers **https://quickmap.lroc.im-ldi.com/** (hébergé par Intuitive Machines) ; l'ancien site sera retiré ✅ (message affiché). Ouvert ✅.
- **Horizons** : API interrogée ✅ (§ 3).
- Ces trois sites sont des **outils** (cartes, 3D, éphémérides), pas des fichiers à intégrer ; les fichiers de données sont ceux du § 2 et § 3.1.

**Mesures de CHAT du 14/11/2026 (requêtes faites depuis le navigateur intégré, en-têtes HTTP) — à relire avant de s'y fier :**

| Cible | Iframe possible ? | Accès aux données |
|---|---|---|
| Page Moon Trek | **non** : `frame-ancestors 'self'` + un site d'e-learning ; `X-Frame-Options: nasa.gov` | — |
| Tuiles et `WMTSCapabilities.xml` de Moon Trek | — | **oui**, `access-control-allow-origin: *` (tuile test 0/0/0 : 200, image JPEG) |
| Quickmap | **non** : `X-Frame-Options: sameorigin` et `frame-ancestors 'self'` | **aucune API trouvée** ; paramètres d'URL et liens courts seulement |

Conséquences : D-019 (liens profonds, pas d'intégration). Les vues 3D et panoramiques de ces sites ne sont pas exposées comme service ; seules des tuiles 2D (WMTS) le sont sur Moon Trek. Les identifiants de couches polaires ne sont **pas encore listés** (ils viennent de `GetCapabilities`). Licence des couches et conditions d'usage : **non vérifiées**.

## 7. Imagerie et textures (Atlas)
- Texture du globe : NASA SVS « CGI Moon Kit » (https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/), couleurs « optimisées pour l'esthétique, pas pour la science » : **licence et crédit à lire par CODE** (déjà dans M-016).
- Mosaïques LROC NAC des régions candidates (`data.lroc.im-ldi.com`, produits `NAC_ROI_*`, p. ex. `NAC_ROI_MALAPERTLO1`) : **facultatif** ; usage/licence ⚠️ non lus.

## 8. Licences et citations (ce qui est écrit sur les pages)
- Produit 90 ✅ : « Please cite this paper when using these products » — Barker et al. 2023, PSJ 4, 183, doi:10.3847/PSJ/acf3e1 ; données : doi:10.60903/gsfcpgda-lola-spole.
- Produits 78 et 81 ✅ : citer Barker et al. 2021, PSS 203, 105119, doi:10.1016/j.pss.2020.105119 ; la page 78 mentionne Mazarico et al. 2011 pour la numérotation des sites.
- GDRVIS ✅ : Mazarico et al. 2011 (page du produit PGDA 69 : https://pgda.gsfc.nasa.gov/products/69). La page MIT ne donne ni licence ni règle d'usage.
- NAIF/SPICE : conditions NAIF à relever par CODE (SOURCES.md). Horizons : à citer comme « NASA/JPL Horizons System ».
- **Aucune des pages lues ne donne de licence explicite** ; la règle de CODE (citer, versionner seulement les résultats dérivés avec leur citation) reste valable.

## 9. Plan de téléchargement (ordre, qui, quoi)
| Ordre | Quoi | Taille | Qui | Pour quelle tâche |
|---|---|---|---|---|
| 1 | Noyaux SPICE : `naif0012.tls`, `de440s.bsp`, `moon_pa_de440_200625.bpc`, `moon_de440_*.tf` | ≈ 45 Mo (⚠️ à mesurer) | **CODE** (après accord de l'humain), dans `data/raw/spice/`, hors Git | T-20, T-07 |
| 2 | 4 fichiers `Site01/04/07/11_final_adj_5mpp_surf.tif` | ≈ 156 Mo | **humain** (ou CODE avec son accord) → `data/raw/` | S-01, S-02 |
| 3 | `Site23`, `Site06`, `DM2`, `SL2`, `Haworth` (`*_surf.tif`) | ⚠️ à mesurer | idem | niveau 2 (régions 2024) |
| 4 | Réponses Horizons de validation (quelques Ko) | < 1 Mo | **CODE**, `data/cache/horizons/` | T-24 |
| 5 | GDRVIS `AVGVISIB_85S_060M_201608` (+ `_EARTH`) | 49 Mo (+ 49 Mo) | CODE avec accord | T-24 (facultatif) |
| 6 | `LDEM_80S_20MPP_ADJ.TIF` | 2,6 Go | **humain**, seulement si une région 2024 sans 5 m est retenue | niveau 3 |

## 10. Ce que CHAT n'a pas vérifié
Taille de `de440s.bsp` ; contenu du dossier `fk/satellites/` à jour ; que `naif0012.tls` soit toujours la dernière version en 2026 ; tailles des fichiers 5 m autres que ceux des sites 01/04/07/11 ; correspondances PGDA ↔ régions 2024 ; positions des régions 2024 ; licences des textures et mosaïques LROC ; couches « régions candidates » de Moon Trek et de Quickmap (non explorées en profondeur).
