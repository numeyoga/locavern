---
version: '0.1.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# Interface, vues et raccourcis clavier

Description factuelle de l’interface utilisateur, des champs, des valeurs par défaut et des raccourcis clavier de Locavern (`0.1.0`).

## Sommaire

- [Structure générale (Shell)](#structure-générale-shell)
- [Vue Tâches en mode Liste](#vue-tâches-en-mode-liste)
- [Vue Tâches en mode Kanban](#vue-tâches-en-mode-kanban)
- [Tiroir de tâche](#tiroir-de-tâche)
- [Vue Projets](#vue-projets)
- [Vue Notes et éditeur enrichi](#vue-notes-et-éditeur-enrichi)
- [Palette de commandes et raccourcis clavier](#palette-de-commandes-et-raccourcis-clavier)

## Structure générale (Shell)

- **Lien d’évitement** : `Aller au contenu` (cible `#shell-main`).
- **Barre latérale (`Navigation principale`)** :
  - `Tâches` (vue par défaut au premier démarrage) ;
  - `Projets` ;
  - `Notes` ;
  - Groupe `Données` : `Sauvegardes` (ouvre la fenêtre `Sauvegardes et stockage`).
  - Sur écran étroit (< 1024 px), le bouton menu (`Ouvrir le menu`) dans la barre supérieure ouvre et ferme la barre latérale.
- **Barre supérieure** :
  - Titre de la vue active (`Tâches`, `Projets` ou `Notes`) ;
  - Bouton `Rechercher` (`Ctrl+K`) ouvrant la palette de commandes ;
  - Interrupteur `Sombre` basculant entre thème clair et thème sombre (la préférence est conservée localement sous la clé `locavern-color-scheme` ; sinon l’application suit la préférence système `prefers-color-scheme`) ;
  - Bouton `Sauvegarder` ouvrant la fenêtre `Sauvegardes et stockage`.
- **Notifications** : les notifications de succès et d’information se ferment automatiquement après 6 secondes (en pause au survol ou au focus) ; les alertes d’avertissement et d’erreur restent affichées jusqu’à fermeture manuelle.

## Vue Tâches en mode Liste

En-tête partagé des vues tâches :

| Contrôle                | Options / comportement                                                                  | Valeur par défaut                             |
| ----------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| Sélecteur de projet     | `Tous les projets`, ou l’un des projets existants (avec suffixe `(archivé)` si archivé) | `Tous les projets` (puis premier projet créé) |
| Mode d’affichage        | `Liste`, `Kanban`                                                                       | `Liste`                                       |
| Bouton `Nouvelle tâche` | Ouvre le tiroir de création ; désactivé si aucun projet n’existe ou en lecture seule    | —                                             |

Barre de filtres et tableau (`Liste`) :

| Élément             | Valeurs disponibles                                            | Comportement                                                                                     |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Rechercher`        | Texte libre                                                    | Filtre insensible à la casse sur le titre de la tâche                                            |
| `Statut`            | `Tous les statuts`, `À faire`, `En cours`, `Terminé`           | Filtre exact sur le statut                                                                       |
| `Priorité`          | `Toutes les priorités`, `Haute`, `Moyenne`, `Basse`            | Filtre exact sur la priorité                                                                     |
| `Tri`               | `Ordre Kanban`, `Échéance`, `Priorité`                         | `Échéance` place les tâches datées avant celles sans date ; `Priorité` trie de `Haute` à `Basse` |
| Colonnes du tableau | `Tâche`, `Projet`, `Statut`, `Priorité`, `Échéance`, `Actions` | `Actions` contient un sélecteur rapide de statut, `Ouvrir` et `Supprimer`                        |

## Vue Tâches en mode Kanban

- **Colonnes fixes** : `À faire` (`todo`), `En cours` (`in_progress`), `Terminé` (`done`). Chaque en-tête affiche un compteur et un bouton `+` créant une tâche pré-remplie avec le statut de la colonne.
- **Filtre** : `Rechercher sur le tableau` (filtre insensible à la casse sur le titre).
- **Contenu d’une carte** : titre cliquable, bouton menu `Actions` (`⋮`), badge de priorité, étiquette de date d’échéance (si définie), compteur de liste de contrôle `fait/total` (si non vide), étiquette du nom de projet (uniquement quand `Tous les projets` est sélectionné).
- **Menu d’actions d’une carte** : `Ouvrir les détails`, `Déplacer vers <autre colonne>`, `Monter dans la colonne` (si non première de son projet), `Descendre dans la colonne` (si non dernière de son projet), `Supprimer` (avec confirmation). En lecture seule, seul `Ouvrir les détails` est présent.

## Tiroir de tâche

| Champ               | Type                             | Obligatoire | Limite / défaut                                              |
| ------------------- | -------------------------------- | ----------- | ------------------------------------------------------------ |
| `Titre`             | Texte                            | Oui         | 200 caractères maximum                                       |
| `Projet`            | Liste déroulante                 | Oui         | Projet sélectionné ou premier projet                         |
| `Statut`            | `À faire`, `En cours`, `Terminé` | Oui         | `À faire` (ou statut de la colonne si ajouté via `+` Kanban) |
| `Priorité`          | `Basse`, `Moyenne`, `Haute`      | Oui         | `Moyenne`                                                    |
| `Échéance`          | Date (`AAAA-MM-JJ`)              | Non         | Vide (`null`)                                                |
| `Liste de contrôle` | Liste d’étapes à cocher          | Non         | 200 caractères par étape                                     |
| `Description`       | Éditeur texte enrichi            | Non         | Document vide                                                |

Actions du pied de tiroir : `Supprimer` (en édition hors lecture seule, avec confirmation), `Annuler`, `Créer la tâche` / `Enregistrer`.

## Vue Projets

| Élément                 | Contrainte / comportement                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Nom du projet`         | Obligatoire, 120 caractères maximum                                                                                   |
| `Description`           | Facultative, 1000 caractères maximum                                                                                  |
| Badges d’état           | `Actif` ou `Archivé`                                                                                                  |
| Compteurs affichés      | Nombre de tâches et nombre de notes associées                                                                         |
| Actions par carte       | `Ouvrir les tâches`, `Modifier`, `Archiver` / `Désarchiver`, `Supprimer`                                              |
| Suppression d’un projet | Supprime le projet et toutes ses tâches ; détache ses notes (`projectId` devient `null`, visibles dans `Sans projet`) |

## Vue Notes et éditeur enrichi

- **Filtres** : menu déroulant (`Toutes les notes`, `Sans projet`, ou un projet), champ `Rechercher une note` (filtre sur le titre). Tri automatique par date de mise à jour décroissante.
- **Champs d’en-tête** : `Titre de la note` (200 caractères maximum, défaut `Nouvelle note`), `Projet associé` (`Sans projet` ou projet existant).
- **Barre d’outils de l’éditeur** (partagée avec la description des tâches) :

| Bouton                     | Action                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `Gras`                     | Active/désactive la mise en gras                                                            |
| `Italique`                 | Active/désactive l’italique                                                                 |
| `Barré`                    | Active/désactive le texte barré                                                             |
| `Code en ligne`            | Active/désactive le style code inline                                                       |
| `Titre`                    | Bascule en titre de niveau 2 (`h2`) ; les niveaux `h1` à `h3` sont supportés dans le modèle |
| `Liste à puces`            | Liste à puces                                                                               |
| `Liste numérotée`          | Liste ordonnée                                                                              |
| `Liste de contrôle`        | Liste de cases à cocher imbricables                                                         |
| `Lien`                     | Ouvre la barre `Lien (https://)` avec boutons `Appliquer` et `Annuler`                      |
| `Insérer une image locale` | Ouvre le sélecteur de fichier (`image/png`, `image/jpeg`, `image/webp`, `image/gif`)        |

- **Indicateur de sauvegarde** : `Modifications en cours` pendant le délai de saisie (200 ms), puis `Enregistrée localement`. Bouton `Enregistrer` pour forcer l’enregistrement avec notification ; bouton `Supprimer` avec confirmation.

## Palette de commandes et raccourcis clavier

Commandes disponibles dans la palette (`Ctrl+K` / `Cmd+K`) :

| Libellé                          | Action                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `Aller aux tâches`               | Affiche la vue `Tâches`                                                                                             |
| `Aller aux projets`              | Affiche la vue `Projets`                                                                                            |
| `Aller aux notes`                | Affiche la vue `Notes`                                                                                              |
| `Créer une tâche`                | Ouvre le tiroir `Nouvelle tâche` (ou la modale `Nouveau projet` si aucun projet n’existe) ; ignoré en lecture seule |
| `Créer un projet`                | Ouvre la modale `Nouveau projet` ; ignoré en lecture seule                                                          |
| `Créer une note`                 | Passe sur `Notes` et crée une note `Nouvelle note` ; ignoré en lecture seule                                        |
| `Ouvrir les sauvegardes`         | Ouvre la fenêtre `Sauvegardes et stockage`                                                                          |
| `Basculer le thème clair/sombre` | Inverse le thème actif et enregistre la préférence                                                                  |

Raccourcis clavier globaux et contextuels :

| Contexte                               | Raccourci                                                     | Effet                                                                   |
| -------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Global                                 | `Ctrl+K` / `Cmd+K`                                            | Ouvre la palette de commandes                                           |
| Modales, tiroirs, palette, menu mobile | `Échap`                                                       | Ferme la fenêtre ou le menu ouvert                                      |
| Palette de commandes                   | `Flèche haut` / `Flèche bas`, `Entrée`                        | Parcourt et exécute la commande filtrée                                 |
| Carte Kanban focalisée                 | `Alt + Flèche gauche` / `Alt + Flèche droite`                 | Déplace la carte vers la colonne précédente / suivante                  |
| Carte Kanban focalisée                 | `Alt + Flèche haut` / `Alt + Flèche bas`                      | Monte / descend la carte parmi les tâches de son projet dans la colonne |
| Menu d’actions Kanban ouvert           | `Flèche haut` / `Flèche bas`, `Début`, `Fin`, `Entrée`, `Tab` | Navigue dans les actions, active l’option ou ferme le menu              |
