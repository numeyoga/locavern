---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# Choix d’architecture

Cette page explique les motivations de l’architecture de Locavern, à partir de la [restitution initiale](../../choix-technique.md) et des arbitrages actés dans le [registre des décisions](../reference/decisions-et-avancement.md). L’[état du dépôt](../reference/etat-du-depot.md) précise ce qui est matériellement présent.

## Sommaire

- [Autonomie et confidentialité](#autonomie-et-confidentialité)
- [Découpage par lots et maîtrise de la complexité](#découpage-par-lots-et-maîtrise-de-complexité)
- [Standards web, JavaScript natif et store immuable](#standards-web-javascript-natif-et-store-immuable)
- [Système de design et composants spécialisés](#système-de-design-et-composants-spécialisés)
- [Persistance, actifs binaires et portabilité](#persistance-actifs-binaires-et-portabilité)
- [Points restant ouverts pour les lots ultérieurs](#points-restant-ouverts-pour-les-lots-ultérieurs)

## Autonomie et confidentialité

La conception place les données sur l’appareil et exclut comptes et synchronisation automatique. Ce choix évite la dépendance à un service métier distant et laisse les transferts à l’initiative de l’utilisateur. Il implique aussi que la récupération des données dépend du stockage local et des exports réalisés.

La distribution statique permet d’héberger l’application sur GitHub Pages sans serveur applicatif : le build Vite émet des chemins relatifs (`base: './'`) compatibles avec un sous-chemin de projet GitHub Pages comme avec un domaine dédié, et le workflow `.github/workflows/deploy.yml` conditionne chaque publication sur `main` à la réussite préalable du workflow réutilisable de vérification `.github/workflows/ci.yml`. Pour concilier l’usage hors ligne par Service Worker et une politique de sécurité (CSP) stricte, la CSP autorise uniquement l’origine locale `'self'` pour les scripts, les workers (`worker-src 'self'`) et la mise en cache des ressources statiques (`connect-src 'self'`), tout en bloquant toute requête ou ressource vers un domaine tiers.

## Découpage par lots et maîtrise de la complexité

Plutôt que de construire simultanément six outils distincts (projets, liste, Kanban, calendrier, notes et tableau blanc) ou de structurer le socle autour d’une bibliothèque de dessin encore jeune (`@quickdrawjs/core` 0.3.0), la conception a retenu un déploiement incrémental :

1. **Lot 1 (MVP, `0.1.0`)** : socle JavaScript moderne (`.js` ESM + JSDoc), store d’état immuable, stockage local IndexedDB (`idb`), gestion des projets et des tâches (vues liste et Kanban), notes enrichies (Tiptap Core) et import/export ZIP complet.
2. **Lot 2 (Tableau blanc, `0.2.0`)** : ajout de la collection `whiteboards` (`schemaVersion: 2`, migration transparente `v1` -> `v2`) et du canevas SVG interactif natif (`src/adapters/whiteboard-canvas.js`).
3. **Lots ultérieurs** : vue calendrier mensuelle dédiée aux échéances.

Ce découpage a permis de stabiliser d’abord le modèle de données cœur, le stockage multi-collections et le système de design avant d’ajouter le moteur graphique du tableau blanc.

## Standards web, JavaScript natif et store immuable

Le choix du HTML5 sémantique, du CSS natif et du **JavaScript récent (`.js` ES2024+ en ES Modules)** pousse au maximum l’alignement avec les standards web. Le code applicatif est directement compréhensible et exécutable par le navigateur sans étape de transpilation de langage. Pour conserver la sécurité d’un typage statique strict sur le modèle métier, les commandes du store et les migrations de données, les contrats sont déclarés dans des fichiers `.d.ts` et vérifiés via les annotations **JSDoc** par `tsc --allowJs --checkJs --noEmit`. Vite n’intervient que pour résoudre les paquets npm (`@tiptap/core`, `idb`, `fflate`) et produire le bundle de distribution.

Sans framework applicatif (React, Vue), le risque principal d’une interface multi-vues (synchroniser une tâche entre la liste, le Kanban et le panneau de détail, ou préserver le focus dans les notes et le canevas SVG) est la dispersion d’un état mutable dans le DOM. Pour l’éviter, l’architecture associe :

- un **noyau fonctionnel pur** et un **store d’état immuable** recevant des commandes explicites et notifiant les vues abonnées ;
- des **adaptateurs** isolant les effets de bord : rendu DOM exploitant les capacités modernes des navigateurs récents (`<dialog>`, Popover API, Pointer Events), persistance IndexedDB via `idb`, import/export de fichiers, encapsulation de Tiptap Core et moteur SVG natif du tableau blanc.

Cette séparation garantit que les règles métier et les schémas de sauvegarde restent indépendants des bibliothèques tierces et peuvent être testés unitairement sans navigateur.

## Système de design et composants spécialisés

Au lieu de concevoir une méthodologie CSS de zéro, l’interface s’appuie sur les conventions du **Covenant Design System** pour applications web Vanilla : tokens sémantiques en propriétés personnalisées CSS `--cv-*` (thèmes clair et sombre), polices et icônes embarquées localement, et respect des critères d’accessibilité WCAG 2.2 AA.

Pour le texte enrichi, **Tiptap Core** est retenu en mode headless (sans wrapper React/Vue) derrière un adaptateur dédié. Ce périmètre restreint (paragraphes, emphase, liens, listes de contrôle, images locales) offre la robustesse du modèle ProseMirror sans alourdir l’application.

Pour le Kanban, l’usage d’API natives (HTML Drag and Drop) doublées de commandes clavier explicites évite de dépendre d’une bibliothèque ancienne comme SortableJS sur la cible visée (Chrome récent sur ordinateur).

Pour le **Tableau blanc** (Lot 2), l’**Option A (Canevas SVG natif + Pointer Events + raccourcis clavier)** a été retenue face à des bibliothèques externes (`Fabric.js`, `@quickdrawjs/core`) pour quatre raisons :

1. **Zéro dépendance runtime supplémentaire** : maintien d’un bundle léger et d’une maîtrise totale de la CSP ;
2. **Accessibilité native WCAG 2.2 AA** : chaque élément SVG (`<g tabindex="0" role="group">`) participe nativement à l’ordre de tabulation, au lecteur d’écran et aux raccourcis clavier (flèches de déplacement/redimensionnement, `Entrée`/`F2` pour le texte, ajout au centre sans glisser-déposer) ;
3. **Intégration directe à Covenant** : les 5 jetons de couleur des formes suivent automatiquement le basculement thème clair/sombre sans ré-initialiser le canevas ;
4. **Pérennité des données** : le format pivot `Whiteboard` (`viewport`, `elements`, `assetIds`) reste indépendant de toute bibliothèque tierce.

## Persistance, actifs binaires et portabilité

IndexedDB conserve l’état de travail dans le navigateur, accédé via la micro-bibliothèque `idb` pour fiabiliser la gestion des promesses, des transactions et des migrations de schéma (`DB_VERSION = 2` ajoutant l’objectStore `whiteboards`). L’appel à `navigator.storage.persist()` réduit le risque d’effacement automatique par le navigateur, et l’API Web Locks (`navigator.locks`) protège contre les écritures concurrentes entre onglets.

Une distinction stricte est établie entre les données structurées (projets, tâches, notes, tableaux blancs) et les actifs binaires (images locales stockées en `Blob` dans le magasin `assets`). Lors de l’export manuel, cette séparation évite d’encoder toutes les images en Base64 au sein d’un fichier JSON monolithique, ce qui saturerait rapidement la mémoire et la taille des fichiers. Une version de schéma (`schemaVersion: 2`) indépendante de la version applicative permet d’appliquer des migrations pures lors de l’import d’anciennes sauvegardes (`v1` -> `v2`).

Pour l’export ponctuel d’un tableau blanc vers un fichier `.svg` ou `.png` destiné à un usage externe hors navigateur, les couleurs CSS sont résolues à l’instant de l’export et les images `blob:` locales sont converties via un `<canvas>` local en URI `data:` embarquées, afin que le fichier exporté reste autonome sans aucune requête réseau ni contournement de CSP.

## Points restant ouverts pour les lots ultérieurs

- Conception détaillée de la future vue calendrier mensuelle pour les échéances de tâches.
