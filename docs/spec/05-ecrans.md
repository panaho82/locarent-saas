# 05 — Inventaire des écrans

Captures : [`../recon/shots/`](../recon/shots). Le DOM complet de chaque écran admin est dans
[`../recon/html/`](../recon/html), le texte dans [`../recon/text/`](../recon/text).

## Structure de navigation du back-office

Sidebar à 5 sections, fond blanc, item actif surligné orange, pied de page légal.

```
PRINCIPAL
  Tableau de bord        /admin/index
  État des lieux         /admin/inspections          [feature: vehicle_inspections]
RÉSERVATIONS
  Réservations           /admin/reservations
  Calendrier             /admin/calendar
  Planning               /admin/planning
GESTION
  Clients                /admin/customers
  Lieux                  /admin/locations
PARC AUTOMOBILE
  Véhicules              /admin/cars
  Services supplémentaires /admin/extra-services     [feature: extra_services]
  Maintenance            /admin/maintenance          [feature: maintenance]
FINANCE & COMPTABILITÉ
  Factures               /admin/invoices             [perm: invoice.view]
  Devis                  /admin/quotations
  Paiements              /admin/payments             [perm: payment.view]
  Dépenses               /admin/expenses             [perm: expense.view]
RAPPORTS
  Encaissements & Dépenses /admin/earnings-report    [feature: advanced_reports]
  Statistiques           /admin/income-report        [feature: advanced_reports]
  Locations              /admin/rental-report        [feature: advanced_reports]
  Rapport TVA            /admin/tva-report           [feature: tva_report]
MON ABONNEMENT
  Plans disponibles      /admin/subscription/plans
  État de l'abonnement   /admin/subscription/status
  Aide                   /admin/help
```

En haut à droite : bouton **+ Nouvelle réservation**, bascule thème clair/sombre, stats rapides,
cloche de notifications, menu compte (franck / email / **Déconnexion**).

## Écrans admin (40)

