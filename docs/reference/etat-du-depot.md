---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# État du dépôt

Constat technique du 15 novembre 2026 après implémentation complète du **Lot 2 — Tableau blanc (`0.2.0`)**, paramétrage du visuel de saisie par écran et ajout du pipeline de livraison GitHub Pages.

## Sommaire

- [Périmètre du constat](#périmètre-du-constat)
- [Inventaire](#inventaire)
- [État applicatif](#état-applicatif)
- [Validations exécutables](#validations-exécutables)
- [Écarts et éléments différés](#écarts-et-éléments-différés)

## Périmètre du constat

Les informations ci-dessous reflètent les fichiers présents dans l’arbre de travail de `locavern/` et les exécutions locales des suites d’analyse, de build et de tests.

## Inventaire

| Élément                    | Contenu vérifié                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration et outillage | `.nvmrc`, `package.json`, `jsconfig.json`, `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `eslint.config.js`, `.prettierrc`, `.github/workflows/{ci,deploy}.yml`                                                                                                                                           |
| Shell HTML et PWA          | `index.html`, `public/manifest.webmanifest`, `public/theme-init.js`, `public/sw.js`                                                                                                                                                                                                                                       |
| Assets Covenant embarqués  | `public/vendor/covenant/` (`covenant-tokens.css`, `covenant.css`, `covenant.js`, logos SVG), sans `@import` distant                                                                                                                                                                                                       |
| Polices et icônes locales  | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@phosphor-icons/web` bundlés par Vite                                                                                                                                                                                                                          |
| Noyau fonctionnel pur      | `src/types.d.ts`, `src/env.d.ts`, `src/core/{model,store,schema,backup}.js`                                                                                                                                                                                                                                               |
| Adaptateurs et UI          | `src/main.js`, `src/styles/app.css`, `src/adapters/{storage-idb,archive-file,rich-text-tiptap,whiteboard-canvas}.js`, `src/adapters/dom/{app-shell,backup-modal,kanban-view,note-dialog,notes-view,preferences-modal,project-view,task-drawer,task-list-view,task-workspace-header,whiteboard-dialog,whiteboard-view}.js` |
| Tests                      | `tests/unit/{model,store,schema,backup,archive-file}.test.js`, `tests/e2e/{input-presentation,notes-tasklist,offline-csp,persistence-and-locks,projects-tasks-kanban,shell,whiteboard}.spec.js`                                                                                                                           |
| Documentation              | `README.md`, `docs/index.md`, `docs/tutorials/`, `docs/how-to/` (dont `utiliser-le-tableau-blanc.md`), `docs/reference/{etat-du-depot,decisions-et-avancement,interface-et-raccourcis,stockage-limites-et-erreurs}.md`, `docs/explanation/`                                                                               |

## État applicatif

La version `0.2.0` définie dans `package.json` implémente le Lot 1 (MVP) et le Lot 2 (Tableau blanc) :

- **Shell Covenant** clair/sombre (`#theme-switch` + `theme-init.js`), contrôle `Taille du texte`, choix du visuel de saisie par écran (`Tiroir latéral` / `Modale` pour `Tâches`, `Projets`, `Notes`, `Tableaux blancs` dans `#modal-preferences`), palette de commandes `Ctrl+K`, notifications toast, tiroirs et modales `<dialog>`.
- **Projets et tâches** : CRUD projets, filtres et tri en vue Liste (`DataTable`), tableau Kanban en 3 colonnes avec glisser-déposer natif, menu Popover et raccourcis clavier `Alt` + flèches, saisie de tâche configurable en tiroir latéral ou modale (priorité, statut, échéance, checklist, description enrichie).
- **Notes enrichies** : éditeur Tiptap Core headless avec blocage des images distantes, validation des liens et stockage binaire local des images dans IndexedDB, création/édition dans `#dialog-note` (tiroir latéral ou modale) et espace de travail intégré.
- **Tableau blanc SVG natif** : adaptateur dédié `src/adapters/whiteboard-canvas.js` (Post-it, rectangle, ellipse, flèche, texte, tracé libre, image locale, 5 tokens couleur Covenant, Annuler/Rétablir, zoom/panoramique, contrôle intégral au clavier WCAG 2.2 AA, blocage des images distantes et export `.svg` / `.png`), intégré dans `src/adapters/dom/whiteboard-view.js` avec fenêtre de saisie `#dialog-whiteboard` (modale ou tiroir latéral).
- **Stockage et résilience** : persistance IndexedDB (`idb`, `DB_VERSION = 2` avec magasin `whiteboards` et migration transparente `v1` -> `v2` sur les sauvegardes), verrouillage multi-onglets via `navigator.locks` (passage automatique en lecture seule et reprise à la fermeture de l’onglet éditeur), import/export ZIP (`fflate`, `schemaVersion: 2`), CSP stricte injectée au build et cache hors ligne via Service Worker (`precache-manifest.json`).
- **Livraison statique** : workflow `.github/workflows/deploy.yml` déclenché sur `push` vers `main` et `workflow_dispatch`, exécutant les vérifications `.github/workflows/ci.yml` puis le build de `dist/` et le déploiement vers l’environnement `github-pages` via `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` et `actions/deploy-pages@v4`.

## Validations exécutables

Toutes les portes de qualité suivantes sont configurées et vérifiées localement :

- `npm run typecheck` : `tsc -p jsconfig.json` (`checkJs: true`, `strict: true`, `noUncheckedIndexedAccess: true`).
- `npm run lint` : ESLint flat config.
- `npm run format:check` : Prettier.
- `npm test` : 5 fichiers / 27 tests unitaires Vitest sur `src/core/*` et `src/adapters/archive-file.js`.
- `npm run build` : bundle Vite dans `dist/` avec méta CSP et `precache-manifest.json`.
- `npm run test:e2e` : 7 fichiers (8 scénarios) Playwright Chromium couvrant zéro requête externe, WCAG 2.2 AA en thèmes clair et sombre (`@axe-core/playwright`), reflow 320 px, persistance après rechargement, verrouillage multi-onglets, export/reset/import ZIP, Tiptap + images locales, tableau blanc SVG (clavier, image locale, export SVG/PNG), paramétrage du visuel de saisie par écran (`Tiroir latéral` / `Modale`) et fonctionnement hors ligne sous Service Worker.

## Écarts et éléments différés

Conformément au découpage par lots décrit dans [decisions-et-avancement.md](decisions-et-avancement.md) :

- **Calendrier des échéances** : les dates d’échéance sont portées par les tâches et triables en vue liste dès le MVP ; la vue calendrier mensuelle dédiée reste différée à un lot ultérieur.
