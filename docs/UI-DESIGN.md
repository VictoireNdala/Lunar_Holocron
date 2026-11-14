# UI-DESIGN — refonte de l'interface (D-017)

Rédigé par CHAT le 14 novembre 2026, à la demande de l'humain : l'interface actuelle ne lui plaît pas ; il veut une interface **intuitive, belle, élégante, moderne**, inspirée des meilleurs rendus de 21st.dev. Ce document remplace tout choix visuel antérieur. **Il ne change ni la logique, ni les données, ni les règles d'honnêteté** (D-001 à D-016) : seule la couche de présentation et de navigation change.

## 1. Ce que 21st.dev est — et n'est pas pour nous

- 21st.dev est un catalogue de composants **React + Tailwind + shadcn** (installation par `npx shadcn add …` avec une clé API 21st, quota limité en compte gratuit). Notre application est une page statique **hors ligne**, en modules ES, **sans framework, sans étape de compilation, sans CDN** (D-002, principe hors ligne de `CLAUDE.md`).
- Conséquence : **on n'installe rien de 21st.dev et on ne copie aucun code.** Plusieurs composants portent une licence « unknown » ou « no-license ». On reprend uniquement des **modèles d'interaction et de composition** (le « pourquoi ça paraît bon »), réécrits en HTML/CSS/JS natifs.
- Ce que CHAT a **vu** (aperçus rendus, navigateur intégré) : *Progress Metric Card* (Mak VieSAinte), *Dashboard Sidebar* (Arun Dass), *Scrubber* (Edu Calvo, aperçu minuscule). Ce que CHAT a seulement **lu** (descriptions et articles de blog de 21st.dev) : les autres références du § 2. Les aperçus vus sont des interfaces SaaS **claires** ; le thème sombre « mission spatiale » ci-dessous est notre adaptation, **pas** une copie.

## 2. Références retenues (modèle → usage chez nous)

| Modèle (21st.dev) | Ce qu'on en retient | Où chez nous |
|---|---|---|
| *Progress Metric Card* (Mak VieSAinte) — vu | **Un seul grand chiffre**, puis sa tendance (courbe lisse + infobulle), fenêtre de comparaison écrite **sur la carte** | Carte « verdict » du site (§ 5.4) |
| *Dashboard Sidebar* (Arun Dass) — vu ; *Sidebar Icon Rail* (sean0205) — lu ; *Animated Sidebar* (Unlumen UI) — lu | Rail d'icônes qui se déplie ; en-tête d'espace de travail ; groupes ; pastille de compteur ; indicateur d'élément actif animé | Rail de navigation (§ 5.2) |
| *Scrubber* (Edu Calvo) — vu ; *Playback Scrubber* (sltowl) ; *Filmstrip Scrub* (Mehi) — lus | Curseur à **capsule**, graduations, valeur affichée en ligne, glisser **et** clavier ; tête de lecture + bouton lecture/pause | Barre de temps (§ 5.3) |
| *Command Palette* (Joly UI, Hirael) et l'article « Command Palettes and Search » de 21st — lus | ⌘K / Ctrl+K, recherche floue, résultats groupés, éléments récents, rappel du raccourci sur chaque ligne ; « une palette est utile quand la navigation ne passe plus à l'échelle » | Aller à un site, une vue, une date (§ 5.6) |
| *Analytics Bento* (Jatin Yadav), *Globe Analytics* (shuding) — lus | Grille de panneaux d'**importance inégale** ; une vue géographique | Composition de l'Atlas et de la fiche |
| Articles de 21st sur les tableaux de bord et les barres latérales — lus | Règles de composition (§ 3) | tout |

## 3. Règles de composition (tirées des articles de 21st.dev, adaptées)

