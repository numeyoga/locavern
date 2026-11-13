---
version: '0.1.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# Comment rédiger des notes avec mise en forme et images locales

Ce guide explique comment créer, classer, mettre en forme et illustrer vos notes dans Locavern. Les règles détaillées de validation des images et des liens sont listées dans [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md).

## Sommaire

- [Créer, filtrer et supprimer une note](#créer-filtrer-et-supprimer-une-note)
- [Mettre en forme le texte et insérer des liens](#mettre-en-forme-le-texte-et-insérer-des-liens)
- [Insérer des images locales](#insérer-des-images-locales)
- [Comprendre la sauvegarde automatique](#comprendre-la-sauvegarde-automatique)

## Créer, filtrer et supprimer une note

Ouvrez la vue **Notes** depuis la barre de navigation latérale.

- **Créer une note** : cliquez sur **Nouvelle note** (ou **Créer une note** si la liste est vide). La note est créée immédiatement et rattachée par défaut au projet actif dans le filtre (ou sans projet si « Toutes les notes » est affiché sans projet sélectionné).
- **Associer ou détacher un projet** : dans l’en-tête de l’éditeur, changez le menu **Projet associé** pour choisir un projet ou **Sans projet**.
- **Filtrer et rechercher** : utilisez le menu déroulant en haut à gauche (**Toutes les notes**, **Sans projet** ou un projet précis) et le champ **Rechercher une note** (recherche sur le titre). Les notes sont classées de la plus récemment modifiée à la plus ancienne.
- **Supprimer une note** : cliquez sur **Supprimer** en bas à droite de l’éditeur, puis confirmez avec **Supprimer la note**.

## Mettre en forme le texte et insérer des liens

La barre d’outils située au-dessus de la zone de texte propose les commandes suivantes (utilisables également dans la **Description** d’une tâche) :

- **Gras**, **Italique**, **Barré**, **Code en ligne** ;
- **Titre** (titre de niveau 2) ;
- **Liste à puces**, **Liste numérotée** et **Liste de contrôle** (cases à cocher interactives).

Pour ajouter ou modifier un lien :

1. Sélectionnez le texte à transformer en lien, puis cliquez sur le bouton **Lien** dans la barre d’outils.
2. Dans la barre qui s’ouvre, saisissez une adresse commençant par `https://` ou `mailto:`.
3. Cliquez sur **Appliquer**.

Pour retirer un lien existant, placez le curseur sur le lien, ouvrez la barre **Lien**, videz le champ d’adresse et cliquez sur **Appliquer**. Les adresses utilisant d’autres protocoles (comme `http://` ou `javascript:`) sont refusées et déclenchent une notification d’avertissement.

## Insérer des images locales

Vous pouvez joindre des images stockées sur votre ordinateur au format **PNG**, **JPEG**, **WebP** ou **GIF** (taille maximale de **5 Mio** par image). Trois méthodes sont disponibles :

- Cliquer sur le bouton **Insérer une image locale** dans la barre d’outils et sélectionner un fichier ;
- Coller une image depuis le presse-papiers dans la zone d’écriture ;
- Glisser-déposer un fichier image depuis votre gestionnaire de fichiers dans l’éditeur.

L’image est copiée dans la base locale de votre navigateur (`IndexedDB`) et incluse lors des exports ZIP.

Si vous tentez de coller une URL d’image distante (`https://…`) ou du HTML contenant une image externe, Locavern bloque l’insertion et affiche l’alerte **Image distante bloquée**. Enregistrez d’abord l’image sur votre appareil, puis insérez le fichier local.

## Comprendre la sauvegarde automatique

Chaque frappe dans le titre ou le corps de la note déclenche un enregistrement automatique après une courte pause (environ 200 ms) : l’indicateur en bas à gauche passe de **Modifications en cours** à **Enregistrée localement**. Le changement de projet associé enregistre immédiatement.

Vous pouvez également cliquer sur **Enregistrer** à tout moment pour forcer une sauvegarde immédiate avec une notification de confirmation.

Attention : le champ **Titre de la note** ne peut pas rester vide ; si vous l’effacez entièrement, le titre précédent est conservé lors de l’enregistrement.
