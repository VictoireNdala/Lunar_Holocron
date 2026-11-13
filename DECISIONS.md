# DECISIONS — Lunar Holocron

Journal des décisions (`D-xxx`) et des questions ouvertes (`Q-xxx`).
- Les décisions **scientifiques et de périmètre** naissent dans la conversation « contexte et stratégie » (Claude, projet Hackathon NASA) et sont recopiées ici par l'humain ou par Claude Code.
- Claude Code **n'en prend pas seul** : il écrit une question (`Q-xxx`), applique l'option la plus prudente marquée `# DECISION-PROVISOIRE Q-xxx`, et signale le point dans `STATUS.md`.
- On n'efface jamais une décision : on la marque « remplacée par D-yyy ».

## Contexte d'équipe (information, pas décision)
Équipe de deux personnes, participation **en présentiel**, langues courantes : français et swahili. Une personne est étudiante en informatique et vidéaste (vidéo de démonstration).
Calendrier : événement les 14 et 15 novembre 2026 ; guide officiel le 13 novembre ; données NASA à recevoir.

## Décisions prises

| Id | Date | Décision | Raison | Statut |
|---|---|---|---|---|
| D-001 | 2026-11-12 | Application **statique et hors ligne** ; calculs lourds dans un **pipeline hors ligne**. | Fiabilité en démonstration (réseau sur place incertain), simplicité. | Active |
| D-002 | 2026-11-12 | **Pas de moteur 3D à niveaux de détail** ni de globe entier : un maillage régional (20 × 20 km, 257²) par site. | Risque et calendrier (48 h). La valeur est dans l'horizon réel vu du sol, pas dans le globe. | Active |
| D-003 | 2026-11-12 | Repère lunaire **`MOON_ME`** (pas `IAU_MOON`). | Cohérent avec LOLA ; écart ≈ 0,03° ≈ 875 m sinon. | Active |
| D-004 | 2026-11-12 | Deux seuils de visibilité : **strict** (centre du disque au-dessus de l'horizon) et **optimiste** (une partie du disque visible). Les deux sont calculés et exposés ; **strict par défaut**. | La Terre « visible » de PGDA est optimiste ; le strict est plus proche d'une liaison directe réaliste. Transparence sur la définition. | Active (strict par défaut : à confirmer, `Q-006`) |
| D-005 | 2026-11-12 | Série temporelle : **2026-01-01 à 2030-12-31, pas horaire** (43 824 échantillons), en millidegrés entiers. | Couvre l'horizon des produits NASA cités (jusqu'à 2030) ; taille de fichier raisonnable. | Active |
| D-006 | 2026-11-12 | Tant que les données NASA ne sont pas branchées : **données de démonstration synthétiques**, étiquetées `synthetic: true`, bannière permanente. | Ne jamais présenter du fictif comme du réel. | Active |
| D-007 | 2026-11-12 | Contrat de données **figé en premier** (`docs/CONTRAT-DONNEES.md`, version 1.0), formules de visibilité **partagées** Python/JS et vérifiées par les mêmes valeurs d'or. | Travail en parallèle ; éviter les divergences silencieuses. | Active |
| D-008 | 2026-11-12 | Hauteur de l'œil par défaut **2,0 m**. | Valeur neutre pour un panorama ; un atterrisseur ou une antenne n'est pas à 2 m. | **Provisoire** (`Q-007`) |
| D-009 | 2026-11-12 | Interface en **français et anglais** dès le départ ; swahili prévu (P2) avec repli sur l'anglais. | Soumission probablement en anglais (`Q-003`) ; le swahili est un plus pour le public d'Afrique de l'Est. | Active |
| D-010 | 2026-11-12 | Organisation du travail : **Claude (chat/projet)** pour contexte, décisions et revue scientifique ; **Claude Code (VS Code)** pour la construction ; coordination par les fichiers MD de ce dépôt ; au plus 3 agents (constructeur pipeline, constructeur interface, vérificateur). | Gain réel mais limité du parallélisme ; la revue scientifique reste humaine. | Active |
| D-011 | 2026-11-12 | Commits d'avant le 14 novembre préfixés **`pre-event:`** ; tag `pre-event-base`. | Pouvoir repartir proprement si le règlement interdit le code écrit avant l'événement (`Q-001`). | Active |
| D-012 | 2026-11-12 | Pas de pôle exact : `-89.99 ≤ lat_deg ≤ 89.99`, bornes **incluses** (précisé après M-004). | L'azimut n'est pas défini au pôle ; `-89.99` sert de latitude de test. | Active |
| D-013 | 2026-11-12 | `provenance.generated_utc` est **fixé par la configuration** (`config/pipeline.json` → `build_utc`), jamais lu sur l'horloge ; à changer à la main lors d'une régénération voulue. | Sorties identiques octet pour octet (principe 5 de `CLAUDE.md`) ; la date reste une information de provenance. | Active |
| D-014 | 2026-11-13 | Site `demo-a` placé **sur le rebord** du cratère synthétique (par défaut à 4 km au sud du centre ; à ajuster en T-07 pour que Soleil et Terre soient visibles dans au moins un secteur, sans que tous les indicateurs soient 0 % ou 100 %). Réponse à `Q-011` (M-013). | Un site au centre donne un horizon ≈ 20,6° partout : indicateurs tous à 0 %, ombre du rebord invisible (T-11), comparaison A/B sans intérêt. | Active |