1. **Hiérarchie** : un chiffre dominant, puis sa tendance, puis le détail. Pas de grille de cartes de poids égal (chaque nombre se disputerait l'attention).
2. **Fenêtre de comparaison sur la carte**, pas dans une infobulle ; **chiffres tabulaires** (`font-variant-numeric: tabular-nums`) pour que les valeurs ne « sautent » pas ; **hauteur réservée** dans les états de chargement (pas de décalage de mise en page).
3. **États** : chaque panneau a son état *chargement*, *vide* (avec « prochaine action »), *erreur* (message précis). 
4. **Couleur** : rouge/orange/vert réservés au **sens d'état** (erreur, avertissement, succès) ; jamais pour la position des séries. Soleil et Terre ont leurs couleurs propres, **et** une forme/icône différente (aucune information portée par la couleur seule).
5. **Graphiques** : un **tableau HTML équivalent** (masqué ou derrière un bouton « Voir les valeurs ») pour lecteurs d'écran et copie.
6. **Rail latéral** : la déployabilité au survol s'**ajoute** à un vrai bouton (le survol n'existe ni au tactile ni au clavier) ; en mode icônes, les libellés passent en infobulles ; l'état replié/déployé est mémorisé (localStorage suffit : application 100 % client) ; `aria-current="page"` sur l'élément actif ; repère `nav`, lien « Aller au contenu », `aria-expanded` sur le bouton ; raccourci de bascule ignoré quand on tape dans un champ ; sous le seuil mobile, le panneau devient une **feuille modale** (focus piégé, Échap ferme, focus rendu au déclencheur).

## 4. Direction visuelle

**Idée : une salle de contrôle sobre.** La scène (globe, relief 3D, panorama) occupe **tout l'écran** ; l'interface flotte par-dessus en panneaux de verre sombre, peu nombreux, bien alignés. Calme, dense seulement là où il faut, un accent par fonction.

### 4.1 Jetons (variables CSS dans `web/css/tokens.css`) — valeurs de départ, à **vérifier par calcul**
- Fonds : `--bg-0: #06080c` (scène), `--bg-1: #0b0f16` (panneau plein), `--glass: rgba(14,19,28,.62)` avec flou 16 px (repli plein `--bg-1` si `backdrop-filter` absent ou lent).
- Traits : `--line: rgba(255,255,255,.08)` ; survol `.14`.
- Texte : `--text: #e9eef5` ; `--text-2: #9aa6b6` ; `--text-3: #6b7686` (**réservé au non essentiel** ; si le contraste calculé est < 4,5:1, l'éclaircir).
- Accents : **Soleil** `--sun: #ffd479` (or pâle, forme : disque), **Terre** `--earth: #5aa9ff` (bleu, forme : disque cerclé) ; états : `--ok: #3ddc97`, `--warn: #ff9f43`, `--err: #ff6b6b` ; focus : anneau 2 px `--earth` décalé de 2 px.
- Rayons : 10 px (champs, boutons), 16 px (panneaux). Espacement : échelle de 4 px (4, 8, 12, 16, 24, 32). Ombre : une seule, douce (`0 8px 32px rgba(0,0,0,.45)`).
- Mouvement : 150–220 ms, `cubic-bezier(.2,.8,.2,1)` ; mouvements de caméra 800–1200 ms ; **`prefers-reduced-motion` → transitions instantanées**.

### 4.2 Typographie (hébergée localement, hors ligne)
- **Inter** (variable) pour l'interface et **JetBrains Mono** pour les valeurs numériques et coordonnées, en `woff2` dans `web/vendor/fonts/`, **avec leurs fichiers de licence** (SIL OFL : CODE lit la licence avant d'ajouter). Repli : pile système.
- Échelle : 12 / 13 / 14 / 16 / 20 / 28 / 44 px ; le grand chiffre de la carte verdict : 44 px, graisse 600, tabulaire.

### 4.3 Icônes
Jeu inline SVG de quelques icônes (globe, carte, pôle, panorama, relief, horloge, recherche, lecture, pause, info, langue). Source libre (ex. Lucide, licence ISC) **ou** dessinées à la main ; **licence lue et fichier de licence ajouté**. Pas de police d'icônes, pas de CDN.

## 5. Composition de l'écran

