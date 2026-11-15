---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-14
---

# Fonctionnement local, confidentialité et périmètre

Cette page explique les principes de conception de Locavern qui influencent directement votre usage quotidien : stockage sur l’appareil, sécurité des notes et tableaux blancs, verrouillage multi-onglets et périmètre de la version `0.2.0`.

## Sommaire

- [Vos données restent sur votre appareil](#vos-données-restent-sur-votre-appareil)
- [Pourquoi exporter régulièrement des archives ZIP](#pourquoi-exporter-régulièrement-des-archives-zip)
- [Pourquoi un seul onglet écrit à la fois](#pourquoi-un-seul-onglet-écrit-à-la-fois)
- [Pourquoi les images distantes et certains liens sont bloqués](#pourquoi-les-images-distantes-et-certains-liens-sont-bloqués)
- [Périmètre actuel et fonctionnalités différées](#périmètre-actuel-et-fonctionnalités-différées)

## Vos données restent sur votre appareil

Locavern suit une approche **local-first** : il n’existe ni création de compte, ni serveur applicatif distant, ni synchronisation automatique en arrière-plan. Vos projets, tâches, notes, tableaux blancs et images sont conservés uniquement dans la base `IndexedDB` de votre navigateur.

Ce choix garantit qu’aucune donnée personnelle ne quitte votre machine, mais il implique aussi que vos données ne sont pas automatiquement partagées entre deux navigateurs ou deux appareils différents : les transferts passent exclusivement par l’export et l’import manuels d’archives ZIP.

## Pourquoi exporter régulièrement des archives ZIP

Même lorsque le navigateur accorde le statut **Stockage persistant**, la base locale reste liée à votre profil de navigateur et à votre poste. Une suppression manuelle des données de site dans les paramètres du navigateur, une réinitialisation du profil ou une panne matérielle effacerait le contenu local.

L’archive ZIP permet de conserver une copie portable complète sur votre disque ou un support externe. Par conception, cette archive n’est pas chiffrée : les fichiers JSON et les images sont lisibles en clair, ce qui évite toute perte définitive liée à un mot de passe oublié mais suppose de stocker vos sauvegardes dans un endroit de confiance.

## Pourquoi un seul onglet écrit à la fois

Dans une application sans serveur central, laisser deux onglets modifier simultanément la même base `IndexedDB` entraîne des écrasements silencieux : le dernier onglet à écrire efface les changements récents de l’autre.

Pour prévenir toute perte de données, le premier onglet ouvert acquiert un verrou exclusif (`Web Locks`) et les onglets suivants basculent automatiquement en **mode lecture seule**. Dès que l’onglet éditeur est fermé, l’onglet suivant récupère le verrou et recharge l’état à jour.

## Pourquoi les images distantes et certains liens sont bloqués

Dans les notes comme sur le tableau blanc, Locavern bloque le collage d’images distantes (`https://…`) et n’embarque que des fichiers locaux stockés en binaire dans `IndexedDB`. Deux raisons motivent cette règle :

- **Confidentialité** : afficher une image hébergée sur un serveur tiers déclencherait une requête réseau à chaque ouverture, révélant votre adresse IP et le moment de consultation (effet de pixel espion), ce qui est incompatible avec une politique stricte sans requête externe ;
- **Disponibilité hors ligne** : une image locale stockée dans `IndexedDB` et incluse dans l’archive ZIP reste affichable sans connexion Internet, même si le site d’origine disparaît. Lorsqu’un tableau blanc contenant des images locales est exporté en `.svg` ou `.png`, ces images sont rendues localement dans le navigateur afin de produire un fichier autonome sans aucune requête externe.

De la même façon, seuls les liens `https://` et `mailto:` sont acceptés afin d’écarter les schémas potentiellement dangereux ou ambigus dans des contenus importés.

## Périmètre actuel et fonctionnalités différées

La version `0.2.0` couvre le noyau de productivité (projets, tâches en vue Liste et Kanban, notes enrichies, sauvegardes ZIP hors ligne en `schemaVersion: 2`) ainsi que la vue **Tableaux blancs** (canevas SVG natif accessible, images locales et export SVG/PNG).

Une fonction prévue dans la feuille de route reste volontairement différée après cette version :

- **Calendrier des échéances** : vous pouvez déjà attribuer une date d’échéance aux tâches et les trier chronologiquement en vue Liste, mais la vue calendrier mensuelle dédiée viendra dans un lot ultérieur.
