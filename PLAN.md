# PLAN — Lunar Holocron

Dernière mise à jour : 2026-11-12. L'état d'avancement vit dans `STATUS.md` (pas ici).

## 1. Objectif et périmètre

**Objectif** : une application web statique qui, pour un site du pôle Sud lunaire et une date, montre le Soleil et la Terre **par rapport à l'horizon réel du terrain**,
compare deux sites, et donne des indicateurs de décision (énergie solaire, liaison directe avec la Terre), avec **méthode, sources et limites** affichées.

**Ce qu'on peut faire sans les données NASA** : tout le squelette (contrat, pipeline, interface, tests) avec des **données de démonstration synthétiques** clairement étiquetées.
**Ce qui dépend des données NASA** : les valeurs réelles (MNT LOLA, noyaux SPICE), les coordonnées vérifiées des sites, la validation scientifique.

### Priorités
- **P0** : indispensable à la démonstration (tâches T-00 à T-15 ci-dessous).
- **P1** : après un noyau stable (T-16 à T-20) : export CSV, « et si on décale ? », deux dates, pastilles Artemis, lecture accélérée.
- **P2** : bonus : ombres par ray-marching dans le shader, swahili complet, MNT à 5 m sur un site vitrine.

### Hors périmètre (décidé, voir DECISIONS.md)
Moteur 3D à niveaux de détail, globe lunaire entier, serveur, comptes utilisateur, fond de carte distant, modélisation thermique/poussière, planification de trajectoire.

## 2. Jalons

| Jalon | Contenu | Tâches |
|---|---|---|
| **J0 — Fondations** | Dépôt, outils, contrat de données, géodésie, schéma | T-00 à T-03 |
| **J1 — Calculs de démonstration** | MNT synthétique, horizon, visibilité, éphémérides démo, indicateurs, export, génération des 3 sites | T-04 à T-08 |
| **J2 — Interface noyau** | Chargement, état, panorama, vue 3D, barre de temps et frise, verdicts | T-09 à T-13 |
| **J3 — Produit complet P0** | A/B, carte polaire, page méthode, tests de fumée, performances | T-14 à T-15 |
| **J4 — Données réelles** | Branchement NASA, validation, sites réels | T-20 à T-24 (dès que les données sont là) |
| **J5 — Livrables d'événement** | README, vidéo de démonstration, soumission | T-30 à T-32 |

Parallélisation possible (deux agents, dossiers distincts) : après T-03, **pipeline (T-04 à T-08)** et **interface (T-09 à T-13)** avancent en parallèle, car l'interface lit un jeu de données
d'exemple écrit à la main à partir du contrat (T-03). Le point de rendez-vous est T-08 (vrais JSON générés) ; T-09 lit alors les JSON du pipeline.

## 3. Tâches

Format : **Dépend de** · **Dossier** · **Livrables** · **Critères d'acceptation** (tous obligatoires).
Pour toutes les tâches s'appliquent la boucle de travail et la définition de « terminé » de `CLAUDE.md`.

### T-00 — Initialisation du dépôt
- Dépend de : rien · Dossier : racine.
- Livrables : dépôt Git ; `.gitignore` (données brutes, caches, `.venv`, `node_modules`, `*.IMG`, `*.bsp`, `*.bpc`, `*.tif`) ; `LICENSE` Apache-2.0 ; arborescence de `docs/ARCHITECTURE.md` § 4 (dossiers vides avec `.gitkeep`) ;
  `pipeline/requirements.txt` (versions minimales) ; `README.md` provisoire (3 lignes) ; premier commit `pre-event: initialisation` et, au dernier commit d'avant événement, tag `pre-event-base`.
- Critères : `py -m venv .venv` + `pip install -r pipeline/requirements.txt` réussit ; `py -m pytest pipeline/tests -q` s'exécute (0 test, code 5 accepté) ; `node --version` ≥ 20 ; `git status` propre.
- **Ne rien inventer** dans les fichiers de licence ou de sources.

### T-01 — Schéma de données et validateur
- Dépend de : T-00 · Dossier : `pipeline/`.
- Livrables : `pipeline/schema/site.schema.json`, `index.schema.json`, `terrain.schema.json` (JSON Schema) d'après `docs/CONTRAT-DONNEES.md` ; `pipeline/validate.py` (contrôles du § 7 de ce document, y compris recalcul des indicateurs une fois T-07 fait) ;
  `pipeline/tests/test_schema.py`.
- Critères : exemples valides acceptés ; cas invalides (longueur fausse, azimut ≥ 360000, `schema_version` inconnu, `synthetic` incohérent) refusés avec un message qui nomme le champ.