### 5.1 Plan d'ensemble (bureau ≥ 1024 px)
```
┌────┬──────────────────────────────────────────────────────────────┐
│ ◉  │  Lunar Holocron · Rebord de Shackleton     ⌘K Rechercher  FR │ ← barre flottante
│rail│  ⚠ Relief réel · éphémérides de démonstration  (chip, § 5.5) │
│ 🌐 │                                            ┌───────────────┐ │
│ 🗺 │            SCÈNE PLEIN ÉCRAN               │  FICHE SITE   │ │
│ ◔  │      (globe / relief 3D / panorama)        │  verdict ◉    │ │
│ ⛰  │                                            │  courbe       │ │
│ ⓘ  │                                            └───────────────┘ │
│    │   ┌──────────────────────────────────────────────────────┐   │
│    │   │ ▶  2027-03-14 06:00 UTC   ◀ ▮─────●──────── ▶  ×24   │   │ ← barre de temps
│    │   └──────────────────────────────────────────────────────┘   │
└────┴──────────────────────────────────────────────────────────────┘
```
Rail 64 px (déplié 232 px). Fiche à droite 360 px, fermable. Barre de temps centrée en bas. Mobile (< 1024 px) : rail → barre d'onglets en bas ; fiche → feuille modale ; barre de temps au-dessus de la barre d'onglets.

### 5.2 Rail de navigation
Éléments : Atlas (globe), Carte du monde, Pôle Sud, Site (relief 3D + panorama), Méthode, puis en bas : Langue, Aide. L'élément actif a un indicateur animé. Moins de sept destinations : pas de groupes. Vue choisie dans le fragment d'URL (`view=`), sans casser `t=` et `site=` (D-015).

### 5.3 Barre de temps (remplace les boutons ±1 h / ±1 jour comme contrôle principal ; les boutons restent accessibles)
- Curseur à **capsule** sur 2026–2030 (43 824 échantillons horaires), **graduations** par mois (années étiquetées), valeur UTC en tabulaire à côté ; glisser **et** clavier : ← → ±1 h, Maj+← → ±1 jour, PageHaut/PageBas ±30 jours, Espace lecture/pause, Origine/Fin ; `role="slider"` avec `aria-valuetext` lisible (« 14 mars 2027, 06:00 UTC »).
- Lecture : vitesses ×1, ×24 (1 jour/s), ×720 (30 jours/s) ; **jamais plus vite que ce que le rendu peut suivre** (saut d'images : le temps affiché est toujours celui du rendu).
- Heure **toujours en UTC** (D-001/contrat) ; l'heure locale éventuelle est un complément, jamais la référence.

### 5.4 Carte « verdict » du site (le grand chiffre)
- **Un chiffre dominant** : fraction de l'année où le Soleil est visible (indicateur « strict » du contrat), en 44 px ; en dessous, **une ligne** : « sur 2026–2030, pas horaire » (fenêtre de comparaison **sur la carte**) ; puis la Terre (même forme, couleur Terre) ; puis la courbe mensuelle (lisse, infobulle au survol et au clavier) ; bouton « Voir les valeurs » qui bascule vers le tableau HTML équivalent.
- **Aucun nouveau calcul** n'est introduit par l'interface : elle affiche les indicateurs du contrat (`kpi.strict` / `kpi.any`) tels que fournis ; le vocabulaire (« visible », « partiellement ») reste celui de `docs/` ; pas de note, pas de classement.
- États : chargement (squelette de la hauteur finale), erreur (message précis, comme T-09), vide.

### 5.5 Bandeau d'honnêteté → « chip » permanent
Le bandeau actuel devient une **pastille** toujours visible sous la barre du haut : « Relief réel · éphémérides de démonstration » (selon les drapeaux `terrain_real` / `ephemeris_synthetic`), qui s'ouvre au clic/clavier en une courte explication. **Elle ne peut pas être masquée définitivement** et reste dans toute capture d'écran de l'application. C'est une règle d'honnêteté, pas un choix de style.

### 5.6 Palette de commandes (⌘K / Ctrl+K)
Champ de recherche ; groupes **Sites** (13 régions et leurs identifiants), **Vues**, **Actions** (aller à une date, langue, visite guidée « Sites prioritaires ») ; recherche floue insensible aux accents ; flèches + Entrée ; Échap ferme ; focus piégé ; éléments récents ; chaque ligne rappelle son raccourci. **Reportable** : si le temps manque, la recherche reste un simple champ de la barre.

### 5.7 Fiche d'un site (tiroir droit / feuille mobile)
Nom, **niveau** (puce « Priorité 1 »), région NASA 2022, latitude/longitude **avec la source** (D-016), résolution et produit du MNT, **deux puces d'honnêteté** (relief réel ou démonstration ; éphémérides réelles ou de démonstration), aperçu (vignette de la vue 3D ou du panorama), boutons « Voir le site » et « Comparer » (A/B, T-14). Même grammaire visuelle que la carte verdict.

### 5.8 Atlas
Globe plein écran ; marqueurs de sites : **niveau 1 plus grands et plus lumineux**, niveau 2 discrets ; survol/focus : nom en infobulle ; clic : fiche. Soleil et Terre sont des **icônes** distinctes (forme + couleur) posées sur la scène selon l'horloge commune.

## 6. Contraintes techniques (non négociables)
1. Hors ligne : **aucun CDN**, aucune requête externe (le test `nonetwork` doit continuer à passer).
2. **Sans framework ni étape de compilation** : CSS + JS natifs en modules ES ; fichiers `web/css/{tokens,base,components}.css` et `web/js/ui/*.js` (petits modules, un par composant).
3. **Non-régression** : les 41 tests JS et 104 tests Python continuent de passer ; la logique de `geometry.js`, `data.js`, `store.js`, `terrainmesh.js` n'est pas modifiée pour des raisons de style ; l'état reste dans `store.js` (une seule source de vérité).
4. **Performance** : `backdrop-filter` sur **3 panneaux au plus**, flou ≤ 16 px, repli plein par `@supports` ; pas de recalcul de mise en page pendant le rendu WebGL ; 60 images/s visées sur un portable sans carte dédiée, **à mesurer, pas à supposer**.
5. **Accessibilité** : contraste texte ≥ 4,5:1 et éléments d'interface ≥ 3:1, **calculés par un script** (pas à l'œil) et consignés dans le RAPPORT ; cibles tactiles ≥ 44 px ; focus visible ; lecteur d'écran : repères, `aria-live` poli pour les changements de verdict ; `prefers-reduced-motion` respecté.
6. **i18n** : tout texte passe par `i18n.js` (FR/EN) ; aucune chaîne en dur ; les libellés longs en français ne cassent pas la mise en page.
7. **Licences** : polices et icônes → fichier de licence ajouté ; **aucun code recopié de 21st.dev**.

