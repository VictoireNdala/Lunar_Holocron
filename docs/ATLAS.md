# ATLAS — globe 3D, cartes 2D et simulation du temps

Spécification de la **partie « Atlas »** de Lunar Holocron (décision D-015, 14 novembre 2026). Elle s'ajoute à la vue de site existante (panorama, vue 3D du terrain, frise) et la **précède** : l'utilisateur choisit un lieu sur l'Atlas, puis ouvre la vue de site.
Inspirations (idées de fonctions uniquement, **ni code ni images copiés**) : Moon Trek (NASA, menu « Projections » : globe 3D, carte du pôle Nord, carte mondiale, carte du pôle Sud ; exagération du relief ; lecture lat/lon) et Quickmap (ASU : frise temporelle avec lecture, Soleil et Terre placés selon l'heure, boussole, échelle, lecture lat/lon/hauteur, recherche par coordonnées).
Lire d'abord `CLAUDE.md` (principes) et `docs/ARCHITECTURE.md` (conventions). En cas de conflit, `CLAUDE.md` gagne.

## 1. Ce que l'Atlas est, et n'est pas

- **Est** : quatre vues d'une **même Lune texturée**, reliées par **une seule horloge** (celle de la vue de site) et par les **marqueurs de sites**.
  1. **Globe 3D** : sphère de rayon 1 (échelle d'affichage), texture couleur, éclairage par le Soleil.
  2. **Carte mondiale 2D** : projection équirectangulaire, longitude 0° au centre, −180° à gauche, +180° à droite.
  3. **Pôle Sud 2D** : projection stéréographique polaire (formules de `PolarProjection`, `docs/ARCHITECTURE.md`), de −60° au pôle (rayon réglable).
  4. **Pôle Nord 2D** : même projection, signes adaptés (§ 5.3), de +60° au pôle.
- **N'est pas** : un terrain 3D mondial. **D-002 reste valable** pour le relief : pas de niveaux de détail, pas de relief global déformé. La sphère est lisse ; la texture seule donne l'aspect. Le relief réel n'apparaît que dans la **vue de site** (maillage régional).
- **Aucun verdict de visibilité ne sort de l'Atlas.** L'Atlas montre où sont le Soleil et la Terre et quelle moitié de la Lune est éclairée ou tournée vers la Terre, **sans relief local** (horizon plat). Les verdicts avec horizon réel restent dans la vue de site. Les infobulles de l'Atlas le disent.

## 2. Principes (hérités de CLAUDE.md, rappelés)

1. **Honnêteté.** La texture est **esthétique** : elle n'est pas une mesure. Les positions du Soleil et de la Terre viennent des éphémérides de **démonstration** tant que SPICE n'est pas branché : bandeau et note l'indiquent (champ `synthetic` du fichier d'éphémérides globales).
2. **Hors ligne.** Textures et données **locales** (`web/assets/`, `web/data/`). Étendre `nonetwork.test.js` à ces fichiers. Aucun CDN, aucune tuile distante.
3. **Une seule horloge.** L'Atlas lit et écrit le même état temporel que la vue de site (`store.js`, fragment d'URL `t=`). Changer l'heure dans l'un change l'autre.
4. **Calcul fait foi.** Les positions des points sub-solaire et sub-terrestre sont **calculées** (pipeline ou JS partagé et testé), jamais « placées à l'œil ».
5. **Pas de repli silencieux.** Si WebGL manque, le globe affiche un message et **les trois cartes 2D (canvas) restent utilisables**.

## 3. Données

