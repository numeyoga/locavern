---
version: '0.1.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-13
---

# État du dépôt

Constat technique du 13 novembre 2026 après implémentation complète du **Lot 1 — MVP (`0.1.0`)**.

## Sommaire

- [Périmètre du constat](#périmètre-du-constat)
- [Inventaire](#inventaire)
- [État applicatif](#état-applicatif)
- [Validations exécutables](#validations-exécutables)
- [Écarts et éléments différés](#écarts-et-éléments-différés)

## Périmètre du constat

Les informations ci-dessous reflètent les fichiers présents dans l’arbre de travail de `locavern/` et les exécutions locales des suites d’analyse, de build et de tests.

## Inventaire

| Élément                    | Contenu vérifié                                                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration et outillage | `.nvmrc`, `package.json`, `jsconfig.json`, `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `eslint.config.js`, `.prettierrc`, `.github/workflows/ci.yml`                                                                  |
| Shell HTML et PWA          | `index.html`, `public/manifest.webmanifest`, `public/theme-init.js`, `public/sw.js`                                                                                                                                                     |
| Assets Covenant embarqués  | `public/vendor/covenant/` (`covenant-tokens.css`, `covenant.css`, `covenant.js`, logos SVG), sans `@import` distant                                                                                                                     |
| Polices et icônes locales  | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@phosphor-icons/web` bundlés par Vite                                                                                                                                        |
| Noyau fonctionnel pur      | `src/types.d.ts`, `src/env.d.ts`, `src/core/{model,store,schema,backup}.js`                                                                                                                                                             |
| Adaptateurs et UI          | `src/main.js`, `src/styles/app.css`, `src/adapters/{storage-idb,archive-file,rich-text-tiptap}.js`, `src/adapters/dom/{app-shell,backup-modal,kanban-view,notes-view,project-view,task-drawer,task-list-view,task-workspace-header}.js` |
| Tests                      | `tests/unit/{model,store,schema,backup,archive-file}.test.js`, `tests/e2e/{shell,persistence-and-locks,projects-tasks-kanban,notes-tiptap,offline-csp}.spec.js`                                                                         |
| Documentation              | `README.md`, `docs/index.md`, `docs/reference/{etat-du-depot,decisions-et-avancement}.md`, `docs/explanation/choix-architecture.md`                                                                                                     |

## État applicatif

La version `0.1.0` définie dans `package.json` implémente l’intégralité du Lot 1 (MVP) :

- **Shell Covenant** clair/sombre (`#theme-switch` + `theme-init.js`), palette de commandes `Ctrl+K`, notifications toast, tiroirs et modales `<dialog>`.
- **Projets et tâches** : CRUD projets, filtres et tri en vue Liste (`DataTable`), tableau Kanban en 3 colonnes avec glisser-déposer natif, menu Popover et raccourcis clavier `Alt` + flèches, tiroir d’édition de tâche (priorité, statut, échéance, checklist, description enrichie).
- **Notes enrichies** : éditeur Tiptap Core headless avec blocage des images distantes, validation des liens et stockage binaire local des images dans IndexedDB.
- **Stockage et résilience** : persistance IndexedDB (`idb`), verrouillage multi-onglets via `navigator.locks` (passage automatique en lecture seule et reprise à la fermeture de l’onglet éditeur), import/export ZIP (`fflate`), CSP stricte injectée au build et cache hors ligne via Service Worker (`precache-manifest.json`).

## Validations exécutables

Toutes les portes de qualité suivantes sont configurées et vérifiées localement :

- `npm run typecheck` : `tsc -p jsconfig.json` (`checkJs: true`, `strict: true`, `noUncheckedIndexedAccess: true`).
- `npm run lint` : ESLint flat config.
- `npm run format:check` : Prettier.
- `npm test` : 5 fichiers / 18 tests unitaires Vitest sur `src/core/*` et `src/adapters/archive-file.js`.
- `npm run build` : bundle Vite dans `dist/` avec méta CSP et `precache-manifest.json`.
- `npm run test:e2e` : 5 scénarios Playwright Chromium couvrant zéro requête externe, WCAG 2.2 AA en thèmes clair et sombre (`@axe-core/playwright`), reflow 320 px, persistance après rechargement, verrouillage multi-onglets, export/reset/import ZIP, Tiptap + images locales et fonctionnement hors ligne sous Service Worker.

## Écarts et éléments différés

Conformément au découpage par lots décrit dans [decisions-et-avancement.md](decisions-et-avancement.md) :

- **Calendrier des échéances** : les dates d’échéance sont portées par les tâches et triables en vue liste dès le MVP ; la vue calendrier mensuelle dédiée est différée au lot ultérieur.
- **Tableau blanc** : différé au lot ultérieur après stabilisation du MVP.
