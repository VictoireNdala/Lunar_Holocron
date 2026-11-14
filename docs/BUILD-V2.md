# BUILD-V2 — Correctifs techniques et module « Communications et planification »

> Écrit par CHAT le 2026-11-15 (heure locale ≈ 02 h 30), à la demande de l'humain (message de 01 h 23 avec 14 captures de l'application et de la page « Details » du défi).
> Portée : **construction technique seulement** (pas le texte de soumission ni la vidéo). Décisions associées : D-025 à D-030. Tâches : `V2-01` à `V2-08` (PLAN.md). Message : M-042.
> Règle qui prime sur tout le reste : **aucune affirmation sans preuve ; le réel seulement ; chaque limite est écrite dans l'application.**

## 0. Ce que demande l'humain, point par point (et ce que le défi exige)

| # | Demande (humain) | Constat de CHAT dans le dépôt | Tâche |
|---|---|---|---|
| 1 | Le **maximum de sites** : atterrissages potentiels, sites d'intérêt NASA et de la recherche, dont ceux où il pourrait y avoir de l'eau | 4 sites réels seulement (Site01/04/07/11), tous du « niveau 1 » de Barker et al. | V2-02 |
| 2 | **Supprimer le fictif** | `demo-a/b/c`, `data/sample`, `ephemeris_demo.py` encore dans le produit ; les 4 sites réels ont déjà des éphémérides SPICE (`ephemeris_synthetic: false` dans `web/data/index.json`) mais **`config/sites_real.json` porte encore `ephemeris_synthetic: true`** (valeur périmée à corriger) | V2-01 |
| 3 | Marqueurs de sites : **autre représentation, interactive, taille proportionnelle au zoom** | Cercles de 4 à 6 px, rayon fixe, superposés sur le globe (`maps2d.js` l. 183-187 ; `globe.js` sprites) | V2-03 |
| 4 | **Soleil et Terre = deux points** : rendu « comme Quickmap » | Disque plat dessiné par canvas (`terrain3d.js` `discTexture`), disques de 7 px sur les cartes | V2-04 |
| 5 | **Les TIF sont des carrés plats**, rien ne s'affiche au survol : innover | Grille 257² de 20 km (pas 78 m), coupée net aux bords, teinte hypsométrique, aucune lecture au survol | V2-06 |
| 6 | **Coupures de communication, plan prévisionnel d'alunissage Terre → Lune, délais, zones non couvertes** | Rien. Mais tout ce qu'il faut pour le cœur existe : élévation de la Terre, masque d'horizon, indicateurs « Terre visible », trous (`longest_gap_h`) | V2-05 |
| 7 | **Lire les documents** (page « Details ») | Voir § 0.1 | tout |

### 0.1 Ce que la page « Details » du défi demande, et où c'est couvert

| Exigence du défi (lue sur les captures) | Couverture actuelle | Après V2 |
|---|---|---|
| Sélection de site et **comparaison, avec coordonnées saisies par l'utilisateur** | Comparaison A/B de sites du catalogue seulement | **V2-02 § 3.6** : point libre (lat, lon) n'importe où sur la Lune |
| **Date/heure flexibles** | Oui (barre de temps, champ UTC) | inchangé |
| Soleil et Terre **par rapport à l'horizon**, **temps restant avant le coucher** du Soleil ou de la Terre | Position et verdict ; **pas de décompte** | **V2-05 § 7.1** : « Terre se couche dans … », « Soleil se lève dans … » |
| **Indicateurs d'énergie et de communication** | KPI « Soleil visible % », « Terre visible % », trous | **V2-05** : fenêtres, coupures, plus longue coupure, délai |
| **Visualisations multiples 2D/3D, dynamique temporelle, accessibilité** | Oui en grande partie | V2-03/04/06 (survol, clavier, contrastes) |
| Données et exactitude : **topographie LOLA réelle**, libration, pas d'atmosphère (pas de réfraction), relief complexe du pôle Sud | Oui | V2-06 garde le relief réel ; V2-01 retire le fictif |
| Soumission en anglais (courriel des organisateurs) | Interface FR/EN | La page « Sources et méthode » reste FR/EN |

## 1. Principes (non négociables)