| # | Écran | Ce qu'il contient | Capture |
|---|---|---|---|
| 1 | Tableau de bord | bandeau orange de bienvenue, 4 KPI (réservations, encaissements, dépenses, module TVA), « État des lieux du jour » (départs/retours), alertes véhicules (contrôle technique), réservations récentes, graphe encaissements vs dépenses, clients récents, maintenance, factures récentes, checklist onboarding 5 étapes | [index.png](../recon/shots/index.png) |
| 2 | Réservations | filtres (période, statut, recherche), tableau paginé, badges de statut, actions rapides | [reservations.png](../recon/shots/reservations.png) |
| 3 | Nouvelle réservation | formulaire en sections : client (existant ou rapide), véhicule, dates/heures, lieux, options, remise, notes, récap prix live | [add-reservation.png](../recon/shots/add-reservation.png) |
| 4 | Détail réservation | en-tête (#B-2026-00991, statut, « Check-in en attente »), boutons Contrat / Facture, bandeau d'action « Confirmer », onglets **Informations · Documents · État des lieux · Caution · Historique**, tableau de facturation | [det-reservation.png](../recon/shots/det-reservation.png) |
| 5 | Modifier réservation | même formulaire pré-rempli | [det-reservation-edit.png](../recon/shots/det-reservation-edit.png) |
| 6 | Calendrier | vue mois, réservations par jour, couleurs par statut | [calendar.png](../recon/shots/calendar.png) |
| 7 | Planning | grille véhicules × jours, barres de réservation colorées, glisser-déposer, filtres statut/lieu | [planning.png](../recon/shots/planning.png) |
| 8 | Devis | liste, statuts, conversion en réservation | [quotations.png](../recon/shots/quotations.png) |
| 9 | Clients | liste particuliers/sociétés, colonnes (nom, contact, réservations, actions), filtre archivés | [customers.png](../recon/shots/customers.png) |
| 10 | Fiche client | coordonnées, conducteurs, réservations, factures, documents | [det-customer.png](../recon/shots/det-customer.png) |
| 11 | Sociétés clientes | facturation entreprise, n° fiscal | [customers-companies.png](../recon/shots/customers-companies.png) |
| 12 | Lieux | agences, adresse, horaires, frais, public/privé, défaut | [locations.png](../recon/shots/locations.png) |
| 13 | Véhicules | cartes/tableau, photo, plaque, tarifs, statut, alerte CT | [cars.png](../recon/shots/cars.png) |
| 14 | Ajouter un véhicule | formulaire complet + upload photos + dommages sur schéma | [add-car.png](../recon/shots/add-car.png) |
| 15 | Fiche véhicule | infos, tarifs, historique, dommages, documents, activités | [det-car.png](../recon/shots/det-car.png) |
| 16 | Services supplémentaires | options payantes (GPS, siège bébé…), prix/jour ou /location | [extra-services.png](../recon/shots/extra-services.png) |
| 17 | Maintenance | interventions, coûts, prochaine échéance km/date | [maintenance.png](../recon/shots/maintenance.png) |
| 18 | État des lieux | planning des départs/retours du jour, filtres, accès au wizard | [inspections.png](../recon/shots/inspections.png) |
| 19 | Factures | liste, statuts, montants, PDF, envoi | [invoices.png](../recon/shots/invoices.png) |
| 20 | Paiements | encaissements, méthodes, références | [payments.png](../recon/shots/payments.png) |
| 21 | Dépenses | catégories, justificatifs | [expenses.png](../recon/shots/expenses.png) |
| 22 | Encaissements & Dépenses | rapport période, graphe, export PDF | [earnings-report.png](../recon/shots/earnings-report.png) |
| 23 | Statistiques | taux d'occupation, revenus, top véhicules | [income-report.png](../recon/shots/income-report.png) |
| 24 | Locations | rapport par location/véhicule | [rental-report.png](../recon/shots/rental-report.png) |
| 25 | Rapport TVA | base HT, TVA collectée, période | [tva-report.png](../recon/shots/tva-report.png) |
| 26 | Plans | 3 cartes tarifaires, mensuel/annuel, features cochées/croisées | [subscription-plans.png](../recon/shots/subscription-plans.png) |
| 27 | État de l'abonnement | plan courant, essai, prochaine échéance, quotas, historique | [subscription-status.png](../recon/shots/subscription-status.png) |
| 28 | Aide | FAQ / contact support | [help.png](../recon/shots/help.png) |
| 29 | Sécurité | mot de passe, sessions | [set-security.png](../recon/shots/set-security.png) |
| 30 | Entreprise | logo, nom, coordonnées, couleur principale | [set-company.png](../recon/shots/set-company.png) |
| 31 | Contrat | éditeur riche des CGV (ProseMirror), aperçu PDF | [set-contract.png](../recon/shots/set-contract.png) |
| 32 | Facturation | préfixe, séquence, délai, mentions, équivalent EUR | [set-invoice.png](../recon/shots/set-invoice.png) |
| 33 | Devis | idem pour les devis | [set-estimate.png](../recon/shots/set-estimate.png) |
| 34 | TVA | activation, taux par défaut, mentions | [set-tva.png](../recon/shots/set-tva.png) |
| 35 | Suivi des véhicules | alertes contrôle technique (délai), alertes kilométrage | [set-vehicle-monitoring.png](../recon/shots/set-vehicle-monitoring.png) |
| 36 | Réservation en ligne | activation, lien public, politiques (délai min, auto-refus, turnaround), apparence (couleur), intégration iframe | [set-online-booking.png](../recon/shots/set-online-booking.png) |
| 37 | Paiement en ligne | PayZen : site id, mode, clé REST, clé publique, HMAC | [set-payment.png](../recon/shots/set-payment.png) |
| 38 | Codes promo | code, type, valeur, limites, validité | [set-promo-codes.png](../recon/shots/set-promo-codes.png) |
| 39 | Équipe | membres, rôles, permissions, invitations | [set-team.png](../recon/shots/set-team.png) |
| 40 | Connecter l'app mobile | QR rotatif 30 s + compte à rebours + badges stores | [set-mobile-connect.png](../recon/shots/set-mobile-connect.png) |
| 41 | Appareils mobiles | tableau nom/modèle/plateforme/dernière activité/push/déconnecter | [set-mobile-devices.png](../recon/shots/set-mobile-devices.png) |

## Écrans publics

| Écran | Contenu | Capture |
|---|---|---|
| Accueil marketing | hero, features, témoignages, tarifs, footer légal | [public-home.png](../recon/shots/public-home.png) |
| Connexion | split screen : formulaire à gauche, argumentaire + capture produit à droite, CTA orange | [01-login.png](../recon/shots/01-login.png) |
| Inscription | même layout, onglets signin/signup | [public-register.png](../recon/shots/public-register.png) |
| Réservation en ligne | tunnel 3 étapes (dates → véhicule → confirmation), header agence, badge « Réservation sécurisée » | [public-booking.png](../recon/shots/public-booking.png) (ici désactivée → « Service indisponible ») |
| Check-in | récap réservation, 4 blocs : permis (recto/verso), pièce d'identité, contrat (aperçu), signature + nom + consentement | [public-checkin.png](../recon/shots/public-checkin.png) |
| Rapport d'état des lieux | véhicule, client, dommages départ/retour, photos | [public-report.png](../recon/shots/public-report.png) |

## Application mobile (captures officielles)

[`../recon/shots/app/`](../recon/shots/app) — 5 captures Play Store (1200×2597) :
tableau de bord du jour, réservations, planning, état des lieux, scan QR.

## Écrans du template à ne PAS reproduire

Le bundle contient ~60 écrans de démonstration du template acheté (`/admin/base-ui/*`,
`/admin/advanced-ui/*`, `/admin/forms/*`, `/admin/table/*`, `/admin/icon/*`, `/admin/charts/*`,
`/admin/maps/*`). Ils sont inaccessibles depuis le menu et n'ont aucune valeur produit.
Ils représentent néanmoins ~40 % du poids JS : une refonte bien faite les élimine.
