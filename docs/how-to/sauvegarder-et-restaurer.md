---
version: '0.1.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# Comment sauvegarder, restaurer ou effacer vos données

Locavern conserve vos données dans le navigateur. Ce guide explique comment vérifier la persistance du stockage, exporter vos données en archive ZIP, restaurer une sauvegarde ou réinitialiser l’espace local.

Pour les détails techniques du format ZIP et les limites de taille, consultez [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md).

## Sommaire

- [Vérifier l’état du stockage et demander la persistance](#vérifier-létat-du-stockage-et-demander-la-persistance)
- [Exporter une archive ZIP](#exporter-une-archive-zip)
- [Restaurer une sauvegarde ZIP](#restaurer-une-sauvegarde-zip)
- [Effacer toutes les données locales](#effacer-toutes-les-données-locales)

## Vérifier l’état du stockage et demander la persistance

Cliquez sur **Sauvegarder** dans la barre supérieure (ou **Sauvegardes** dans le menu latéral) pour ouvrir la fenêtre **Sauvegardes et stockage**.

La section **État du stockage local** indique le nombre de projets, tâches, notes et images locales enregistrés, ainsi que l’espace utilisé et le quota estimé par votre navigateur.

- Si le badge indique **Stockage persistant**, le navigateur protège la base contre l’effacement automatique en cas de manque d’espace disque.
- Si le badge indique **Stockage standard**, cliquez sur **Demander la persistance au navigateur** (bouton visible hors mode lecture seule). Si le navigateur refuse l’élévation, exportez régulièrement des archives ZIP pour sécuriser vos données.

## Exporter une archive ZIP

1. Ouvrez **Sauvegardes et stockage** (`Sauvegarder`).
2. Sous **Exporter une archive**, cliquez sur **Exporter l’archive ZIP**.
3. Enregistrez le fichier `locavern-sauvegarde-AAAA-MM-JJ.zip` sur votre ordinateur ou sur un support externe.

L’archive contient vos projets, tâches, notes et toutes les images locales au format binaire d’origine. Les données sont stockées **en clair** (non chiffrées) : conservez l’archive dans un emplacement sûr.

Note : l’export reste disponible même si l’onglet est en mode lecture seule.

## Restaurer une sauvegarde ZIP

> **Attention :** l’import remplace intégralement les projets, tâches, notes et images présents dans le navigateur. Exportez d’abord vos données actuelles si vous souhaitez les conserver.

1. Ouvrez **Sauvegardes et stockage**.
2. Sous **Importer une archive**, cliquez sur **Fichier de sauvegarde (.zip)** et sélectionnez votre archive `.zip`.
3. Locavern vérifie l’intégrité du fichier, le format du manifeste, le schéma et la présence de chaque image référencée. En cas d’anomalie, un message d’erreur s’affiche sous le champ et aucune donnée locale n’est modifiée.
4. Si l’archive est valide, une fenêtre de confirmation indique le nombre de projets, tâches, notes et images à importer. Cliquez sur **Importer et remplacer**.

La vue se met immédiatement à jour avec les données restaurées et une notification **Sauvegarde restaurée** apparaît.

## Effacer toutes les données locales

1. Ouvrez **Sauvegardes et stockage**.
2. Sous **Réinitialisation locale**, cliquez sur **Effacer toutes les données locales**.
3. Dans la fenêtre de confirmation, cliquez sur **Effacer tout**.

Tous les projets, tâches, notes et images locales sont définitivement supprimés de `IndexedDB` sur cet appareil. Cette action est irréversible sans archive ZIP préalable.