1. **Réel seulement dans le produit livré.** Les données fictives n'existent plus que dans `tests/fixtures/` (hors `web/`), jamais servies par défaut (D-029).
2. **Hors ligne à l'exécution** (D-001, test `nonetwork`) : tout ce qui vient d'Internet est téléchargé par le pipeline, avec empreinte SHA-256, source et licence consignées.
3. **Une position vérifiée ou marquée « non vérifiée »** : chaque site porte `position_basis` (d'où vient la coordonnée) et `verified`. Jamais de coordonnée « de mémoire ».
4. **Trois niveaux de terrain, dits à l'écran** : `5m` (MNT PGDA 78), `80m` (LDEM polaire 80 m, partout au sud de 80° S), `flat` (hors couverture : horizon plat, relief **non modélisé**, et la pastille le dit).
5. **Pas de qualité sacrifiée à la quantité** : si le temps manque, on coupe un module entier (ordre § 9), on ne livre pas un module faux.

## 2. V2-01 — Retirer le fictif (≈ 1 h)

1. `web/data/` ne contient plus **que** des sites réels : supprimer `sites/demo-*.json`, `terrain/demo-*`, `sample/`, et leurs entrées de `index.json` (le pipeline ne les émet plus).
2. `pipeline/cli.py build` n'émet des sites synthétiques **que** avec `--fixtures` (sortie vers `tests/fixtures/web-data/`, jamais `web/data/`). `ephemeris_demo.py`, `dem_synthetic.py`, `tests/reference/make_web_sample.py` : déplacés sous `pipeline/testing/` ou `tests/`, **non importés** par le code de production (test qui le vérifie : `grep` d'import dans `pipeline/` hors `tests/`).
3. Fichier d'or `tests/golden/body_state_cases.json` (signé par CHAT sur `demo-b`, SHA-256 `525481042aa1ecca8bb2541f64dc99625dad7cbc821977dd9ce244b2b92f806f`) : **conservé tel quel comme fixture de test** (il valide des formules, pas des sites). Ne pas le régénérer : la signature serait annulée. Si les tests ont besoin de `demo-b.json`, le générer dans `tests/fixtures/` au lancement des tests.
4. Interface : supprimer les chemins « fictif » (libellés `— fictif`, `?data=data/sample/`, bandeau « Données de démonstration »). **Garder** la pastille d'honnêteté, avec les états réels : « Données réelles · relief 5 m », « … · relief 80 m », « Point libre · horizon approché (500 m) », « Hors couverture polaire · horizon plat ».
5. Corriger `config/sites_real.json` : retirer `ephemeris_synthetic` (périmé).
6. Preuve : `grep -ri "demo-\|synthetic\|sample" web/ --include=*.js --include=*.json --include=*.html` ne trouve plus rien (hors tests) ; `pytest` et `node --test` verts ; l'application démarre sans fichier fictif ; `validate web/data` OK.

## 3. V2-02 — Catalogue étendu et coordonnées libres (≈ 3 h)

### 3.1 Familles de sites

| Famille (`kind`) | Source de la position (`position_basis`) | Terrain | Remarque |
|---|---|---|---|
| `lola_site` : produits PGDA 78 (5 m) | **centre de l'emprise du GeoTIFF** (règle existante, D-016) | `5m` | 4 faits ; **13 à ajouter** (§ 3.2 A) |
| `feature` : cratères et massifs nommés | **Gazetteer IAU** (planetarynames.wr.usgs.gov, fiche citée) | `80m` | glace / ombre permanente / lumière ; § 3.2 B |
| `nasa_region` : 9 régions Artemis du 28/10/2024 | selon § 3.2 C : emprise PGDA si le produit existe, sinon centre d'entité marqué « approximatif » | `5m` ou `80m` | **jamais** « sites d'Artemis III » (D-018) |
| `mission` : atterrisseurs posés ou prévus | coordonnée **publiée par l'agence ou LROC**, source citée ; « prévu » = zone visée, pas un point | `80m` si lat ≤ −80°, sinon `flat` | § 3.2 D |
| `apollo` : 6 sites | **LROC / NSSDC** (module lunaire) | `flat` | § 3.2 E |
| `custom` : saisie de l'utilisateur | l'utilisateur | `80m` si lat ≤ −80°, sinon `flat` | § 3.6 |

### 3.2 Catalogue à construire (valeurs vérifiées par CHAT le 2026-11-15 ; tout ce qui n'est pas ici est « à lire », pas à deviner)

**A. Produits PGDA 78 (5 m)** — liste lue sur https://pgda.gsfc.nasa.gov/products/78 : Site01 (fait), Site04 (fait), **Site06** (Nobile rim 1), Site07 (fait), Site11 (fait, de Gerlache rim), **Site20 / Site20v2** (Leibnitz beta plateau), **Site23** (Malapert massif), **Site42** (de Gerlache-Kocher massif), **Haworth**, **Shoemaker**, **DM1** (Amundsen rim), **DM2** (Nobile rim 2), **SL2** (de Gerlache rim), **SL3** (Connecting ridge extension), **NPA** (Cabeus exterior wall 1), **NPB** (Amundsen 1), **NPC** (Idel'son L crater 1) ; le répertoire https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ en contient d'autres (NPD, LM1 à LM8, SL…) : CODE **liste le répertoire** et prend tout ce qui est nommé. Chaque fichier ≈ 41 Mo ; téléchargement par le pipeline, SHA-256 consigné ; si le téléchargement échoue, le site reste en `80m` (pas de blocage).
Étiquettes `nasa_2024_region` : correspondances **à établir et à marquer `à vérifier`** (ex. Site06 ↔ « Nobile Rim 1 », DM2 ↔ « Nobile Rim 2 », Site23 ↔ « Malapert Massif », Site20 ↔ « Mons Mouton » car Mons Mouton était appelé Leibnitz Beta avant 2022 ; Site11/SL2 ↔ « de Gerlache Rim 2 » *non établi*). **Ne pas affirmer une correspondance qu'aucune source ne donne.**

**B. Entités nommées (Gazetteer IAU, centre, système « Planetographic, +East »)**

