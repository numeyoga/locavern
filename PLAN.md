Voici le plan détaillé de mise en place de **Locavern (Lot 1 — MVP)**, aligné sur les choix actés (**JavaScript récent ES2024+ `.js`**, **JSDoc + `.d.ts`**, **Covenant Design System**, **Modern Web Guidance**, **IndexedDB via `idb`**, **Tiptap Core headless**).

---

## 1. Point d'attention préalable (Covenant + Confidentialité Zéro-CDN)

En inspectant le skill [`covenant-design-system`](file:///var/home/nemo/.gemini/config/skills/covenant-design-system/SKILL.md#L33), son template standard charge les icônes Phosphor depuis un CDN (`https://unpkg.com/@phosphor-icons/web@2.1.1`) et les polices IBM Plex.
Or, Locavern impose **zéro appel vers un domaine tiers / CDN** et un fonctionnement **100 % hors ligne**.

- **Solution prévue dans le plan** : Nous embarquerons `@phosphor-icons/web` et `@fontsource/ibm-plex-sans` + `@fontsource/ibm-plex-mono` en **dépendances locales bundlées par Vite** (ou fichiers locaux dans `public/vendor/`), et nous copierons les 3 fichiers officiels de Covenant (`covenant-tokens.css`, `covenant.css`, `covenant.js`) ainsi que les logos dans le projet.

---

## 2. Architecture cible des fichiers du dépôt

```text
locavern/
├── .github/workflows/
│   └── ci.yml                      # Vérification (typecheck, lint, format, vitest, playwright)
├── .nvmrc                          # Node 24
├── index.html                      # AppShell Covenant (Sidebar, TopBar, <main>, <dialog>, Popovers)
├── package.json                    # Dépendances figées (idb, @tiptap/*, phosphor, fontsource, outils)
├── jsconfig.json                   # TypeScript checkJs: true, strict: true, noEmit: true, target: ESNext
├── vite.config.js                  # Build ESNext, CSP dev/prod
├── vitest.config.js                # Tests unitaires (noyau pur, migrations, store)
├── playwright.config.js            # Tests E2E + @axe-core/playwright
├── eslint.config.js                # Flat config ESLint pour JS moderne
├── public/
│   ├── manifest.webmanifest        # Manifeste PWA local-first
│   ├── sw.js                       # Service Worker natif (cache statique offline)
│   └── vendor/covenant/            # covenant-tokens.css, covenant.css, covenant.js, logos SVG
├── src/
│   ├── types.d.ts                  # Contrats TS stricts (Project, Task, Note, AssetMeta, State, Command)
│   ├── main.js                     # Point d'entrée : init Covenant, Web Locks, Store, Hydratation IDB, UI
│   ├── core/                       # 100 % fonctions pures (zéro DOM, zéro IndexedDB)
│   │   ├── model.js                # Création, validation et invariants (projets, tâches, notes)
│   │   ├── store.js                # Store immuable (dispatch, reducer pur, subscribe, sélecteurs)
│   │   ├── schema.js               # Validation de schéma et migrations pures (v1 -> vN)
│   │   └── backup.js               # Sérialisation / désérialisation et validation d'import/export
│   ├── adapters/                   # Isolent tous les effets de bord
│   │   ├── storage-idb.js          # Adaptateur IndexedDB via `idb` + navigator.storage.persist() + Web Locks
│   │   ├── archive-file.js         # Export/import (archive contenant manifest.json, data.json et blobs)
│   │   ├── rich-text-tiptap.js     # Adaptateur Tiptap Core headless + sanitisation URL/images locales
│   │   └── dom/                    # Adaptateurs d'interface (Covenant + Modern Web Guidance)
│   │       ├── app-shell.js        # Navigation Sidebar, TopBar, switch thème clair/sombre, CommandMenu (⌘K)
│   │       ├── project-view.js     # Sélecteur de projet, création/édition/suppression via <dialog> Covenant
│   │       ├── task-list-view.js   # Vue Liste (DataTable Covenant, filtres, tri, statut, échéance)
│   │       ├── kanban-view.js      # Vue Kanban (Cards Covenant, Drag & Drop natif + commandes clavier)
│   │       ├── task-drawer.js      # Drawer Covenant (<dialog>) d'édition détaillée d'une tâche + Tiptap
│   │       ├── notes-view.js       # Vue Notes autonomes + éditeur Tiptap + gestion d'images locales (Blob)
│   │       └── backup-modal.js     # Modal Covenant (<dialog>) d'import/export et état du stockage
│   └── styles/
│       └── app.css                 # Ajustements spécifiques (Kanban board, barre d'outils Tiptap) avec tokens --cv-*
└── tests/
    ├── unit/                       # Tests Vitest sur src/core/*
    └── e2e/                        # Tests Playwright + axe-core (parcours utilisateur, multi-onglets, CSP, offline)
```

---

## 3. Découpage en 6 étapes séquentielles (avec jalons vérifiables)

### Étape 1 — Outillage, configuration JS/JSDoc et Design System Covenant

**Objectif** : Avoir un socle qui compile, vérifie les types JSDoc, linte, exécute Vitest/Playwright et affiche l'`AppShell` Covenant accessible en mode clair et sombre sans aucun appel réseau externe.

1. Créer `.nvmrc` (Node 24), `package.json`, `jsconfig.json` (`checkJs: true`, `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`, `target: "ESNext"`), `vite.config.js`, `eslint.config.js`, `.prettierrc`.
2. Copier les assets du skill `covenant-design-system` (`covenant-tokens.css`, `covenant.css`, `covenant.js`, logos) et bundler localement les polices IBM Plex et icônes Phosphor.
3. Consulter `modern-web-guidance` pour la gestion du thème clair/sombre, des `<dialog>` et de la CSP.
4. Construire `index.html` à partir de `templates/page.html` de Covenant :
   - Barre latérale (`SidebarNav`) : Projets, Tâches (Liste / Kanban), Notes, Sauvegardes.
   - Barre supérieure (`TopBar`) : Titre de la vue active, recherche rapide (`CommandMenu` `Ctrl+K`), bouton d'import/export, bascule thème clair/sombre (`Switch`).
   - Zone principale `<main id="main">` et conteneur de notifications (`Toast`).
5. **Validation Étape 1** : `npm run typecheck`, `npm run lint`, `npm run build` et 1er test Playwright + `axe-core` validant 0 violation WCAG 2.2 AA en thème clair et sombre.

---

### Étape 2 — Cœur fonctionnel pur (`src/types.d.ts` & `src/core/`)

**Objectif** : Implémenter et tester unitairement (TDD avec Vitest) 100 % de la logique métier sans DOM ni base de données.

1. Définir `src/types.d.ts` :
   - `Project` (`id`, `name`, `description`, `createdAt`, `updatedAt`, `archived`).
   - `Task` (`id`, `projectId`, `title`, `status`: `'todo' | 'in_progress' | 'done'`, `priority`: `'low' | 'medium' | 'high'`, `dueDate`: `string | null`, `position`: `number`, `descriptionDoc`: JSON Tiptap, `checklist`: items, `createdAt`, `updatedAt`).
   - `Note` (`id`, `projectId`: `string | null`, `title`, `contentDoc`: JSON Tiptap, `assetIds`: `readonly string[]`, `createdAt`, `updatedAt`).
   - `AssetMeta` (`id`, `mimeType`, `sizeBytes`, `filename`, `createdAt`).
   - `AppState` et l'union discriminée `AppCommand`.
2. Implémenter `src/core/model.js` & `src/core/store.js` :
   - Réducteur pur `(state, command) => { nextState, effects }`.
   - Sélecteurs purs (tâches filtrées par projet/statut, groupement par colonne Kanban via `Object.groupBy`, tri par position/échéance).
3. Implémenter `src/core/schema.js` :
   - Validation stricte des structures JSON (sans dépendance externe lourde), gestion du `schemaVersion: 1`, rejet propre des versions futures inconnues ou payloads corrompus.
4. **Validation Étape 2** : Suite Vitest complète sur les invariants métier, les transitions du store et la validation de schéma.

---

### Étape 3 — Stockage IndexedDB (`idb`), Web Locks et Import/Export (`src/adapters/storage-*`)

**Objectif** : Persister l'état localement de façon fiable, bloquer les éditions concurrentes multi-onglets et permettre l'export/import complet (JSON + images `Blob`).

1. Implémenter `src/adapters/storage-idb.js` avec `idb` :
   - Stores IndexedDB : `meta` (version de schéma, préférences), `projects`, `tasks`, `notes`, `assets` (stockant les `Blob` binaires des images locales).
   - Appel à `navigator.storage.persist()` et exposition de l'état de persistance/quota dans l'interface.
   - Protection multi-onglets via `navigator.locks.request('locavern-write-lock', ...)` : le second onglet passe en mode lecture seule avec une `Alert` Covenant explicite.
2. Implémenter `src/adapters/archive-file.js` :
   - Export téléchargeable et import avec pré-validation atomique (vérification de la taille max, des types MIME d'images autorisés `image/png`, `image/jpeg`, `image/webp`, `image/gif`, et confirmation utilisateur via `Modal` Covenant avant écrasement).
3. **Validation Étape 3** : Tests unitaires + tests Playwright vérifiant la persistance après rechargement (`page.reload()`), le verrouillage du 2e onglet et le cycle complet export → remise à zéro → import.

---

### Étape 4 — Projets & Tâches : Vues Liste et Kanban (`src/adapters/dom/`)

**Objectif** : Offrir un parcours complet de gestion de projets et de tâches en utilisant exclusivement les composants Covenant et les API modernes (consultées via `modern-web-guidance`).

1. **Gestion des projets** : Création, renommage, archivage et suppression (avec `Modal` de confirmation destructive Covenant).
2. **Bascule de vue** : `SegmentedControl` Covenant pour basculer entre **Vue Liste** et **Vue Kanban**.
3. **Vue Liste** : `DataTable` Covenant avec badges de statut (`Badge`), priorité, date d'échéance en police mono (`IBM Plex Mono`), filtres rapides et ouverture du détail.
4. **Vue Kanban** :
   - 3 colonnes (`À faire`, `En cours`, `Terminé`) utilisant les `Card` Covenant.
   - Glisser-déposer natif entre colonnes et réordonnancement.
   - **Accessibilité clavier complète** : menu d'action ou raccourcis clavier sur chaque carte pour la déplacer d'une colonne ou d'une position sans souris, conformément à WCAG 2.2 AA.
5. **Panneau de détail (`Drawer` Covenant `<dialog>`)** : Édition du titre, statut, priorité, échéance (`DateTimeInput` natif) et description.
6. **Validation Étape 4** : Tests Playwright + `axe-core` sur la création de projet, création/déplacement de tâche en Liste et Kanban (souris + clavier).

---

### Étape 5 — Texte enrichi Tiptap Core & Notes avec images locales

**Objectif** : Intégrer Tiptap Core en mode headless pour les notes autonomes et les descriptions de tâches, avec insertion d'images locales stockées en `Blob`.

1. Implémenter `src/adapters/rich-text-tiptap.js` :
   - Extensions minimales : `Document`, `Paragraph`, `Text`, `Bold`, `Italic`, `Code`, `Strike`, `Heading`, `BulletList`, `OrderedList`, `ListItem`, `TaskList`, `TaskItem`, `Link` (avec contrôle strict du protocole `https:`/`mailto:` et `rel="noopener noreferrer"`), et nœud `LocalImage` personnalisé (référençant un `assetId` local résolu en `blob:` URL en mémoire, et bloquant toute URL d'image distante `http://` ou `https://`).
   - Barre d'outils DOM en composants `Button` Covenant (`aria-pressed` synchronisé avec la sélection Tiptap).
2. Implémenter `src/adapters/dom/notes-view.js` :
   - Liste des notes (filtrables par projet ou globales), création/édition/suppression, collage ou sélection d'image locale enregistrée dans le store `assets` d'IndexedDB.
3. **Validation Étape 5** : Tests Playwright vérifiant la saisie enrichie, les listes de contrôle, l'insertion d'une image locale (persistée après rechargement et incluse dans l'export) et le rejet d'une image distante collée.

---

### Étape 6 — Hors-ligne (PWA), CSP stricte, CI et Documentation Diátaxis

**Objectif** : Verrouiller la sécurité, le mode hors ligne et la documentation finale vérifiée.

1. Ajouter `public/manifest.webmanifest` et `public/sw.js` (mise en cache des ressources statiques du build Vite).
2. Appliquer la politique **Content-Security-Policy (CSP)** de production (`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`).
3. Configurer `.github/workflows/ci.yml` (installation déterministe, `typecheck`, `lint`, `format:check`, `test`, `build`, `test:e2e`).
4. Mettre à jour la documentation selon le skill `diataxis-documentation` :
   - Passer les éléments implémentés au statut **« Vérifié »** dans [`docs/reference/decisions-et-avancement.md`](file:///var/home/nemo/codex/locavern/docs/reference/decisions-et-avancement.md) et [`docs/reference/etat-du-depot.md`](file:///var/home/nemo/codex/locavern/docs/reference/etat-du-depot.md).
   - Mettre à jour [`README.md`](file:///var/home/nemo/codex/locavern/README.md) avec les commandes réelles vérifiées.
5. **Validation Étape 6** : Test Playwright vérifiant qu'aucune requête réseau externe n'est émise et que l'application fonctionne en mode `context.setOffline(true)`.

---

## 4. Stratégie de tests (selon le skill `testing`)

Pour respecter le skill [`testing`](file:///var/home/nemo/.gemini/config/skills/testing/SKILL.md#L33-L38), voici la classification de criticité proposée pour Locavern :

- **Criticité Haute (risque de perte de données ou fuite de confidentialité)** :
  - Stockage IndexedDB, migrations de schémas, verrouillage multi-onglets, import/export d'archives, filtrage des images distantes et CSP → _Tests en boucle complète (TDD sur les règles pures + tests de contrat aux frontières IndexedDB/Playwright)_.
- **Criticité Moyenne (fonctionnalités métier visibles et récupérables)** :
  - Gestion des projets, tâches (Liste/Kanban), notes Tiptap et navigation → _1 test d'acceptation Playwright par parcours métier + exemples unitaires Vitest sur le réducteur du store_.
- **Criticité Basse (cosmétique)** :
  - Vérifié via le contrôle automatisé `axe-core` (thèmes clair et sombre, reflow 320 px).

---

Ce plan en 6 étapes vous convient-il, et souhaitez-vous que nous lancions immédiatement l'**Étape 1 (Outillage, configuration JS/JSDoc et squelette AppShell Covenant)** ?
