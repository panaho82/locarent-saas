# 06 — Parcours utilisateurs (flows)

## A. Réservation en ligne par le client final

```
Client                Page publique                    API
  │                        │                            │
  │  ouvre /booking/slug   │                            │
  │───────────────────────▶│  GET /public/booking/{slug}/config
  │                        │───────────────────────────▶│
  │                        │  404 → « Service indisponible »
  │                        │  200 → couleur, devise, activation
  │  étape 1 : dates+lien  │                            │
  │───────────────────────▶│  GET /public/booking/{slug}/vehicles?start&end
  │                        │───────────────────────────▶│  (filtre dispo + lead time + turnaround)
  │  étape 2 : véhicule    │                            │
  │───────────────────────▶│  GET …/extras, …/locations │
  │  étape 3 : coordonnées │                            │
  │───────────────────────▶│  POST …/validate-promo (option)
  │                        │  POST …/reserve            │
  │                        │   {recaptcha_token, customer, driver, extras,
  │                        │    promo_code, payment_method, accept_terms}
  │                        │───────────────────────────▶│  crée customer + driver + booking(pending)
  │                        │                            │  → email confirmation + lien check-in
  │  si paiement CB        │                            │
  │───────────────────────▶│  (PayZen JS SDK) → POST …/payment/init
  │                        │                            │
  │                        │◀── redirection page de paiement PayZen
```