| Entité | Lat (°) | Lon E (°) | Diamètre | Fiche / source | Note |
|---|---|---|---|---|---|
| Shackleton | −89,67 | 129,78 | 21 km | planetarynames.wr.usgs.gov/Feature/5450 | le fichier du projet utilise 129,5 pour la même zone : prendre la valeur IAU pour l'entité, laisser Site04 à son centre d'emprise |
| Nobile | −85,28 | 53,27 | 79,27 km | …/Feature/4321 | |
| Scott | −82,35 | 48,52 | 107,82 km | …/Feature/5395 | contexte, pas un site d'intérêt en soi |
| Mons Amundsen | −82,57 | 75,71 | 38 km | …/Feature/16397 | nom approuvé le 2025-03-31 |
| Mons Cabeus | −83,67 | −36,16 | 43 km | …/Feature/16396 | nom approuvé le 2025-03-31 |
| Cabeus | −84,9 | −35,5 | 98 km | fiche IAU …/Feature/953 (valeur reprise de Wikipedia, **lire la fiche IAU**) | cible de LCROSS |
| Faustini | −87,3 | 77,0 | 39–42 km | fiche IAU …/Feature/1919 ; **divergence** : the-moon.us donne −87,18 ; 85,02 | « les longitudes près du pôle sont mal déterminées » : prendre la fiche IAU, marquer `à vérifier` |
| Shoemaker | −88,1 | 44,9 | 50,9 km | Wikipedia (**lire la fiche IAU**) | |
| Haworth | −86,8 à −86,9 | −4 | ≈ 35 km | IAU : nom approuvé en 2008 pour « 86,8 S, 4 O » (planetarynames, page « News ») | PSR de Haworth centroïde −87,575 ; 332,977 E (LROC PSR Atlas) : **ne pas confondre** entité et PSR |
| de Gerlache | −88,5 | −87,1 | 32,4 km | Wikipedia (**lire la fiche IAU**) | |
| Sverdrup, Amundsen, Wiechert J, Idel'son L, Slater (« Slater Plain »), Malapert | à lire | à lire | — | Gazetteer | **CODE lit les fiches** ; Malapert région : (−85,99 ; 357,07 E) selon NASA (science.nasa.gov/image-detail/20100618) |

Tentative de lecture en lot : le Gazetteer propose des fichiers de points centraux de la Lune (CSV/shapefile) ; si le téléchargement fonctionne, lire **toutes** les entités à lat ≤ −80° ; sinon fiches une par une. Toute valeur lue est enregistrée avec l'URL de la fiche et la date de lecture.

**C. 9 régions NASA du 2024-10-28** (NASA ; NTRS 20250011660) : Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, Slater Plain. **NASA ne publie pas de coordonnées par région dans les pages lues.** Règle : (1) si un produit PGDA correspond (§ A), position = centre d'emprise ; (2) sinon position = centre de l'entité nommée (§ B) avec `position_basis: "feature_center"`, `approximate: true`, rayon d'incertitude affiché = rayon de l'entité ; (3) « Peak near Cabeus B » et « Slater Plain » : **à rechercher** (Gazetteer, LROC) ; à défaut, ne pas les placer et le dire dans la fiche du catalogue. Montrer sur la carte l'**empreinte approximative** (cercle), pas un point exact.

**D. Missions** (coordonnées ou zones, source citée dans la fiche)

