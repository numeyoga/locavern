---
version: 'non versionné — aucune version applicative vérifiable'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# Choix d’architecture

Cette page explique les motivations de l’architecture visée pour Locavern, à partir de la [restitution initiale](../../choix-technique.md) et des arbitrages actés dans le [registre des décisions](../reference/decisions-et-avancement.md). L’[état du dépôt](../reference/etat-du-depot.md) précise ce qui est matériellement présent.

## Sommaire

- [Autonomie et confidentialité](#autonomie-et-confidentialité)
- [Découpage par lots et maîtrise de la complexité](#découpage-par-lots-et-maîtrise-de-la-complexité)
- [Standards web, JavaScript natif et store immuable](#standards-web-javascript-natif-et-store-immuable)
- [Système de design et composants spécialisés](#système-de-design-et-composants-spécialisés)
- [Persistance, actifs binaires et portabilité](#persistance-actifs-binaires-et-portabilité)
- [Questions de conception ouvertes](#questions-de-conception-ouvertes)

## Autonomie et confidentialité

La conception place les données sur l’appareil et exclut comptes et synchronisation automatique. Ce choix évite la dépendance à un service métier distant et laisse les transferts à l’initiative de l’utilisateur. Il implique aussi que la récupération des données dépend du stockage local et des exports réalisés.

La distribution statique permet d’héberger l’application sur GitHub Pages sans serveur applicatif. Pour concilier l’usage hors ligne par Service Worker et une politique de sécurité (CSP) stricte, la CSP autorise uniquement l’origine locale `'self'` pour les scripts, les workers (`worker-src 'self'`) et la mise en cache des ressources statiques (`connect-src 'self'`), tout en bloquant toute requête ou ressource vers un domaine tiers.

## Découpage par lots et maîtrise de la complexité

Plutôt que de construire simultanément six outils distincts (projets, liste, Kanban, calendrier, notes et tableau blanc) ou de structurer le socle autour d’une bibliothèque de dessin encore jeune (`@quickdrawjs/core` 0.3.0), la conception retient un phasage en deux temps :

1. **Premier lot (MVP)** : socle JavaScript moderne (`.js` ESM + JSDoc), store d’état immuable, stockage local IndexedDB (`idb`), gestion des projets et des tâches (vues liste et Kanban), notes enrichies (Tiptap Core) et import/export complet.
2. **Lots ultérieurs** : vue calendrier dédiée et tableau blanc.

Ce découpage permet de stabiliser d’abord le modèle de données cœur, le stockage multi-collections et le système de design avant d’intégrer un moteur graphique de tableau blanc.

## Standards web, JavaScript natif et store immuable

Le choix du HTML5 sémantique, du CSS natif et du **JavaScript récent (`.js` ES2024+ en ES Modules)** pousse au maximum l’alignement avec les standards web. Le code applicatif est directement compréhensible et exécutable par le navigateur sans étape de transpilation de langage. Pour conserver la sécurité d’un typage statique strict sur le modèle métier, les commandes du store et les migrations de données, les contrats sont déclarés dans des fichiers `.d.ts` et vérifiés via les annotations **JSDoc** par `tsc --allowJs --checkJs --noEmit`. Vite n’intervient que pour résoudre les paquets npm (`@tiptap/core`, `idb`) et produire le bundle de distribution.

Sans framework applicatif (React, Vue), le risque principal d’une interface multi-vues (synchroniser une tâche entre la liste, le Kanban et le panneau de détail) est la dispersion d’un état mutable dans le DOM. Pour l’éviter, l’architecture associe :

- un **noyau fonctionnel pur** et un **store d’état immuable** recevant des commandes explicites et notifiant les vues abonnées ;
- des **adaptateurs** isolant les effets de bord : rendu DOM exploitant les capacités modernes des navigateurs récents (`<dialog>`, Popover API, View Transitions, Container Queries, guidés par `modern-web-guidance`), persistance IndexedDB via `idb`, import/export de fichiers et encapsulation de Tiptap Core.

Cette séparation garantit que les règles métier et les schémas de sauvegarde restent indépendants des bibliothèques tierces et peuvent être testés unitairement sans navigateur.

## Système de design et composants spécialisés

Au lieu de concevoir une méthodologie CSS de zéro, l’interface s’appuie sur les conventions du **Covenant Design System** pour applications web Vanilla : structuration par couches `@layer` (`reset`, `tokens`, `base`, `layout`, `components`, `utilities`, `vendor`), tokens sémantiques en propriétés personnalisées CSS (thèmes clair et sombre) et respect des critères d’accessibilité WCAG AA.

Pour le texte enrichi, **Tiptap Core** est retenu en mode headless (sans wrapper React/Vue) derrière un adaptateur dédié. Ce périmètre restreint (paragraphes, emphase, liens, listes de contrôle, images locales) offre la robustesse du modèle ProseMirror sans alourdir l’application.

Pour le Kanban, l’usage d’API natives (HTML Drag and Drop ou Pointer Events) doublées de commandes clavier explicites évite de dépendre d’une bibliothèque ancienne comme SortableJS sur la cible visée (Chrome récent sur ordinateur).

Pour le futur tableau blanc, le report au lot 2 s’accompagne d’une exigence d’architecture : définir un schéma pivot propre à Locavern afin que la pérennité des sauvegardes ne dépende jamais du format interne d’une bibliothèque graphique.

## Persistance, actifs binaires et portabilité

IndexedDB conserve l’état de travail dans le navigateur, accédé via la micro-bibliothèque `idb` pour fiabiliser la gestion des promesses, des transactions et des migrations de schéma. L’appel à `navigator.storage.persist()` réduit le risque d’effacement automatique par le navigateur, et l’API Web Locks (`navigator.locks`) protège contre les écritures concurrentes entre onglets.

Une distinction stricte est établie entre les données structurées (projets, tâches, notes) et les actifs binaires (images locales stockées en `Blob` dans un magasin IndexedDB dédié). Lors de l’export manuel, cette séparation évite d’encoder toutes les images en Base64 au sein d’un fichier JSON monolithique, ce qui saturerait rapidement la mémoire et la taille des fichiers. Une version de schéma indépendante de la version applicative permet d’appliquer des migrations pures lors des mises à jour ou de l’import d’anciennes sauvegardes.

## Questions de conception ouvertes

Les points suivants restent à détailler lors de l’initialisation du code du premier lot :

- La structure exacte de l’archive d’export/import (par exemple une archive ZIP contenant `manifest.json`, `data.json` et le dossier `assets/`) et les limites de taille par fichier joint.
- La stratégie de mise à jour du Service Worker pour éviter tout décalage entre la version du code mis en cache et la version du schéma IndexedDB.
- Le choix définitif du moteur de tableau blanc lors de l’ouverture du second lot.