### T-02 — Constantes, géodésie, projection
- Dépend de : T-00 · Dossier : `pipeline/`.
- Livrables : `config.py` (constantes avec source en commentaire), `geodesy.py`, `projection.py` (classe `PolarProjection` paramétrable) ; tests `test_geodesy.py`, `test_projection.py`.
- Critères : tous les cas de `docs/TESTS-VALIDATION.md` § 3 passent ; base ENU orthonormée ; vectorisé (un appel sur 1 million de points < 1 s).

### T-03 — Jeu de données d'exemple fait main + constantes JS
- Dépend de : T-00 · Dossier : `web/`, `tests/golden/`.
- Livrables : `web/js/constants.js` ; un **jeu d'exemple minimal** respectant le contrat (1 site, 7 jours seulement, masque d'horizon simple, séries sinusoïdales) dans `web/data/sample/` pour débloquer l'interface
  avant que le pipeline existe ; `tests/golden/visible_fraction.json` (valeurs de `TESTS-VALIDATION.md` § 1).
- Critères : l'exemple passe `validate` (T-01) ; il porte `synthetic: true`.

### T-04 — MNT synthétique et interface `Dem`
- Dépend de : T-02 · Dossier : `pipeline/`.
- Livrables : `dem.py` (`Dem`, `MultiResDem`), `dem_synthetic.py` (3 types : `crater`, `massif`, `flat`).
- Critères : déterminisme (deux appels identiques) ; interpolation bilinéaire exacte sur un plan incliné (erreur < 1e-6 m) ; `NaN` hors couverture ; hauteurs plausibles (cratère : rebord ≈ +900 m, fond négatif) ; test d'un `MultiResDem` qui retombe sur le grossier.

### T-05 — Masque d'horizon
- Dépend de : T-02, T-04 · Dossier : `pipeline/`.
- Livrables : `horizon.py` ; `test_horizon.py`.
- Critères : tous les tests de `docs/TESTS-VALIDATION.md` § 2 (sol lisse, marche, convention d'azimut N/E/S/O, symétrie, `truncated`, `NaN`, bouclage, formule d'élévation) passent. Temps de calcul d'un site < 30 s.

### T-06 — Visibilité (formules partagées) et indicateurs
- Dépend de : T-03 · Dossier : `pipeline/` et `web/js/`.
- Livrables : `pipeline/visibility.py`, `web/js/visibility.js`, `kpi.py` ; tests `test_visibility.py`, `test_kpi.py`, `web/tests/visibility.test.js`.
- Critères : les **mêmes** valeurs d'or passent en Python et en JavaScript ; propriétés (monotonie, symétrie `f(d)+f(−d)=1`) ; cas limites des indicateurs listés en `TESTS-VALIDATION.md` § 5.

### T-07 — Éphémérides de démonstration et export
- Dépend de : T-02, T-05, T-06 · Dossier : `pipeline/`.
- Livrables : `ephemeris_demo.py`, `export.py`, `cli.py` (commandes `demo`, `build`, `validate`), `config/pipeline.json`, `config/sites.json` (3 sites de démonstration) ; tests `test_ephemeris_demo.py`, `test_export.py`.
- Critères : conformes à `docs/PIPELINE.md` ; `terrain/*.bin` décodable ; `index.json` cohérent ; tous les fichiers portent `synthetic: true` ; compatibilité avec `validate` ; `generated_utc` = `build_utc` de la configuration, pas l'horloge (D-013).

### T-08 — Génération de bout en bout et fichier d'or d'accord Python/JS
- Dépend de : T-07 · Dossier : `pipeline/`, `tests/golden/`.
- Livrables : `py -m pipeline.cli demo` produit `web/data/` complet ; `tests/golden/body_state_cases.json` (option `--write-golden`) ; `test_demo_end_to_end.py`.
- Critères : `validate` retourne 0 ; deux exécutions donnent des fichiers **identiques octet pour octet** ; le fichier d'or est **relu et validé par un humain** (noté dans `STATUS.md`) avant d'être figé.
  Tailles : `sites/<id>.json` < 2,5 Mo brut ; `terrain/<id>.bin` = 132 098 octets pour `n = 257`.

