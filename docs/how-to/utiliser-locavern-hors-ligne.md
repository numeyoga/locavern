---
version: '0.1.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# Comment installer Locavern et l’utiliser hors ligne

Locavern est une application web progressive (PWA) autonome : après un premier chargement, toutes ses ressources statiques sont mises en cache localement pour fonctionner sans connexion réseau.

## Sommaire

- [Installer Locavern sur votre ordinateur](#installer-locavern-sur-votre-ordinateur)
- [Vérifier la disponibilité hors ligne](#vérifier-la-disponibilité-hors-ligne)
- [Mettre à jour une version installée](#mettre-à-jour-une-version-installée)

## Installer Locavern sur votre ordinateur

Prérequis : ouvrir Locavern dans Chrome ou Chromium récent depuis son adresse de production (HTTPS ou `127.0.0.1` en prévisualisation locale).

1. Chargez l’application une première fois avec une connexion active afin que le Service Worker mette les fichiers en cache.
2. Dans la barre d’adresse de Chrome/Chromium, cliquez sur l’icône d’installation d’application (ou ouvrez le menu du navigateur et choisissez **Enregistrer et partager** → **Installer Locavern…**).
3. Confirmez l’installation.

Locavern s’ouvre dans une fenêtre dédiée, sans barre d’adresse, et utilise le même stockage `IndexedDB` que votre profil de navigateur.

## Vérifier la disponibilité hors ligne

1. Après le premier chargement complet de l’application, coupez le réseau (ou activez le mode hors ligne dans les outils de développement du navigateur).
2. Rechargez la page ou rouvrez l’application installée.

L’interface complète (polices, icônes, thèmes clair/sombre, vues **Tâches**, **Projets**, **Notes** et **Sauvegardes**) reste accessible et vos modifications continuent d’être enregistrées localement.

## Mettre à jour une version installée

Lorsque Locavern est mis à jour sur le serveur qui l’héberge, rechargez l’application avec une connexion réseau active, puis fermez et rouvrez les onglets (ou la fenêtre installée) pour activer le nouveau cache. Exportez préalablement une archive ZIP par précaution via [Comment sauvegarder, restaurer ou effacer vos données](sauvegarder-et-restaurer.md).
