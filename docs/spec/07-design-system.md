# 07 — Design system

## Polices (relevées au runtime)

| Zone | Police | Taille de base |
|---|---|---|
| Back-office | **Albert Sans** (fallback serif) | 14 px |
| Site public / connexion | **Fira Sans** | 16 px |

Recommandation : n'en garder **qu'une** (Albert Sans, ou Inter), avec une échelle 12/13/14/16/18/20/24/32.

## Couleurs

| Rôle | Valeur | Usage |
|---|---|---|
| **Primaire** | `#FFA633` (orange) | CTA, item de menu actif, accents, badges « en attente » |
| Primaire foncé | `#F7941D` | hover / pressed |
| Primaire très clair | `#FFF4E6` | fonds de badge, surlignage de ligne |
| Texte principal | `#111827` | titres |
| Texte courant | `#6D777F` | corps de texte admin |
| Texte secondaire | `#98A2B3` | labels, hints |
| Fond application | `#F8F9FA` (admin) / `#FCFBFB` (public) | |
| Surface | `#FFFFFF` | cartes, sidebar |
| Bordure | `#E5E7EB` | cartes, séparateurs |
| Succès | `#198754` | payé, confirmé, disponible |
| Info | `#0DCAF0` | en location (`in_progress`) |
| Avertissement | `#FFC107` / `#F59E0B` | en attente, contrôle technique proche |
| Danger | `#DC3545` | annulé, impayé, retard |
| Violet | `#7C3AED` | « en cours » (variante planning) |
| Noir planning | `#1F2937` | barres « réservé » |

Couleur configurable par agence : `settings.primary_color` (défaut `#2563eb`) pour le back-office,
`settings.online_booking_primary_color` (défaut `#FFA633`) pour la page publique.

## Typographie

| Élément | Taille | Graisse |
|---|---|---|
| Titre de page | 20–24 px | 700 |
| Titre de carte | 16 px | 600 |
| Corps | 14 px | 400 |
| Label de formulaire | 13 px | 500 |
| Tableau (en-tête) | 12 px | 600, majuscules (letter-spacing .03em) |
| Badge | 11–12 px | 600 |
| KPI | 24–28 px | 700 |

## Formes & espacements

- Rayon des cartes : **10 px** ; boutons : 8 px ; badges/pills : 999 px.
- Ombre : très discrète ou absente (`box-shadow: none` + bordure `#E5E7EB` sur les cartes).
- Grille : 12 colonnes, gouttière 24 px, padding de contenu 24 px.
- Sidebar : **240 px** fixe, blanche, sections en majuscules 11 px gris clair.
- Hauteur de ligne de tableau : 56–64 px.
- Icônes : Tabler Icons (admin) / Font Awesome (public).

## Composants clés à recréer

| Composant | Détail |
|---|---|
| `StatCard` | icône dans un carré coloré pastel, label, valeur, variation `+100 % vs mois dernier`, mini-sparkline |
| `BandeauBienvenue` | bloc orange dégradé, « 'Ia ora na, {prénom} », 4 boutons d'action rapide, 2 compteurs |
| `StatusBadge` | pastille + libellé, mapping statut → couleur (voir ci-dessous) |
| `DataTable` | recherche, tri, pagination, sélection multiple, actions ligne (⋯) |
| `PlanningGrid` | colonne véhicule figée, colonnes jours, barres absolues, drag & drop, tooltip détail |
| `BookingSummary` | tableau description / quantité / prix unitaire / montant TTC + total |
| `Tabs` | Informations · Documents · État des lieux · Caution · Historique |
| `SignaturePad` | canvas, bouton Effacer, export PNG |
| `PhotoCapture` | cadre pointillé, input `capture=environment`, aperçu, suppression |
| `VehicleDamageMap` | schéma véhicule (vue dessus + côtés), zones cliquables, marqueurs |
| `QrPanel` | QR 240 px, compte à rebours, bouton régénérer, badges stores |
| `OnboardingChecklist` | barre de progression `n/5`, étapes cochées, fermeture |
| `EmptyState` | icône pastel, titre, sous-titre (ex. « Aucune facture ») |

Mapping statut → couleur :

| Statut | Libellé FR | Couleur |
|---|---|---|
| `pending` | En attente | jaune / orange |
| `confirmed` | Confirmée | vert doux |
| `in_progress` | En location | bleu |
| `completed` | Terminée | gris |
| `cancelled` | Annulée | rouge |
| `declined` | Refusée | rouge |
| `expired` | Expirée | gris |

## Layout admin

```
┌──────────┬───────────────────────────────────────────────┐
│ LOGO     │  [+ Nouvelle réservation]   🌙 📊 🔔 + 👤     │  header 72 px
├──────────┼───────────────────────────────────────────────┤
│ PRINCIPAL│  Fil d'Ariane : Accueil › Tableau de bord     │
│  • item  │  ┌─────────────────────────────────────────┐  │
│          │  │  contenu (cartes 10 px, padding 24)     │  │
│ ...      │  └─────────────────────────────────────────┘  │
├──────────┴───────────────────────────────────────────────┤
│  Politique de confidentialité · CGU · Mentions légales    │
└──────────────────────────────────────────────────────────┘
```

## Layout public

- **Connexion** : 50/50. Gauche : logo, titre « Connexion », champs, CTA orange pleine largeur,
  « Mot de passe oublié ? », séparateur « OU », bouton secondaire « Créer un compte ».
  Droite : fond crème `#FFF8EF` avec formes circulaires, titre marketing, paragraphe, capture produit.
- **Check-in** : une colonne max 720 px centrée, fond `#F8F9FA`, cartes blanches, header minimal
  (logo + « Check-in en ligne » + n° réservation), footer de confiance.

## Accessibilité (à corriger dans la refonte)

- Contrastes : l'orange `#FFA633` sur blanc est **insuffisant** pour du texte (ratio ≈ 2:1) →
  l'utiliser en fond avec texte foncé, ou assombrir pour le texte.
- Les captures montrent des libellés de formulaire en gris clair : viser ≥ 4.5:1.
- Focus visible, navigation clavier sur le planning (drag & drop doit avoir une alternative).
- `aria-label` sur les boutons icônes (cloche, thème, +).
- Le QR doit avoir une alternative texte (le token) pour les lecteurs d'écran.