| Mission | Position | Statut (à la date de lecture) | Source |
|---|---|---|---|
| IM-1 Odysseus | −80,13 ; 1,44 E (alt. 2579 m) | posé le 2024-02-22 | NTRS 20250011367 (affiche CLPS, AGU 2025) |
| IM-2 Athena | visé −84,78 ; 29,13 E (Mons Mouton) | posé le 2025-03-06, tombé sur le côté ; fin de mission sans recharge | LROC « IM-2 Landing Region » (lroc.im-ldi.com/images/1401) ; NTRS ci-dessus ; planetary.org/space-missions/clps. **Zone visée, pas la position finale** |
| Chandrayaan-3 (Statio Shiv Shakti) | −69,373 ; 32,319 E | posé le 2023-08-23 | Wikipedia « Statio Shiv Shakti » (nom approuvé par l'IAU le 2024-03-19) ; ISRO (UNOOSA 2024) : 69,3 S ; 32,3 E. **Divergence** : une source donne −69,3676 ; 32,3481 (≈ 1 km) → `verified:false`, écart affiché |
| Chang'e-7 | **rapporté** −88,8 ; 123,4 E (« pic près de la crête sud-est de Shackleton ») | lancement visé août 2026 ; aucune confirmation d'alunissage lue | SpaceNexus et Wikipedia ; **non confirmé par une source primaire** ; recoupe le centre d'emprise de Site07 (−88,811 ; 123,690) : **à dire comme recoupement, pas comme identité** |
| Blue Moon MK1 « Endurance » (CLPS / NASA) | zone « Shackleton Connecting Ridge » (pas de coordonnée lue) | prévu ; état à vérifier | blueorigin.com, NASA ; **ne pas placer de point** : afficher sur l'empreinte de Site01 « zone prévue (sans coordonnée publiée) » |
| Chandrayaan-4 / LUPEX / Chang'e-8 (Leibnitz Beta ≈ Mons Mouton, vers 2029 selon Wikipedia) | régions seulement | prévus | **pas de coordonnées** : étiquette sur la région |
| VIPER (annulé par la NASA, une source), CLPS ultérieurs | — | — | ne pas les inclure sans source primaire |

**E. Apollo** (module lunaire, repère ME) : Apollo 11 (0,67416 N ; 23,47314 E) ; Apollo 12 (−3,0128 ; −23,4219) ; Apollo 14 (−3,64589 ; −17,47194) — NSSDC « Apollo Landing Site Coordinates » (déterminées par images LRO, Wagner et al. 2017) ; Apollo 15 (26,13239 ; 3,63330) ; Apollo 16 (−8,9734 ; 15,5011) ; Apollo 17 (20,1911 ; 30,7723) — « 2016 LROC Coordinates of Human Features » (lroc.asu.edu). **CODE relit les deux pages et reporte les valeurs lues**, pas celles de ce tableau, et signale tout écart.

### 3.3 Intérêt scientifique (étiquettes, avec la référence ; jamais « contient de l'eau »)

Champ `interest[]` : `{ "kind": "h_enhanced" | "psr" | "illumination" | "dte" | "lcross", "ref": "…" }`. Seulement ce que la source dit :
- **Hydrogène enrichi (probablement glace)** dans la plupart des PSR au sud de 77° S ; maxima à Haworth, Shoemaker, Faustini — McClanahan et al. 2024, *Planetary Science Journal* 5, 217, doi:10.3847/PSJ/ad5b55 (arXiv:2303.03911).
- **Détections de glace de surface (M³) dans des PSR** de Shoemaker, Faustini, Cabeus, Malapert, Nobile, Sverdrup, Wiechert J, Haworth — *PSJ* (IOP) doi:10.3847/PSJ/abf3c5 (la liste exacte vient du résumé lu ; CODE relit l'article).
- **Panache de LCROSS excavée à Cabeus** — Colaprete et al. 2010 (cité par l'article ci-dessus).
- **Lumière quasi permanente** sur des points des bords de Shackleton et de Malapert (≈ 90 % du temps, source : Sky & Telescope / NASA GSFC) ; Malapert : excellente visibilité de la Terre (NASA science.nasa.gov, 2010).
- **Visibilité de la Terre limitée au pôle** : la NASA écrit que la Terre n'y est visible que pendant environ la moitié de chaque mois sidéral (Lunar Communications and Navigation Architecture, NASA 2024) — **sert de test de cohérence § 8**.

### 3.4 Contrat 1.2 (champs **optionnels** seulement, rien de retiré)

Dans `index.json` et `sites/<id>.json` : `kind`, `position_basis`, `approximate` (bool), `position_uncertainty_km`, `terrain_tier` (`"5m" | "80m" | "flat"`), `sources[]` (`{label, url, read_utc}`), `interest[]`, `status` (`"landed" | "planned" | "failed" | "candidate" | "reference"`), `mission` (texte). `validate` vérifie : `terrain_tier == "5m"` ⇒ `dem.resolution_m == 5` ; `kind == "custom"` interdit dans `index.json`. Schémas, `CONTRAT-DONNEES.md` § 7 ter et tests dans le **même commit** (D-021 sert de modèle).

### 3.5 Construction

- Sites `5m` : chaîne existante (`dem_geotiff.py`, `terrain_grid.py`, `horizon.py`, `ephemeris_spice.py`). Sites `80m` : même chaîne avec `LDEM_80S_80MPP_ADJ.tiff` seul, grille 257² de 20 km (78 m) — **le pas de la grille est le pas du LDEM**, donc aucun sur-échantillonnage trompeur ; `terrain_tier: "80m"`. Durée mesurée : ≈ 17 s par site (118 s pour 7 sites) → 40 sites ≈ 12 min.
- Sites `flat` (Apollo, missions hors pôle) : séries Soleil et Terre SPICE, **masque d'horizon plat** (courbure incluse), `terrain_real: false` **avec le sens exact** : « relief non modélisé » (pas fictif). Nouveau drapeau `terrain_modeled: false` ; **ne pas** réutiliser `synthetic`.
- Poids : un site ≈ 2,5 Mo (série 43 824 × 6 millidegrés + terrain). 40 sites ≈ 100 Mo : **charger à la demande**, jamais tous au démarrage (le préchargement actuel de 4 sites reste ; ajouter un cache LRU de 6 sites). Alternative si trop lourd : réduire la série des sites `80m` secondaires à un pas de 2 h (contrat 1.2 : `time.step_s`), **seulement si** mesuré nécessaire et dit dans la méthode.

### 3.6 Coordonnées libres (exigence explicite du défi) — « Point libre »

Sans réexécuter le pipeline, **dans le navigateur** :
1. **Soleil et Terre** : `global.json` donne, par heure, le point sub-solaire et le point sub-terrestre (lat, lon, rayon angulaire, repère `MOON_ME`). Pour un point (φ, λ) : θ = distance angulaire au point sub-corps ; distance du corps d = R_corps / sin(rayon angulaire) ; **élévation exacte = atan2(d cos θ − R_lune, d sin θ)** (la parallaxe de la Terre fait ≈ 0,26° : à ne pas négliger) ; azimut par trigonométrie sphérique. **Preuve exigée** : sur les 5 sites × 3 dates de la validation Horizons, écart du calcul client contre la série SPICE du site < 0,01° (sinon tolérance mesurée et affichée).
2. **Horizon** : le pipeline exporte `web/data/polar/ldem_south_500m.bin` (uint16 linéaire, polaire stéréographique, 80° S → pôle, ≈ 1 200 × 1 200 px, ≈ 3 Mo, entête JSON : min/max, projection, pas) **dérivé du LDEM 80 m par moyenne par blocs** (`BUILD-V2` § 6 en a besoin aussi). Le client lance le même algorithme de masque (360 azimuts, courbure incluse) sur cette grille. **Ce n'est pas l'horizon 80 m** : pastille « horizon approché (500 m) ». **Preuve exigée** : sur Site01/04/07/11, écart RMS et maximum entre l'horizon client (500 m) et l'horizon pipeline (80 m + 5 m), publié dans `VALIDATION-RESULTATS.md` ; si le maximum dépasse 1°, le dire dans la fiche (les obstacles fins sont lissés).
3. **Hors couverture** (lat > −80°) : horizon plat, pastille « Hors couverture polaire : relief non modélisé ».
4. Sortie : mêmes `kpis`, mêmes verdicts, même frise, même comparaison (A ou B = point libre). Entrée : champ lat/lon (validation : −90 < lat < 90, ±180 ; refuser le pôle exact, D-012), clic sur la carte, lien partageable `#view=site&a=custom:-85.3,53.3`. Le point libre n'est **jamais** écrit dans `index.json`.
5. Le calcul client réutilise `bodystate.js` et les formules partagées (visibilité) : **ne pas réécrire** ces formules.

## 4. V2-03 — Marqueurs de sites (≈ 1,5 h)

Cause actuelle : rayon constant (4–6 px) sur des cartes projetées de ≈ 600 km → les 40 sites se recouvrent.

1. **Glyphes à double codage (forme + couleur)** : ◆ région NASA 2024 · ● site LOLA 5 m · ○ entité nommée · ▲ mission (plein = posé, creux = prévu, croix = échec) · ✦ Apollo · ⌖ point libre. Palette sûre pour le daltonisme (vérifier les contrastes par calcul, ≥ 3:1 sur le fond) ; l'état « sélectionné » = anneau + étiquette fixe.
2. **Taille liée au zoom** : taille écran `clamp(5, 5·√zoom, 16) px` ; **empreinte réelle** : quand la région vaut > 14 px à l'écran, dessiner le **cercle au rayon réel** (rayon de l'entité, ou 8 km pour une emprise 5 m 16 km, ou l'incertitude `position_uncertainty_km` : trait pointillé si `approximate`). C'est ce qui fait que « la taille change proportionnellement » quand on zoome.
3. **Désencombrement** : regroupement par grille de ≈ 28 px ; pastille « 7 » ; clic = zoom sur le groupe ; étiquettes seulement pour : niveau 1, sélectionné, survolé, et tout si zoom ≥ seuil, avec évitement de collision (liste de rectangles, priorité niveau 1 > région NASA > mission > entité).
4. **Interactivité** : survol = infobulle (nom, famille, terrain `5m/80m/flat`, drapeaux, Terre/Soleil visibles % — strict — de la fenêtre courante) ; clic = fiche (existante, S-03) ; **clavier** : Tab parcourt les marqueurs (ordre = priorité), Entrée = fiche, flèches = marqueur voisin ; `aria-label` complet ; `prefers-reduced-motion` respecté.
5. **Zoom et panoramique** sur les cartes 2D (molette, pincement, glisser, boutons +/− ; touche `0` = recadrer) si ce n'est pas déjà le cas (vérifier `maps2d.js` : projection à rayon fixe aujourd'hui). Sur le globe 3D : marqueurs en **sprites à taille écran constante** (comme aujourd'hui `sizeAttenuation` est faux pour les points), placés sur la sphère ; masqués côté éloigné.
6. Couche « Glace / intérêt » (case à cocher) : colore la bordure des marqueurs selon `interest[]` (§ 3.3) avec légende **qui cite la source**, pas « eau ».
7. Preuve : captures du pôle Sud à 3 zooms (1×, 4×, 16×) montrant : taille proportionnelle, regroupement, étiquettes sans chevauchement ; test unitaire du regroupement et de l'évitement de collision (fonctions pures, `node --test`).

## 5. V2-04 — Soleil et Terre : vrais disques (≈ 2 h)

**Vue de site (3D et panorama)**
1. **Taille réelle** : rayon angulaire réel depuis les séries (Soleil ≈ 0,26–0,27°, Terre ≈ 0,9–1,05°). À l'échelle réelle ils ne font que quelques pixels : afficher le **disque réel + halo** et un interrupteur « Agrandir ×N (illustratif) » (défaut : ×1 ; le facteur est écrit dans la pastille). L'actuel `MIN_SPRITE_RADIUS_DEG = 2°` reste disponible mais **dit** « agrandi ×N ».
2. **Soleil** : disque très lumineux, **assombrissement centre-bord** (loi linéaire de limb darkening, coefficient u ≈ 0,6 ; paramètre documenté), halo additif (`THREE.AdditiveBlending`), rayonnement en lentille discrète ; dépasse l'horizon proprement : **coupe réelle par le relief** (le disque est masqué par le terrain, pas atténué à 35 %) — le Soleil « à moitié levé » doit se voir à moitié.
3. **Terre** : sphère éclairée dessinée **avec sa phase réelle** : fraction illuminée k = (1 − cos ψ)/2 où ψ = séparation angulaire Soleil–Terre vue du site (pleine Terre quand le Soleil est à l'opposé), terminateur orienté vers l'angle de position du Soleil ; texture : **procédurale** par défaut (océans, continents schématiques, atmosphère bleutée au limbe) ; si l'humain fournit/valide une texture (NASA Blue Marble, domaine public à confirmer) → option. **Étiqueter « Terre (schématique) »** tant que c'est procédural.
4. **Étiquettes et aides** : nom, élévation, marge à l'horizon, « se couche dans … » (V2-05 § 7.1) ; traînée de la trajectoire ±24 h (polyligne fine) ; repères de l'horizon (N/E/S/O) ; lisibilité WCAG (texte sur verre ≥ 4,5:1).

**Atlas (globe et cartes)**
5. Point sub-solaire : disque jaune avec halo + **terminateur dégradé** (déjà là) ; point sub-terrestre : disque bleu à anneau ; **zones remplies, translucides** : hémisphère éclairé (le côté nuit assombri), calotte « Terre au-dessus de l'horizon plat » (bleu léger) avec légende ; pastille distance/élévation au survol.
6. Sur le globe 3D : Soleil et Terre en **billboards à taille angulaire correcte vue de la Lune**, pas en sprites de 0,9 / 1,1 unité.
7. Preuve : captures « avant / après » aux mêmes dates ; test : le rayon dessiné (px) = rayon angulaire × px/° (fonction pure) ; Terre pleine quand ψ = 180° (test), croissant quand ψ petit.

## 6. V2-06 — Fond polaire, empreintes DEM sans bords carrés, lecture au survol (≈ 3 h)

**Constat** : la vue de site est une dalle 20 × 20 km, hypsométrique, coupée net ; les cartes 2D n'ont qu'une texture LROC couleur ; rien n'est lisible au survol. Innovation retenue : **un fond polaire réel et lisible partout, et des empreintes fondues dedans**.

1. **Fond polaire = relief LOLA réel** : `ldem_south_500m.bin` (§ 3.6) → dans le navigateur : **ombrage (hillshade) calculé à la volée** avec la direction réelle du Soleil au temps courant (échelle de teinte hypsométrique sobre + ombrage multiplicatif) — le jour/nuit local suit le curseur de temps. Légende : « ombrage par incidence locale, **sans ombres portées** ». *Stretch (P2)* : ombres portées par lancer de rayon sur la grille 500 m dans un Worker (≈ 1–2 s, recalculé à l'arrêt du curseur, pas en lecture).
2. **Empreintes** : chaque site `5m` montre son **empreinte réelle** (carré 16 km de l'emprise) **fondue** : bord à dégradé alpha sur ≈ 1,5 km (masque lisse, jamais de trait net), hillshade 5 m **fusionné** au fond ; au zoom faible, seulement l'anneau pointillé ; au zoom fort, le détail 5 m apparaît progressivement (transition par opacité entre niveaux). Les valeurs 5 m et 80 m se recoupent : **pas de couture** (test : différence de hauteur sur l'anneau de recouvrement, publiée).
3. **Vue 3D de site** : (a) maillage central 5 m/78 m existant ; (b) **anneau de contexte** : le LDEM 500 m étendu à ±80 km, maillé en dégradé de résolution, **jonction sans bord** (jupes + fondu de couleur et de brouillard à distance) ; (c) hillshade + pente visibles même sans Soleil (l'« éclairage d'étude » reste, étiqueté illustratif) ; (d) **l'horizon vu du site peut maintenant dépasser 10 km** (sommets lointains visibles dans le panorama 3D), déjà vrai dans le masque.
4. **Survol / sonde** (carte 2D, vue 3D, panorama) : à la position du curseur, lire : latitude, longitude, **altitude** (m, par rapport à R_REF), **pente** (°), distance et azimut depuis le site, **élévation de l'horizon dans cette direction** (lue dans le masque) et « Soleil / Terre au-dessus de cet horizon à t : oui/non ». Sur la carte : infobulle suivant le curseur + réticule ; au clavier : flèches déplacent la sonde (a11y). Calcul pur et testé (`probe.js` : altitude bilinéaire, pente par différences centrées, cohérent avec `dem.py`).
5. **Courbes de niveau** (isohypses) en option sur la carte (pas 250 m / 500 m selon le zoom), marching squares sur la grille 500 m.
6. Couche « Ombre permanente (PSR) » : *stretch* — seulement si une source de polygones sous licence claire est disponible dans le temps imparti (LROC PSR Atlas, PGDA 69) ; sinon **ne pas la dessiner depuis des valeurs approchées**.
7. Preuve : captures sans bord carré (zoom 1×, 4×, 16×) ; test de la fonction de fondu (alpha = 1 au centre, 0 au bord, monotone) ; test de la sonde sur 3 points dont les valeurs sont recalculées indépendamment dans Python.

## 7. V2-05 — Communications et planification d'alunissage (≈ 4 h) — le module manquant

> **Honnêteté d'abord.** Ce module calcule la **géométrie** : la Terre est-elle au-dessus de l'horizon local (ligne de vue directe) et combien de temps, avec quel délai de propagation. Il **ne modélise pas** : les relais en orbite (Queqiao-2, passerelle NRHO, satellites commerciaux : aucune éphéméride sourcée dans le dépôt), les stations au sol (antennes DSN/ESA), la puissance de liaison, les trajets multiples (la NASA signale que la Terre rasante près de l'horizon dégrade la liaison), la trajectoire Terre → Lune (la NASA écrit que l'orbite NRHO impose de fortes contraintes temporelles et géométriques à l'accès à la surface). Ces limites sont dans la page méthode et sur chaque écran du module.

### 7.1 Indicateurs en direct (barre de temps et fiche de site)

À l'instant t choisi, pour le site A (et B si comparaison) : 
- **État** : « Liaison directe possible / bloquée » (Terre au-dessus du masque d'horizon, seuil strict ou optimiste, + **angle minimal utile** réglable 0–5°, défaut 0°, libellé « paramètre utilisateur, non normatif »).
- **Décompte** : « La Terre se couche dans 3 h 12 » / « se lève dans 41 h » ; idem **Soleil** (énergie). Résolution : 1 minute (affiner les croisements entre échantillons horaires par interpolation d'Hermite de l'azimut et de l'élévation ; **mesurer l'erreur** contre SPICE minute par minute sur 5 sites, annoncer « ± x min » dans l'infobulle).
- **Délai de propagation** : aller simple = distance oblique / c (≈ 1,19 à 1,36 s selon la distance Terre–Lune ; la valeur affichée est **calculée**, pas citée) ; **aller-retour** = 2×. Distance oblique du site : d_site = √(d² + R² − 2 d R cos θ) (§ 3.6) ; courbe de la distance Terre–Lune sur la frise.
- **Marge** : élévation de la Terre − élévation de l'horizon dans son azimut (degrés), déjà calculée dans les lectures.

### 7.2 Coupures (« outages »)

À partir de la série horaire (puis affinée à la minute) : liste **chronologique** des fenêtres « Terre visible » et des coupures, pour le site et la fenêtre choisis (7 j, 30 j, 1 an, tout) : début, fin, durée ; **plus longue coupure**, nombre de coupures, % de temps couvert ; même chose pour le Soleil ; **fenêtres « les deux »** (énergie + lien). Affichage : bandes sur la frise (existant) + **tableau triable** + export CSV (rattrape T-16, une seule fois). Le chiffre « plus longue coupure » reprend `kpis.*.longest_gap_h` : **test d'égalité** avec le pipeline.

### 7.3 Planificateur d'alunissage (« Quand atterrir ici ? »)

Entrées : site (catalogue ou point libre), fenêtre de recherche (défaut : de la date du jour au 2030-12-31 ; la série couvre 2026–2030), **durée de séjour en surface D** (jours ; paramètre utilisateur, défaut 7 j, non tiré d'une mission), contraintes optionnelles : Soleil ≥ x % (énergie), Terre visible ≥ y % (lien), coupure maximale ≤ z h, « pas de coucher du Soleil avant H heures après l'alunissage ».
Calcul : pour chaque instant d'alunissage candidat t₀ (pas de 6 h), indicateurs sur [t₀, t₀ + D] : % Soleil, % Terre, % les deux, plus longue coupure Soleil, plus longue coupure Terre, **temps jusqu'au premier coucher du Soleil**, **temps jusqu'à la première perte de lien**. Classement (score = ordre lexicographique des contraintes puis % les deux ; formule affichée, pas de score opaque) ; sortie : **carte de chaleur calendaire** (jour × heure ou mois × jour : couleur = % les deux), **top 10 des fenêtres**, bouton « Placer le curseur de temps sur cette date ». Comparaison de 2 à 4 sites sur la même fenêtre (tableau).
Calendrier de mission **à décalages saisis** : lancement = alunissage − durée de transfert (**saisie utilisateur**, défaut vide) ; l'application n'invente aucune trajectoire. Elle affiche : lancement → alunissage → fin du séjour, avec, pour la phase de surface, les indicateurs ci-dessus.

### 7.4 « Zones non couvertes »

1. **Carte instantanée** (Atlas pôle Sud) : calotte « Terre au-dessus de l'horizon plat » (existe) **plus**, pour chaque site du catalogue, l'**état réel** (liaison possible / bloquée par le relief) à l'instant t : le marqueur change de contour (plein/creux) — c'est la différence entre la limite géométrique théorique et le terrain réel.
2. **Carte de couverture sur une fenêtre** : couleur des marqueurs = % de temps de liaison directe sur la fenêtre choisie ; légende continue. C'est un **échantillonnage par sites** (les sites sont les points de mesure), pas une cartographie continue : l'écrire.
3. *Stretch (P2)* : **raster de couverture** à 2 km sur 80° S → pôle (≈ 40 000 cellules) calculé par le pipeline (numba ou NumPy vectorisé, 360 azimuts × ≈ 300 pas de rayon : ≈ 4·10⁹ opérations, ordre de la minute avec numba) pour une fenêtre de référence (année 2027) et le seuil strict ; sert de fond « % de liaison directe » ; si le temps ne permet pas **de le valider** (échantillon de 5 cellules recalculé à 80 m, écart publié), ne pas le livrer.

### 7.5 Interface

Nouvel onglet du rail « Liaison » (vue `#view=link&a=<id>&t=…&win=…`), 3 sections : *Maintenant* (§ 7.1) · *Coupures* (§ 7.2) · *Planifier* (§ 7.3). Pastille de limites toujours visible : « Géométrie seulement : relais, stations, puissance de liaison et trajectoire non modélisés ». Accessible au clavier, tableaux avec en-têtes, couleurs doublées d'un motif.

## 8. Preuves exigées (une ligne de preuve par tâche dans STATUS)

| Preuve | Méthode | Seuil |
|---|---|---|
| Cohérence physique de la liaison (test de la NASA) | Point à −89,9° avec **horizon plat**, fenêtre 2026–2030, seuil strict : fraction de temps Terre au-dessus de 0° | ≈ 50 % (la NASA : « environ la moitié de chaque mois sidéral ») ; écart toléré ± 5 points, sinon **chercher la cause avant de livrer** |
| Délai de propagation | Distance de SPICE vs Horizons (quantité 20, portée) sur 5 sites × 3 dates déjà en cache | écart < 1 ms ; sinon le dire |
| Instants de coucher/lever | Recalcul indépendant SPICE à la minute sur 5 sites | médiane < 1 min ; maximum publié |
| Calcul client (point libre) | Sites connus recalculés dans le navigateur vs série du pipeline | < 0,01° ; horizon client vs pipeline : RMS et maximum publiés |
| Plus longue coupure | égale à `kpis` du pipeline | égalité exacte |
| Fusion sans couture | hauteur 5 m vs 80 m sur l'anneau de recouvrement | écart RMS publié |
| Aucun réseau | test `nonetwork` étendu aux nouvelles vues | 0 requête externe |
| Pas de fictif | `grep` § 2.6 | 0 résultat |
| Données de la fiche | chaque coordonnée a `sources[]` avec URL et date de lecture | test de schéma |

Écart ouvert **T-24** (élévation de la Terre : 2,44·10⁻⁵° de plus que Horizons, cause non établie) : **ne pas le résoudre dans ce lot** ; l'écart est ≪ à la précision d'un horizon (0,01°) ; il reste affiché dans `VALIDATION-RESULTATS.md`.

## 9. Ordre, durées, coupes (échéance de soumission : dimanche 15/11 23:59 heure locale)

| Ordre | Tâche | Durée indicative | Si le temps manque |
|---|---|---|---|
| 1 | **V2-01** retirer le fictif | 1 h | ne se coupe pas |
| 2 | **V2-02** catalogue 80 m (entités + missions + Apollo + `flat`) et **point libre** (§ 3.6) | 3 h | couper d'abord les 13 produits PGDA 5 m supplémentaires (V2-07) |
| 3 | **V2-03** marqueurs | 1,5 h | couper la couche « glace » en dernier |
| 4 | **V2-05 § 7.1 et 7.2** (décompte, délai, coupures) | 2 h | ne se coupe pas : exigence du défi |
| 5 | **V2-06 § 1, 2, 4** (fond polaire, empreintes fondues, sonde) | 3 h | couper les isohypses et les ombres portées |
| 6 | **V2-05 § 7.3, 7.4.1–7.4.2** (planificateur, couverture par sites) | 2 h | planificateur réduit à « meilleures fenêtres d'un site » |
| 7 | **V2-04** Soleil et Terre | 2 h | Terre procédurale simple, sans phase, si nécessaire |
| 8 | V2-07 produits PGDA 5 m supplémentaires | 1 h + téléchargements | |
| 9 | V2-08 : raster de couverture (stretch), PSR (stretch) | — | ne pas commencer sans accord de CHAT |

**Total ≈ 15 h de CODE** : probablement **plus que le temps disponible avec les vérifications**. Ordre de coupe si CODE annonce du retard à 14 h (heure locale) : V2-08, V2-07, puis simplifier V2-04, puis § 7.3. **CODE rapporte l'avancement dans LIAISON à chaque tâche terminée** (un message court, pas un rapport), pour que CHAT puisse arbitrer.

## 10. Limites à écrire dans la page « Sources et méthode »

- Géométrie seulement ; pas de relais ni de station au sol ni de bilan de liaison ni de multitrajet ; pas de trajectoire Terre → Lune (NRHO non modélisée).
- Horizon : `5m` (relief LOLA 5 m + 80 m), `80m`, `approché 500 m` (point libre) ou `plat` ; les masques ne voient pas les obstacles plus petits que la maille ; aucune réfraction (pas d'atmosphère) ; courbure incluse.
- Ombrage du fond polaire : incidence locale sans ombres portées (sauf si le stretch est livré et validé).
- Position des régions NASA : approximative quand NASA ne publie pas de coordonnées ; position des missions « prévues » = zone visée.
- Éphémérides : SPICE (DE440s) ; écarts avec Horizons mesurés ; écart d'élévation de la Terre de 2,4·10⁻⁵° non expliqué.
- Terre procédurale = schématique.

## 11. Sources lues par CHAT le 2026-11-15

NASA (28/10/2024) et NTRS 20250011660 (régions Artemis) · IAU Gazetteer (fiches 5450, 4321, 5395, 16396, 16397 ; page « News » pour Haworth) · NSSDC et LROC (coordonnées Apollo) · LROC (IM-2, NOBILE04) · NTRS 20250011367 (CLPS 2025) · ISRO/UNOOSA et Wikipedia (Chandrayaan-3) · SpaceNews, SpaceNexus, Wikipedia (Chang'e-7) · Blue Origin, collectSPACE, NASA (Connecting Ridge) · PGDA 78 · McClanahan et al. 2024 · *PSJ* abf3c5 · NASA « Lunar Communications and Navigation Architecture » (2024) · NTRS 20240013248 et 20250003321 (relais, visibilité de la Terre) · Sky & Telescope (lumière quasi permanente). **Les pages Wikipedia ne servent qu'à repérer ; la valeur retenue dans le catalogue est celle de la source primaire que CODE relit** (`sources[]`).
