---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# Décisions et avancement

Registre issu de la [restitution du 12 novembre 2026](../../choix-technique.md) et des arbitrages d’architecture du 13 novembre 2026, mis à jour le 15 novembre 2026 pour le Lot 2 (`0.2.0`) et le pipeline GitHub Pages, et confronté à l’[état local du dépôt](etat-du-depot.md).

## Sommaire

- [Statuts](#statuts)
- [Produit et contraintes](#produit-et-contraintes)
- [Périmètre livré (Lots 1 et 2)](#périmètre-livré-lots-1-et-2)
- [Stack et outils](#stack-et-outils)
- [Architecture et conventions](#architecture-et-conventions)
- [Texte enrichi](#texte-enrichi)
- [Stockage et sauvegardes](#stockage-et-sauvegardes)
- [Confidentialité](#confidentialité)
- [Styles et design system](#styles-et-design-system)
- [Tableau blanc (Lot 2)](#tableau-blanc-lot-2)
- [Qualité et documentation](#qualité-et-documentation)
- [Distribution](#distribution)

## Statuts

| Statut                | Signification                                                                     |
| --------------------- | --------------------------------------------------------------------------------- |
| Retenu                | Décision confirmée pour la conception ; implémentation non attestée dans le dépôt |
| Différé               | Fonctionnalité ou composant reporté après les lots livrés                         |
| Envisagé              | Fonctionnalité annoncée sans engagement de livraison ni ordre défini              |
| À confirmer           | Proposition ou détail restant à choisir                                           |
| Rapporté, non vérifié | Réalisation annoncée dans la source historique, absente du dépôt inspecté         |
| Vérifié               | Élément directement observable et validé dans le dépôt                            |

## Produit et contraintes

| Sujet                  | Décision ou périmètre                                                                               | Statut  |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| Usage                  | Productivité personnelle inspirée fonctionnellement de Nanoboard                                    | Vérifié |
| Premier lot (MVP)      | Socle, stockage local, projets et tâches (vues liste et Kanban), notes enrichies, import/export ZIP | Vérifié |
| Deuxième lot           | Tableau blanc SVG natif accessible (`0.2.0`, `schemaVersion: 2`)                                    | Vérifié |
| Lots ultérieurs        | Calendrier des échéances                                                                            | Différé |
| Contenu                | Descriptions enrichies, liens, listes de contrôle, schémas vectoriels, images locales               | Vérifié |
| Expérience             | Import/export ZIP, mode sombre, installation PWA et usage hors ligne, export SVG/PNG                | Vérifié |
| Exécution              | Local first, sans backend distant ni serveur applicatif requis au runtime                           | Vérifié |
| Distribution           | Fichiers statiques compatibles GitHub Pages                                                         | Vérifié |
| Cible                  | Chrome / Chromium récent sur ordinateur                                                             | Vérifié |
| Technologies           | Standards web (HTML5, CSS natif, JavaScript ES2024+ natif) ; aucun framework applicatif au runtime  | Vérifié |
| Développement          | Serveur local autorisé pour les outils (`vite`, `vite preview`)                                     | Vérifié |
| Identité et transferts | Aucun compte ni synchronisation automatique ; transferts manuels par import/export                  | Vérifié |
| Réseau                 | Aucun appel métier, télémétrie, analytique ou ressource CDN tierce                                  | Vérifié |

## Périmètre livré (Lots 1 et 2)

**Vérifié :**

- Socle en **JavaScript récent natif (`.js`, ES Modules)**, sans transpilation du code applicatif, avec vérification statique des types via **JSDoc + fichiers de déclaration `.d.ts`** (`tsc -p jsconfig.json`) et bundling des dépendances locales via Vite.
- Store d’état immuable et adaptateurs DOM exploitant les API modernes des navigateurs récents (guidés par `modern-web-guidance`).
- Stockage local IndexedDB (`DB_VERSION = 2`) via `idb` et demande de persistance (`navigator.storage.persist()`).
- Gestion des projets et des tâches (vues liste et Kanban accessible au clavier et à la souris), avec colonnes de statut Kanban paramétrables (`preferences.taskStatuses`) et signalement visuel dans la vue Liste des tâches sans statut ou au statut inconnu (exclues du tableau Kanban jusqu’à réassignation).
- Notes autonomes et descriptions de tâches avec Tiptap Core headless et images locales en `Blob`.
- Tableaux blancs autonomes sur canevas SVG natif (`src/adapters/whiteboard-canvas.js`), avec outils vectoriels, images locales, navigation clavier complète et export `.svg` / `.png`.
- Visuel de saisie (`Tiroir latéral` ou `Modale`) configurable par écran (`Tâches`, `Projets`, `Notes`, `Tableaux blancs`) dans `Préférences d’affichage` et persisté dans `IndexedDB`.
- Sauvegarde et restauration par archive ZIP (`fflate`, `schemaVersion: 2` avec migration transparente depuis `v1`) séparant les données JSON et les binaires d’images (`Blob`).
- Interface conforme au système de design Covenant (HTML5 natif, CSS natif, mode clair/sombre, accessibilité WCAG 2.2 AA).

**Différé :**

- Calendrier mensuel et agenda des échéances (les dates d’échéance sont stockées sur les tâches dès le MVP, mais la vue calendrier dédiée reste reportée).

## Stack et outils

| Élément                  | Choix retenu                                                                                                         | Avancement local |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Langage                  | JavaScript moderne (ES2024+, `.js` ESM natif)                                                                        | Vérifié          |
| Vérification de types    | JSDoc + contrats `.d.ts` vérifiés par TypeScript (`checkJs: true`, `strict: true`, `noUncheckedIndexedAccess: true`) | Vérifié          |
| Interface                | HTML5 sémantique, DOM natif (`<dialog>`, Popover API)                                                                | Vérifié          |
| Styles                   | CSS natif moderne, conventions Covenant Design System (`@layer`, tokens CSS)                                         | Vérifié          |
| Polices et icônes        | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@phosphor-icons/web` bundlés localement (zéro CDN)        | Vérifié          |
| Build et développement   | Vite (résolution des paquets npm, CSP prod, `precache-manifest.json`)                                                | Vérifié          |
| Stockage                 | IndexedDB (`DB_VERSION = 2`) via `idb` + Web Locks (`navigator.locks`)                                               | Vérifié          |
| Archives                 | `fflate` (ZIP standard contenant `manifest.json`, `data.json`, `assets/*`, schéma `v2`)                              | Vérifié          |
| Texte enrichi            | Tiptap Core v3 (headless)                                                                                            | Vérifié          |
| Kanban (glisser-déposer) | API natives (HTML Drag and Drop) + menu Popover et raccourcis clavier `Alt` + flèches                                | Vérifié          |
| Tableau blanc            | Option A retenue et livrée : canevas SVG natif + Pointer Events + raccourcis clavier (zéro dépendance tiers)         | Vérifié          |
| Tests                    | Vitest, Playwright, `@axe-core/playwright`                                                                           | Vérifié          |
| Analyse statique         | ESLint (flat config) et TypeScript (`tsc -p jsconfig.json`)                                                          | Vérifié          |
| Formatage                | Prettier                                                                                                             | Vérifié          |
| CI et déploiement        | GitHub Actions (`.github/workflows/ci.yml` et `.github/workflows/deploy.yml` vers GitHub Pages)                      | Vérifié          |
| Environnement            | Node.js 24 dans `.nvmrc`                                                                                             | Vérifié          |

## Architecture et conventions

**Vérifié :**

- Code exécutable en JavaScript standard (`.js`), appuyé sur les contrats de types déclarés dans `src/types.d.ts` / `src/env.d.ts` et annotés en JSDoc.
- Exploitation privilégiée des standards web modernes (orientée par `modern-web-guidance` et `covenant-design-system`).
- Fonctions pures dans `src/core/` pour le métier, les validations et les transformations (`model.js`, `store.js`, `schema.js`, `backup.js`).
- Gestion d’état centralisée par store immuable minimaliste (commandes, réduction pure `{ state, effects }`, abonnement des vues) sans état global mutable partagé.
- Effets isolés dans `src/adapters/` : DOM, stockage IndexedDB (`idb`), archives ZIP, encapsulation de Tiptap Core et adaptateur SVG natif du tableau blanc.
- Données métier et schémas de sauvegarde strictement indépendants des structures internes des bibliothèques tierces.
- Organisation modulaire par fonctionnalité, code et identifiants en anglais, fichiers en `kebab-case.js`, fonctions et variables en `camelCase`, types JSDoc/TS en `PascalCase`, structures métier immuables (`readonly`).

## Texte enrichi

**Vérifié :** Tiptap Core v3 sans wrapper React/Vue, isolé derrière `src/adapters/rich-text-tiptap.js` avec barre d’outils en DOM natif ; sélection minimale d’extensions libres ; document sérialisé en JSON validé ; contrôle des URL (`https://`, `mailto:` uniquement), refus et blocage des images distantes au collage et à l’insertion.

**Périmètre vérifié :** paragraphes, titres, emphase (gras, italique, barré, code inline), liens, listes à puces et numérotées, listes de contrôle (tâches) et références aux images locales stockées en tant qu’assets.

## Stockage et sauvegardes

**Vérifié :**

- État de travail conservé dans IndexedDB (`DB_VERSION = 2`) via `idb` (`meta`, `projects`, `tasks`, `notes`, `whiteboards`, `assets`).
- Appel à `navigator.storage.persist()` et affichage de l’état/quota dans la modale de sauvegarde.
- Verrouillage multi-onglets via `navigator.locks` (`locavern-write-lock`) avec passage en lecture seule du second onglet et reprise automatique à la fermeture du détenteur.
- Séparation entre les magasins de données structurées et le magasin de fichiers binaires (`assets` stockés sous forme de `Blob`).
- Version de schéma de données (`schemaVersion: 2`) distincte de la version applicative (`0.2.0`), avec validation stricte et migration transparente `v1` -> `v2` à l’import dans `src/core/schema.js`.
- Import/export manuel déclenché par l’utilisateur sous forme d’archive ZIP (`manifest.json`, `data.json`, `assets/*`) avec limites de taille (`5 Mio` par image, `25 Mio` par archive, `10 000` enregistrements) et types MIME autorisés (`image/png`, `image/jpeg`, `image/webp`, `image/gif`).

**Limites de conception déclarées :** aucun chiffrement applicatif, exports en clair, stockage navigateur pouvant être effacé manuellement par l’utilisateur.

## Confidentialité

**Vérifié :**

- Aucun backend métier, télémétrie, rapport d’erreur distant, CDN, aperçu distant de lien, donnée utilisateur dans les URL, HTML actif librement importé ou synchronisation automatique.
- Politique CSP de production stricte injectée au build (`default-src 'none'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' blob: data:`, `font-src 'self'`, `connect-src 'self'`, `worker-src 'self'`, `manifest-src 'self'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, `form-action 'none'`).
- Zéro requête réseau externe vérifié par les tests Playwright (`shell.spec.js`, `notes-tiptap.spec.js`, `offline-csp.spec.js`, `whiteboard.spec.js`, `input-presentation.spec.js`).

## Styles et design system

**Vérifié :**

- CSS natif sans framework CSS externe.
- Intégration locale des fichiers du **Covenant Design System** (`public/vendor/covenant/`, sans import Google Fonts) et styles applicatifs basés exclusivement sur les tokens `--cv-*` (`src/styles/app.css`).
- Tokens sémantiques en propriétés personnalisées CSS (thèmes clair et sombre natifs avec `color-scheme` et script anti-flash `public/theme-init.js`).
- Composants HTML5 sémantiques (`<dialog>`, `[popover]`, formulaires accessibles, états vides et d’erreur explicites), conformité WCAG 2.2 AA vérifiée en clair et sombre via `@axe-core/playwright`.
- Formatage avec Prettier.

## Tableau blanc (Lot 2)

**Vérifié :**

- Schéma pivot propre à Locavern (`Whiteboard`, `WhiteboardElement`, `WhiteboardViewport`) dans `src/types.d.ts` et `src/core/model.js`, indépendant de toute bibliothèque externe.
- Moteur graphique retenu et implémenté : **Option A — Canevas SVG natif + Pointer Events + raccourcis clavier** dans `src/adapters/whiteboard-canvas.js`, sans aucune dépendance runtime supplémentaire.
- Périmètre complet vérifié : outils `select`, `sticky`, `rect`, `ellipse`, `arrow`, `text`, `path`, insertion d’images locales, blocage des images distantes au collage, 5 couleurs Covenant, historique Annuler/Rétablir, zoom et panoramique, création et manipulation intégrales au clavier (WCAG 2.2 AA) et export autonome `.svg` / `.png`.

## Qualité et documentation

**Vérifié :**

- Vérification statique stricte des types sur les fichiers `.js` (`tsc -p jsconfig.json`).
- 32 tests unitaires Vitest sur le cœur fonctionnel pur et la validation d’archives (`tests/unit/`).
- 10 scénarios de bout en bout (8 fichiers) Playwright avec contrôles d’accessibilité `@axe-core/playwright` (`tests/e2e/`).
- Documentation française organisée selon Diátaxis (`README.md`, `docs/`), alignée sur la version `0.2.0`.

## Distribution

**Vérifié :**

- Distribution statique produite dans `dist/` (`base: './'`), manifeste PWA (`public/manifest.webmanifest`) et Service Worker natif (`public/sw.js` + `precache-manifest.json`) vérifiés hors ligne sous Playwright.
- Pipeline GitHub Actions dédié dans `.github/workflows/deploy.yml` (déclenchement sur `push` vers `main` et `workflow_dispatch`, appel du workflow réutilisable `.github/workflows/ci.yml`, build de `dist/`, préparation via `actions/configure-pages@v5`, upload via `actions/upload-pages-artifact@v3` et déploiement via `actions/deploy-pages@v4` sur l’environnement `github-pages`).

**Prérequis côté dépôt GitHub :** activer GitHub Pages avec la source « GitHub Actions » dans les paramètres du dépôt pour la première exécution du déploiement.
