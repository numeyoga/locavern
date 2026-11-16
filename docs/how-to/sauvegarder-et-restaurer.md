---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-16
---

# Comment sauvegarder, restaurer ou effacer vos données

Locavern conserve vos données localement dans le navigateur. Ce guide explique comment vérifier la persistance et l’ancienneté de votre dernière sauvegarde, exporter une archive ZIP claire ou chiffrée, fusionner ou importer sélectivement une archive, récupérer ou purger des éléments dans la corbeille locale, ou réinitialiser l’espace local.

Pour les détails techniques du format ZIP, de la portée exacte des archives et des messages d’erreur, consultez [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md).

## Sommaire

- [Vérifier l’état du stockage et demander la persistance](#vérifier-létat-du-stockage-et-demander-la-persistance)
- [Activer la sauvegarde automatique dans un dossier](#activer-la-sauvegarde-automatique-dans-un-dossier)
- [Exporter une archive ZIP (en clair ou chiffrée)](#exporter-une-archive-zip-en-clair-ou-chiffrée)
- [Importer, fusionner ou restaurer une archive ZIP](#importer-fusionner-ou-restaurer-une-archive-zip)
- [Récupérer ou purger depuis la corbeille locale](#récupérer-ou-purger-depuis-la-corbeille-locale)
- [Effacer toutes les données locales](#effacer-toutes-les-données-locales)

## Vérifier l’état du stockage et demander la persistance

Cliquez sur **Sauvegarder** dans la barre supérieure (ou **Sauvegardes** dans le menu latéral) pour ouvrir la fenêtre **Sauvegardes et stockage**.

La section **État du stockage local** indique le nombre de projets, tâches, notes, tableaux blancs et images locales enregistrés, l’espace utilisé, le quota estimé par votre navigateur et l’indicateur **Dernière sauvegarde ZIP** (`Aucune sauvegarde ZIP`, `À l’instant`, `Il y a <n> min/h/jour(s)`).

- Si le badge indique **Stockage persistant**, le navigateur protège la base contre l’effacement automatique en cas de manque d’espace disque.
- Si le badge indique **Stockage standard**, cliquez sur **Demander la persistance au navigateur** (bouton visible hors mode lecture seule). Si le navigateur refuse l’élévation, exportez régulièrement des archives ZIP pour sécuriser vos données.

## Activer la sauvegarde automatique dans un dossier

1. Ouvrez **Sauvegardes** dans la barre latérale.
2. Dans **Sauvegarde dans un dossier**, cliquez sur **Connecter un dossier** et autorisez l’accès en écriture.
3. Une première copie de vos données est immédiatement créée dans `locavern-sauvegarde.zip`. Les données restent également dans le navigateur.

Après une modification, Locavern attend trois secondes sans nouvelle modification puis remplace ce même fichier. La copie automatique est en clair ; le chiffrement par mot de passe reste disponible pour les exports ponctuels.

Le bouton **Sauvegarder** en haut à droite affiche une disquette lorsqu’un dossier est connecté et déclenche une sauvegarde immédiate. La carte du dossier propose également **Sauvegarder maintenant**. La barre latérale continue d’ouvrir la modale. Sans dossier connecté, le bouton supérieur ouvre cette modale.

L’état indique les modifications en attente, l’écriture en cours, la réussite ou l’échec. La date de dernière écriture réussie n’avance qu’après fermeture du fichier. La sauvegarde est effectuée par l’onglet actif, pendant que l’application est ouverte. Les modifications récentes restent dans le navigateur si vous fermez l’application avant la prochaine copie.

Le dossier est mémorisé lorsque le navigateur le permet. Sinon, le choix vaut uniquement pour la session. Si le navigateur exige une nouvelle autorisation après réouverture, la sauvegarde est suspendue : cliquez sur **Réautoriser et sauvegarder** ou sur la disquette. Aucune demande d’autorisation n’est ouverte en arrière-plan.

**Changer de dossier** crée une première copie dans le nouvel emplacement. **Déconnecter** arrête la sauvegarde automatique sans supprimer les fichiers existants. Les exports ponctuels ZIP, Markdown, iCalendar, SVG et PNG restent indépendants de ce dossier. Sur les navigateurs incompatibles, les exports utilisent le sélecteur de fichier ou le téléchargement classique.

## Exporter une archive ZIP (en clair ou chiffrée)

1. Ouvrez **Sauvegardes et stockage** (`Sauvegarder`).
2. Par défaut, l’archive est générée en clair. Pour protéger son contenu par mot de passe, cochez **Protéger l’archive par un mot de passe (AES-GCM)**, puis saisissez et confirmez le mot de passe dans **Mot de passe de chiffrement** et **Confirmer le mot de passe** (bouton œil pour vérifier la saisie).
3. Cliquez sur **Exporter l’archive ZIP**.
4. Choisissez l’emplacement du fichier daté `locavern-sauvegarde-AAAA-MM-JJTHH-MM-SS.zip` dans le sélecteur natif, ou laissez le téléchargement standard s’effectuer. Cet export ne remplace pas le fichier de sauvegarde automatique. Si vous annulez le sélecteur natif, aucun fichier n’est écrit et la date **Dernière sauvegarde ZIP** n’est pas modifiée.

L’archive inclut projets, tâches (récurrence, checklists, descriptions et étiquettes), notes, tableaux blancs, liens internes, images, statuts Kanban, préférences de l’application, modèles personnalisés et corbeille. Pour tout restaurer, choisissez **Remplacer toutes les données locales**. Les modes de fusion et d’import sélectif conservent les préférences, modèles et la corbeille déjà présents ; seuls les éléments sélectionnés et leurs liens internes sont importés. Les anciens fichiers ZIP restent importables mais ne contiennent pas nécessairement ces informations supplémentaires.

> **Important :** si vous activez le chiffrement par mot de passe, conservez ce mot de passe en lieu sûr. En l’absence de serveur ou de compte, aucune récupération n’est possible en cas d’oubli.

Note : l’export reste disponible même si l’onglet est en mode lecture seule.

## Importer, fusionner ou restaurer une archive ZIP

1. Ouvrez **Sauvegardes et stockage**.
2. Sous **Importer une archive**, cliquez sur **Fichier de sauvegarde (.zip)** et sélectionnez votre archive `.zip`.
3. Si l’archive est protégée par mot de passe, saisissez le **Mot de passe de l’archive** puis cliquez sur **Déverrouiller l’archive**. Locavern valide ensuite le format, le schéma et la présence de chaque image référencée sans modifier vos données locales en cas d’anomalie.
4. Une fois l’aperçu affiché, choisissez l’un des trois **Mode d’importation** :
   - **Fusionner tout sans écraser les données locales** (sélectionné par défaut si vous avez déjà des données locales) : ajoute l’intégralité de l’archive sans toucher à vos éléments existants (en réattribuant automatiquement les identifiants en cas de collision et en complétant les statuts Kanban manquants), puis cliquez sur **Lancer l’import** ;
   - **Importer une sélection de projets sans écraser** : cochez uniquement les projets voulus sous **Projets à importer** (et, s’il y en a dans l’archive, **Inclure les éléments sans projet**), puis cliquez sur **Lancer l’import** ;
   - **Remplacer toutes les données locales** (sélectionné par défaut si la base locale est vide) : cliquez sur **Importer et remplacer**, puis confirmez dans la fenêtre **Remplacer les données locales ?** pour remplacer intégralement les données locales par le contenu de l’archive.

La vue se met immédiatement à jour et une notification (**Archive fusionnée** ou **Sauvegarde restaurée**) confirme l’opération.

## Récupérer ou purger depuis la corbeille locale

Lorsque vous supprimez un projet, une tâche, une note ou un tableau blanc depuis l’interface, l’élément est déplacé dans la **Corbeille** locale plutôt que détruit immédiatement.

- **Consulter et restaurer un élément** : cliquez sur **Corbeille** dans la barre latérale (ou lancez **Ouvrir la corbeille** via `Ctrl+K`), puis cliquez sur **Restaurer** en face de l’élément souhaité. Si vous restaurez un projet, toutes ses tâches archivées dans la corbeille avec lui sont également restaurées ; en revanche, une tâche supprimée isolément ne peut être restaurée que si son projet parent existe toujours.
- **Purger définitivement avant expiration** : cliquez sur **Purger** sur une ligne (ou **Vider la corbeille** en haut de la fenêtre) et confirmez. Les images locales qui n’étaient utilisées que par les éléments purgés sont alors libérées de `IndexedDB` et les liens internes pointant vers ces éléments supprimés sont nettoyés.
- **Ajuster le délai de conservation** : cliquez sur **Configurer le délai** dans la fenêtre **Corbeille locale** (ou ouvrez **Affichage** → **Rétention de la corbeille (jours)**) pour définir une durée entière entre `1` et `365` jours (`30` jours par défaut). Au démarrage de l’application, tout élément ayant dépassé son échéance est purgé automatiquement.

## Effacer toutes les données locales

1. Ouvrez **Sauvegardes et stockage**.
2. Sous **Réinitialisation locale**, cliquez sur **Effacer toutes les données locales**.
3. Dans la fenêtre de confirmation, cliquez sur **Effacer tout**.

Tous les projets, tâches, notes, tableaux blancs et images locales sont définitivement supprimés de `IndexedDB` sur cet appareil. Cette action est irréversible sans archive ZIP préalable.