### 3.1 Textures (à vérifier sur la source avant usage)
- **Source retenue** : *CGI Moon Kit* de NASA SVS (https://svs.gsfc.nasa.gov/4720). Carte couleur issue de LROC WAC (ASU), relief issu de LOLA ; mention de crédit demandée : « NASA's Scientific Visualization Studio ». **La page indique que la carte est optimisée pour l'esthétique, pas pour la science.** Reprendre cette phrase dans `SOURCES.md` et dans la page méthode.
- Fichiers connus (noms à relever sur la page, **ne pas deviner**) : `lroc_color_2k.jpg` (équirectangulaire, centrée sur 0°) et une version « pôles » (`lroc_color_poles_1k.jpg`) dans le même dossier `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/`. **Disposition de l'image « pôles » inconnue** : l'ouvrir et la lire avant tout usage (projection ? Nord et Sud côte à côte ?). Si elle ne convient pas, **rééchantillonner** la carte équirectangulaire vers la projection polaire (formules du § 5.3).
- Emplacement : `web/assets/moon/` (+ `LICENSE-ASSETS.md` : source, URL, date de téléchargement, SHA-256, crédit, licence **relevée sur la page**).
- Poids visé : texture globale ≤ 2 Mo (2048 × 1024). Pas de 8k ni de 16k.
- CODE ne doit pas deviner la licence : si la page ne l'indique pas clairement, **écrire une question Q-xxx**, ne pas supposer « domaine public ».

### 3.2 Pôle Sud : vraie donnée LOLA (option, après le contrôle du MNT)
Entre −80° et le pôle, on possède le MNT réel (`data/raw/LDEM_80S_80MPP_ADJ.tiff`, hors Git). Le pipeline peut en tirer une **image d'ombrage** (hillshade) **1024 × 1024** en projection polaire (lecture de l'en-tête : pixel 80 m, origine (−304 000 ; +304 000) m), enregistrée dans `web/assets/moon/south_hillshade_80m.jpg` avec sa **provenance** (produit, résolution, date). La carte du pôle Sud l'affiche **par-dessus** la texture, avec la mention « relief réel LOLA 80 m » (vrai) à côté de « texture illustrative » (hors du disque). Ne pas l'activer avant le contrôle de M-014 § 4 (unités, orientation).

