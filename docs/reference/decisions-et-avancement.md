---
version: '0.1.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# Décisions et avancement

Registre issu de la [restitution du 12 novembre 2026](../../choix-technique.md) et des arbitrages d’architecture du 13 novembre 2026, confronté à l’[état local du dépôt](etat-du-depot.md).

## Sommaire

- [Statuts](#statuts)
- [Produit et contraintes](#produit-et-contraintes)
- [Périmètre du premier lot (MVP)](#périmètre-du-premier-lot-mvp)
- [Stack et outils](#stack-et-outils)
- [Architecture et conventions](#architecture-et-conventions)
- [Texte enrichi](#texte-enrichi)
- [Stockage et sauvegardes](#stockage-et-sauvegardes)
- [Confidentialité](#confidentialité)
- [Styles et design system](#styles-et-design-system)
- [Tableau blanc (lot ultérieur)](#tableau-blanc-lot-ultérieur)
- [Qualité et documentation](#qualité-et-documentation)
- [Distribution](#distribution)

## Statuts

| Statut                | Signification                                                                     |
| --------------------- | --------------------------------------------------------------------------------- |
| Retenu                | Décision confirmée pour la conception ; implémentation non attestée dans le dépôt |
| Différé               | Fonctionnalité ou composant reporté après le premier lot (MVP)                    |
| Envisagé              | Fonctionnalité annoncée sans engagement de livraison ni ordre défini              |
| À confirmer           | Proposition ou détail restant à choisir                                           |
| Rapporté, non vérifié | Réalisation annoncée dans la source historique, absente du dépôt inspecté         |
| Vérifié               | Élément directement observable et validé dans le dépôt                            |

## Produit et contraintes

| Sujet                  | Décision ou périmètre                                                                               | Statut  |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------- |
| Usage                  | Productivité personnelle inspirée fonctionnellement de Nanoboard                                    | Vérifié |
| Premier lot (MVP)      | Socle, stockage local, projets et tâches (vues liste et Kanban), notes enrichies, import/export ZIP | Vérifié |
| Lots ultérieurs        | Calendrier des échéances, tableau blanc                                                             | Différé |
| Contenu                | Descriptions enrichies, liens, listes de contrôle, images locales                                   | Vérifié |
| Expérience             | Import/export ZIP, mode sombre, installation PWA et usage hors ligne                                | Vérifié |
| Exécution              | Local first, sans backend distant ni serveur applicatif requis au runtime                           | Vérifié |
| Distribution           | Fichiers statiques compatibles GitHub Pages                                                         | Retenu  |
| Cible                  | Chrome / Chromium récent sur ordinateur                                                             | Vérifié |
| Technologies           | Standards web (HTML5, CSS natif, JavaScript ES2024+ natif) ; aucun framework applicatif au runtime  | Vérifié |
| Développement          | Serveur local autorisé pour les outils (`vite`, `vite preview`)                                     | Vérifié |
| Identité et transferts | Aucun compte ni synchronisation automatique ; transferts manuels par import/export                  | Vérifié |
| Réseau                 | Aucun appel métier, télémétrie, analytique ou ressource CDN tierce                                  | Vérifié |

## Périmètre du premier lot (MVP)

**Vérifié :**

- Socle en **JavaScript récent natif (`.js`, ES Modules)**, sans transpilation du code applicatif, avec vérification statique des types via **JSDoc + fichiers de déclaration `.d.ts`** (`tsc -p jsconfig.json`) et bundling des dépendances locales via Vite.
- Store d’état immuable et adaptateurs DOM exploitant les API modernes des navigateurs récents (guidés par `modern-web-guidance`).
- Stockage local IndexedDB via `idb` et demande de persistance (`navigator.storage.persist()`).
- Gestion des projets et des tâches (vues liste et Kanban accessible au clavier et à la souris).
- Notes autonomes et descriptions de tâches avec Tiptap Core headless et images locales en `Blob`.
- Sauvegarde et restauration par archive ZIP (`fflate`) séparant les données JSON et les binaires d’images (`Blob`).
- Interface conforme au système de design Covenant (HTML5 natif, CSS natif, mode clair/sombre, accessibilité WCAG 2.2 AA).

**Différé :**

- Tableau blanc (reporté à un lot ultérieur pour ne pas coupler le modèle de données initial à une bibliothèque en version `0.3.0`).
- Calendrier mensuel et agenda des échéances (les dates d’échéance sont stockées sur les tâches dès le MVP, mais la vue calendrier dédiée est reportée).

## Stack et outils

| Élément                  | Choix retenu                                                                                                  | Avancement local |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------- |
| Langage                  | JavaScript moderne (ES2024+, `.js` ESM natif)                                                                 | Vérifié          |
| Vérification de types    | JSDoc + contrats `.d.ts` vérifiés par TypeScript (`checkJs: true`, `strict: true`, `noEmit: true`)            | Vérifié          |
| Interface                | HTML5 sémantique, DOM natif (`<dialog>`, Popover API)                                                         | Vérifié          |
| Styles                   | CSS natif moderne, conventions Covenant Design System (`@layer`, tokens CSS)                                  | Vérifié          |
| Polices et icônes        | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@phosphor-icons/web` bundlés localement (zéro CDN) | Vérifié          |
| Build et développement   | Vite (résolution des paquets npm, CSP prod, `precache-manifest.json`)                                         | Vérifié          |
| Stockage                 | IndexedDB via `idb` + Web Locks (`navigator.locks`)                                                           | Vérifié          |
| Archives                 | `fflate` (ZIP standard contenant `manifest.json`, `data.json`, `assets/*`)                                    | Vérifié          |
| Texte enrichi            | Tiptap Core v3 (headless)                                                                                     | Vérifié          |
| Kanban (glisser-déposer) | API natives (HTML Drag and Drop) + menu Popover et raccourcis clavier `Alt` + flèches                         | Vérifié          |
| Tableau blanc            | Différé (isolation par schéma pivot exigée avant choix définitif)                                             | Différé          |
| Tests                    | Vitest, Playwright, `@axe-core/playwright`                                                                    | Vérifié          |
| Analyse statique         | ESLint (flat config) et TypeScript (`tsc -p jsconfig.json`)                                                   | Vérifié          |
| Formatage                | Prettier                                                                                                      | Vérifié          |
| CI                       | GitHub Actions (`.github/workflows/ci.yml`)                                                                   | Vérifié          |
| Environnement            | Node.js 24 dans `.nvmrc`                                                                                      | Vérifié          |

## Architecture et conventions

**Vérifié :**

- Code exécutable en JavaScript standard (`.js`), appuyé sur les contrats de types déclarés dans `src/types.d.ts` / `src/env.d.ts` et annotés en JSDoc.
- Exploitation privilégiée des standards web modernes (orientée par `modern-web-guidance` et `covenant-design-system`).
- Fonctions pures dans `src/core/` pour le métier, les validations et les transformations (`model.js`, `store.js`, `schema.js`, `backup.js`).
- Gestion d’état centralisée par store immuable minimaliste (commandes, réduction pure `{ state, effects }`, abonnement des vues) sans état global mutable partagé.
- Effets isolés dans `src/adapters/` : DOM, stockage IndexedDB (`idb`), archives ZIP et encapsulation de Tiptap Core.
- Données métier et schémas de sauvegarde strictement indépendants des structures internes des bibliothèques tierces.
- Organisation modulaire par fonctionnalité, code et identifiants en anglais, fichiers en `kebab-case.js`, fonctions et variables en `camelCase`, types JSDoc/TS en `PascalCase`, structures métier immuables (`readonly`).

**Rapporté, non vérifié (prototype historique du tableau blanc) :** séparation entre `src/document.ts`, `src/whiteboard.ts`, `src/storage.ts` et `src/main.ts`.

## Texte enrichi

**Vérifié :** Tiptap Core v3 sans wrapper React/Vue, isolé derrière `src/adapters/rich-text-tiptap.js` avec barre d’outils en DOM natif ; sélection minimale d’extensions libres ; document sérialisé en JSON validé ; contrôle des URL (`https://`, `mailto:` uniquement), refus et blocage des images distantes au collage et à l’insertion.

**Périmètre initial vérifié :** paragraphes, titres, emphase (gras, italique, barré, code inline), liens, listes à puces et numérotées, listes de contrôle (tâches) et références aux images locales stockées en tant qu’assets.

**Hors périmètre initial :** tableaux complexes, mise en page avancée, collaboration distante, services Cloud ou IA.

## Stockage et sauvegardes

**Vérifié :**

- État de travail conservé dans IndexedDB via `idb` (`meta`, `projects`, `tasks`, `notes`, `assets`).
- Appel à `navigator.storage.persist()` et affichage de l’état/quota dans la modale de sauvegarde.
- Verrouillage multi-onglets via `navigator.locks` (`locavern-write-lock`) avec passage en lecture seule du second onglet et reprise automatique à la fermeture du détenteur.
- Séparation entre les magasins de données structurées et le magasin de fichiers binaires (`assets` stockés sous forme de `Blob`).
- Version de schéma de données (`schemaVersion: 1`) distincte de la version applicative (`0.1.0`), avec validation stricte des imports dans `src/core/schema.js`.
- Import/export manuel déclenché par l’utilisateur sous forme d’archive ZIP (`manifest.json`, `data.json`, `assets/*`) avec limites de taille (10 Mio par image, 50 Mio par archive) et types MIME autorisés (`image/png`, `image/jpeg`, `image/webp`, `image/gif`).

**Limites de conception déclarées :** aucun chiffrement applicatif, exports en clair, stockage navigateur pouvant être effacé manuellement par l’utilisateur.

## Confidentialité

**Vérifié :**

- Aucun backend métier, télémétrie, rapport d’erreur distant, CDN, aperçu distant de lien, donnée utilisateur dans les URL, HTML actif librement importé ou synchronisation automatique.
- Politique CSP de production stricte injectée au build (`default-src 'none'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' blob: data:`, `font-src 'self'`, `connect-src 'self'`, `worker-src 'self'`, `manifest-src 'self'`, `object-src 'none'`, `frame-src 'none'`, `base-uri 'none'`, `form-action 'none'`).
- Zéro requête réseau externe vérifié par les tests Playwright (`shell.spec.js`, `notes-tiptap.spec.js`, `offline-csp.spec.js`).

## Styles et design system

**Vérifié :**

- CSS natif sans framework CSS externe.
- Intégration locale des fichiers du **Covenant Design System** (`public/vendor/covenant/`, sans import Google Fonts) et styles applicatifs en couches `@layer` (`src/styles/app.css`).
- Tokens sémantiques en propriétés personnalisées CSS (thèmes clair et sombre natifs avec `color-scheme` et script anti-flash `public/theme-init.js`).
- Composants HTML5 sémantiques (`<dialog>`, `[popover]`, formulaires accessibles, états vides et d’erreur explicites), conformité WCAG 2.2 AA vérifiée en clair et sombre via `@axe-core/playwright`.
- Formatage avec Prettier.

**À confirmer :** configuration éventuelle de Stylelint.

## Tableau blanc (lot ultérieur)

**Différé :** l’intégration d’un tableau blanc est reportée après la stabilisation du MVP (projets, tâches, Kanban, notes et stockage).

**Conditions préalables retenues pour le lot Tableau blanc :**

- Définition d’un schéma pivot propre à Locavern afin que le format de sauvegarde ne dépende pas directement du snapshot interne d’une bibliothèque tierce.
- Réévaluation comparative entre `@quickdrawjs/core`, `Fabric.js` et un canevas SVG/Canvas dédié au moment de l’implémentation du lot, incluant l’exigence d’une interface francisée et accessible au clavier.

## Qualité et documentation

**Vérifié :**

- Vérification statique stricte des types sur les fichiers `.js` (`tsc -p jsconfig.json`).
- 18 tests unitaires Vitest sur le cœur fonctionnel pur et la validation d’archives (`tests/unit/`).
- 5 suites de bout en bout Playwright avec contrôles d’accessibilité `@axe-core/playwright` (`tests/e2e/`).
- Documentation française organisée selon Diátaxis (`README.md`, `docs/`), alignée sur la version `0.1.0`.

**Rapporté, non vérifié (source historique) :** 11 tests unitaires et 4 tests navigateur sur le prototype absent du dépôt.

## Distribution

**Vérifié :** distribution statique produite dans `dist/`, manifeste PWA (`public/manifest.webmanifest`) et Service Worker natif (`public/sw.js` + `precache-manifest.json`) vérifiés hors ligne sous Playwright.

**À confirmer :** workflow GitHub Actions dédié au déploiement automatisé vers GitHub Pages (le workflow `.github/workflows/ci.yml` couvre déjà typecheck, lint, formatage, Vitest, build et Playwright).
