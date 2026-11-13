# Documentation de Locavern

État documentaire mis à jour le 13 novembre 2026 pour le **Lot 1 — MVP (`0.1.0`)**, organisé selon [Diátaxis](https://diataxis.fr/).

## Documentation utilisateur

### Tutoriel

- [Créer votre premier espace de travail](tutorials/premier-espace-de-travail.md) : prise en main guidée de bout en bout (premier projet, tâche, Kanban, note et export ZIP).

### Guides pratiques (How-to)

- [Comment organiser vos projets et vos tâches](how-to/organiser-projets-et-taches.md) : gérer les projets, filtrer et trier la liste, déplacer les cartes Kanban et utiliser la palette de commandes.
- [Comment rédiger des notes avec mise en forme et images locales](how-to/rediger-notes-et-images.md) : éditeur enrichi, liens autorisés, images locales et enregistrement automatique.
- [Comment sauvegarder, restaurer ou effacer vos données](how-to/sauvegarder-et-restaurer.md) : stockage persistant, export ZIP, restauration et réinitialisation locale.
- [Comment installer Locavern et l’utiliser hors ligne](how-to/utiliser-locavern-hors-ligne.md) : installation PWA dans Chrome/Chromium et usage sans réseau.
- [Comment reprendre l’édition en présence de plusieurs onglets](how-to/reprendre-edition-multi-onglets.md) : comportement du mode lecture seule et reprise du verrou d’écriture.

### Référence utilisateur

- [Interface, vues et raccourcis clavier](reference/interface-et-raccourcis.md) : description des vues, champs, limites de saisie, commandes et raccourcis.
- [Stockage local, format d’archive et messages d’erreur](reference/stockage-limites-et-erreurs.md) : bases `IndexedDB`, structure des archives ZIP, plafonds de taille et catalogue des erreurs.

### Explication

- [Fonctionnement local, confidentialité et périmètre](explanation/fonctionnement-local-et-confidentialite.md) : modèle local-first, verrouillage multi-onglets, blocage des images distantes et lots différés.

## Pour les contributeurs

### Référence technique

- [État du dépôt](reference/etat-du-depot.md) : inventaire des fichiers présents, état applicatif et validations exécutables.
- [Décisions et avancement](reference/decisions-et-avancement.md) : contraintes retenues, choix techniques vérifiés et lots différés (`Différé` : calendrier des échéances et tableau blanc).

### Explication technique

- [Choix d’architecture](explanation/choix-architecture.md) : motivations, compromis et séparation noyau pur / adaptateurs.

Les commandes de démarrage et de vérification sont synthétisées dans [README.md](../README.md).

## Source historique

[choix-technique.md](../choix-technique.md) conserve la restitution initiale du 12 novembre 2026 ayant servi de base au cadrage.
