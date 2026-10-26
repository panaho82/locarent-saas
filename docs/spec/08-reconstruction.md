# 08 — Plan de reconstruction

## Décision n°1 : refaire, ou racheter ?

Le produit observé est mature (40+ écrans, contrats, TVA, PayZen, app mobile, multi-tenant).
Le refaire à l'identique coûte **4 à 6 mois** à une équipe de 2 développeurs.
Trois stratégies réalistes :

| Stratégie | Délai | Coût | Risque |
|---|---|---|---|
| **A. Clone fonctionnel complet** | 4–6 mois | élevé | élevé (paiement, contrats, mobile) |
| **B. MVP ciblé « location + check-in »** | 6–10 semaines | moyen | faible — c'est ce qui rapporte |
| **C. Reprise du code existant** | — | — | impossible : code minifié, propriétaire |

**Recommandation : B**, puis absorption progressive des modules finance/TVA/mobile.
Le cœur de valeur est : *flotte → réservation → contrat signé → état des lieux → facture*.
Le reste (TVA, rapports, abonnement) peut venir en phase 2.

## Décision n°2 : stack

### Option recommandée — TypeScript de bout en bout

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | un seul repo, SSR pour la page publique (SEO), server actions pour le back-office |
| Langage | TypeScript strict | le modèle de données est complexe, les types évitent 80 % des bugs |
| UI | Tailwind CSS + shadcn/ui | reproduit vite le design system, accessible par défaut |
| Base | **PostgreSQL 16** + Prisma | JSONB pour `permissions`, `discounts`; migrations versionnées |
| Auth | Auth.js (credentials) + cookie httpOnly | pas de token en localStorage |
| PDF | `@react-pdf/renderer` ou Puppeteer | contrat + facture |
| Fichiers | S3 compatible (Scaleway/OVH) + URLs signées | photos de permis = données sensibles |
| Paiement | PayZen (même PSP, adapté au Fenua) | continuité locale |
| Mobile | **Expo / React Native** (ou PWA d'abord) | réutilise les mêmes types/API |
| Emails | Resend ou Brevo | |

### Option « proche de l'existant »

Angular 19 + Laravel 11 + MySQL — pertinent seulement si vous reprenez une équipe déjà formée
sur ces technologies. Sinon, aucun intérêt à copier la stack d'origine.

### Ce qu'il faut améliorer par rapport à l'existant

1. **Sécurité** : cookie httpOnly (au lieu de `localStorage`), rate limiting, audit log,
   secrets chiffrés en base, webhooks signés.
2. **Performance** : supprimer les ~60 écrans de démo du template (≈ 40 % du bundle).
3. **Mobile** : PWA d'abord (installation sans store, mises à jour instantanées) ; app native
   seulement pour le scan caméra et les push.
4. **Testabilité** : l'existant n'expose aucun test ; viser les règles de prix et de disponibilité
   en tests unitaires (c'est là que les bugs coûtent de l'argent).
5. **Accessibilité** : contrastes, navigation clavier, alternatives au drag & drop.
6. **Observabilité** : logs structurés + Sentry + alerte sur les erreurs 5xx.

## Découpage en lots

### Lot 0 — Socle (1 semaine)
- Monorepo, CI, environnements (local / staging / prod), Postgres, S3, emails transactionnels.
- Schéma `db/schema.sql` migré en Prisma, seed de démo.
- Auth : inscription agence, login, invitation, rôles + permissions, middleware de tenancy.
- Layout admin (sidebar, header, thème), composants de base (cards, tables, badges, formulaires).
- **Livrable** : on se connecte, on voit un dashboard vide.

### Lot 1 — Flotte & clients (1,5 semaine)
- CRUD véhicules (photos, tarifs, catégorie, lieu, contrôle technique), catégories, lieux, options.
- CRUD clients + conducteurs + sociétés.
- Import du catalogue de marques (fourni plus tard / API publique).
- **Livrable** : une agence peut saisir son parc et ses clients.

### Lot 2 — Réservations & planning (2 semaines) ← le cœur
- Moteur de prix (jours/semaines/mois, options, frais, remises, TVA) + tests unitaires.
- Création/édition de réservation, détection de conflits (turnaround), confirmation/annulation.
- Liste filtrable + calendrier mois.
- **Planning flotte** avec glisser-déposer.
- **Livrable** : l'agence travaille au quotidien.

### Lot 3 — Contrat & check-in (2 semaines) ← le différenciateur
- Génération PDF du contrat (modèle + CGV éditables).
- Page publique `/check-in/{token}` : photos permis/ID (upload direct S3), aperçu contrat,
  signature canvas, consentement.
- Stockage du hash SHA-256, IP, user-agent ; notification à l'agence.
- Page `/report/{token}` (rapport d'état des lieux).
- **Livrable** : plus de papier, plus de scan.

### Lot 4 — États des lieux (1,5 semaine)
- Wizard départ/retour : km, carburant, propreté, schéma de dommages, photos, signature.
- Comparaison départ/retour, mise à jour du kilométrage, alertes.
- **Livrable** : litiges couverts.

### Lot 5 — Facturation & paiement (2 semaines)
- Factures/devis, numérotation par tenant, PDF, envoi email.
- Paiements (espèces, virement, carte), cautions, relances.
- PayZen : clés, init, confirmation, webhook signé.
- **Livrable** : encaissement complet.

### Lot 6 — Page publique de réservation (1,5 semaine)
- Tunnel 3 étapes, disponibilité temps réel, options, code promo, paiement ou paiement sur place.
- Mode `embed` (iframe) + couleurs de l'agence + SEO/OG.
- **Livrable** : acquisition directe.

### Lot 7 — Mobile (3 semaines)
- PWA : planning, états des lieux photo, check-in assisté.
- Appairage QR (token 30 s → session 90 j révocable), push.
- **Livrable** : le terrain travaille sans ordinateur.

### Lot 8 — Abonnement & back-office éditeur (2 semaines)
- Plans, essai, quotas, gating des features, page de statut, facturation de l'abonnement.
- Admin éditeur : agences, impersonation journalisée, statistiques.

### Lot 9 — Finance avancée & TVA (2 semaines)
- Rapports (encaissements/dépenses, statistiques d'occupation, locations, TVA), exports PDF/CSV.
- Rapprochement bancaire simple.

**Total MVP (lots 0 → 5) : ~10 semaines. Produit complet : ~18 semaines.**

## Réutilisation possible du dossier

| Élément | Utilisable directement |
|---|---|
| `db/schema.sql` | oui (Postgres), à adapter en Prisma |
| `spec/04-api.md` | oui comme contrat d'API |
| `spec/03-modele-donnees.md` | oui (règles métier) |
| Libellés FR (`recon/text/`, `recon/i18n-fr.json`) | oui pour l'UI, à relire |
| Captures d'écran | oui comme **référence de travail**, pas à publier |
| CSS / bundles | non (propriétaires, minifiés) |
| Logo, nom, CGV, photos | **non** (voir ci-dessous) |

## Propriété intellectuelle

Ce qui a été analysé relève de l'**observation de fonctionnalités** (idées, parcours, structure de
données) — en principe librement réutilisable. En revanche, sont protégés et **ne doivent pas être
copiés** :

- la marque **FenuaCar**, son logo et sa charte graphique ;
- les **CGV types** rédigées dans leur outil (texte littéraire) → faire rédiger les vôtres ;
- les **photos** de véhicules, les visuels marketing, les captures d'écran publiées ;
- le **code source** (même minifié) et les fichiers CSS ;
- la **base de marques** avec logos (droits des constructeurs).

Ce dossier décrit donc des **spécifications fonctionnelles**, pas une copie d'actifs.
Faites valider le nom et la charte par un conseil en propriété industrielle avant lancement
(dépôt de marque en Polynésie française + extension).

## Risques à anticiper

| Risque | Mitigation |
|---|---|
| Données personnelles (permis, carte d'identité, signature) | chiffrement au repos, URLs signées à durée courte, purge après N mois, registre RGPD, hébergement UE/Polynésie |
| Paiement carte en Polynésie | PayZen/OSB est le bon choix local ; prévoir un mode « paiement à l'agence » par défaut |
| Connexion internet instable sur les îles | PWA offline-first pour les états des lieux, file d'attente de synchronisation |
| Litige client | hash du contrat signé, photos horodatées, journal d'audit |
| Dépendance à un seul PSP | abstraire une interface `PaymentProvider` |
| Reprise de l'existant | prévoir un import CSV (clients, véhicules, réservations) et une période de double saisie |

## Prochaine étape concrète

1. Valider le périmètre du MVP (lots 0 → 5) et la stack.
2. Choisir le nom + le logo (nouvelle marque).
3. Ouvrir le repo, appliquer `db/schema.sql`, brancher l'auth, et livrer le Lot 0 en une semaine.
