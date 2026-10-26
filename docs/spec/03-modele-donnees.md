# 03 — Modèle de données

Le schéma SQL exécutable est dans [`../db/schema.sql`](../db/schema.sql).
Toutes les tables métier portent `tenant_id` (isolation stricte par agence).

## Vue d'ensemble

```
plans ──< subscriptions >── tenants ──< users ──< mobile_devices
                              │            └──< invitations
                              ├── settings (1-1)
                              ├── locations ──< vehicles >── vehicle_images
                              │                    └──< vehicle_damages
                              ├── vehicle_categories, brands (catalogue global)
                              ├── customers ──< drivers
                              ├── companies
                              ├── bookings ──< booking_extras
                              │        ├──< booking_drivers
                              │        ├──< booking_discounts
                              │        ├──< inspections ──< inspection_photos
                              │        │                 └──< inspection_damages
                              │        ├──< invoices ──< invoice_lines
                              │        └──< payments
                              ├── estimates ──< estimate_lines
                              ├── expenses, maintenance, promo_codes, notifications
                              └── activity_log
```

## 1. Comptes & abonnement

### `tenants` — l'agence
`id`, `slug` (ex. `raiatea-rent-car-CYcUmp` — suffixe aléatoire pour éviter les collisions et
l'énumération), `name`, `manager_name`, `email`, `phone`, `tahiti_number`, `address`, `city`,
`zipcode`, `country` (`PF`), `island`, `logo_path`, `logo_url`, `created_at`.

### `users` — l'équipe
`id`, `tenant_id`, `name`, `email` (unique par tenant), `password` (Argon2id), `role`
(`owner` | `admin` | `member`), `permissions` (JSON : liste de chaînes, voir ci-dessous),
`is_founder`, `is_deactivated`, `deactivated_at`, `last_login_at`, `remember_token`.

**Permissions observées (40+)** — regroupées par domaine :
`booking.{view,create,edit,delete,confirm,cancel,negotiate_rate}`,
`inspection.{view,create,edit}`, `contract.{print,download}`,
`customer.{view,create,edit,delete}`, `driver.{view,create,edit}`,
`vehicle.{view,create,edit,delete}`, `maintenance.{view,create,edit}`,
`invoice.{view,create,edit,send,delete}`, `payment.{view,record,refund}`,
`estimate.{view,create,edit,delete,convert}`, `expense.{view,create,edit,delete}`,
`report.finance.view`, `settings.{view,edit}`,
`catalog.view`, `user.{view,invite,edit,remove}`,
`subscription.{view,manage}`.

### `invitations`
`id`, `tenant_id`, `email`, `role`, `permissions`, `token` (unique), `expires_at`, `accepted_at`.

### `mobile_devices`
`id`, `tenant_id`, `user_id`, `name` (ex. `24117RN76O`), `model` (`tanzanite`), `platform`
(`android`|`ios`), `push_token`, `has_push`, `last_seen_at`, `expires_at` (**+90 jours**),
`revoked_at`.

### `qr_tokens`
`id`, `user_id`, `token` (48 chars aléatoires, unique), `expires_at` (**+30 s**), `used_at`.
Un token = un usage. Régénéré automatiquement à expiration.

### `plans` / `subscriptions`
`plans` : `name`, `slug`, `monthly_price`, `yearly_price`, `max_vehicles`, `max_locations`,
et les flags `has_*` (voir [`01-produit.md`](01-produit.md#modèle-économique)).
`subscriptions` : `tenant_id`, `plan_id`, `status` (`trial`|`active`|`past_due`|`cancelled`|`expired`),
`billing_period` (`monthly`|`yearly`), `payment_method`, `current_price`,
`trial_start_date`, `trial_end_date`, `current_period_start`, `current_period_end`,
`next_renewal_date`, `cancel_at_period_end`, `cancels_at`, `stripe_id`/`payzen_ref`.

> Le plan analysé : **PRO**, `trial`, 7 990 XPF/mois, essai du 20/10/2026 au 19/11/2026.

## 2. Réglages `settings` (1 ligne par tenant)

Tous les champs observés (37 colonnes), regroupés par thème :

| Thème | Champs |
|---|---|
| Entreprise | `company_tagline`, `primary_color` (défaut `#2563eb`), logo via `tenants` |
| Facturation | `invoice_prefix` (`FACT-`), `last_invoice_sequence`, `next_invoice_number`, `invoice_due_days` (30), `invoice_date_prefix`, `invoice_show_eur_equivalent`, `invoice_default_terms`, `invoice_footer_text` |
| Devis | `estimate_prefix` (`DEVIS-`), `last_estimate_sequence`, `estimate_due_days`, `estimate_date_prefix`, `estimate_default_terms`, `estimate_show_eur_equivalent` |
| Contrat | `contract_conditions` (HTML riche, CGV) |
| Emails | `send_booking_confirmations`, `send_mail_when_updating_booking`, `send_invoice_notifications`, `require_manual_confirmation`, `auto_decline_hours` (24) |
| Réservation en ligne | `online_booking_enabled`, `online_booking_allow_offline_payment`, `online_booking_allow_online_payment`, `online_booking_auto_decline_enabled`, `online_booking_auto_decline_hours` (48), `online_booking_min_lead_hours` (2), `online_booking_turnaround_hours` (1), `online_booking_primary_color` (`#FFA633`) |
| Paiement | `enable_offline_payments`, `payzen_site_id`, `payzen_public_key`, `payzen_mode` (`TEST`/`PROD`), `payzen_rest_endpoint`, `payzen_enabled_for_email` |
| Fiscalité | `default_currency` (`XPF`), `default_tax_rate` (`13.00`), `tva_enabled` |
| Flotte | `dtt_alerts_enabled`, `dtt_alert_lead_days` (30), `mileage_alerts_enabled`, `mileage_alert_interval_km` |
| Divers | `rental_tolerance_hours`, `onboarding_completed` |

⚠️ Les secrets PayZen (clé REST, HMAC) ne sont **jamais renvoyés** au navigateur :
l'API expose seulement `payzen_has_credentials` et les champs publics.

## 3. Parc automobile

### `vehicles`
`id`, `tenant_id`, `name` (nom commercial), `license_plate`, `make`, `brand_id`, `model`, `year`,
`color` (slug du référentiel `colors`), `mileage`, `seats`, `fuel_type`
(`petrol`|`diesel`|`electric`|`hybrid`), `transmission_type` (`manual`|`automatic`), `status`
(`available`|`rented`|`maintenance`|`inactive`), `next_technical_control_date`, `dtt_alert_state`
(`ok`|`due_soon`|`overdue`), `last_mileage_alert_at_km`, `daily_rate`, `weekly_rate`,
`monthly_rate`, `base_kilometers` (km inclus), `extra_km_price`, `is_active`,
`main_location_id`, `category_id`.

Relations : `brand`, `category`, `main_location`, `featured_image`, `gallery_images[]`, `damages[]`.

### `vehicle_images`
`id`, `vehicle_id`, `path`, `url`, `is_featured`.

### `vehicle_damages`
Dommages « permanents » du véhicule (rayures, chocs) reportés sur le schéma : `id`, `vehicle_id`,
`zone` (identifiant de zone du schéma), `severity`, `description`, `photo_path`, `repaired_at`.

### Référentiels globaux
- `brands` : ~380 marques avec `logo_url` (`/api/brands/{id}/logo`), `is_visible`.
- `colors` : `slug`, `name` FR, `hex`, `is_visible`.
- `vehicle_categories` : **par tenant** (`Auto`, `Scooter`, `Utilitaire`).

### `locations` — agences/points de prise en charge
`name`, `address`, `opening_hours`, `price` (frais de prise en charge), `is_free`, `is_public`,
`is_default`, `island`.

### `extra_services` — options payantes
`name`, `description`, `price`, `price_type` (`per_day`|`per_rental`), `is_active`, `max_qty`.

### `maintenance`
`vehicle_id`, `type` (`service`|`repair`|`tires`|`technical_control`…), `title`, `description`,
`cost`, `mileage`, `performed_at`, `next_due_date`, `next_due_mileage`, `status`, `garage`.

## 4. Clients

### `customers`
`type` (`private`|`company`), `is_insurance`, `source` (`admin`|`online`), `first_name`,
`last_name`, `contact_name`, `email`, `phone`, `phone_code` (`+689`), `address`, `zipcode`,
`city`, `country`, `notes`, `archived_at`, `documents_count` (calculé), `rents_count` (calculé).

### `drivers`
`customer_id`, `first_name`, `last_name`, `date_of_birth`, `gender`, `license_card_number`,
`license_issued_at`, `license_expires_at`, `license_country`, `is_main`.

> Règle métier du contrat : conducteur **≥ 18 ans**, permis valide **depuis ≥ 2 ans**,
> pièce d'identité en cours de validité.

### `companies` — sociétés clientes (facturation)
`name`, `contact_name`, `email`, `phone`, `address`, `zipcode`, `city`, `country`, `tax_id`
(identifiant fiscal / n° TAHITI), `notes`. Une réservation peut être facturée à une société
(`booking.company_id` + `show_company_on_invoice`).

### `documents`
Pièces jointes client : `customer_id`, `booking_id` (optionnel), `type`
(`license_front`|`license_back`|`id_front`|`id_back`|`passport`|`other`), `path`, `mime`,
`size`, `uploaded_at`.

## 5. Réservations — le cœur du modèle

### `bookings`
| Groupe | Champs |
|---|---|
| Identité | `booking_number` (**`B-{année}-{séquence 5}`**, ex. `B-2026-00991`), `status` (`pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `declined`, `expired`), `source` (`admin`\|`online`\|`phone`), `created_by` |
| Parties | `customer_id`, `company_id`, `show_company_on_invoice`, `vehicle_id`, `pickup_location_id`, `dropoff_location_id` |
| Dates | `start_date`, `start_time`, `end_date`, `end_time`, `rental_days` |
| Km | `base_kilometers`, `extra_km_price`, `is_unlimited_kilometers` |
| Tarifs figés | `vehicle_daily_rate`, `vehicle_weekly_rate`, `vehicle_monthly_rate` (copiés du véhicule **au moment de la réservation**), `negotiated_rates` (JSON si tarif négocié) |
| Durée | `duration_unit` (`days`\|`weeks`\|`months`), `duration_value` |
| Montants | `vehicle_total`, `extras_total`, `pickup_location_fee`, `dropoff_location_fee`, `discounts` (JSON), `vehicle_tax_rate`, `grand_total`, `total_price`, `tax_rate`, `tax_amount`, `total_with_tax` |
| Notes | `notes` (client), `internal_notes` (agence) |
| Check-in | `check_in_token` (UUID), `check_in_url`, `check_in_completed_at`, `handed_over_at`, `returned_at` |
| Contrat | `contract_signed_at`, `contract_signature_ip`, `contract_signature_name`, `contract_signature_ua`, `contract_signature_url`, `has_signed_contract` |
| Rapport | `public_report_token` (UUID), `public_report_url` |
| Caution | `caution_collected`, `caution_amount`, `caution_collected_at`, `caution_comments`, `caution_contract_notes`, `caution_released_at`, `caution_refund_amount`, `caution_refund_comments` |

Le **gel des tarifs** sur la réservation est essentiel : si l'agence change le prix du véhicule
demain, les réservations passées ne bougent pas.

### Tables filles
- `booking_extras` : `booking_id`, `extra_service_id`, `name` (figé), `unit_price` (figé), `qty`,
  `price_type`, `total`.
- `booking_drivers` : `booking_id`, `driver_id`, `is_main`.
- `booking_discounts` : `booking_id`, `label`, `type` (`amount`|`percent`), `value`, `amount`.

### `inspections` — état des lieux
`booking_id`, `type` (`departure`|`return`), `mileage`, `fuel_level` (0–100 ou fractions 1/8…1),
`cleanliness_interior` (`clean`|`dirty`|`very_dirty`), `cleanliness_exterior` (idem), `notes`,
`completed_at`, `completed_by`, `signature_path`, `customer_signature_name`.

- `inspection_photos` : `inspection_id`, `zone` (avant/arrière/côté gauche/droit/intérieur/compteur),
  `path`, `taken_at`.
- `inspection_damages` : `inspection_id`, `zone`, `type` (`scratch`|`dent`|`crack`|`missing`),
  `severity`, `description`, `photo_path`.

### `contracts` — PDF et preuve de signature
`booking_id`, `version`, `pdf_path`, `pdf_hash` (SHA-256), `signed_at`, `signer_name`,
`signer_ip`, `signer_user_agent`, `signature_image_path`.

## 6. Finance

### `invoices`
`invoice_number` (`FACT-{année}-{séquence}`), `booking_id`, `customer_id`, `company_id`,
`status` (`draft`|`sent`|`paid`|`partial`|`overdue`|`cancelled`), `issued_at`, `due_at`,
`subtotal`, `tax_rate`, `tax_amount`, `discount`, `total`, `amount_paid`, `balance`,
`notes`, `terms`, `pdf_path`, `sent_at`.
`invoice_lines` : `label`, `qty`, `unit_price`, `tax_rate`, `total`.

### `estimates` (devis)
Même structure, préfixe `DEVIS-`, statuts `draft`|`sent`|`accepted`|`declined`|`expired`,
plus `converted_booking_id` (permission `estimate.convert`).

### `payments`
`booking_id`, `invoice_id`, `amount`, `method` (`cash`|`card`|`transfer`|`check`|`payzen`),
`status` (`pending`|`completed`|`refunded`), `paid_at`, `reference` (n° transaction PayZen),
`notes`, `recorded_by`.

### `expenses`
`category`, `label`, `amount`, `tax_amount`, `date`, `supplier`, `payment_method`,
`vehicle_id` (optionnel), `attachment_path`.

### `promo_codes`
`code` (unique par tenant), `type` (`percent`|`amount`), `value`, `min_amount`, `max_uses`,
`used_count`, `starts_at`, `ends_at`, `is_active`.

## 7. Divers

### `notifications`
`user_id`, `type`, `title`, `message`, `data` (JSON), `read_at`, `created_at`.
Endpoints : `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/mark-all-read`.

### `activity_log`
`tenant_id`, `user_id`, `action`, `subject_type`, `subject_id`, `properties` (JSON), `ip`, `created_at`.
(absent chez eux, **fortement recommandé** : litige, caution, contrat signé.)

### `onboarding_progress`
Calculé, pas stocké : `settings_configured`, `has_vehicles`, `has_customers`, `has_bookings`
→ « 4/5 » sur le tableau de bord.

## Règles métier à implémenter

### Tarification
```
1. durée : selon duration_unit
     days   → valeur = nb de jours (arrondi selon rental_tolerance_hours)
     weeks  → valeur = nb de semaines
     months → valeur = nb de mois
2. prix véhicule :
     days   → duration_value × vehicle_daily_rate
     weeks  → duration_value × vehicle_weekly_rate
     months → duration_value × vehicle_monthly_rate
   (si tarif négocié → negotiated_rates, permission booking.negotiate_rate)
3. + extras_total (per_day × jours, ou per_rental)
4. + frais de lieux (pickup/dropoff si location payante et différente)
5. − discounts (montant ou %)
6. = grand_total / total_price
7. tax_amount = total_price × tax_rate / 100   (si tva_enabled)
8. total_with_tax = total_price + tax_amount
```
Tous les montants sont **en entiers XPF** (pas de centimes).

### Disponibilité d'un véhicule
Un véhicule est indisponible si une réservation de statut `pending`, `confirmed` ou `in_progress`
chevauche la période demandée, **augmentée de `online_booking_turnaround_hours`** (nettoyage entre
deux locations). La recherche publique applique en plus `online_booking_min_lead_hours` (délai
minimum avant le départ).

### Cycle de vie d'une réservation
```
pending ──confirm──▶ confirmed ──départ (check-in)──▶ in_progress ──retour──▶ completed
   │                    │
   ├─decline──▶ declined ├─cancel──▶ cancelled
   └─(auto)──▶ expired   └─(auto)──▶ expired
```
- `require_manual_confirmation` : si vrai, toute réservation en ligne arrive en `pending`.
- `online_booking_auto_decline_enabled` : refus automatique après `online_booking_auto_decline_hours`
  (48 h) sans confirmation.
- `rental_tolerance_hours` : tolérance de retard avant facturation d'un jour de plus.

### Numérotation
Séquences **par tenant**, remises à zéro chaque année : `B-2026-00991`, `FACT-2026-00012`,
`DEVIS-2026-00003`. Le préfixe est configurable dans les réglages.

### Caution (dépôt de garantie)
Encaissée au départ (`caution_collected`, `caution_amount`), restituée au retour
(`caution_released_at`, `caution_refund_amount`), avec commentaires libres et note sur le contrat.
En cas de dommage : retenue totale ou partielle.

## Champs « calculés » renvoyés par l'API

Ne pas les stocker, les calculer à la volée : `rental_days`, `total_price`, `tax_amount`,
`total_with_tax`, `has_signed_contract`, `check_in_url`, `public_report_url`,
`documents_count`, `rents_count`, `dtt_alert_state`, `featured_image`, `gallery_images`,
`last_known_mileage` (pour l'état des lieux).
