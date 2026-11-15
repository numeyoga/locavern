---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# Comment organiser vos projets et vos tâches

Ce guide décrit les actions pour créer, modifier, archiver et supprimer des projets, ainsi que pour piloter vos tâches en vue Liste, en vue Kanban ou au clavier et personnaliser les colonnes de statut du Kanban. Pour le détail exhaustif des champs et raccourcis, consultez la référence [Interface, vues et raccourcis clavier](../reference/interface-et-raccourcis.md).

## Sommaire

- [Gérer les projets](#gérer-les-projets)
- [Créer et modifier une tâche](#créer-et-modifier-une-tâche)
- [Configurer les statuts du Kanban](#configurer-les-statuts-du-kanban)
- [Filtrer, trier et traiter les statuts inconnus en vue Liste](#filtrer-trier-et-traiter-les-statuts-inconnus-en-vue-liste)
- [Déplacer des tâches sur le tableau Kanban](#déplacer-des-tâches-sur-le-tableau-kanban)
- [Utiliser la palette de commandes](#utiliser-la-palette-de-commandes)

## Gérer les projets

Ouvrez la vue **Projets** depuis la barre de navigation latérale.

- **Créer un projet** : cliquez sur **Nouveau projet**, renseignez un nom (obligatoire) et une description facultative, puis validez avec **Créer le projet**. La fenêtre s’ouvre en modale par défaut ou en tiroir latéral selon le réglage choisi dans **Préférences d’affichage** (**Visuel de saisie par écran**).
- **Modifier un projet** : sur la carte du projet, cliquez sur **Modifier**, ajustez le nom ou la description, puis cliquez sur **Enregistrer**.
- **Ouvrir les tâches d’un projet** : cliquez sur **Ouvrir les tâches** sur sa carte pour basculer vers la vue **Tâches** déjà filtrée sur ce projet.
- **Ouvrir les notes d’un projet** : cliquez sur **Ouvrir les notes** sur sa carte pour basculer vers la vue **Notes** déjà filtrée sur ce projet.
- **Archiver ou désarchiver un projet** : cliquez sur **Archiver** (ou **Désarchiver**). Le projet reste visible dans les sélecteurs avec la mention `(archivé)` et conserve toutes ses tâches et notes.
- **Supprimer un projet** : cliquez sur **Supprimer**, puis confirmez avec **Supprimer le projet**. Attention : les tâches rattachées à ce projet sont supprimées, tandis que les notes et tableaux blancs associés sont conservés en tant qu’éléments « Sans projet ».

## Créer et modifier une tâche

Chaque tâche doit être rattachée à un projet existant.

1. Depuis la vue **Tâches**, sélectionnez un projet dans le menu déroulant (ou laissez **Tous les projets**), puis cliquez sur **Nouvelle tâche** — ou sur le bouton **+** en haut d’une colonne Kanban pour préremplir son statut. La saisie s’ouvre en tiroir latéral par défaut ou en modale selon le réglage choisi dans **Préférences d’affichage**.
2. Renseignez le **Titre** (obligatoire), le **Projet**, le **Statut** (choisissez l’un des statuts configurés ou **Sans statut**), la **Priorité** et, si besoin, une **Échéance**.
3. Pour ajouter des sous-étapes dans **Liste de contrôle**, saisissez un libellé dans **Ajouter une étape** et cliquez sur **Ajouter**. Cochez les étapes terminées ou retirez-en avec le bouton **×**.
4. Rédigez la **Description** avec la barre d’outils de mise en forme si nécessaire.
5. Cliquez sur **Créer la tâche** (ou **Enregistrer** lors d’une modification).

Pour rouvrir une tâche existante, cliquez sur son titre dans la vue Liste ou sur le tableau Kanban, sur **Ouvrir** dans la vue Liste, ou sur **Ouvrir les détails** dans son menu d’actions Kanban. Pour la supprimer depuis la fenêtre de saisie, cliquez sur **Supprimer** puis confirmez.

## Configurer les statuts du Kanban

Par défaut, le tableau Kanban comporte trois colonnes (**À faire**, **En cours**, **Terminé**). Vous pouvez adapter ces statuts à votre flux de travail :

1. Depuis l’en-tête de la vue **Tâches**, cliquez sur **Statuts** (ou cliquez sur **Configurer les statuts** dans **Préférences d’affichage**, ou choisissez **Configurer les statuts du Kanban** dans la palette `Ctrl+K`).
2. Dans la fenêtre **Statuts du Kanban** :
   - **Renommer un statut** : modifiez directement son libellé dans la liste.
   - **Ajouter un statut** : saisissez son nom dans **Ajouter un statut** puis cliquez sur **Ajouter** (jusqu’à 12 statuts).
   - **Réordonner les colonnes** : utilisez les boutons **↑** (**Monter**) et **↓** (**Descendre**) en face de chaque statut.
   - **Supprimer un statut** : cliquez sur l’icône de corbeille en face du statut à retirer. Les tâches qui portaient ce statut ne sont pas supprimées : elles conservent leur identifiant de statut, ne s’affichent plus sur le Kanban et apparaissent avec le badge d’alerte **Statut inconnu** dans la vue **Liste**.
   - **Réinitialiser** : cliquez sur **Valeurs par défaut** pour restaurer les trois colonnes initiales (**À faire**, **En cours**, **Terminé**).
3. Cliquez sur **Enregistrer** pour appliquer la nouvelle configuration.

## Filtrer, trier et traiter les statuts inconnus en vue Liste

Dans l’en-tête de la vue **Tâches**, sélectionnez **Liste**. Contrairement au tableau Kanban qui n’affiche que les colonnes configurées, la vue **Liste** présente l’intégralité des tâches, y compris celles **Sans statut** ou dotées d’un **Statut inconnu** (par exemple après la suppression d’une colonne Kanban).

- **Repérer les tâches à régulariser** : les tâches sans statut ou au statut inconnu sont mises en évidence par une bordure d’avertissement et un badge orange (**Sans statut** ou **Statut inconnu (`<ancien statut>`)**).
- **Filtrer par projet** : choisissez **Tous les projets** ou un projet précis dans le menu déroulant en haut à gauche.
- **Affiner l’affichage** : utilisez le champ **Rechercher** (filtre sur le titre), le sélecteur **Statut** (incluant **Sans statut** et **Statut inconnu**) et le sélecteur **Priorité**.
- **Trier les lignes** : choisissez dans **Tri** entre **Ordre Kanban**, **Échéance** (les tâches avec date apparaissent en premier par ordre chronologique) et **Priorité** (de `Haute` à `Basse`).
- **Réassigner ou changer un statut rapidement** : utilisez directement le menu déroulant de statut dans la colonne **Actions** de la ligne concernée pour lui attribuer un statut actif (elle réapparaîtra aussitôt dans la colonne correspondante du Kanban) ou **Sans statut**.

## Déplacer des tâches sur le tableau Kanban

Dans l’en-tête de la vue **Tâches**, sélectionnez **Kanban**. Le champ **Rechercher sur le tableau** filtre les cartes affichées dans les colonnes configurées. Les tâches **Sans statut** ou ayant un **Statut inconnu** ne figurent pas sur le tableau Kanban tant qu’un statut actif ne leur a pas été attribué.

Trois méthodes permettent de déplacer une carte :

- **À la souris (glisser-déposer)** : faites glisser une carte vers une autre colonne (elle est ajoutée en fin de colonne) ou directement sur une autre carte du même projet pour l’insérer à cette position.
- **Via le menu d’actions** : cliquez sur le bouton **⋮** de la carte, puis choisissez **Déplacer vers `<colonne>`**, **Monter dans la colonne** ou **Descendre dans la colonne**.
- **Au clavier** : placez le focus clavier sur la carte (avec `Tab`), puis maintenez `Alt` et appuyez sur les flèches :
  - `Alt + Flèche droite` / `Alt + Flèche gauche` pour changer de colonne ;
  - `Alt + Flèche haut` / `Alt + Flèche bas` pour réordonner la carte au sein de son projet dans la même colonne.

Si le sélecteur de projet est réglé sur **Tous les projets**, chaque carte affiche une étiquette avec le nom de son projet ; les déplacements verticaux réordonnent la tâche parmi celles de son propre projet.

## Utiliser la palette de commandes

Appuyez sur `Ctrl+K` (ou `Cmd+K` sur macOS), ou cliquez sur **Rechercher** dans la barre supérieure, pour ouvrir la palette de commandes. Tapez quelques lettres pour filtrer la liste, utilisez les flèches haut/bas puis `Entrée` pour changer de vue, créer une tâche, un projet, une note ou un tableau blanc, configurer les statuts du Kanban, ouvrir les sauvegardes ou préférences d’affichage, ou basculer le thème.