### 3.3 Éphémérides globales (nouveau fichier)
`web/data/global.json`, produit par le pipeline (module `pipeline/global_state.py`, appelé par `cli demo`), **même période et même pas horaire** que les sites (D-005 : 2026-01-01 → 2030-12-31, 43 824 échantillons), entiers en **millidegrés** :
```
{ "schema_version": "1.0", "synthetic": true,
  "provenance": { "...": "comme CONTRAT-DONNEES § provenance" },
  "time": { "t0_utc": "2026-01-01T00:00:00Z", "step_s": 3600, "n": 43824 },
  "sun":   { "lat_mdeg": [...], "lon_mdeg": [...], "radius_mdeg": [...] },
  "earth": { "lat_mdeg": [...], "lon_mdeg": [...], "radius_mdeg": [...] } }
```
- **Point sub-solaire** (resp. sub-terrestre) : latitude et longitude sélénographiques (lon Est +, repère `MOON_ME`) du point où le Soleil (resp. la Terre) est au zénith. Calcul : vecteur Lune → corps dans `MOON_ME`, `lat = asin(z/|r|)`, `lon = atan2(y, x)`. C'est **le même vecteur** que celui des séries de site (T-07), pris au centre de la Lune. Ne pas inventer une autre formule.
- Réel (J4) : `spkpos("SUN"/"EARTH", et, "MOON_ME", "LT+S", "MOON")`, en **km** ; convertir et tester (leçon de M-008 sur les unités).
- Démo (T-07, `ephemeris_demo.py`) : mêmes fonctions analytiques que les séries de site → cohérence garantie ; `synthetic: true`.
- Interpolation côté JS : latitude linéaire ; **longitude sur le cercle** (saut +180 → −180 géré, comme le saut d'azimut 359° → 1° de `bodyStateAt`). Hors période : borne la plus proche + avertissement (comme T-09).
- Taille attendue : ≈ 6 listes × 43 824 entiers ≈ 1,5 Mo brut ; si trop gros pour le chargement, publier un pas de 6 h pour l'Atlas (documenté) : la vue de site garde le pas horaire.

## 4. L'horloge et la lecture

- Contrôles, communs à l'Atlas et à la vue de site : champ UTC validé, −1 j / −1 h / +1 h / +1 j, **lecture / pause**, vitesses ×1, ×60, ×3600, ×86 400, bouton « maintenant » (date réelle **si** elle est dans la période, sinon message).
- La lecture suit **le temps réel mesuré** (pas le nombre d'images) : 10 s réelles à ×3600 ⇒ +10 h simulées ±1 % (même test que T-12).
- Le fragment d'URL reste la source de vérité : `#view=atlas&proj=globe|world|south|north&t=…&a=<site>`. Recharger la page rétablit la vue.

## 5. Les vues

### 5.1 Globe 3D (`web/js/atlas/globe.js`)
- Maillage : `SphereGeometry` (64 × 32 segments suffisent), texture 2k, `MeshStandardMaterial` ou matériau maison. **Orientation** : longitude 0°, latitude 0° au point faisant face à +x de la scène, Nord = +y ; longitude Est vers la droite quand on regarde la face visible depuis +x. **Test obligatoire** : `latLonToVector` / `vectorToLatLon` (§ 6) pour (0,0), (0,90), (90,0), (−89,45).
- Lumière : `DirectionalLight` vers la direction **sub-solaire** (vecteur unitaire du § 3.3). Le côté nuit n'est **pas noir pur** (ambiance faible, ~0,08) pour qu'on voie la texture ; une légende dit « côté nuit éclairci pour la lisibilité ».
- **Terminateur** : trait fin sur le grand cercle à 90° du point sub-solaire (toggle). Test § 6.
- **Zone « Terre visible »** : cercle à 90° du point sub-terrestre, un second trait d'une autre couleur (toggle). **Intersection des deux zones** (Soleil au-dessus de l'horizon plat ET Terre au-dessus de l'horizon plat) : étiquette « horizon plat, sans relief ». On ne la colorie pas en vert « OK » : ce serait un verdict.
- Marqueurs : le Soleil et la Terre sont dessinés **hors de la sphère** dans leur direction vue du centre (sprites, taille exagérée, **dit à l'écran**), plus des marqueurs de **points sub-solaire (jaune) et sub-terrestre (bleu)** sur la surface.
- Sites : un marqueur par entrée de `index.json` (symbole + nom au survol, lat/lon, provenance). **Clic** : ouvre la vue de site (même fragment `a=`), **double-clic** : la caméra se centre sur le site (animation ≤ 1 s).
- Interactions : orbite à la souris et au tactile (OrbitControls déjà fourni), zoom limité (ne pas traverser la sphère), bouton « Maison » (vue initiale), lecture lat/lon sous le curseur (raycast sur la sphère), **échelle** et **boussole** (Nord, direction du Soleil), graticule 30° en option.
- Étoiles : fond noir avec champ d'étoiles généré **localement** (points aléatoires à graine fixe) ; ne pas télécharger de carte d'étoiles sans vérifier licence et poids.
- Performance : 60 images/s visées sur un portable sans carte dédiée ; qualité adaptative (comme `terrain3d.js` : si un rendu dépasse 25 ms en moyenne, réduire le nombre de segments et la taille de texture).

### 5.2 Carte mondiale 2D (`web/js/atlas/worldmap.js`)
- Canvas 2D, image équirectangulaire. Surimpressions : graticule, **courbe du terminateur** (calculée par échantillonnage de la latitude du terminateur pour chaque longitude : `tan φ = −cos(λ − λ☉) / tan φ☉`, cas φ☉ ≈ 0 traité ; test § 6), points sub-solaire et sub-terrestre, sites, curseur lat/lon, zoom et déplacement (molette, glisser).
- **Ne pas** présenter la projection équirectangulaire comme conforme aux surfaces : légende « distorsion forte près des pôles ».

### 5.3 Cartes polaires 2D (`web/js/atlas/polarmap.js`)
- **Sud** : ρ = 2R·tan((φ + 90°)/2), x = ρ·sin λ, y = ρ·cos λ (mêmes que `PolarProjection`, k0 = 1) ; le Nord de la page est « vers le haut » pour la **longitude 0°** seulement si x, y sont orientés comme ci-dessus : **vérifier par un test sur 4 points**, ne pas supposer.
- **Nord** : ρ = 2R·tan((90° − φ)/2), x = ρ·sin λ, y = −ρ·cos λ (convention usuelle ; longitude 0° vers le bas). À vérifier par un test d'aller-retour et sur 4 points.
- Affichage : disque limité à la latitude choisie (défaut ±60°), cercles de latitude tous les 5° (ou 10°), méridiens tous les 30°, étiquettes, boussole, lecture lat/lon au curseur (**projection inverse**), sites, point sub-solaire s'il est dans le disque, **ligne du terminateur** découpée au disque.
- Sud : couche **hillshade LOLA 80 m** (§ 3.2) quand elle est validée ; sinon texture seule.
- Nord : **texture seule** (pas de MNT polaire Nord dans notre dépôt). La page le dit : « pas de relief mesuré ici ». Les sites réels ne sont qu'au Sud ; la carte Nord est un **repère**, pas un produit scientifique.

## 6. Fonctions pures et tests (comme `geometry.js`)

Dans `web/js/atlas/sphere.js` (aucun three.js, aucun DOM) :
- `latLonToVector(latDeg, lonDeg)` → vecteur unitaire (x, y, z) ; `vectorToLatLon(v)`.
- `angularDistanceDeg(lat1, lon1, lat2, lon2)`.
- `terminatorLatitudeDeg(lonDeg, subSolarLatDeg, subSolarLonDeg)` (ou liste de points du grand cercle).
- `equirectPixel(lat, lon, w, h)` et inverse ; `southPolar(lat, lon, R)` / `northPolar(...)` et inverses.
- `interpolateSubPoint(series, t)` : latitude linéaire, **longitude sur le cercle**.

Valeurs d'or à écrire **avant** le code (les calculer avec une méthode indépendante, noter la méthode) :
- `latLonToVector(0,0)` = (1,0,0) ; (0,90) = (0,0,1) ou (0,0,−1) selon la convention retenue **écrite dans le code et le test** ; (90,0) = (0,1,0).
- Sub-solaire (0°, 0°) ⇒ terminateur = méridiens ±90° ; Sub-solaire (0°, 90°) ⇒ terminateur = méridiens 0° et 180°.
- Sub-solaire (φ☉, λ☉) ⇒ tout point à 90° exactement a une élévation du Soleil nulle (sur sphère lisse) : test par `angularDistanceDeg`.
- Pôle Sud : aller-retour sur 1 000 points ; correspondance avec la table de projection de `TESTS-VALIDATION.md` (ρ(−89°) = 30 324,1202 m).
- Pôle Nord : aller-retour, symétrie avec le Sud (ρ_nord(+φ) = ρ_sud(−φ)).
- Interpolation de longitude : 179,9° → −179,9° donne 180,0° au milieu, jamais 0°.

## 7. Intégration à la page

- Barre d'onglets en haut : **Atlas** | **Site** (la vue actuelle). Sous « Atlas » : sélecteur de projection (Globe · Monde · Pôle Sud · Pôle Nord), les contrôles de temps communs, les couches (terminateur, zone Terre, graticule, sites).
- Au chargement, la page s'ouvre sur l'Atlas **si** aucun site n'est dans l'URL ; sinon sur la vue de site (pour ne pas casser les liens).
- Aucun texte en dur : tout passe par `i18n.js` (FR/EN ; swahili prévu avec repli EN).
- `nonetwork.test.js` étendu ; un test de fumée ouvre chaque projection et vérifie : pas d'erreur console, pas de requête externe.

## 8. Tâches (ordre de travail dans `PLAN.md`, bloc « Atlas »)

| Id | Contenu | Dépend de | Critères |
|---|---|---|---|
| A-01 | Textures + `LICENSE-ASSETS.md` + `SOURCES.md` | rien | fichiers < 2 Mo, SHA-256, licence **lue sur la page**, disposition de l'image « pôles » documentée |
| A-02 | `sphere.js` + tests d'or | rien | tests du § 6 passent |
| A-03 | `global_state.py` + `global.json` (démo) | T-07 (partie `ephemeris_demo`) | schéma, validation, déterminisme (octet pour octet), `synthetic: true` |
| A-04 | `globe.js` | A-01, A-02, A-03 | § 5.1 ; capture ; repli sans WebGL |
| A-05 | `worldmap.js` + `polarmap.js` (Sud, Nord) | A-01, A-02, A-03 | § 5.2, 5.3 ; captures ; tests de projection |
| A-06 | Onglets, URL, horloge commune, lecture | A-04, A-05 | § 4 et § 7 ; test de fumée |
| A-07 (option) | Hillshade LOLA 80 m sur la carte du pôle Sud | contrôle du MNT (M-014 § 4) | § 3.2 ; provenance affichée |

## 9. Ce que l'Atlas ne fera pas (et pourquoi)
- Pas de relief 3D global ni de LOD (D-002, risque et délai).
- Pas de tuiles distantes (Moon Trek, Quickmap) : hors ligne obligatoire (D-001).
- Pas de verdict « OK / pas OK » sur l'Atlas : l'horizon réel est dans la vue de site.
- Pas de rayon d'Artemis ni de zones d'intérêt officielles tant qu'une source officielle n'est pas lue (SOURCES.md).
