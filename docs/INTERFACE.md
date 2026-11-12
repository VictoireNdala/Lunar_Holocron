# Application web (statique)

Aucune étape de compilation. Modules ES natifs. `three.js` copié dans `web/vendor/three/` (version figée, notée dans `SOURCES.md`).
`index.html` déclare un `importmap` : `"three"` → `./vendor/three/three.module.js`, `"three/addons/"` → `./vendor/three/addons/`.
L'application fonctionne **sans réseau**. Cible : Chrome et Edge récents, ordinateur portable à graphiques intégrés ; lisible sur mobile (pas prioritaire).

## 1. Principes

- **Une seule source d'état** (`store.js`) ; les composants s'abonnent, ne se parlent pas entre eux.
- **Texte uniquement via `i18n.js`** (`fr`, `en`, `sw` prévu : si une clé manque en `sw`, repli sur `en`).
- **Toujours UTC** : l'heure est affichée avec « UTC » ; aucune conversion en heure locale.
- **Honnêteté visuelle** : bannière permanente si `synthetic` ; échelles et unités sur chaque graphique ; exagération verticale indiquée.
- **Accessibilité** : navigation clavier (curseur de temps, boutons), `aria-label`, contraste suffisant, Soleil et Terre distingués par la **forme** et la couleur
  (Soleil : disque ambre ; Terre : disque bleu avec contour), jamais par la couleur seule.

## 2. Modules JavaScript (`web/js/`)

| Fichier | Rôle | API publique |
|---|---|---|
| `constants.js` | Constantes (R_REF, pas, seuils) avec sources en commentaire | exports nommés |
| `visibility.js` | Formules partagées avec Python | `visibleFraction(elDeg, radiusDeg, horizonDeg)`, `horizonAt(horizonElevDeg[360], azDeg)`, `isVisible(f, mode)` |
| `geometry.js` | Angles, repère local → Three.js, interpolation d'azimut | `unwrapAzMdeg`, `enuToThree(e,n,u)`, `wrapDeg` |
| `data.js` | Chargement et lecture des JSON | `loadIndex()`, `loadSite(id)`, `loadTerrain(id)`, `bodyStateAt(site, 'sun'\|'earth', tMs)` → `{azDeg, elDeg, radiusDeg}` |
| `store.js` | État et abonnements | voir § 3 |
| `urlstate.js` | État ⇄ fragment d'URL | `encode(state)`, `decode(hash)` |
| `i18n.js` | Textes et formats | `t(key, params)`, `setLang(lang)`, `formatUtc(ms)` |
| `panorama.js` | Panorama 360° (Canvas 2D) | `renderPanorama(canvas, site, tMs, opts)` |
| `terrain3d.js` | Vue 3D (Three.js) | `createTerrainView(container)` → `{ setTerrain(meta, heights), setBodies(sun, earth), setViewMode(mode), dispose() }` |
| `timeline.js` | Courbes d'élévation et bandes de visibilité (Canvas 2D) | `renderTimeline(canvas, site, tMs, windowDays, mode)` |
| `verdicts.js` | Pastilles de verdict, lectures chiffrées, « Pourquoi ? » minimal | `updateVerdicts(root, site, tMs, mode)` |
| `polarmap.js` | Carte 2D polaire de sélection (SVG) | `createPolarMap(container, index, onSelect)` |
| `compare.js` | Mise en page A/B | `createCompare(...)` |
| `main.js` | Initialisation, boucle d'animation, liaison de tout | — |

Les fonctions pures (`visibility`, `geometry`, `data` sans réseau, `urlstate`) sont testées par `node --test web/tests/`.

## 3. État (`store.js`)