Règles appliquées côté serveur :
- vérification de disponibilité **au moment de la réservation** (pas seulement à l'affichage) ;
- `online_booking_min_lead_hours` (2 h par défaut) : pas de départ dans l'heure ;
- `online_booking_turnaround_hours` (1 h) : tampon de nettoyage entre deux locations ;
- `require_manual_confirmation` → statut `pending` ;
- `online_booking_auto_decline_enabled` + `auto_decline_hours` (48 h) → refus auto si non confirmée ;
- reCAPTCHA v3 action `public_booking_reserve` ;
- prix **recalculés côté serveur** (jamais de confiance au prix envoyé par le client).

## B. Réservation au comptoir (back-office)

1. **+ Nouvelle réservation**
2. Client : recherche existante (email/tél/nom) ou création rapide (prénom, nom, email, tél +689).
3. Véhicule : liste filtrée par la période ; badge « disponible / indisponible ».
4. Dates + heures de départ/retour, lieux de prise en charge et de retour.
5. Options (services supplémentaires) et remise éventuelle (permission `booking.negotiate_rate`).
6. Récapitulatif de prix en direct → **Enregistrer**.
7. Statut initial `pending` (ou `confirmed` si l'agence confirme immédiatement).
8. Depuis la fiche : **Confirmer**, **Contrat**, **Facture**, **Modifier**, **Annuler**.

## C. Tarification (moteur de prix)

```
durée réelle ──▶ unité de facturation
     ≤ 6 jours         → days   (× tarif journalier)
     7 jours … 3 sem.  → weeks  (× tarif hebdomadaire)
     > 3 semaines      → months (× tarif mensuel)

prix = durée × tarif(unité)
     + Σ options (par jour × nb jours, ou forfait location)
     + frais de lieux (si lieux différents et lieu payant)
     − remises (montant ou %)
     = total HT (grand_total / total_price)
     + TVA (si tva_enabled) = total TTC
```

Points de vigilance repris de l'existant :
- Les tarifs sont **copiés sur la réservation** (`vehicle_daily_rate`, etc.) : l'historique ne bouge plus.
- Les options aussi (`booking_extras.name`, `unit_price` figés).
- `rental_tolerance_hours` : tolérance avant de facturer un jour de plus.
- Km : `is_unlimited_kilometers`, sinon `base_kilometers` + `extra_km_price`.
- Montants en **entiers XPF**, jamais de float (arrondi au franc).

## D. Check-in en ligne (le parcours signature)

```
Agence                    Client (mobile)                   API
  │  confirme la résa          │                              │
  │───────────────────────────▶│  email/SMS : lien /check-in/{uuid}
  │                            │─────────────────────────────▶│ GET /public/check-in/{uuid}
  │                            │◀── récap (véhicule, dates, prix, lieu)
  │                            │
  │                            │ 1. photo permis recto/verso  ─┐
  │                            │ 2. photo pièce d'identité      │ POST /public/check-in/{uuid}
  │                            │ 3. lecture du contrat (PDF)    │ (multipart + signature)
  │                            │ 4. signature au doigt          │
  │                            │ 5. nom + case « j'accepte »   ─┘
  │                            │─────────────────────────────▶│ enregistre docs, signature,
  │                            │                              │ IP, user-agent, horodatage
  │                            │                              │ génère contrat PDF + hash SHA-256
  │◀── notification « check-in complété »                      │
  │  vérifie les pièces dans l'onglet Documents                 │
```

Détails UI relevés :
- 4 blocs numérotés (1 permis, 2 pièce d'identité, 3 contrat, 4 signature).
- Chaque zone photo = un cadre pointillé cliquable « Prendre une photo » (input `capture="environment"`).
- Aperçu du contrat dans une zone grise (iframe/PDF).
- Canvas de signature avec bouton **Effacer** ; nom complet saisi à part.
- Case à cocher obligatoire ; sinon encart d'avertissement jaune.
- Bouton **Finaliser le check-in** désactivé tant que les pièces obligatoires + consentement manquent.
- Header minimal : logo agence, « Check-in en ligne », n° de réservation.
- Footer : « Une question ? email agence », « Connexion sécurisée · Propulsé par <éditeur> ».

État en base à la fin : `check_in_completed_at`, `has_signed_contract`, `contract_signed_at`,
`contract_signature_ip`, `contract_signature_name`, `contract_signature_ua`, `contract_signature_url`,
`documents` (4 lignes), `contracts` (PDF + hash).

## E. État des lieux (départ / retour)

Réalisé par l'agence sur mobile (`/admin/inspection/{bookingId}/departure|return`) ou par le client.

```
1. Km au compteur           → mileage (alerte si < dernier km connu)
2. Niveau de carburant      → fuel_level (jauge 0–100 ou fractions)
3. Propreté intérieure      → clean | dirty | very_dirty
4. Propreté extérieure      → clean | dirty | very_dirty
5. Dommages                 → clic sur une zone du schéma véhicule
                              (avant, arrière, côtés, toit, jantes, intérieur)
                              type : rayure / bosse / fissure / manquant
                              gravité : mineur / modéré / majeur
                              photo par dommage
6. Photos                   → 6 zones minimum
7. Signature client         → canvas
8. Notes libres
```

À la validation : `inspections` + `inspection_photos` + `inspection_damages`, mise à jour du
kilométrage du véhicule, statut de la réservation (`in_progress` au départ, `completed` au retour),
mise à jour des alertes kilométriques.

Le **rapport public** `/report/{uuid}` compare départ et retour côte à côte (photos, dommages, km,
carburant) — c'est la pièce utilisée en cas de litige.

## F. Contrat de location (PDF signé)

Variables du contrat (à reprendre) : agence (nom, adresse, n° TAHITI, logo), client (nom, adresse,
email, tél), conducteur (nom, permis, date de naissance), véhicule (marque, modèle, plaque, couleur,
km), dates/heures de départ et retour, lieux, durée, tarif journalier, total, km inclus / illimité,
caution, conditions générales (HTML riche des réglages), signature (image), nom du signataire,
date/heure, IP, user-agent.

Le PDF est **figé** au moment de la signature et son **hash SHA-256** est conservé : c'est la preuve
en cas de contestation. Le client peut le retélécharger depuis la page de check-in.

## G. Facturation

```
Réservation ──▶ « Facture » ──▶ brouillon (lignes reprises de la réservation)
                             ──▶ numéro FACT-{année}-{séquence} (séquence par tenant, remise à zéro annuelle)
                             ──▶ envoi email (PDF joint)
                             ──▶ paiements partiels → statut partial / paid
```

Mentions : délai d'échéance (`invoice_due_days`), conditions, pied de page, équivalent EUR optionnel,
TVA 13 % si activée, coordonnées société si `company_id` + `show_company_on_invoice`.

## H. Paiement en ligne (PayZen / OSB)

1. L'agence saisit : `site_id`, mode TEST/PROD, clé REST privée, clé publique JS, clé HMAC SHA-256.
2. Le serveur crée la transaction (`POST /bookings/{id}/payment/init` ou `/public/pay/{token}/intent`).
3. Le front charge le SDK JS PayZen avec la clé publique et le `formToken`.
4. Retour : `/public/pay/{token}/confirm` → vérification serveur → `payments` + statut facture.
5. Les clés privées ne sortent jamais de l'API (aujourd'hui : le front reçoit `payzen_has_credentials`).

## I. Appairage de l'app mobile par QR

```
Back-office (web)                              API                        Téléphone
  │ GET /auth/qr/current ─────────────────────▶│ crée qr_token (30 s)
  │◀── {token, expires_at, ttl_seconds:30}     │
  │ affiche QR (contenu = token brut)          │
  │ compte à rebours ; à 0 → régénère          │
                                              │◀── POST /auth/qr/claim {token, device}
                                              │    vérifie : non utilisé, non expiré
                                              │    crée mobile_device (expires +90 j)
                                              │──▶ {token de session, user}
  │ Paramètres → Appareils : liste, révoquer   │
```

Propriétés à conserver : token court (30 s), usage unique, rotation automatique, session longue
(90 j) mais révocable appareil par appareil, push token stocké par appareil.

## J. Impersonation (support éditeur)

`/impersonate` → `POST /public/impersonate/exchange` avec un token signé émis par le support.
Permet à l'éditeur d'entrer dans le compte d'une agence pour du support.
**À sécuriser dans la refonte** : token à durée très courte, usage unique, journalisation
obligatoire dans `activity_log`, bandeau visible « vous êtes en mode support ».

## K. Notifications

| Événement | Destinataire | Canal |
|---|---|---|
| Nouvelle réservation en ligne | agence | in-app + email |
| Réservation confirmée | client | email (+ lien check-in) |
| Réservation modifiée | client | email (`send_mail_when_updating_booking`) |
| Rappel de départ | client | email (J-1) |
| Check-in complété | agence | in-app |
| Facture envoyée | client | email + PDF |
| Contrôle technique proche | agence | in-app (dashboard + `vehicles/alerts`) |
| Réservation non confirmée depuis 48 h | agence + client | in-app + email (refus auto) |
| Paiement reçu | agence | in-app |

## L. Onboarding (5 étapes, affiché en haut du dashboard)

1. Configurer l'entreprise (`settings_configured`)
2. Ajouter un véhicule (`has_vehicles`)
3. Enregistrer un client (`has_customers`)
4. Créer une réservation (`has_bookings`)
5. Voir le planning (action, pas de flag)

Progress bar `n/5`, bouton de fermeture (mémorisé), réapparaît tant que non terminé.
