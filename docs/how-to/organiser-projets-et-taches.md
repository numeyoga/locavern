---
version: '0.1.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# Comment organiser vos projets et vos tâches

Ce guide décrit les actions pour créer, modifier, archiver et supprimer des projets, ainsi que pour piloter vos tâches en vue Liste, en vue Kanban ou au clavier. Pour le détail exhaustif des champs et raccourcis, consultez la référence [Interface, vues et raccourcis clavier](../reference/interface-et-raccourcis.md).

## Sommaire

- [Gérer les projets](#gérer-les-projets)
- [Créer et modifier une tâche](#créer-et-modifier-une-tâche)
- [Filtrer, trier et mettre à jour en vue Liste](#filtrer-trier-et-mettre-à-jour-en-vue-liste)
- [Déplacer des tâches sur le tableau Kanban](#déplacer-des-tâches-sur-le-tableau-kanban)
- [Utiliser la palette de commandes](#utiliser-la-palette-de-commandes)

## Gérer les projets

Ouvrez la vue **Projets** depuis la barre de navigation latérale.

- **Créer un projet** : cliquez sur **Nouveau projet**, renseignez un nom (obligatoire) et une description facultative, puis validez avec **Créer le projet**.
- **Modifier un projet** : sur la carte du projet, cliquez sur **Modifier**, ajustez le nom ou la description, puis cliquez sur **Enregistrer**.
- **Ouvrir les tâches d’un projet** : cliquez sur **Ouvrir les tâches** sur sa carte pour basculer vers la vue **Tâches** déjà filtrée sur ce projet.
- **Archiver ou désarchiver un projet** : cliquez sur **Archiver** (ou **Désarchiver**). Le projet reste visible dans les sélecteurs avec la mention `(archivé)` et conserve toutes ses tâches et notes.
- **Supprimer un projet** : cliquez sur **Supprimer**, puis confirmez avec **Supprimer le projet**. Attention : les tâches rattachées à ce projet sont supprimées, tandis que les notes associées sont conservées en tant que notes « Sans projet ».

## Créer et modifier une tâche

Chaque tâche doit être rattachée à un projet existant.

1. Depuis la vue **Tâches**, sélectionnez un projet dans le menu déroulant (ou laissez **Tous les projets**), puis cliquez sur **Nouvelle tâche** — ou sur le bouton **+** en haut d’une colonne Kanban pour préremplir son statut.
2. Renseignez le **Titre** (obligatoire), le **Projet**, le **Statut**, la **Priorité** et, si besoin, une **Échéance**.
3. Pour ajouter des sous-étapes dans **Liste de contrôle**, saisissez un libellé dans **Ajouter une étape** et cliquez sur **Ajouter**. Cochez les étapes terminées ou retirez-en avec le bouton **×**.
4. Rédigez la **Description** avec la barre d’outils de mise en forme si nécessaire.
5. Cliquez sur **Créer la tâche** (ou **Enregistrer** lors d’une modification).

Pour rouvrir une tâche existante, cliquez sur son titre dans la vue Liste ou sur le tableau Kanban, sur **Ouvrir** dans la vue Liste, ou sur **Ouvrir les détails** dans son menu d’actions Kanban. Pour la supprimer depuis le tiroir, cliquez sur **Supprimer** puis confirmez.

## Filtrer, trier et mettre à jour en vue Liste

Dans l’en-tête de la vue **Tâches**, sélectionnez **Liste**.

- **Filtrer par projet** : choisissez **Tous les projets** ou un projet précis dans le menu déroulant en haut à gauche.
- **Affiner l’affichage** : utilisez le champ **Rechercher** (filtre sur le titre), le sélecteur **Statut** et le sélecteur **Priorité**.
- **Trier les lignes** : choisissez dans **Tri** entre **Ordre Kanban**, **Échéance** (les tâches avec date apparaissent en premier par ordre chronologique) et **Priorité** (de `Haute` à `Basse`).
- **Changer le statut rapidement** : modifiez directement le menu déroulant de statut dans la colonne **Actions** de la ligne concernée, sans ouvrir le tiroir.

## Déplacer des tâches sur le tableau Kanban

Dans l’en-tête de la vue **Tâches**, sélectionnez **Kanban**. Le champ **Rechercher sur le tableau** filtre les cartes affichées dans les trois colonnes (**À faire**, **En cours**, **Terminé**).

Trois méthodes permettent de déplacer une carte :

- **À la souris (glisser-déposer)** : faites glisser une carte vers une autre colonne (elle est ajoutée en fin de colonne) ou directement sur une autre carte du même projet pour l’insérer à cette position.
- **Via le menu d’actions** : cliquez sur le bouton **⋮** de la carte, puis choisissez **Déplacer vers À faire / En cours / Terminé**, **Monter dans la colonne** ou **Descendre dans la colonne**.
- **Au clavier** : placez le focus clavier sur la carte (avec `Tab`), puis maintenez `Alt` et appuyez sur les flèches :
  - `Alt + Flèche droite` / `Alt + Flèche gauche` pour changer de colonne ;
  - `Alt + Flèche haut` / `Alt + Flèche bas` pour réordonner la carte au sein de son projet dans la même colonne.

Si le sélecteur de projet est réglé sur **Tous les projets**, chaque carte affiche une étiquette avec le nom de son projet ; les déplacements verticaux réordonnent la tâche parmi celles de son propre projet.

## Utiliser la palette de commandes

Appuyez sur `Ctrl+K` (ou `Cmd+K` sur macOS), ou cliquez sur **Rechercher** dans la barre supérieure, pour ouvrir la palette de commandes. Tapez quelques lettres pour filtrer la liste, utilisez les flèches haut/bas puis `Entrée` pour changer de vue, créer une tâche, un projet ou une note, ouvrir les sauvegardes ou basculer le thème.