```js
{
  siteIdA: 'demo-a',
  siteIdB: 'demo-b',        // null si pas de comparaison
  compare: true,
  tMs: Date.parse('2027-03-14T06:00:00Z'),
  threshold: 'strict',      // 'strict' | 'any'
  windowDays: 30,           // fenêtre de la frise : 7 | 30 | 365 | 'all'
  lang: 'fr',
  playing: false,
  speed: 3600,              // secondes simulées par seconde réelle : 3600 (1 h/s), 86400 (1 j/s), 604800 (1 sem/s)
  panoramaCenterAz: 0       // azimut central du panorama, degrés
}
```
`urlstate.js` encode : `#a=demo-a&b=demo-b&t=2027-03-14T06:00Z&thr=strict&lang=fr&w=30`. Le fragment est mis à jour (sans recharger) à chaque changement d'état
stable (pas à chaque image de l'animation) ; à l'ouverture, il restaure l'état. Les valeurs invalides sont ignorées sans erreur.

## 4. Mise en page

```
┌ En-tête : Lunar Holocron · [Langue FR/EN] · [Seuil strict/optimiste] · [Comparer A/B] · lien « Sources et méthode » ┐
│ Bannière rouge si synthetic : « DONNÉES DE DÉMONSTRATION — valeurs fictives »                                        │
├───────────────┬─────────────────────────────────────────────┬──────────────────────────────────────────────────────┤
│ Carte polaire │ PANNEAU A                                    │ PANNEAU B (si comparaison)                           │
│ (sélection    │  vue 3D │ panorama 360°                       │  vue 3D │ panorama 360°                              │
│  des sites)   │  verdicts Soleil / Terre, lectures           │  verdicts Soleil / Terre, lectures                   │
│               │  indicateurs (KPI) du site                   │  indicateurs (KPI) du site                           │
├───────────────┴─────────────────────────────────────────────┴──────────────────────────────────────────────────────┤
│ Barre de temps : [◀ ▶ lecture] [vitesse] [champ date UTC] [curseur sur la période] [fenêtre 7 j / 30 j / 1 an / tout]  │
│ Frise : élévation Soleil et Terre dans la fenêtre, bandes de visibilité, repère « maintenant »  (un graphique par panneau) │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
Le temps (`tMs`) est **commun** aux panneaux A et B : on compare deux sites **à la même date**. (« Deux dates » : P1, voir § 9.)
Sans comparaison, le panneau A occupe toute la largeur.

## 5. Panorama 360° (`panorama.js`) — P0

Canvas 2D. Abscisse : azimut (degrés), ordonnée : élévation (degrés).
- Fenêtre horizontale par défaut : **90°** de large centrée sur `panoramaCenterAz` (défilement horizontal à la souris ou aux flèches ; bouton « 360° » pour tout voir).
  Fenêtre verticale : de -2° à +14° par défaut ; molette = zoom vertical. L'échelle verticale est affichée (`échelle ×N` par rapport à l'échelle horizontale).
- **Silhouette du relief** : zone pleine sous la courbe `horizon.elev_deg` (interpolée, bouclage 360°). Le ciel au-dessus. Azimuts `truncated` : trame hachurée.
- **Boussole** : graduations tous les 10°, étiquettes `N`, `NE`, `E`, `SE`, `S`, `SO`, `O`, `NO` (localisées via i18n : `N`, `E`, `S`, `W`/`O`…).
- **Soleil** : disque ambre à sa position `(az, el)`, rayon dessiné = `max(rayon réel à l'échelle, 5 px)` avec un halo ; si le rayon est élargi, le signaler (« taille exagérée »).
  **Terre** : disque bleu avec contour. Étiquettes « Soleil » / « Terre ».
- Si un corps est hors de la fenêtre : flèche sur le bord indiquant sa direction et son azimut.
- **Trace du jour** : trajectoire du corps sur les ±24 h autour de `tMs`, en pointillés (échantillons horaires).
- **Lecture du curseur** : au survol, azimut, élévation de l'horizon à cet azimut.
- Un corps partiellement masqué est dessiné **clippé** par la silhouette (le relief passe devant) ; c'est cohérent avec `visibleFraction` (horizon pris au centre).

## 6. Vue 3D (`terrain3d.js`) — P0

- Repère : le repère local ENU est converti en repère Three.js par `three = (x: E, y: U, z: −N)` (`geometry.enuToThree`). Regarder vers le nord = regarder vers −z.
- Maillage : `PlaneGeometry(size_m, size_m, n−1, n−1)` déplacé en hauteur à partir du `.bin` décodé ; `z_m` déjà corrigé de la courbure. Normales recalculées.
- Teinte hypsométrique (dégradé) du minimum au maximum de la grille, avec légende en mètres. Pas de texture réseau.
- **Exagération verticale** : curseur ×1 à ×5, **défaut ×1**, valeur affichée.
- **Lumière** : `DirectionalLight` dans la direction `enuToThree(sin(az)·cos(el), cos(az)·cos(el), sin(el))` (du site vers le Soleil). Si `el < 0` : lumière éteinte, éclairage ambiant très faible.
  Ombres portées activées (carte d'ombres 2048) ; la boîte de la caméra d'ombre couvre la grille ; réglage du biais pour les angles rasants.
  **Les ombres sont illustratives** (rendu), les verdicts viennent du masque d'horizon.
- Soleil et Terre : sprites (disques générés par Canvas, aucune image distante) placés à grande distance dans leur direction `(az, el)`.
- Marqueur du site (petit mât ou anneau) au centre.
- Deux modes de caméra (`setViewMode`) :
  - `overview` : orbite (OrbitControls) autour du site, distance initiale ≈ 1,2 × `size_m`, angle d'environ 35° ;
  - `ground` : caméra à `observer_height_m` au-dessus du site, regardant l'azimut `panoramaCenterAz`, champ de vision 60° ; synchronisée avec le panorama.
- Qualité adaptative : si la durée de rendu moyenne dépasse 25 ms sur 30 images, passer la carte d'ombres à 1024 puis désactiver les ombres, et le signaler discrètement.
- Libérer proprement (`dispose`) la géométrie, les matériaux et le renderer lors d'un changement de site.

## 7. Barre de temps et frise (`timeline.js`) — P0

- Curseur : de `start_utc` à la fin de la période ; pas d'une heure ; flèches du clavier = ±1 h, `Maj` = ±1 jour. Champ de date UTC éditable (validation, bornes).
- Lecture : bouton lecture/pause, vitesses 1 h/s, 1 j/s, 1 sem/s. L'animation avance `tMs` selon le temps réel écoulé (`requestAnimationFrame`), jamais selon le nombre d'images.
- **Frise** (une par panneau) : abscisse = temps sur `windowDays` centrés (ou débutant) à `tMs` ; ordonnée = élévation en degrés.
  Courbes : Soleil (ambre), Terre (bleu). Ligne de l'**horizon à l'azimut du corps** (gris), calculée par `horizonAt(az(t))` : c'est la vraie limite de visibilité, variable dans le temps.
  Bandes sous le graphique : une rangée par corps, colorée quand le corps est visible (selon le seuil choisi), une rangée « les deux ».
  Repère vertical à `tMs`. Un clic sur la frise déplace `tMs`.
- Échantillonnage : sur 1 an ou « tout », sous-échantillonner (min/max par pixel) pour garder l'allure sans perdre les extrêmes.

## 8. Verdicts, lectures, « Pourquoi ? » minimal (`verdicts.js`) — P0

Pour chaque panneau, à `tMs` :
- Pastille **Soleil**, purement descriptive (indépendante du seuil) : `Masqué` si `f = 0`, `Partiel` si `0 < f < 1`, `Visible` si `f = 1` ; avec `f` en %.
  Même logique pour la **Terre**. Le **seuil** (strict ou optimiste) ne sert qu'au binaire « visible / non visible » utilisé par les indicateurs, les bandes de la frise
  et la phrase « liaison directe possible » (Terre visible selon le seuil) ou « pas de ligne de vue directe (géométrique) ».
  Toujours l'icône et le texte, pas seulement la couleur.
- Lectures chiffrées : azimut et élévation du centre, rayon angulaire, **horizon à l'azimut du corps**, **marge = élévation − horizon** (en degrés, signée).
  C'est la version minimale du mode « Pourquoi ? » : on voit directement ce qui sépare le corps de l'horizon.
- Avertissement si `horizon.truncated` est vrai à l'azimut du corps : « masque minorant : le relief lointain n'est pas couvert ».
- Avertissement si `tMs` est hors de la période couverte.
- **Indicateurs du site** (`kpis`) : cartes « Soleil visible x % », « Terre visible y % », « Les deux z % », « Plus longue nuit h », « Plus longue absence Terre h »,
  dans le seuil choisi, avec infobulle renvoyant à la définition dans la page méthode. Mini-carte de chaleur mensuelle (`monthly`) : 60 cases, cliquable (déplace `tMs` au 1er du mois).

## 9. Carte polaire, comparaison, « et si on décale ? »

- **Carte polaire** (`polarmap.js`, SVG, sans fond d'image réseau) : projection stéréographique polaire Sud (formules d'ARCHITECTURE § 3) jusqu'à la latitude -80° ;
  cercles à -89°, -88°, -85°, -80° (graduations), `0°` en haut et `90° E` à droite (à confirmer avec la convention du MNT réel) ; un point par site (forme différente pour les sites de démonstration) ;
  clic = sélectionne le site (A par défaut ; `Maj`+clic = B). Étiquettes lisibles, zone cliquable ≥ 24 px.
- **Comparaison A/B** (`compare.js`) : deux panneaux identiques, `tMs` commun. Un tableau comparatif sous les panneaux : pour chaque indicateur, A, B et l'écart.
  Si un seul site est choisi, la mise en page se replie.
- **P1 « Et si on décale ? »** : pour le site et le seuil courants, calculer, à partir des séries, la **prochaine fenêtre** (après `tMs`) où Soleil et Terre sont tous deux visibles
  (début, fin, durée) et la **meilleure** fenêtre du mois en cours ; affichage en une phrase avec bouton « aller à ». Calcul côté client, pur, testé.
- **P1 « Deux dates »** : même site à deux dates (panneaux A et B partageant le site et non le temps). Option d'état : `tMsB`.
- **P1 export** : bouton « Exporter les séries (CSV) » pour le site et la fenêtre courants.
- **P2** : lecture animée du panorama avec trace du Soleil ; ombres par ray-marching dans le shader ; pastilles de conformité Artemis (pente, distance au pôle) ; version swahilie complète.

## 10. Page « Sources et méthode » (`method.html`) — P0

Page statique, mêmes styles, même sélecteur de langue. Contenu :
1. Ce que fait l'outil et pour qui (planificateurs, enseignants, public).
2. Données utilisées : produits MNT (nom exact, résolution, lien, licence), noyaux SPICE (noms retenus), lues depuis les `provenance` des JSON (affichage dynamique).
3. Méthode : repère `MOON_ME`, calcul d'élévation et d'azimut, masque d'horizon (algorithme, courbure), fraction visible (formule), seuils strict/optimiste.
4. Définition de chaque indicateur.
5. **Limites** (liste de `PIPELINE.md` § 4) et incertitudes ; résultats de validation (`TESTS-VALIDATION.md` § 6) une fois disponibles.
6. Crédits, licence (Apache 2.0), mentions NASA/USGS/PGDA selon `SOURCES.md`, **usage de l'IA** (section de `SOURCES.md`).
7. Si `synthetic` : paragraphe expliquant que les valeurs affichées sont fictives.

## 11. Performances et robustesse

- Charger un site à la demande ; mettre en cache en mémoire ; afficher un indicateur de chargement ; une erreur réseau locale (fichier manquant) affiche un message clair, jamais une page blanche.
- Budget : première image utile < 2 s en local ; interaction fluide ≥ 30 images/s en vue 3D sur graphiques intégrés ; mémoire < 400 Mo.
- Ne recalculer la fraction visible qu'à l'instant courant (pas sur toute la série à chaque image) ; les bandes de la frise se calculent une fois par site/fenêtre/seuil et sont mises en cache.
- Aucun `console.error` en usage normal (vérifié par le test de fumée).