### T-09 — Chargement, état, i18n, squelette de page
- Dépend de : T-03 · Dossier : `web/`.
- Livrables : `index.html` (importmap, bannière, conteneurs), `css/`, `vendor/three/` (version figée, notée dans `SOURCES.md`), `data.js`, `store.js`, `urlstate.js`, `i18n.js`, `geometry.js`, `main.js` ; tests `data.test.js`, `geometry.test.js`, `urlstate.test.js`.
- Critères : l'application s'ouvre via `py -m http.server`, charge l'exemple (puis les JSON de T-08), affiche la bannière si `synthetic`, change de langue FR/EN ; `bodyStateAt` interpole correctement, y compris au saut 359°→1° ;
  erreur de fichier manquant = message clair ; **aucune requête vers un domaine externe** (vérifié dans l'onglet Réseau et par le test de fumée).

### T-10 — Panorama 360°
- Dépend de : T-06, T-09 · Dossier : `web/js/panorama.js`.
- Critères : conformes à `docs/INTERFACE.md` § 5 : silhouette du relief, boussole, Soleil et Terre à la bonne position, taille exagérée signalée, trace ±24 h, flèches hors fenêtre, hachures `truncated`, lecture au survol.
  Vérification : avec le site d'exemple, un corps placé à `(az, el)` connus apparaît aux pixels attendus (test sur la fonction de projection écran).

### T-11 — Vue 3D du terrain
- Dépend de : T-08 (ou le jeu d'exemple avec un terrain écrit à la main), T-09 · Dossier : `web/js/terrain3d.js`.
- Critères : conformes à `docs/INTERFACE.md` § 6 : maillage correct (le Nord est bien vers −z), courbure déjà dans `z_m`, teinte et légende, exagération verticale, lumière orientée vers le Soleil, éteinte si `el < 0`, sprites Soleil/Terre,
  deux modes de caméra, `dispose` sans fuite (changer 20 fois de site ne fait pas croître la mémoire de façon notable), qualité adaptative.
  Vérification visuelle : pour `demo-a`, l'ombre du rebord de cratère est du côté opposé au Soleil ; documenté par une capture dans `STATUS.md`.

### T-12 — Barre de temps et frise
- Dépend de : T-06, T-09 · Dossier : `web/js/timeline.js`.
- Critères : conformes à `docs/INTERFACE.md` § 7 : curseur, champ UTC validé, lecture et vitesses, frise avec courbes, ligne d'horizon à l'azimut du corps, bandes de visibilité, clic pour se déplacer, sous-échantillonnage min/max.
  La lecture suit le temps réel (pas le nombre d'images) ; test : 10 s réelles à vitesse 3600 ⇒ +10 h simulées ±1 %.

### T-13 — Verdicts, lectures et indicateurs
- Dépend de : T-06, T-09 · Dossier : `web/js/verdicts.js`.
- Critères : conformes à `docs/INTERFACE.md` § 8 : pastilles Masqué/Partiel/Visible indépendantes du seuil, binaire selon le seuil pour les indicateurs et la phrase « liaison directe », lectures chiffrées, marge signée,
  avertissements (`truncated`, hors période), cartes d'indicateurs avec infobulles, carte de chaleur mensuelle cliquable.

### T-14 — Carte polaire, comparaison A/B, page méthode, README
- Dépend de : T-10 à T-13 · Dossier : `web/`, racine.
- Livrables : `polarmap.js`, `compare.js`, `method.html`, `README.md` complet (objectif, installation, commandes, structure, sources, licence, usage de l'IA).
- Critères : conformes à `docs/INTERFACE.md` §§ 9-10 ; l'état A/B/date/seuil est restauré depuis l'URL ; le tableau comparatif donne A, B et l'écart ; la page méthode affiche dynamiquement les `provenance` ; les limites de `PIPELINE.md` § 4 y figurent.

### T-15 — Tests de fumée, performances, revue
- Dépend de : T-14 · Dossier : `tests/e2e/`, `web/`.
- Critères : test Playwright conforme à `TESTS-VALIDATION.md` § 5 ; budget de `INTERFACE.md` § 11 respecté (mesures notées dans `STATUS.md`) ; **revue du vérificateur** (liste de `TESTS-VALIDATION.md` § 7) sans constat bloquant ; suite complète verte.

### Après le jalon J3 : P1
- **T-16** export CSV · **T-17** « et si on décale ? » (prochaine fenêtre, meilleure fenêtre du mois, avec tests) · **T-18** deux dates sur un même site · **T-19** lecture animée du panorama avec trace · **T-25** pastilles Artemis (pente, distance au pôle ; nécessite le MNT réel, donc après T-22).

### Bloc « Atlas » (D-015, spécification : `docs/ATLAS.md`)
Globe 3D, carte mondiale 2D, pôles Sud et Nord 2D, horloge commune. Tâches **A-01 à A-07** (tableau du § 8 de `docs/ATLAS.md`). Ordre conseillé :
1. Tout de suite, sans dépendre du reste : **A-01** (textures, licence lue sur la page) et **A-02** (fonctions pures + tests d'or).
2. **A-03** dès que la partie `ephemeris_demo` de T-07 existe (la faire tôt, elle sert aussi aux séries de site).
3. **A-04** (globe) puis **A-05** (cartes 2D) puis **A-06** (onglets, URL, horloge).
4. **A-07** seulement après le contrôle du MNT réel.
L'Atlas **ne remplace pas** le noyau : T-06, T-05, T-07, T-08 et T-10 restent prioritaires pour la **vérité scientifique** ; l'Atlas est la porte d'entrée visuelle. Si le temps manque, livrer dans cet ordre : A-06 réduit (globe + carte pôle Sud) avant le reste.

### Bloc « Interface » (D-017, spécification : `docs/UI-DESIGN.md`)
Tâches **U-01 à U-07** (§ 7 de `docs/UI-DESIGN.md`) : jetons et polices locales, coque (rail, barre flottante), barre de temps à capsule (avec T-12), carte verdict (avec T-06), fiche de site (avec A-05 / S-03), palette ⌘K, finition. **U-01 et U-02 passent avant T-06** pour que T-10 et les écrans suivants soient construits dans le nouveau style. Ordre de coupe : U-06, puis U-07, **jamais U-01 à U-04**.

### Bloc « Sites réels » (D-016, spécification : `docs/SITES-REELS.md`)
Tâches **S-01 à S-04** (§ 8 de `docs/SITES-REELS.md`) : positions lues dans les MNT 5 m de PGDA 78, outil de découpe par site, marqueurs et fiche sur l'Atlas, préchargement et visite guidée. S-01 et S-02 prolongent l'aperçu 3D du relief réel (M-014 étape B) et préparent T-22 / T-23.

**S-05 — Liens profonds (D-019).** Fonction pure `deepLinks(site)` (testée en node) et boutons « Ouvrir dans Quickmap / Moon Trek » dans la fiche de site, avec les coordonnées du site et un bouton « copier » ; aucun chargement automatique, aucune iframe, `nonetwork` inchangé. Spécification : `docs/SITES-REELS.md` § 9. Placement : avec U-04 (fiche de site), **après S-02** ; coupe : avant S-03.

### J4 — Données réelles (dès que disponibles ; suivre `docs/BRANCHEMENT-DONNEES-REELLES.md` **et `docs/INVENTAIRE-DONNEES.md`**, fichiers, tailles, sources, ordre ; D-018)
- **T-20** noyaux SPICE et tests de plausibilité · **T-21** MNT : étiquette, convention de projection, contrôle sur un cratère · **T-22** `RasterDem`, `MultiResDem` réel, un site complet · **T-23** sites réels vérifiés, construction de tous les sites ·
  **T-24** validation scientifique (Horizons, PGDA, outil officiel, sensibilité) et `docs/VALIDATION-RESULTATS.md`.

### J5 — Livrables d'événement
- **T-30** retirer ou isoler les sites de démonstration ; **T-31** page méthode finalisée avec résultats de validation ; **T-32** vidéo de démonstration (script court, enregistrement d'écran, sous-titres FR/EN) et soumission selon le guide du 13 novembre.

## 4. Ordre conseillé pour une première session de travail

1. Lire `STATUS.md`, puis exécuter T-00.
2. Enchaîner T-01, T-02, T-03 (courtes, elles débloquent tout).
3. Lancer en parallèle : pipeline (T-04 → T-08) et interface (T-09 → T-13).
4. Rendez-vous à T-08, puis T-14 et T-15.
5. À chaque fin de tâche : mise à jour de `STATUS.md`, commit, passage à la suivante.

## 5. Risques connus

| Risque | Parade |
|---|---|
| Convention de projection du MNT réel mal interprétée (miroir, rotation) | Contrôle sur un cratère reconnaissable (BRANCHEMENT § 2.3) ; test d'azimut Nord/Est/Sud/Ouest |
| Noms de fichiers SPICE changés | `fetch` choisit par motif et consigne les noms retenus |
| Performances 3D sur graphiques intégrés | Qualité adaptative, grille 257², ombres désactivables |
| Données réelles différentes de l'attendu | `BRANCHEMENT` § 6 ; le contrat ne change pas |
| Règle du hackathon sur le code d'avant événement | `Q-001` ; commits préfixés `pre-event:` et tag `pre-event-base` |
| Valeurs fictives prises pour réelles | Drapeau `synthetic`, bannière, validation de cohérence, relecture du vérificateur |

## Backlog (à traiter seulement quand l'Atlas, les sites réels et l'interface sont stables)
| Id | Idée | Origine | Remarque |
|---|---|---|---|
| B-01 | **Itinéraire de rover entre cratères** (trajet à pente et éclairage contraints, entre les sites de l'Atlas) | Demande de l'humain, 2026-11-14 | Hors périmètre du produit actuel (qui calcule des visibilités, pas des trajets) ; à spécifier à part (données de pente, critères, honnêteté sur les limites). |
| B-02 | **Tuiles Moon Trek en texture d'imagerie** (pré-test : couches polaires, alignement, éclairage, licence ; puis éventuellement téléchargement par le pipeline) | Demande de l'humain, 2026-11-14 ; différé par D-019 (Q-012) | Risques listés dans D-019 ; ne rien intégrer avant décision de l'humain |
