---
version: '0.2.0'
cree_le: 2026-11-15
mis_a_jour_le: 2026-11-15
---

# Comment planifier votre journée et votre calendrier

Ce guide explique comment piloter vos échéances quotidiennes depuis la vue **Aujourd’hui**, replanifier vos tâches dans la vue **Calendrier**, configurer des tâches récurrentes et exporter un agenda `.ics`. Pour les détails exhaustifs des contrôles et raccourcis, consultez [Interface, vues et raccourcis clavier](../reference/interface-et-raccourcis.md).

## Sommaire

- [Piloter la journée depuis Aujourd’hui](#piloter-la-journée-depuis-aujourdhui)
- [Planifier et reporter des tâches dans le calendrier](#planifier-et-reporter-des-tâches-dans-le-calendrier)
- [Configurer une tâche récurrente](#configurer-une-tâche-récurrente)
- [Exporter vos échéances au format iCalendar (.ics)](#exporter-vos-échéances-au-format-icalendar-ics)

## Piloter la journée depuis Aujourd’hui

Ouvrez la vue **Aujourd’hui** dans la barre latérale (ou via `Ctrl+K` puis **Aller à Aujourd’hui**).

1. Consultez les quatre indicateurs en haut de l’écran (**En retard**, **Pour aujourd’hui**, **Sous 7 jours**, **Priorités hautes**) pour évaluer la charge du jour.
2. Parcourez les sections **Tâches en retard**, **Échéances proches** (aujourd’hui et 7 prochains jours) et **Priorités hautes** :
   - Cliquez sur une ligne pour ouvrir le détail de la tâche et ajuster son échéance, sa priorité ou ses étapes ;
   - Cliquez sur le bouton **Marquer terminée** (icône coche) à droite d’une tâche pour la passer directement au statut `Terminé` (si la tâche est récurrente, Locavern crée aussitôt la prochaine occurrence).
3. Utilisez **Éléments récents** pour rouvrir rapidement l’une des huit tâches, notes ou tableaux blancs modifiés dernièrement, ou créez un élément depuis les boutons **Nouvelle tâche**, **Nouvelle note** et **Nouveau tableau blanc** de l’en-tête.

## Planifier et reporter des tâches dans le calendrier

Ouvrez la vue **Calendrier** dans la barre latérale (ou via `Ctrl+K` puis **Aller au calendrier**).

- **Changer d’échelle et naviguer** : basculez entre **Mois** et **Semaine**, avancez ou reculez avec **Précédent** et **Suivant**, ou revenez à la date courante avec **Aujourd’hui**.
- **Filtrer par projet** : sélectionnez **Tous les projets** ou un projet précis dans le menu déroulant en haut à gauche.
- **Créer une tâche à une date donnée** : cliquez sur **+** dans la case du jour souhaité (ou sur **Nouvelle tâche** dans l’en-tête pour utiliser la date ancrée actuelle).
- **Planifier une tâche sans échéance** : faites défiler jusqu’au panneau **Sans échéance** sous la grille, puis cliquez sur **Planifier aujourd’hui** ou glissez la puce de tâche sur la case du jour choisi.
- **Reporter une échéance existante** :
  - **À la souris** : glissez la carte de tâche vers une autre case de date ;
  - **Par bouton rapide** : cliquez sur `−1 j` ou `+1 j` sur la carte ;
  - **Au clavier** : placez le focus sur une tâche datée et utilisez `Alt + Flèche gauche/droite` (ou `Maj + Flèche gauche/droite`) pour décaler de `±1` jour, et `Alt + Flèche haut/bas` (ou `Maj + Flèche haut/bas`) pour décaler de `±7` jours.

## Configurer une tâche récurrente

1. Créez ou ouvrez une tâche dans son formulaire de détail.
2. Définissez idéalement une **Échéance** (date de référence pour calculer l’occurrence suivante ; à défaut, la date du jour est utilisée lors de la validation).
3. Dans **Récurrence**, sélectionnez **Quotidienne**, **Hebdomadaire** ou **Mensuelle**, puis enregistrez.

Lorsque vous passez cette tâche au statut `Terminé` (depuis la vue **Aujourd’hui**, la vue **Liste**, le tableau **Kanban** ou le formulaire de tâche), Locavern crée automatiquement l’occurrence suivante sur le premier statut configuré, décale l’échéance, remet la liste de contrôle à zéro et conserve la description, les étiquettes, les liens internes et les images locales.

## Exporter vos échéances au format iCalendar (.ics)

1. Dans la vue **Calendrier**, choisissez **Tous les projets** ou le projet à exporter dans le sélecteur de projet.
2. Cliquez sur **Exporter (.ics)**.
3. Enregistrez le fichier `locavern-<projet|echeances>-AAAA-MM-JJ.ics` via le sélecteur de fichier natif ou le téléchargement navigateur.

Le fichier généré contient un événement journée entière (`VALUE=DATE`) pour chaque tâche filtrée possédant une date d’échéance, avec son statut, sa priorité, sa description et sa liste de contrôle. Importez ce fichier `.ics` dans votre agenda personnel si vous souhaitez consulter vos échéances hors de Locavern.
