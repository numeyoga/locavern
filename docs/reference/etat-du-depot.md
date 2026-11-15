---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-15
---

# État du dépôt

Constat technique du 15 novembre 2026 après implémentation du **Lot 1 (MVP)**, du **Lot 2 — Tableau blanc (`0.2.0`)**, du pipeline de livraison GitHub Pages et des **23 évolutions fonctionnelles** de productivité, planification, corbeille et chiffrement.

## Sommaire

- [Périmètre du constat](#périmètre-du-constat)
- [Inventaire](#inventaire)
- [État applicatif](#état-applicatif)
- [Validations exécutables](#validations-exécutables)

## Périmètre du constat

Les informations ci-dessous reflètent les fichiers présents dans l’arbre de travail de `locavern/` et les exécutions locales des suites d’analyse, de build et de tests.

## Inventaire

| Élément                    | Contenu vérifié                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Configuration et outillage | `.nvmrc`, `package.json`, `jsconfig.json`, `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `eslint.config.js`, `.prettierrc`, `.github/workflows/{ci,deploy}.yml`                                                                                                                                                                                    |
| Shell HTML et PWA          | `index.html`, `public/manifest.webmanifest`, `public/theme-init.js`, `public/sw.js` (`locavern-shell-v2`)                                                                                                                                                                                                                                                          |
| Assets Covenant embarqués  | `public/vendor/covenant/` (`covenant-tokens.css`, `covenant.css`, `covenant.js`, logos SVG), sans `@import` distant                                                                                                                                                                                                                                                |
| Polices et icônes locales  | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@phosphor-icons/web` bundlés par Vite                                                                                                                                                                                                                                                                   |
| Noyau fonctionnel pur      | `src/types.d.ts`, `src/env.d.ts`, `src/core/{backup,crypto-archive,dates,ical,markdown,model,schema,search,store,templates,whiteboard}.js` (`11` modules)                                                                                                                                                                                                          |
| Adaptateurs                | `src/adapters/{archive-file,rich-text-tiptap,storage-idb,sw-update,whiteboard-canvas}.js` (`5` modules)                                                                                                                                                                                                                                                            |
| Interface DOM              | `src/main.js`, `src/styles/app.css`, `src/adapters/dom/{app-shell,backup-modal,calendar-view,command-palette,kanban-view,link-editor,note-dialog,notes-view,preferences-modal,project-view,status-modal,tag-editor,task-drawer,task-list-view,task-workspace-header,template-picker,today-view,trash-modal,whiteboard-dialog,whiteboard-view}.js` (`20` modules)   |
| Tests unitaires            | `tests/unit/{archive-file,backup,crypto-archive,dates,ical,markdown,model,schema,search,store,sw-update,templates,whiteboard}.test.js` (`13` fichiers, `74` tests)                                                                                                                                                                                                 |
| Tests bout en bout (E2E)   | `tests/e2e/{calendar-ics,dark-mode-contrast,dashboard-and-recurrence,encrypted-backup,file-save-picker,input-presentation,kanban-quickadd-filters,kanban-statuses,notes-markdown-export,notes-tasklist,offline-csp,persistence-and-locks,projects-tasks-kanban,shell,sw-update-and-trash,tags-links-templates,whiteboard}.spec.js` (`17` fichiers, `30` scénarios) |
| Documentation              | `README.md`, `docs/index.md`, `docs/tutorials/`, `docs/how-to/` (`8` guides), `docs/reference/` (`4` fiches), `docs/explanation/` (`2` notes)                                                                                                                                                                                                                      |

## État applicatif

La version `0.2.0` définie dans `package.json` réunit les modules suivants :

- **Shell Covenant** clair/sombre (`#theme-switch` + `theme-init.js`), contrôle `Taille du texte`, choix du visuel de saisie par écran (`Tiroir latéral` / `Modale` pour `Tâches`, `Projets`, `Notes`, `Tableaux blancs`), durée configurable des notifications (`1` à `60 s`) et délai de rétention de la corbeille (`1` à `365 j`) dans `#modal-preferences`, palette de commandes dynamique `Ctrl+K` (15 commandes statiques + recherche multi-mots insensible aux accents dans toutes les entités), notifications toast, bandeau de mise à jour Service Worker (`sw-update.js`) et tiroirs/modales `<dialog>`.
- **Vue `Aujourd’hui` et `Calendrier`** : tableau de bord quotidien (`today-view.js`) avec indicateurs, actions de complétion rapide et éléments récents ; vue calendrier mensuelle et hebdomadaire (`calendar-view.js`) avec planification par glisser-déposer, boutons rapides (`−1 j` / `+1 j`, `Planifier aujourd’hui`), clavier (`Alt`/`Maj` + flèches) et export RFC 5545 `.ics` (`ical.js`).
- **Projets, tâches et récurrence** : CRUD et filtre d’archivage des projets (`Tous` / `Actifs` / `Archivés`), ajout rapide en vue Liste et par colonne Kanban, statuts Kanban configurables (`status-modal.js`, alerte et réassignation des tâches hors colonnes), recherche plein contenu, étiquettes, liens internes, récurrence (`Quotidienne`, `Hebdomadaire`, `Mensuelle`) générant l’occurrence suivante à la complétion, et modèles de checklist.
- **Notes enrichies** : éditeur Tiptap Core headless (`h1` à `h3`, gras/italique/barré/code, liens `https://`/`mailto:`, listes de tâches, images locales `Blob` avec blocage des images distantes), duplication, étiquettes, liens internes, modèles de trame et export Markdown `.md` (`markdown.js`).
- **Tableau blanc SVG natif** : adaptateur `src/adapters/whiteboard-canvas.js` + `src/core/whiteboard.js` (sélection simple, par zone et `Maj+clic` / `Ctrl+A`, duplication `Ctrl+D`, aimantation des flèches aux ancres, grille `20 px` et magnétisme débrayable, fond transparent, ordonnancement `zIndex`, images locales, historique `50` états, zoom / ajustement à la vue, contrôle clavier WCAG 2.2 AA, modèles de canevas, liens internes et export `.svg` / `.png`).
- **Corbeille, stockage et sauvegardes** : persistance `IndexedDB` (`locavern-db`, `DB_VERSION = 4`, `8` objectStores dont `trash` et `templates`), corbeille locale avec restauration et nettoyage des images orphelines et liens invalides, verrouillage multi-onglets via `navigator.locks`, archives ZIP `fflate` (`schemaVersion: 2`) en clair ou chiffrées par mot de passe (`AES-256-GCM` + `PBKDF2-SHA-256` dans `crypto-archive.js`), import en mode remplacement, fusion sans écrasement ou sélection de projets, enregistrement via `showSaveFilePicker` avec repli téléchargement, suivi de la date de dernière sauvegarde (`meta.lastBackupAt`), CSP stricte injectée au build et mode hors ligne via Service Worker (`precache-manifest.json`).
- **Livraison statique** : workflow `.github/workflows/deploy.yml` déclenché sur `push` vers `main` et `workflow_dispatch`, exécutant `.github/workflows/ci.yml` puis le build de `dist/` et le déploiement vers `github-pages` via `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` et `actions/deploy-pages@v4`.

## Validations exécutables

Toutes les portes de qualité suivantes sont configurées et vérifiées localement :

- `npm run typecheck` : `tsc -p jsconfig.json` (`checkJs: true`, `strict: true`, `noUncheckedIndexedAccess: true`).
- `npm run lint` : ESLint flat config.
- `npm run format:check` : Prettier.
- `npm test` : `13` fichiers / `74` tests unitaires Vitest sur `src/core/*`, `src/adapters/archive-file.js` et `src/adapters/sw-update.js`.
- `npm run build` : bundle Vite dans `dist/` avec méta CSP et `precache-manifest.json`.
- `npm run test:e2e` : `17` fichiers (`30` scénarios) Playwright Chromium couvrant zéro requête externe, contraste et accessibilité WCAG 2.2 AA en thèmes clair et sombre (`@axe-core/playwright`), reflow 320 px, persistance après rechargement, verrouillage multi-onglets, corbeille et notification de mise à jour SW, archives chiffrées / fusion / sélection de projets, `showSaveFilePicker`, vue `Aujourd’hui` et récurrence, calendrier et export `.ics`, notes et export `.md`, étiquettes / liens internes / modèles, tableau blanc SVG avancé et fonctionnement hors ligne sous Service Worker.
