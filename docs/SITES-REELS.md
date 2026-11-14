# SITES-REELS — sites d'alunissage du pôle Sud à marquer sur l'Atlas

Rédigé par CHAT le 14 novembre 2026 (décision D-016), à partir de recherches sur le web. **Rien n'est écrit de mémoire** : chaque information porte sa source, et ce qui n'a **pas** été trouvé est dit. Lire d'abord `docs/ATLAS.md` (l'Atlas) et `docs/BRANCHEMENT-DONNEES-REELLES.md`.

## 1. D'où vient la liste

- **NASA, 19 août 2022** : 13 « régions candidates » pour l'atterrissage d'Artemis III, toutes à moins de 6° de latitude du pôle Sud. Chaque région fait environ **15 × 15 km** ; un site d'atterrissage y est une zone d'environ **100 m de rayon**, avec au moins une dizaine de sites par région ; toutes contiennent des sites éclairés en continu pendant **6,5 jours** (durée prévue de la mission).
  Sources : https://www.nasa.gov/news-release/nasa-identifies-candidate-regions-for-landing-next-americans-on-Moon/ · https://www.scientificamerican.com/article/nasa-unveils-candidate-landing-sites-for-artemis-astronauts/ · https://spacenews.com/?p=130778
- **Attention : liste de 2022.** Je n'ai **pas vérifié** si NASA l'a modifiée depuis, ni quelle est la situation de la mission en novembre 2026. Si le guide de l'événement ou NASA donne une autre liste, **elle remplace celle-ci**.
- Les 13 régions : Faustini Rim A · Peak Near Shackleton · Connecting Ridge · Connecting Ridge Extension · de Gerlache Rim 1 · de Gerlache Rim 2 · de Gerlache-Kocher Massif · Haworth · Malapert Massif · Leibnitz Beta Plateau · Nobile Rim 1 · Nobile Rim 2 · Amundsen Rim.
- **Pourquoi pas plus loin que 6° du pôle** : la zone d'intérêt est celle où l'ensoleillement quasi continu des crêtes côtoie des cratères d'ombre permanente (glace d'eau possible). Les critères NASA : pente du terrain, facilité de communication avec la Terre, éclairage, proximité d'une zone d'ombre permanente accessible à pied. **Ce sont exactement les grandeurs que notre produit calcule** (Soleil et Terre vus depuis le site, contre l'horizon réel).

## 2. Où l'on trouve un « MNT à 5 m » pour ces sites

Le produit PGDA 78 (Barker et al.) publie des **GeoTIFF à 5 m/pixel** (coordonnées polaires stéréographiques en mètres, repère `MOON_ME` de DE421, hauteur Z en mètres) pour ces sites. Page : https://pgda.gsfc.nasa.gov/products/78 · répertoire et README : https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ et https://core2.gsfc.nasa.gov/PGDA/LOLA_5mpp/README.
Identifiants listés par cette page (la numérotation vient de Mazarico et al. 2011) :

| Région NASA (2022) | Identifiant PGDA 78 | Remarque |
|---|---|---|
| Connecting Ridge | Site01 | crête entre Shackleton et de Gerlache |
| Shackleton (rim) | Site04 | rebord de Shackleton |
| Peak Near Shackleton | Site07 | pic isolé près de Shackleton |
| de Gerlache Rim 1 / 2 | Site11, SL2 | **correspondance 1 ↔ Site11 et 2 ↔ SL2 non confirmée** |
| Nobile Rim 1 | Site06 | |
| Nobile Rim 2 | DM2 | |
| Amundsen Rim | DM1 | |
| Leibnitz Beta Plateau | Site20 (et Site20v2, limites étendues) | |
| Malapert Massif | Site23 | |
| de Gerlache-Kocher Massif | Site42 | |
| Connecting Ridge Extension | SL3 | |
| Haworth | « Haworth » | |
| **Faustini Rim A** | **aucun identifiant trouvé** | à tirer du MNT 20 m (produit 90) |

- Autres entrées de la page (hors liste Artemis) : Shoemaker, NPA (Cabeus), NPB (Amundsen 1), NPC (Idel'son L), LM1 à LM8.
- La mise en correspondance ci-dessus est **ma lecture croisée** de deux sources ; elle est à confirmer par un rapprochement des emprises (cf. § 4).

## 3. Priorités (ce que nous construisons d'abord)

Critère : **l'appui des sources**, pas une opinion sur « le meilleur site ».
- **Niveau 1 (4 sites)** : Site01, Site04, Site07, Site11. Barker et al. (2021) y construisent d'abord des MNT à 5 m comme « sites d'atterrissage de grande priorité » ; ils sont décrits comme tels sur la page NCCS de la NASA (https://www.nccs.nasa.gov/news-events/nccs-highlights/moon-south-pole) et dans l'article (https://doi.org/10.1016/j.pss.2020.105119).
  Illumination : les crêtes autour de Shackleton reçoivent une lumière quasi continue (trois points du rebord restent éclairés plus de 90 % de l'année selon NASA : https://science.nasa.gov/resource/shackleton-craters-illuminated-rim-shadowed-interior/) ; la crête de liaison (Connecting Ridge) a fait l'objet d'une étude de 19 ans (https://ui.adsabs.harvard.edu/abs/2014Icar..243...78G).
- **Niveau 2** : Malapert Massif (Site23), Leibnitz Beta (Site20), Nobile 1 et 2 (Site06, DM2), Haworth, Amundsen (DM1), de Gerlache-Kocher (Site42), Connecting Ridge Extension (SL3), de Gerlache Rim 2 (SL2).
- **Niveau 3** : Faustini Rim A (pas de MNT 5 m trouvé).
Le niveau décide de l'**ordre de construction** et du **préchargement**, jamais d'un classement scientifique. L'interface le dit (« sites candidats NASA 2022 ; l'ordre est celui de nos priorités de développement »).

## 4. Coordonnées : règle impérative

**Aucune coordonnée n'est écrite de mémoire ni recopiée d'une page de vulgarisation.** Les recherches de CHAT montrent que même un cratère célèbre a **plusieurs positions** selon les sources : Shackleton est donné à 89,67°S 129,78°E (Wikipédia, 21 km de diamètre, 4,2 km de profondeur), à 89,66°S 129,20°E (LROC/ASU), et dans d'anciennes pages à 89,9°S 0,0°E. Les coordonnées de l'UAI ne servent qu'à identifier sans ambiguïté, pas à localiser précisément (note sur https://the-moon.us/wiki/South_Pole).
Règle :
1. **Position d'un site = centre de l'emprise de son MNT 5 m**, lue dans l'en-tête du GeoTIFF (origine et taille de pixel, polaire stéréographique), puis convertie en latitude/longitude par `PolarProjection` (convention contrôlée en M-014 § 4). La **source** (fichier, produit, date) est écrite à côté.
2. Pour un site sans MNT 5 m (Faustini Rim A) : position lue dans une **source officielle** (NASA SVS « Artemis III Landing Region Candidates » https://svs.gsfc.nasa.gov/5013, ou publication) **et** recoupée visuellement sur le MNT 20 m (cratère reconnu).
3. Si deux sources divergent de plus de 1 km, **écrire une QUESTION** ; ne pas choisir en silence.
4. Une position ne devient « vérifiée » qu'après un contrôle visuel (le cratère ou la crête est reconnaissable dans notre vue 3D).

## 5. Fichiers de données à produire

`config/sites_real.json` (une entrée par site) :
```
{ "id": "site04-shackleton-rim", "label_fr": "Rebord de Shackleton", "label_en": "Shackleton rim",
  "artemis_region_2022": "Peak/Shackleton ...", "pgda_id": "Site04", "tier": 1,
  "center": { "lat_deg": ..., "lon_deg": ..., "source": "centre de l'emprise du GeoTIFF Site04_final_adj_5mpp_surf.tif, lu le AAAA-MM-JJ" },
  "dem": { "product": "...", "resolution_m": 5, "file": "data/raw/...", "license_note": "..." },
  "verified": false }
```
Le pipeline en tire, pour chaque site : `terrain/<id>.bin`, `sites/<id>.json`, et une ligne dans `index.json` avec `tier`, `lat`, `lon`, `synthetic: false` (relief réel ; éphémérides de démonstration tant que SPICE n'est pas branché : **deux drapeaux distincts**, `terrain_real` et `ephemeris_synthetic`, pour ne pas mentir par omission).

## 6. Le parcours de l'utilisateur et sa vitesse

1. **Atlas** : seul `index.json` (léger : noms, lat/lon, niveau) est chargé ; les marqueurs du niveau 1 sont plus visibles, les autres plus discrets.
2. **Clic sur un marqueur** : une **fiche** (nom, région NASA 2022, niveau, source du MNT et résolution, « relief réel / éphémérides de démonstration ») s'ouvre ; un bouton « Voir le site » charge la vue de site.
3. **Vue de site** : `terrain/<id>.bin` (≈ 132 Ko à 257²) puis `sites/<id>.json` (≤ 2,5 Mo) ; la vue 3D du terrain s'affiche **avant** le chargement de la série temporelle si possible.
4. **Préchargement** : pendant que l'utilisateur regarde l'Atlas, charger en tâche de fond le terrain des 4 sites du niveau 1 (≈ 0,5 Mo au total) puis les séries ; cache mémoire ; ne jamais bloquer l'interface.
5. **Visite guidée** : bouton « Sites prioritaires » qui enchaîne les sites du niveau 1 dans l'ordre (caméra du globe qui se déplace, puis ouverture de la vue de site).
Poids total attendu : 13 sites × (≈ 2,5 Mo + 132 Ko) ≈ 35 Mo hors ligne, acceptable ; à mesurer, pas à supposer.

## 7. Ce que nous ne disons pas
- Nous ne désignons **pas** « le meilleur site » : le produit montre des conditions de visibilité, pas une recommandation de mission.
- Nous ne prétendons pas que ces 13 régions sont encore les candidates actuelles de NASA (liste de 2022).
- Nous ne donnons pas d'autre précision que celle de la donnée : un MNT de 5 m a ses erreurs (hauteur typique ~0,3–0,5 m, pente ~1,5–2,5° d'après Barker et al. 2021), et l'horizon calculé hérite de ces erreurs.

- **Itinéraire de rover entre cratères** : reporté (backlog `B-01` de `PLAN.md`), après stabilité du système.

## 8. Tâches
| Id | Contenu | Dépend de | Critères |
|---|---|---|---|
| S-01 | Lire l'en-tête des GeoTIFF 5 m (README PGDA), remplir `config/sites_real.json` (niveau 1 d'abord) | accès aux fichiers | chaque position a sa source ; contrôle visuel |
| S-02 | Outil de découpe par site (suite de l'aperçu 3D de M-014 B) → `terrain/<id>.bin`, `sites/<id>.json` | S-01, lecteur GeoTIFF | validate OK ; octet pour octet sur 2 exécutions |
| S-03 | Marqueurs et fiche sur l'Atlas | A-04, A-05, S-02 | § 6 ; niveaux visibles |
| S-04 | Préchargement, cache, visite guidée | S-03 | § 6 ; pas de blocage de l'interface |
