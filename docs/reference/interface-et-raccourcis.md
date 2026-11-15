---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# Interface, vues et raccourcis clavier

Description factuelle de l’interface utilisateur, des champs, des valeurs par défaut et des raccourcis clavier de Locavern (`0.2.0`).

## Sommaire

- [Structure générale (Shell)](#structure-générale-shell)
- [Vue Tâches en mode Liste](#vue-tâches-en-mode-liste)
- [Vue Tâches en mode Kanban](#vue-tâches-en-mode-kanban)
- [Fenêtre Statuts du Kanban](#fenêtre-statuts-du-kanban)
- [Formulaire de tâche (tiroir latéral ou modale)](#formulaire-de-tâche-tiroir-latéral-ou-modale)
- [Vue Projets](#vue-projets)
- [Vue Notes et éditeur enrichi](#vue-notes-et-éditeur-enrichi)
- [Vue Tableaux blancs et canevas SVG](#vue-tableaux-blancs-et-canevas-svg)
- [Palette de commandes et raccourcis clavier](#palette-de-commandes-et-raccourcis-clavier)

## Structure générale (Shell)

- **Lien d’évitement** : `Aller au contenu` (cible `#shell-main`).
- **Barre latérale (`Navigation principale`)** :
  - `Tâches` (vue par défaut au premier démarrage) ;
  - `Projets` ;
  - `Notes` ;
  - `Tableaux blancs` ;
  - Groupe `Données` : `Sauvegardes` (ouvre la fenêtre `Sauvegardes et stockage`) ;
  - Groupe `Préférences` : `Affichage` (ouvre la fenêtre `Préférences d’affichage`).
  - Sur écran étroit (< 1024 px), le bouton menu (`Ouvrir le menu`) dans la barre supérieure ouvre et ferme la barre latérale.
- **Barre supérieure** :
  - Titre de la vue active (`Tâches`, `Projets`, `Notes` ou `Tableaux blancs`) ;
  - Bouton `Rechercher` (`Ctrl+K`) ouvrant la palette de commandes ;
  - Interrupteur `Sombre` basculant entre thème clair et thème sombre (la préférence est conservée localement sous la clé `locavern-color-scheme` ; sinon l’application suit la préférence système `prefers-color-scheme`) ;
  - Bouton `Sauvegarder` ouvrant la fenêtre `Sauvegardes et stockage`.
- **Fenêtre `Préférences d’affichage`** :
  - Contrôle segmenté `Taille du texte` proposant `Automatique` (défaut : ×1,125 dès `2000 px`, ×1,25 dès `2400 px`), `Standard` (×1), `Confortable` (×1,125) et `Grande` (×1,25) ;
  - Un choix explicite est conservé localement sous la clé `locavern-text-size` et synchronisé entre onglets (le choix `Automatique` supprime la clé) ;
  - Contrôles segmentés `Visuel de saisie par écran` permettant de choisir entre `Tiroir latéral` et `Modale` indépendamment pour chacun des quatre écrans :
    - `Tâches` : `Tiroir latéral` par défaut ;
    - `Projets` : `Modale` par défaut ;
    - `Notes` : `Tiroir latéral` par défaut ;
    - `Tableaux blancs` : `Modale` par défaut.
  - Champ numérique `Durée des notifications (secondes)` permettant de définir un délai entier entre `1` et `60` secondes (`6` secondes par défaut) pour la fermeture automatique des notifications de succès et d’information ;
  - Bouton `Configurer les statuts` ouvrant la fenêtre `Statuts du Kanban` ;
  - Les choix de visuel de saisie (`preferences.inputPresentations`), de durée des notifications (`preferences.toastDurationSeconds`) et de colonnes Kanban (`preferences.taskStatuses`) sont enregistrés localement dans `IndexedDB` et conservés lors d’un remplacement de données (sauf si l’archive importée fournit sa propre liste `taskStatuses`).
- **Notifications** : les notifications de succès et d’information se ferment automatiquement après le délai configuré en secondes (`6` secondes par défaut, en pause au survol ou au focus puis reprise à la sortie) ; les alertes d’avertissement et d’erreur restent affichées jusqu’à fermeture manuelle.

## Vue Tâches en mode Liste

En-tête partagé des vues tâches :

| Contrôle                | Options / comportement                                                                                                   | Valeur par défaut                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Sélecteur de projet     | `Tous les projets`, ou l’un des projets existants (avec suffixe `(archivé)` si archivé)                                  | `Tous les projets` (puis premier projet créé) |
| Mode d’affichage        | `Liste`, `Kanban`                                                                                                        | `Liste`                                       |
| Bouton `Statuts`        | Ouvre la fenêtre `Statuts du Kanban` (`#modal-statuses`) ; désactivé en lecture seule                                    | —                                             |
| Bouton `Nouvelle tâche` | Ouvre la saisie de création (tiroir latéral ou modale selon les préférences) ; désactivé sans projet ou en lecture seule | —                                             |

Barre de filtres et tableau (`Liste`) :

| Élément             | Valeurs disponibles                                                                   | Comportement                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Rechercher`        | Texte libre                                                                           | Filtre insensible à la casse sur le titre de la tâche                                                                                                  |
| `Statut`            | `Tous les statuts`, statuts configurés, `Sans statut` (`__none__`), `Statut inconnu`  | Filtre exact sur un statut configuré, sur les tâches sans statut (`null`) ou sur les tâches dont l’identifiant de statut ne figure plus dans le Kanban |
| `Priorité`          | `Toutes les priorités`, `Haute`, `Moyenne`, `Basse`                                   | Filtre exact sur la priorité                                                                                                                           |
| `Tri`               | `Ordre Kanban`, `Échéance`, `Priorité`                                                | `Échéance` place les tâches datées avant celles sans date ; `Priorité` trie de `Haute` à `Basse`                                                       |
| Colonnes du tableau | `Tâche`, `Projet`, `Statut`, `Priorité`, `Échéance`, `Actions`                        | `Actions` contient un sélecteur rapide de statut (incluant `Sans statut`), `Ouvrir` et `Supprimer`                                                     |
| Statut non résolu   | Badge d’avertissement `Sans statut` ou `Statut inconnu (<nom>)` + ligne mise en avant | Identifie visuellement les tâches absentes du Kanban afin que l’utilisateur puisse leur attribuer un statut actif                                      |

## Vue Tâches en mode Kanban

- **Colonnes paramétrables** : correspond à `preferences.taskStatuses` (par défaut : `À faire` (`todo`), `En cours` (`in_progress`), `Terminé` (`done`)). Chaque en-tête affiche un compteur et un bouton `+` créant une tâche pré-remplie avec le statut de la colonne.
- **Exclusion des statuts non configurés** : les tâches `Sans statut` (`status: null`) ou portant un identifiant de statut absent de `preferences.taskStatuses` ne sont pas affichées sur le tableau Kanban (elles restent visibles et modifiables dans la vue `Liste`).
- **Filtre** : `Rechercher sur le tableau` (filtre insensible à la casse sur le titre).
- **Contenu d’une carte** : titre cliquable, bouton menu `Actions` (`⋮`), badge de priorité, étiquette de date d’échéance (si définie), compteur de liste de contrôle `fait/total` (si non vide), étiquette du nom de projet (uniquement quand `Tous les projets` est sélectionné).
- **Menu d’actions d’une carte** : `Ouvrir les détails`, `Déplacer vers <autre colonne>`, `Monter dans la colonne` (si non première de son projet), `Descendre dans la colonne` (si non dernière de son projet), `Supprimer` (avec confirmation). En lecture seule, seul `Ouvrir les détails` est présent.

## Fenêtre Statuts du Kanban

Accessible depuis le bouton `Statuts` de l’en-tête `Tâches`, depuis `Préférences d’affichage` (`Configurer les statuts`) ou via la palette de commandes (`Configurer les statuts du Kanban`).

| Élément                   | Contrainte / comportement                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Liste des statuts         | Jusqu’à `12` statuts ; chaque ligne permet de modifier le libellé (`40` caractères max.), monter, descendre ou supprimer la colonne |
| `Ajouter un statut`       | Crée un nouveau statut avec identifiant slugifié unique et libellé obligatoire (`40` caractères max.)                               |
| `Valeurs par défaut`      | Restaure les trois statuts initiaux (`À faire`, `En cours`, `Terminé`) dans la liste d’édition                                      |
| Suppression d’une colonne | Ne supprime aucune tâche : les tâches rattachées au statut retiré passent en `Statut inconnu` dans la vue `Liste`                   |

## Formulaire de tâche (tiroir latéral ou modale)

S’affiche en `Tiroir latéral` par défaut ou en `Modale` selon le réglage de l’écran `Tâches` dans `Préférences d’affichage`.

| Champ               | Type                                                                      | Obligatoire | Limite / défaut                                                                |
| ------------------- | ------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `Titre`             | Texte                                                                     | Oui         | 200 caractères maximum                                                         |
| `Projet`            | Liste déroulante                                                          | Oui         | Projet sélectionné ou premier projet                                           |
| `Statut`            | Statuts configurés + `Sans statut` (et statut inconnu actuel si existant) | Non         | Premier statut configuré (ou statut de la colonne si ajouté via `+` du Kanban) |
| `Priorité`          | `Basse`, `Moyenne`, `Haute`                                               | Oui         | `Moyenne`                                                                      |
| `Échéance`          | Date (`AAAA-MM-JJ`)                                                       | Non         | Vide (`null`)                                                                  |
| `Liste de contrôle` | Liste d’étapes à cocher                                                   | Non         | 200 caractères par étape                                                       |
| `Description`       | Éditeur texte enrichi                                                     | Non         | Document vide                                                                  |

Actions du pied de fenêtre : `Supprimer` (en édition hors lecture seule, avec confirmation), `Annuler`, `Créer la tâche` / `Enregistrer`.

## Vue Projets

La saisie `Nouveau projet` / `Modifier le projet` s’affiche en `Modale` par défaut ou en `Tiroir latéral` selon le réglage de l’écran `Projets` dans `Préférences d’affichage`.

| Élément                 | Contrainte / comportement                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Nom du projet`         | Obligatoire, 120 caractères maximum                                                                                                      |
| `Description`           | Facultative, 1000 caractères maximum                                                                                                     |
| Badges d’état           | `Actif` ou `Archivé`                                                                                                                     |
| Compteurs affichés      | Nombre de tâches, de notes et de tableaux blancs associés                                                                                |
| Actions par carte       | `Ouvrir les tâches`, `Ouvrir les notes`, `Modifier`, `Archiver` / `Désarchiver`, `Supprimer`                                             |
| Suppression d’un projet | Supprime le projet et toutes ses tâches ; détache ses notes et tableaux blancs (`projectId` devient `null`, visibles dans `Sans projet`) |

## Vue Notes et éditeur enrichi

- **Filtres** : menu déroulant (`Toutes les notes`, `Sans projet`, ou un projet), champ `Rechercher une note` (filtre sur le titre). Tri automatique par date de mise à jour décroissante.
- **Fenêtre de saisie de note (`Nouvelle note` / `Modifier la note`)** : s’affiche en `Tiroir latéral` par défaut ou en `Modale` selon le réglage de l’écran `Notes` dans `Préférences d’affichage`. Ouverte par `Nouvelle note`, `Créer une note`, le bouton `Ouvrir la saisie` dans l’espace de travail ou la commande `Créer une note`. Champs : `Titre de la note` (obligatoire, 200 caractères maximum), `Projet associé` (`Sans projet` ou projet existant), `Contenu` (éditeur enrichi). Actions : `Supprimer` (en édition hors lecture seule, avec confirmation), `Annuler`, `Créer la note` / `Enregistrer`.
- **Champs d’en-tête dans l’espace de travail intégré** : `Titre de la note` (200 caractères maximum), `Projet associé` (`Sans projet` ou projet existant) et bouton `Ouvrir la saisie`.
- **Barre d’outils de l’éditeur** (partagée avec la description des tâches et le formulaire de saisie) :

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

## Vue Tableaux blancs et canevas SVG

- **Filtres** : menu déroulant (`Tous les tableaux`, `Sans projet`, ou un projet), champ `Rechercher un tableau blanc` (filtre sur le titre). Tri automatique par date de mise à jour décroissante.
- **Fenêtre de saisie de tableau blanc (`Nouveau tableau blanc` / `Modifier le tableau blanc`)** : s’affiche en `Modale` par défaut ou en `Tiroir latéral` selon le réglage de l’écran `Tableaux blancs` dans `Préférences d’affichage`. Ouverte par `Nouveau tableau blanc`, `Créer un tableau blanc`, le bouton `Ouvrir la saisie` dans l’espace de travail ou la commande `Créer un tableau blanc`. Champs : `Titre du tableau blanc` (obligatoire, 200 caractères maximum), `Projet associé` (`Sans projet` ou projet existant). Actions : `Supprimer` (en édition hors lecture seule, avec confirmation), `Annuler`, `Créer le tableau blanc` / `Enregistrer`.
- **Champs d’en-tête dans l’espace de travail intégré** : `Titre du tableau blanc` (200 caractères maximum), `Projet associé` (`Sans projet` ou projet existant) et bouton `Ouvrir la saisie`.
- **Barre d’outils du canevas (`Outils du tableau blanc`)** :

| Contrôle                                     | Action                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `Sélectionner`                               | Sélectionne, déplace les éléments ou effectue un panoramique sur le fond                     |
| `Post-it`, `Rectangle`, `Ellipse`            | Crée une forme au clic simple ou par glisser-déposer (`500` caractères de texte max.)        |
| `Flèche`, `Texte`, `Tracé libre`             | Crée une flèche, un bloc texte ou un tracé à main levée (`2 000` points max. par tracé)      |
| `Ajouter au centre`                          | Insère sans glisser-déposer l’élément correspondant à l’outil actif au centre de la vue      |
| `Image locale`                               | Insère une image locale (`PNG`, `JPEG`, `WebP`, `GIF` ; collage et dépôt également actifs)   |
| Sélecteur de couleur (`5` pastilles)         | `Neutre`, `Accent`, `Succès`, `Avertissement`, `Danger` (tokens sémantiques Covenant)        |
| `Fond transparent`                           | Active ou désactive le fond transparent (`fill: none`) sur `Post-it`, `Rectangle`, `Ellipse` |
| `Avancer d’un niveau`, `Reculer d’un niveau` | Déplace l’élément sélectionné d’un cran vers l’avant ou l’arrière (`zIndex`)                 |
| `Modifier le texte`, `Supprimer`             | Ouvre la barre d’édition de texte ou supprime l’élément sélectionné                          |
| `Annuler`, `Rétablir`                        | Historique local d’édition (`50` états)                                                      |
| `Zoom -`, `100 %`, `Zoom +`                  | Ajuste ou réinitialise le facteur de zoom (`25 %` à `300 %`)                                 |

- **Pied de carte** : indicateur `Enregistré localement` / `Modifications en cours` (délai `200 ms`), boutons `Exporter SVG`, `Exporter PNG`, `Supprimer` (avec confirmation) et `Enregistrer`.

## Palette de commandes et raccourcis clavier

Commandes disponibles dans la palette (`Ctrl+K` / `Cmd+K`) :

| Libellé                              | Action                                                                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `Aller aux tâches`                   | Affiche la vue `Tâches`                                                                                              |
| `Aller aux projets`                  | Affiche la vue `Projets`                                                                                             |
| `Aller aux notes`                    | Affiche la vue `Notes`                                                                                               |
| `Aller aux tableaux blancs`          | Affiche la vue `Tableaux blancs`                                                                                     |
| `Créer une tâche`                    | Ouvre la saisie `Nouvelle tâche` (ou `Nouveau projet` si aucun projet n’existe) ; ignoré en lecture seule            |
| `Créer un projet`                    | Ouvre la saisie `Nouveau projet` ; ignoré en lecture seule                                                           |
| `Créer une note`                     | Ouvre la saisie `Nouvelle note` et affiche la vue `Notes` après création ; ignoré en lecture seule                   |
| `Créer un tableau blanc`             | Ouvre la saisie `Nouveau tableau blanc` et affiche la vue `Tableaux blancs` après création ; ignoré en lecture seule |
| `Configurer les statuts du Kanban`   | Ouvre la fenêtre `Statuts du Kanban` (`#modal-statuses`) ; ignoré en lecture seule                                   |
| `Ouvrir les sauvegardes`             | Ouvre la fenêtre `Sauvegardes et stockage`                                                                           |
| `Ouvrir les préférences d’affichage` | Ouvre la fenêtre `Préférences d’affichage`                                                                           |
| `Basculer le thème clair/sombre`     | Inverse le thème actif et enregistre la préférence                                                                   |

Raccourcis clavier globaux et contextuels :

| Contexte                               | Raccourci                                                     | Effet                                                                     |
| -------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Global                                 | `Ctrl+K` / `Cmd+K`                                            | Ouvre la palette de commandes                                             |
| Modales, tiroirs, palette, menu mobile | `Échap`                                                       | Ferme la fenêtre ou le menu ouvert                                        |
| Palette de commandes                   | `Flèche haut` / `Flèche bas`, `Entrée`                        | Parcourt et exécute la commande filtrée                                   |
| Carte Kanban focalisée                 | `Alt + Flèche gauche` / `Alt + Flèche droite`                 | Déplace la carte vers la colonne précédente / suivante                    |
| Carte Kanban focalisée                 | `Alt + Flèche haut` / `Alt + Flèche bas`                      | Monte / descend la carte parmi les tâches de son projet dans la colonne   |
| Menu d’actions Kanban ouvert           | `Flèche haut` / `Flèche bas`, `Début`, `Fin`, `Entrée`, `Tab` | Navigue dans les actions, active l’option ou ferme le menu                |
| Élément SVG du tableau blanc focalisé  | `Flèches directionnelles` (avec `Maj` pour pas fin `1`)       | Déplace l’élément de `10` unités (`1` avec `Maj`)                         |
| Élément SVG du tableau blanc focalisé  | `Alt + Flèches directionnelles`                               | Redimensionne l’élément de `10` unités (`1` avec `Maj`)                   |
| Élément SVG du tableau blanc focalisé  | `Page précédente` / `Page suivante`                           | Avance ou recule l’élément d’un niveau dans l’ordre de superposition      |
| Élément SVG du tableau blanc focalisé  | `Entrée` ou `F2`                                              | Ouvre l’éditeur de texte accessible (`sticky`, `rect`, `ellipse`, `text`) |
| Élément SVG du tableau blanc focalisé  | `Suppr` (`Delete`) ou `Retour arrière`                        | Supprime l’élément sélectionné                                            |
| Tableau blanc actif                    | `Ctrl+Z`, `Ctrl+Y` / `Ctrl+Maj+Z`, `Ctrl + molette`, `Échap`  | Annule, rétablit, zoome ou revient à l’outil `Sélectionner`               |
