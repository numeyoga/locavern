---
version: '0.2.0'
cree_le: 2026-11-14
mis_a_jour_le: 2026-11-14
---

# Comment utiliser le tableau blanc

Ce guide explique comment créer un tableau blanc, ajouter et modifier des éléments à la souris ou au clavier, ajuster la superposition et la transparence du fond, insérer des images locales et exporter votre schéma au format SVG ou PNG. Les raccourcis complets et les limites de données sont regroupés dans [Interface, vues et raccourcis clavier](../reference/interface-et-raccourcis.md) et [Stockage local, format d’archive et messages d’erreur](../reference/stockage-limites-et-erreurs.md).

## Sommaire

- [Créer, filtrer et supprimer un tableau blanc](#créer-filtrer-et-supprimer-un-tableau-blanc)
- [Ajouter, sélectionner et modifier des éléments](#ajouter-sélectionner-et-modifier-des-éléments)
- [Gérer la superposition et la transparence du fond](#gérer-la-superposition-et-la-transparence-du-fond)
- [Utiliser le tableau blanc uniquement au clavier](#utiliser-le-tableau-blanc-uniquement-au-clavier)
- [Insérer une image locale](#insérer-une-image-locale)
- [Naviguer, annuler et exporter en SVG ou PNG](#naviguer-annuler-et-exporter-en-svg-ou-png)

## Créer, filtrer et supprimer un tableau blanc

Ouvrez la vue **Tableaux blancs** depuis la barre de navigation latérale (ou via `Ctrl+K` puis **Aller aux tableaux blancs**).

- **Créer un tableau blanc** : cliquez sur **Nouveau tableau blanc** (ou **Créer un tableau blanc** si la liste est vide, ou lancez **Créer un tableau blanc** via `Ctrl+K`), saisissez le **Titre du tableau blanc** et choisissez éventuellement le **Projet associé**, puis cliquez sur **Créer le tableau blanc**. La fenêtre s’ouvre en modale par défaut ou en tiroir latéral selon le réglage choisi dans **Préférences d’affichage** (**Visuel de saisie par écran**).
- **Renommer et associer à un projet** : modifiez directement **Titre du tableau blanc** et **Projet associé** dans l’en-tête du tableau, ou cliquez sur **Ouvrir la saisie** pour modifier ces informations dans la fenêtre de saisie configurée.
- **Filtrer et rechercher** : utilisez le menu déroulant en haut à gauche (**Tous les tableaux**, **Sans projet** ou un projet) et le champ **Rechercher un tableau blanc**.
- **Supprimer un tableau blanc** : cliquez sur **Supprimer** en pied de carte (ou dans la fenêtre de saisie), puis confirmez avec **Supprimer le tableau blanc**.

## Ajouter, sélectionner et modifier des éléments

La barre d’outils au-dessus du canevas propose sept outils d’édition. **L’outil choisi reste actif jusqu’à ce que vous en sélectionniez un autre** (ou appuyiez sur `Échap`), afin de pouvoir tracer plusieurs formes d’affilée :

1. **Sélectionner** : cliquez sur un élément pour le sélectionner, faites-le glisser pour le déplacer, double-cliquez pour éditer son texte ou glissez sur le fond pour déplacer la vue.
2. **Post-it**, **Rectangle**, **Ellipse**, **Flèche**, **Texte** : sélectionnez l’outil, puis cliquez une fois sur le canevas pour créer l’élément à la taille standard, ou cliquez-glissez pour choisir ses dimensions.
3. **Tracé libre** : cliquez-glissez sur le canevas pour dessiner à main levée autant de traits que nécessaire.

Pour changer la couleur d’un élément ou des éléments suivants, sélectionnez l’une des cinq pastilles de couleur (`Neutre`, `Accent`, `Succès`, `Avertissement`, `Danger`).

Pour modifier le texte d’un **Post-it**, d’un **Rectangle**, d’une **Ellipse** ou d’un bloc **Texte** :

- Passez sur **Sélectionner**, puis double-cliquez sur l’élément (ou sélectionnez-le et cliquez sur **Modifier le texte**) ;
- Saisissez votre texte dans la barre d’édition (jusqu’à 500 caractères ; `Maj+Entrée` insère un retour à la ligne) ;
- Validez avec **Valider** (ou `Entrée`).

## Gérer la superposition et la transparence du fond

Pour organiser plusieurs éléments qui se chevauchent ou encadrer visuellement un groupe d’éléments :

- **Changer l’ordre de superposition d’un niveau à la fois** : sélectionnez l’élément puis cliquez sur **Avancer d’un niveau** (`Page précédente`) pour le faire passer juste devant l’élément supérieur, ou sur **Reculer d’un niveau** (`Page suivante`) pour le faire passer juste derrière l’élément inférieur.
- **Rendre le fond transparent** : activez le bouton **Fond transparent** (icône damier) avant de dessiner un **Rectangle**, une **Ellipse** ou un **Post-it**, ou après avoir sélectionné un élément existant pour retirer ou rétablir son remplissage. Seule la bordure colorée reste visible et cliquable, ce qui permet de sélectionner librement les éléments situés à l’intérieur d’un cadre.

## Utiliser le tableau blanc uniquement au clavier

Toutes les opérations de création, de déplacement et d’édition fonctionnent sans glisser-déposer ni souris :

- **Créer un élément sans glisser** : sélectionnez un outil de forme dans la barre d’outils, puis activez **Ajouter au centre** (ou appuyez sur `Entrée` sur un outil déjà actif) pour placer l’élément de cet outil au centre de la zone visible (si **Sélectionner** est actif, **Ajouter au centre** insère un **Post-it**).
- **Naviguer entre les éléments** : utilisez `Tab` pour parcourir chaque élément du canevas SVG.
- **Déplacer l’élément focalisé** : utilisez les flèches directionnelles (pas de `10` unités, ou `Maj + Flèches` pour un pas fin de `1` unité).
- **Redimensionner l’élément focalisé** : utilisez `Alt + Flèches` (pas de `10` unités, ou `Alt + Maj + Flèches` pour `1` unité).
- **Modifier la superposition** : appuyez sur `Page précédente` (`PageUp`) pour avancer d’un niveau ou `Page suivante` (`PageDown`) pour reculer d’un niveau.
- **Éditer le texte** : appuyez sur `Entrée` ou `F2` sur l’élément sélectionné.
- **Supprimer l’élément** : appuyez sur `Suppr` (`Delete`) ou `Retour arrière` (`Backspace`).
- **Revenir à Sélectionner** : appuyez sur `Échap` lorsque vous utilisez un outil de dessin.

## Insérer une image locale

Locavern accepte les images locales aux formats **PNG**, **JPEG**, **WebP** et **GIF** (jusqu’à **5 Mio** par image) :

- Cliquez sur **Image locale** dans la barre d’outils du tableau blanc et choisissez un fichier ;
- Ou collez directement un fichier image (`Ctrl+V`) ou glissez-déposez-le sur le canevas.

Les images distantes (`https://…`) collées depuis le presse-papiers sont bloquées et déclenchent l’avertissement **Image distante bloquée**. Les fichiers ajoutés sont copiés dans `IndexedDB` et inclus dans les archives ZIP.

## Naviguer, annuler et exporter en SVG ou PNG

- **Historique d’édition** : cliquez sur **Annuler** (`Ctrl+Z`) ou **Rétablir** (`Ctrl+Y` / `Ctrl+Maj+Z`).
- **Zoom et panoramique** : utilisez **Zoom -**, **100 %** et **Zoom +** dans la barre d’outils, ou `Ctrl + molette` au-dessus du canevas. Avec l’outil **Sélectionner**, glissez sur une zone vide pour déplacer le canevas.
- **Sauvegarde automatique** : toute modification est enregistrée localement après `200 ms` (`Enregistré localement`). Cliquez sur **Enregistrer** pour forcer une sauvegarde immédiate.
- **Exporter une image** : cliquez sur **Exporter SVG** pour télécharger un fichier `.svg` autonome (couleurs résolues selon le thème actif, fonds transparents conservés et images locales embarquées) ou sur **Exporter PNG** pour générer un fichier `.png` localement dans votre navigateur.