## 7. Tâches
| Id | Contenu | Dépend de | Critère d'acceptation |
|---|---|---|---|
| U-01 | Jetons, polices locales, styles de base, chip d'honnêteté ; page actuelle restylée sans changer son comportement | rien | tests inchangés ; capture 1440×900 FR/EN ; **tableau de contrastes calculé** ; 0 requête externe |
| U-02 | Coque : rail, barre flottante, mise en page plein écran, responsive, navigation par `view=` | U-01 | clavier complet ; `aria-current` ; mobile 390×844 ; captures |
| U-03 | Barre de temps à capsule (liée à l'horloge de `store.js`), lecture, vitesses | U-02 | tests unitaires des fonctions pures (graduations, touches, mise en forme) ; saut d'images mesuré |
| U-04 | Carte verdict : grand chiffre, fenêtre écrite, courbe, tableau équivalent, états | U-02, T-06 | valeurs identiques au JSON ; test d'égalité chiffre affiché / contrat |
| U-05 | Fiche du site (tiroir/feuille) | U-02, A-05 / S-03 | focus piégé en mobile ; puces d'honnêteté exactes |
| U-06 | Palette de commandes ⌘K | U-02 | recherche floue testée (accents) ; piège de focus |
| U-07 | Finition : mouvement, états vides, `reduced-motion`, audit final, captures | U-01 à U-05 | liste de contrôle du § 8 |

## 8. Liste de contrôle finale (U-07)
Chip d'honnêteté visible partout ☐ · aucune requête externe ☐ · contrastes calculés ☐ · navigation clavier complète ☐ · FR et EN sans débordement ☐ · 1440×900 et 390×844 ☐ · tests JS et Python verts ☐ · captures dans `docs/captures/ui-*.png` ☐ · licences des polices et icônes ☐.

## 9. Ce qui est reporté (après stabilité du système)
Itinéraire de rover entre cratères (backlog `B-01` de `PLAN.md`) ; thème clair ; autres langues.
