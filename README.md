---
version: '0.2.0'
cree_le: 2026-11-13
mis_a_jour_le: 2026-11-14
---

# Locavern

Locavern est une application web local-first de productivité personnelle (projets, tâches en vue liste et Kanban, notes enrichies, tableau blanc SVG interactif avec images locales, import/export manuel en archive ZIP), exécutée entièrement dans le navigateur sans backend ni requête vers des domaines tiers.

## Sommaire

- [Périmètre fonctionnel](#périmètre-fonctionnel)
- [Démarrage et scripts](#démarrage-et-scripts)
- [Documentation](#documentation)
- [Licence](#licence)

## Périmètre fonctionnel

- **Projets et tâches** : création, modification, archivage, vues Liste (`DataTable`) et Kanban (glisser-déposer natif, menu d’actions et raccourcis clavier `Alt` + flèches), tiroir de détail avec liste de contrôle et échéances.
- **Notes enrichies** : éditeur Tiptap Core headless avec titres, listes, liens filtrés (`https://`, `mailto:`), listes de tâches et images locales stockées en `Blob` dans IndexedDB (blocage des images distantes).
- **Tableau blanc SVG** : canevas SVG natif avec Post-it, rectangles, ellipses, flèches, texte, tracés libres et images locales, 5 couleurs sémantiques Covenant, historique Annuler/Rétablir, zoom/panoramique, édition et déplacement complets au clavier (WCAG 2.2 AA), blocage des images distantes et export autonome `.svg` et `.png`.
- **Stockage et portabilité** : persistance IndexedDB (`idb`, schéma `v2` avec migration transparente depuis `v1`), protection multi-onglets par Web Locks (`navigator.locks`), export et restauration atomique d’archives ZIP (`manifest.json`, `data.json`, `assets/*`), mode hors ligne PWA via Service Worker et CSP stricte sans CDN.

## Démarrage et scripts

Prérequis : Node.js 24 (cf. `.nvmrc`) et npm.

```bash
npm ci
npm run dev
```

Scripts vérifiés :

- `npm run dev` : serveur de développement Vite.
- `npm run build` : empaquetage de production dans `dist/` avec CSP et `precache-manifest.json`.
- `npm run preview` : prévisualisation du build sur `http://127.0.0.1:4173`.
- `npm run typecheck` : vérification stricte des types JSDoc et `.d.ts` (`tsc -p jsconfig.json`).
- `npm run lint` : analyse statique ESLint.
- `npm run format` / `npm run format:check` : formatage Prettier.
- `npm test` : tests unitaires Vitest (`tests/unit/`).
- `npm run test:e2e` : tests navigateur Playwright et audits WCAG 2.2 AA (`@axe-core/playwright`, `tests/e2e/`).

## Documentation

- [Sommaire complet de la documentation](docs/index.md).
- **Documentation utilisateur** :
  - [Tutoriel : créer votre premier espace de travail](docs/tutorials/premier-espace-de-travail.md).
  - Guides pratiques : [projets et tâches](docs/how-to/organiser-projets-et-taches.md), [notes et images](docs/how-to/rediger-notes-et-images.md), [tableau blanc](docs/how-to/utiliser-le-tableau-blanc.md), [sauvegardes ZIP](docs/how-to/sauvegarder-et-restaurer.md), [installation hors ligne](docs/how-to/utiliser-locavern-hors-ligne.md), [mode lecture seule multi-onglets](docs/how-to/reprendre-edition-multi-onglets.md).
  - Référence utilisateur : [interface, vues et raccourcis](docs/reference/interface-et-raccourcis.md), [stockage, format ZIP et erreurs](docs/reference/stockage-limites-et-erreurs.md).
  - Explication : [fonctionnement local, confidentialité et périmètre](docs/explanation/fonctionnement-local-et-confidentialite.md).
- **Documentation technique** : [état du dépôt](docs/reference/etat-du-depot.md), [décisions et avancement](docs/reference/decisions-et-avancement.md), [choix d’architecture](docs/explanation/choix-architecture.md).

## Licence

Le dépôt est distribué sous [licence MIT](LICENSE).
