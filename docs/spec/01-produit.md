# 01 — Le produit

## En une phrase

FenuaCar est un **logiciel de gestion (SaaS) pour les agences de location de véhicules de
Polynésie française** : flotte, réservations, clients, contrats, états des lieux, facturation,
TVA, comptabilité — plus une page de réservation en ligne pour les clients finaux et une
application mobile pour le terrain.

## Utilisateurs

| Acteur | Ce qu'il fait | Où |
|---|---|---|
| **Patron / gérant** (rôle `owner`) | Voit tout, gère l'abonnement, l'équipe, les réglages | back-office |
| **Employé** (rôles + permissions granulaires) | Réservations, états des lieux, encaissements selon droits | back-office |
| **Client final** | Réserve en ligne, paie, fait son check-in, signe | page publique, mobile |
| **Équipe terrain** | Planning, états des lieux photo, signature | app Android/iOS |

Le compte `owner` est créé à l'inscription (`tenant` + `user` + `settings` + plan d'essai en une fois).
Les employés sont invités par email (`/authentication/accept-invite`).

## Les 9 modules

1. **Tableau de bord** — KPI du mois (réservations, encaissements, dépenses, TVA), départs/retours
   du jour, alertes véhicules (contrôle technique), dernières réservations/clients/factures,
   graphe encaissements vs dépenses, checklist d'onboarding en 5 étapes.
2. **Réservations** — liste filtrable, création (client + véhicule + dates + lieux + options +
   remise), fiche détaillée à onglets (infos, documents, état des lieux, caution, historique),
   confirmation / annulation / refus, génération du contrat et de la facture.
3. **Calendrier & planning** — vue mois et vue « planning flotte » (véhicules en lignes, jours en
   colonnes, glisser-déposer des réservations pour changer dates/véhicule).
4. **Clients** — particuliers et sociétés, fiche client (réservations, factures, documents),
   conducteurs (principal + supplémentaires, n° de permis), archivage.
5. **Parc automobile** — véhicules (marque, modèle, année, plaque, couleur, km, places, carburant,
   boîte, tarifs jour/semaine/mois, km inclus, prix km sup., contrôle technique, photos, catégorie,
   lieu principal), services supplémentaires, maintenance.
6. **État des lieux** — départ et retour, sur mobile : km, carburant, propreté int/ext,
   dommages localisés sur un schéma du véhicule, photos, signature ; comparaison départ/retour.
7. **Finance** — factures, devis (estimates), paiements, dépenses, cautions (dépôt de garantie),
   TVA, codes promo, rapports (encaissements/dépenses, statistiques, locations, TVA) exportables PDF.
8. **Réglages** — entreprise (logo, coordonnées, couleur), contrat (CGV en éditeur riche),
   facturation (préfixes, séquences, mentions, équivalent EUR), devis, TVA, suivi véhicules
   (alertes contrôle technique / kilométrage), réservation en ligne, paiement PayZen, équipe,
   sécurité, application mobile (QR + appareils).
9. **Abonnement** — plans, état, renouvellement, quotas (véhicules, lieux), fonctionnalités par plan.

## Ce qui est ouvert au public (sans compte)

| Route | Usage |
|---|---|
| `/` | Site marketing (features, pages légales) |
| `/booking/<slug-agence>` | Tunnel de réservation en 3 étapes : dates → véhicule → coordonnées + paiement |
| `/embed/booking/<slug>` | Le même tunnel, sans habillage, pour intégration iframe sur le site de l'agence |
| `/check-in/<token>` | Check-in client : photos permis/pièce d'identité, contrat, signature |
| `/report/<token>` | Rapport d'état des lieux partageable (lecture seule) |
| `/pay/<token>` | Page de paiement d'un acompte/solde |
| `/login`, `/register`, `/authentication/forgot-password`, `/reset-password`, `/authentication/accept-invite` | Auth |

Les tokens `check-in` et `report` sont des **UUID v4** : ils donnent accès aux données privées d'une
réservation (photos de permis, signature, contrat). C'est pour cela que l'app exclut ces URL de
l'analytics (`data-exclude="/check-in/*,/report/*"`).

## Modèle économique (relevé sur la page « Plans »)

Tous les plans : **essai gratuit 1 mois, sans engagement**, mensuel ou annuel (≈ 10 mois payés).

| Plan | Prix/mois | Limites | Positionnement |
|---|---|---|---|
| **Basique** | 1 990 XPF | 3 véhicules, 1 lieu | démarrer |
| **Essentiel** | 4 990 XPF | 10 véhicules, lieux illimités | agence en croissance |
| **PRO** (plan du compte analysé) | 7 990 XPF | véhicules/lieux illimités | complet |

Les fonctionnalités se débloquent par plan via des flags booléens :
`has_extra_services`, `has_maintenance`, `has_advanced_reports`, `has_tva_report`,
`has_advanced_pricing`, `has_full_dashboard`, `has_rental_contracts`,
`has_vehicle_inspections`, `has_online_booking`.

> Le back-office bloque l'accès aux écrans par un **guard** : si la fonctionnalité n'est pas dans le
> plan → redirection vers `/admin/subscription/plans`. Si l'abonnement est expiré → HTTP 403
> `{"error":"Subscription expired"}` → redirection vers l'état d'abonnement. Un impayé renvoie 402.

## Contexte local (à conserver absolument dans la refonte)

- Devise par défaut **XPF** (franc pacifique), sans décimales (`6 630 XPF`).
- **TVA 13 %** par défaut, module activable/désactivable.
- Îles (îles de Polynésie) comme axe de filtrage des lieux / véhicules.
- Numéros de téléphone internationaux avec indicatif **+689**.
- Contrats soumis au droit polynésien, tribunal de Papeete, routes de Polynésie française.
- Interface **100 % français** (i18n présente : `fr` par défaut, `en` disponible pour le public).
- Le fuseau utilisé par l'app est `Pacific/Tahiti` (UTC-10).

## Ce qui fait la valeur (à ne pas rater dans la v1)

1. Le **planning flotte** en glisser-déposer (c'est l'écran le plus utilisé au quotidien).
2. Le **check-in en 2 minutes** sur téléphone, sans appli à installer pour le client.
3. Le **contrat PDF signé** avec preuve (IP, user-agent, nom, horodatage).
4. Les **alertes contrôle technique** (obligation légale locale, très pénible à suivre à la main).
5. Le **lien de réservation en ligne** posé sur le site de l'agence (acquisition directe).
6. La **TVA et les rapports** prêts pour le comptable.
