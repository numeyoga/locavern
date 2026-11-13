---
version: '0.1.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# Stockage local, format d’archive et messages d’erreur

Spécification factuelle du stockage navigateur, des limites techniques, du format d’archive ZIP et des messages d’erreur affichés par Locavern (`0.1.0`).

## Sommaire

- [Stockage dans le navigateur](#stockage-dans-le-navigateur)
- [Format des archives ZIP](#format-des-archives-zip)
- [Limites techniques et formats autorisés](#limites-techniques-et-formats-autorisés)
- [Messages d’avertissement et d’erreur](#messages-davertissement-et-derreur)

## Stockage dans le navigateur

Locavern stocke l’ensemble des données localement sur l’appareil, dans la même origine navigateur :

- **Base `IndexedDB` (`locavern-db`, version `1`)** :
  - `meta` : préférences d’affichage (`activeView`, `taskDisplayMode`, `selectedProjectId`, `selectedNoteId`) et métadonnées de schéma ;
  - `projects` : projets ;
  - `tasks` : tâches, échéances, listes de contrôle et descriptions ;
  - `notes` : notes enrichies ;
  - `assets` : métadonnées et données binaires (`Blob`) des images locales.
- **`localStorage`** : clé `locavern-color-scheme` (`light` ou `dark`, supprimée lorsque le choix correspond au thème système).
- **Verrou multi-onglets** : verrou Web Lock nommé `locavern-write-lock` et canal `BroadcastChannel` nommé `locavern-lock-channel`.
- **Statuts de stockage** :
  - `Stockage persistant` : `navigator.storage.persisted()` retourne `true` ;
  - `Stockage standard` : `navigator.storage.persisted()` retourne `false`.

## Format des archives ZIP

Nom par défaut lors de l’export : `locavern-sauvegarde-AAAA-MM-JJ.zip`.

Contenu de l’archive :

| Entrée          | Rôle                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json` | Métadonnées d’archive : `format` (`locavern-archive`), `schemaVersion` (`1`), `appVersion` (`0.1.0`), `exportedAt`, compteurs `counts` (`projects`, `tasks`, `notes`, `assets`) |
| `data.json`     | Collections JSON en clair : `schemaVersion` (`1`), `exportedAt`, `projects`, `tasks`, `notes`, `assets` (sans chiffrement)                                                      |
| `assets/<id>`   | Fichiers binaires d’images locales associés aux entrées de `data.json`                                                                                                          |

## Limites techniques et formats autorisés

| Élément                                        | Valeur ou contrainte vérifiée                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Version de schéma de données                   | `1` (`schemaVersion: 1`)                                                              |
| Formats d’image acceptés                       | `image/png`, `image/jpeg`, `image/webp`, `image/gif` (SVG et images distantes exclus) |
| Taille maximale par image                      | `5 Mio` (`5 242 880` octets)                                                          |
| Taille maximale d’une archive ZIP              | `25 Mio` (`26 214 400` octets)                                                        |
| Nombre maximal d’enregistrements à l’import    | `10 000` (somme des projets, tâches, notes et images)                                 |
| Protocoles de lien autorisés dans l’éditeur    | `https://` et `mailto:` uniquement (`target="_blank"`, `rel="noopener noreferrer"`)   |
| Longueur maximale — nom de projet              | `120` caractères                                                                      |
| Longueur maximale — description de projet      | `1 000` caractères                                                                    |
| Longueur maximale — titre de tâche ou de note  | `200` caractères                                                                      |
| Longueur maximale — étape de liste de contrôle | `200` caractères                                                                      |

## Messages d’avertissement et d’erreur

### Éditeur et saisie

| Titre / contexte         | Message affiché                                                             | Cause                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Mode lecture seule`     | `Impossible d’ajouter une image tant qu’un autre onglet détient le verrou.` | Tentative d’ajout d’image alors qu’un autre onglet détient `locavern-write-lock`                           |
| `Image refusée`          | `Format d’image non pris en charge. Utilisez PNG, JPEG, WebP ou GIF.`       | Type MIME non autorisé (ex. SVG, TIFF, PDF)                                                                |
| `Image refusée`          | `L’image doit être non vide et ne pas dépasser 5 Mio.`                      | Fichier vide (`0` octet) ou supérieur à 5 Mio                                                              |
| `Image distante bloquée` | `Seules les images locales enregistrées sur cet appareil sont autorisées.`  | Collage d’une URL d’image distante ou de HTML contenant `<img src="https://...">` / `<img src="data:...">` |
| `Lien refusé`            | `Seuls les liens https:// et mailto: sont acceptés.`                        | URL invalide ou utilisant un autre protocole (`http://`, `javascript:`, etc.)                              |
| Formulaire projet        | `Saisissez un nom de projet non vide.`                                      | Validation du formulaire avec nom vide ou composé uniquement d’espaces                                     |
| Formulaire tâche         | `Saisissez un titre de tâche.`                                              | Validation du tiroir avec titre vide ou composé uniquement d’espaces                                       |

### Verrou multi-onglets et persistance

| Titre / contexte        | Message affiché                                                                                                                                              | Cause                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Bandeau supérieur       | `Mode lecture seule actif. Un autre onglet détient le verrou d’écriture sur la base locale. Fermez l’autre onglet puis réessayez pour modifier vos données.` | Un autre onglet ou fenêtre installée détient déjà le verrou d’écriture      |
| `Verrou toujours actif` | `Un autre onglet utilise encore Locavern en écriture.`                                                                                                       | Clic sur `Reprendre l’édition` alors que l’autre onglet est toujours ouvert |
| `Erreur de persistance` | `Impossible d’enregistrer la modification dans IndexedDB.`                                                                                                   | Échec d’écriture dans `IndexedDB` (ex. quota dépassé)                       |

### Import et export d’archives ZIP

| Message affiché                                                                                            | Cause                                                                 |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `Échec de l’export` / `Impossible de générer l’archive ZIP depuis IndexedDB. Réessayez.`                   | Erreur lors de la lecture des `Blob` ou de la génération de l’archive |
| `Impossible d’importer l’archive. Le fichier est vide.`                                                    | Fichier sélectionné de taille `0`                                     |
| `Impossible d’importer l’archive. Le fichier dépasse la limite de 25 Mio.`                                 | Fichier ZIP supérieur à 25 Mio                                        |
| `Impossible d’ouvrir l’archive. Le fichier ZIP est corrompu ou invalide.`                                  | Fichier non ZIP ou archive endommagée                                 |
| `Archive incomplète. Les fichiers manifest.json et data.json sont requis.`                                 | Absence d’un des deux fichiers JSON à la racine du ZIP                |
| `Impossible de lire les données. Le contenu JSON de l’archive est invalide.`                               | JSON syntaxiquement invalide dans `manifest.json` ou `data.json`      |
| `Impossible d’importer l’archive. Le fichier manifest.json est invalide.`                                  | Structure du manifeste incorrecte                                     |
| `Archive non reconnue. Ce fichier n’est pas une sauvegarde Locavern.`                                      | Champ `format` différent de `locavern-archive`                        |
| `Version d’archive non prise en charge (<v>).`                                                             | `schemaVersion` absent ou supérieur à `1` dans `manifest.json`        |
| `Cette sauvegarde utilise une version de schéma future (<v>) non supportée par cette version de Locavern.` | `schemaVersion` supérieur à `1` dans `data.json`                      |
| `La sauvegarde dépasse la limite de 10000 enregistrements.`                                                | Nombre total d’éléments supérieur au plafond de sécurité              |
| `Données de projet invalides ou dupliquées dans la sauvegarde.`                                            | Projet mal formé ou identifiant en double                             |
| `Données de tâche invalides ou rattachées à un projet inexistant.`                                         | Tâche mal formée, dupliquée ou orpheline                              |
| `Données de note invalides ou rattachées à un projet inexistant.`                                          | Note mal formée, dupliquée ou liée à un `projectId` absent            |
| `Métadonnées d’image invalides ou type MIME non autorisé dans la sauvegarde.`                              | Entrée `assets` incohérente ou format non autorisé                    |
| `Image manquante dans l’archive (<nom>). Restauration annulée.`                                            | Binaire absent sous `assets/<id>` pour une image référencée           |
| `Taille de fichier invalide pour l’image <nom>.`                                                           | Image vide ou supérieure à 5 Mio dans l’archive                       |
| `L’archive dépasse la taille totale maximale autorisée (25 Mio).`                                          | Somme des binaires décompressés supérieure à 25 Mio                   |