## Questions ouvertes

| Id | Question | Options | Par défaut provisoire | Qui tranche |
|---|---|---|---|---|
| Q-001 | Le règlement autorise-t-il le code écrit **avant** l'événement ? (guide du 13 nov.) | (a) autorisé ; (b) autorisé si open source et déclaré ; (c) interdit | Hypothèse prudente : (c), d'où D-011 | Humain, après lecture du guide |
| Q-002 | Règle sur l'**usage de l'IA** (déclaration, limites) ? | (a) libre ; (b) à déclarer ; (c) limité | `SOURCES.md` § Usage de l'IA tenu à jour (compatible avec (a) et (b)) | Humain |
| Q-003 | Langue et format de soumission ? | (a) anglais ; (b) français accepté | Anglais | Humain |
| Q-004 | Liste exacte des **ressources/données fournies** par le défi (noms, liens, licences) ? | — | Hypothèses de `BRANCHEMENT-DONNEES-REELLES.md` § 2 | Humain (copie du guide) |
| Q-005 | Quels **sites** retenir (3 à 5) et leurs **coordonnées vérifiées** ? | Shackleton, de Gerlache, Haworth, Nobile, Malapert, ou régions Artemis | Seuls les sites de démonstration jusqu'à vérification | Humain + revue scientifique |
| Q-006 | Seuil par défaut affiché : strict ou optimiste ? | strict / optimiste | strict (D-004) | Humain |
| Q-007 | Hauteur de l'œil (ou de l'antenne) par défaut ? | 2 m / hauteur d'atterrisseur / hauteur d'antenne | 2 m (D-008) | Humain |
| Q-008 | Un site « vitrine » avec MNT à 5 m (PGDA produit 78) ? | oui / non | non | Humain, selon les données disponibles |
| Q-009 | La période 2026-2030 convient-elle aux données fournies ? | garder / changer | garder | Humain, après réception des données |
| Q-010 | Qui est le **titulaire du copyright** de la licence Apache 2.0 (noms des deux membres, nom d'équipe) ? | noms des membres / nom d'équipe | aucune ligne de copyright (état actuel de `LICENSE`) | Humain |
| Q-011 *(tranchée : D-014, option b)* | Site `demo-a` : **au centre** du cratère synthétique (horizon ≈ 20,6° : Soleil et Terre jamais visibles, cas « ombre permanente ») ou **sur le rebord** ou à côté (horizon bas d'un côté) ? | centre / rebord / extérieur | Centre (le terrain est centré sur le site, `dem_synthetic.py`) ; le choix se fait en T-07 via la position du site, sans toucher au MNT | CHAT / humain |

## Format d'une nouvelle entrée

```
| D-0xx | AAAA-MM-JJ | Décision en une phrase. | Pourquoi. | Active / Provisoire / Remplacée par D-0yy |
```
