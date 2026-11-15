---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# Comment organiser vos projets et vos tâches

Ce guide décrit les actions pour créer, filtrer, archiver et supprimer des projets, ainsi que pour piloter vos tâches en vue Liste, en vue Kanban ou au clavier et personnaliser les colonnes de statut du Kanban. Pour planifier vos échéances dans la vue **Aujourd’hui** et le **Calendrier**, consultez [Comment planifier votre journée et votre calendrier](planifier-journee-et-calendrier.md) ; pour les étiquettes, liens internes et modèles de checklist, consultez [Comment organiser votre travail avec étiquettes, liens et modèles](organiser-avec-etiquettes-liens-et-modeles.md). Pour le détail exhaustif des champs et raccourcis, consultez [Interface, vues et raccourcis clavier](../reference/interface-et-raccourcis.md).

## Sommaire

- [Gérer les projets](#gérer-les-projets)
- [Créer et modifier une tâche](#créer-et-modifier-une-tâche)
- [Configurer les statuts du Kanban](#configurer-les-statuts-du-kanban)
- [Filtrer, trier et traiter les statuts inconnus en vue Liste](#filtrer-trier-et-traiter-les-statuts-inconnus-en-vue-liste)
- [Déplacer et filtrer des tâches sur le tableau Kanban](#déplacer-et-filtrer-des-tâches-sur-le-tableau-kanban)
- [Utiliser la palette de commandes](#utiliser-la-palette-de-commandes)

## Gérer les projets

Ouvrez la vue **Projets** depuis la barre de navigation latérale.

- **Filtrer l’affichage par état** : si vous avez au moins un projet, utilisez le sélecteur segmenté **Tous**, **Actifs** ou **Archivés** en haut de l’écran.
- **Créer un projet** : cliquez sur **Nouveau projet**, renseignez un nom (obligatoire) et une description facultative, puis validez avec **Créer le projet**. La fenêtre s’ouvre en modale par défaut ou en tiroir latéral selon le réglage choisi dans **Préférences d’affichage** (**Visuel de saisie par écran**).
- **Modifier un projet** : sur la carte du projet, cliquez sur **Modifier**, ajustez le nom ou la description, puis cliquez sur **Enregistrer**.
- **Ouvrir les éléments d’un projet** : cliquez sur **Ouvrir les tâches**, **Ouvrir les notes** ou **Ouvrir les tableaux blancs** sur la carte du projet pour basculer vers la vue correspondante déjà filtrée sur ce projet.
- **Archiver ou désarchiver un projet** : cliquez sur **Archiver** (ou **Désarchiver**). Le projet reste visible dans les sélecteurs avec la mention `(archivé)` et conserve toutes ses tâches, notes et tableaux blancs.
- **Placer un projet dans la corbeille locale** : cliquez sur **Supprimer**, puis confirmez avec **Supprimer le projet**. Le projet et ses tâches sont déplacés dans la **Corbeille** locale pendant le délai configuré (les notes et tableaux blancs associés restent accessibles en tant qu’éléments « Sans projet »). Pour restaurer ou purger définitivement ce projet, consultez [Comment sauvegarder, restaurer ou effacer vos données](sauvegarder-et-restaurer.md#récupérer-ou-purger-depuis-la-corbeille-locale).

## Créer et modifier une tâche

Chaque tâche doit être rattachée à un projet existant.

- **Ajout rapide en une ligne** :
  - En vue **Liste**, saisissez un titre dans **Ajout rapide d’une tâche…**, sélectionnez si besoin le projet cible (lorsque **Tous les projets** est actif), puis appuyez sur `Entrée` ou cliquez sur **Ajouter rapidement** ;
  - En vue **Kanban**, saisissez un titre dans le champ **Ajout rapide…** en haut de la colonne cible puis cliquez sur **Ajouter** (ou appuyez sur `Entrée`) pour créer la tâche directement dans ce statut.
- **Création ou modification complète** :
  1. Depuis la vue **Tâches**, sélectionnez un projet dans le menu déroulant (ou laissez **Tous les projets**), puis cliquez sur **Nouvelle tâche** — ou sur le bouton **+** en haut d’une colonne Kanban pour préremplir son statut. La saisie s’ouvre en tiroir latéral par défaut ou en modale selon le réglage choisi dans **Préférences d’affichage**.
  2. Renseignez le **Titre** (obligatoire), le **Projet**, le **Statut** (choisissez l’un des statuts configurés ou **Sans statut**), la **Priorité**, l’**Échéance** et, si besoin, une **Récurrence** (**Quotidienne**, **Hebdomadaire** ou **Mensuelle**).
  3. Ajoutez des **Étiquettes** ou des **Éléments liés** si vous souhaitez relier la tâche à d’autres contenus.
  4. Sous **Liste de contrôle**, saisissez une étape dans **Ajouter une étape** et cliquez sur **Ajouter** (ou appliquez un modèle depuis **Modèles de checklist**). Cochez les étapes terminées ou retirez-en avec **×**.
  5. Rédigez la **Description** avec la barre d’outils de mise en forme si nécessaire.
  6. Cliquez sur **Créer la tâche** (ou **Enregistrer** lors d’une modification).

Pour rouvrir une tâche existante, cliquez sur son titre dans la vue Liste ou sur le tableau Kanban, sur **Ouvrir** dans la vue Liste, ou sur **Ouvrir les détails** dans son menu d’actions Kanban. Pour l’envoyer dans la **Corbeille** locale depuis son formulaire ou la vue Liste, cliquez sur **Supprimer** puis confirmez.

## Configurer les statuts du Kanban

Par défaut, le tableau Kanban comporte trois colonnes (**À faire**, **En cours**, **Terminé**). Vous pouvez adapter ces statuts à votre flux de travail :

1. Depuis l’en-tête de la vue **Tâches**, cliquez sur **Statuts** (ou cliquez sur **Configurer les statuts du Kanban** dans **Préférences d’affichage**, ou lancez **Configurer les statuts du Kanban** via `Ctrl+K`).
2. Dans la fenêtre **Statuts du Kanban** :
   - **Renommer un statut** : modifiez directement son libellé dans la liste ;
   - **Ajouter un statut** : saisissez son nom dans **Ajouter un statut** puis cliquez sur **Ajouter** (jusqu’à 12 statuts) ;
   - **Réordonner les colonnes** : utilisez les boutons **↑** (**Monter**) et **↓** (**Descendre**) en face de chaque statut ;
   - **Supprimer un statut** : cliquez sur l’icône de corbeille en face du statut à retirer. Les tâches qui portaient ce statut ne sont pas supprimées : elles conservent leur identifiant de statut et apparaissent avec le badge d’alerte **Statut inconnu** ;
   - **Réinitialiser** : cliquez sur **Valeurs par défaut** pour restaurer les trois colonnes initiales (**À faire**, **En cours**, **Terminé**).
3. Cliquez sur **Enregistrer** pour appliquer la nouvelle configuration.

## Filtrer, trier et traiter les statuts inconnus en vue Liste

Dans l’en-tête de la vue **Tâches**, sélectionnez **Liste**. La vue **Liste** présente l’intégralité des tâches, y compris celles **Sans statut** ou dotées d’un **Statut inconnu**, et met en évidence les échéances proches ou dépassées avec les badges **En retard**, **Aujourd’hui** et **Cette semaine**.

- **Repérer les tâches à régulariser** : les tâches sans statut ou au statut inconnu portent une bordure d’avertissement et un badge orange (**Sans statut** ou **Statut inconnu (`<ancien statut>`)**).
- **Filtrer par projet** : choisissez **Tous les projets** ou un projet précis dans le menu déroulant en haut à gauche.
- **Affiner l’affichage** : utilisez **Rechercher** (filtre multi-mots sur le titre, la description, la checklist et les étiquettes), **Statut** (incluant **Sans statut** et **Statut inconnu**), **Priorité** et **Étiquette**.
- **Trier les lignes** : choisissez dans **Tri** entre **Ordre Kanban**, **Échéance** (tâches datées en premier par ordre chronologique) et **Priorité** (de `Haute` à `Basse`).
- **Réassigner ou changer un statut rapidement** : utilisez directement le menu déroulant de statut dans la colonne **Actions** de la ligne concernée pour lui attribuer un statut actif ou **Sans statut**.

## Déplacer et filtrer des tâches sur le tableau Kanban

Dans l’en-tête de la vue **Tâches**, sélectionnez **Kanban**.

- **Filtrer le tableau** : utilisez **Rechercher sur le tableau** (titre, description, checklist et étiquettes), **Priorité**, **Échéance** (**Toutes les échéances**, **En retard**, **Aujourd’hui**, **Sous 7 jours**, **Sans échéance**) et **Étiquette**.
- **Régulariser les tâches hors colonnes** : si des tâches **Sans statut** ou à **Statut inconnu** existent dans le périmètre filtré, un panneau d’alerte en haut du Kanban (`<n> tâche(s) hors colonnes`) permet d’ouvrir chaque tâche ou de la replacer directement via le sélecteur **Placer dans une colonne…**.

Trois méthodes permettent de déplacer une carte sur le tableau :

- **À la souris (glisser-déposer)** : faites glisser une carte vers une autre colonne (ajoutée en fin de colonne) ou directement sur une autre carte du même projet pour l’insérer à cette position.
- **Via le menu d’actions** : cliquez sur le bouton **⋮** de la carte, puis choisissez **Déplacer vers `<colonne>`**, **Monter dans la colonne** ou **Descendre dans la colonne**.
- **Au clavier** : placez le focus clavier sur la carte (avec `Tab`), puis maintenez `Alt` et appuyez sur les flèches :
  - `Alt + Flèche droite` / `Alt + Flèche gauche` pour changer de colonne ;
  - `Alt + Flèche haut` / `Alt + Flèche bas` pour réordonner la carte au sein de son projet dans la même colonne.

Si une tâche configurée avec une **Récurrence** atteint la colonne `Terminé`, Locavern crée aussitôt la prochaine occurrence dans la première colonne configurée et affiche la notification **Prochaine occurrence créée**.

## Utiliser la palette de commandes

Appuyez sur `Ctrl+K` (ou `Cmd+K` sur macOS), ou cliquez sur **Rechercher** dans la barre supérieure, pour ouvrir la palette de commandes. Saisissez un ou plusieurs mots (insensibles à la casse et aux accents) pour filtrer les commandes d’action ainsi que vos projets, tâches, notes, tableaux blancs et leurs étiquettes, puis validez avec `Entrée` pour changer de vue, ouvrir directement un élément ou lancer une action (y compris la **Corbeille**, les **Sauvegardes**, les **Préférences d’affichage** ou le thème clair/sombre).
