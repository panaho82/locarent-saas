# 04 — Contrat d'API

Base : `https://api.fenuacar.com/api` → dans la refonte : `/api` sur votre domaine.

## Conventions

| Sujet | Règle |
|---|---|
| Format | JSON UTF-8, `Accept: application/json` |
| Auth | `Authorization: Bearer <token>` (token opaque, 1 entrée `personal_access_tokens`) |
| Tenancy | déduite du token : un utilisateur ne voit que son `tenant_id`. **Jamais** de `tenant_id` accepté depuis le client. |
| Liste | `{"data":[…],"links":{…},"meta":{"current_page","last_page","per_page","total",…}}` (pagination Laravel) |
| Ressource | `{"data":{…}}` |
| Création | `201` + `{"data":{…},"message":"…"}` |
| Validation | `422` + `{"message":"…","errors":{"champ":["…"]}}` |
| Non authentifié | `401` |
| Abonnement impayé | `402` |
| Fonctionnalité hors plan | `403` + `{"error":"Subscription expired"}` **ou** message de feature |
| Interdit | `403` |
| Introuvable | `404` + `{"message":"The route api/… could not be found."}` |
| Suppression | `204` |
| Filtres de liste | `?page=&per_page=&sort_by=&sort_direction=asc|desc&search=` |

## Endpoints confirmés (capturés en conditions réelles)

### Authentification
| Méthode | Route | Corps / Réponse |
|---|---|---|
| POST | `/login` | `{email,password}` → `{message, user, token}`. `user` contient `permissions[]` et `tenant{}` |
| POST | `/register` | `{tenant_name,tenant_email,name,email,password,password_confirmation,recaptcha_token}` |
| GET | `/me` | utilisateur courant + `tenant` |
| POST | `/refresh-token` | nouveau token |
| POST | `/logout` | révoque le token courant |
| POST | `/password/forgot` · `/password/reset` | email / `{token,email,password,password_confirmation}` |
| GET | `/auth/qr/current` | `{token:"<48 chars>", expires_at, ttl_seconds:30}` |
| GET | `/auth/devices` | `{data:[{id,name,model,platform,last_seen_at,expires_at,revoked_at,has_push,created_at}]}` |
| DELETE | `/auth/devices/{id}` | révoque |
| POST | `/auth/qr/claim` | *(à recréer)* `{token,device_name,platform,push_token}` → `{token(user), device}` |

### Tableau de bord
| Méthode | Route | Note |
|---|---|---|
| GET | `/bookings/stats` | `?date_from&date_to&group_by=month` → `{total_count, active_count, upcoming_count, breakdown:[{date,total,pickup_datetime,return_datetime,total_amount}]}` |
| GET | `/payments/stats` | idem, encaissements |
| GET | `/expenses/stats` | idem, dépenses |
| GET | `/inspections/daily` | `?date=YYYY-MM-DD` → `{data:{date,departures[],returns[],overdue_departures[],overdue_returns[]}}` |
| GET | `/vehicles/alerts` | `{data:{dtt:[…],mileage:[…]}}` |
| GET | `/onboarding/progress` | `{steps:{settings_configured,has_vehicles,has_customers,has_bookings}}` |
| GET | `/notifications` | liste ; `POST /notifications/{id}/read` ; `POST /notifications/mark-all-read` |

### Flotte
| Méthode | Route | Note |
|---|---|---|
| GET | `/vehicles` | paginé ; `?start_date&end_date&start_time&end_time` → filtre **disponibilité** |
| POST | `/vehicles` | création |
| GET | `/vehicles/{id}` | détail + `brand`, `category`, `main_location`, `images` |
| PUT | `/vehicles/{id}` | mise à jour |
| DELETE | `/vehicles/{id}` | |
| GET | `/vehicles/{id}/activities` | historique (réservations, maintenance, états des lieux) |
| POST | `/vehicles/{id}/images` | multipart |
| GET | `/vehicle-categories` · POST/PUT/DELETE | |
| GET | `/locations` · POST/PUT/DELETE | |
| GET | `/extra-services` · POST/PUT/DELETE | |
| GET | `/maintenance` · POST/PUT/DELETE | |
| GET | `/brands` | catalogue global (~380) |
| GET | `/brands/{id}/logo` | image |
| GET | `/colors` | `{colors:[{slug,name,hex,is_visible}]}` |

### Clients
| Méthode | Route | Note |
|---|---|---|
| GET | `/customers` | `?limit=1000&archived=all&type=company&sort_by=created_at` |
| GET | `/customers/{id}` | fiche + `drivers[]` |
| POST/PUT/DELETE | `/customers` | |
| GET | `/customers/{id}/bookings` | |
| GET | `/customers/{id}/documents` · POST · DELETE `/documents/{docId}` | pièces |
| GET/POST | `/customers/{id}/drivers` | conducteurs |

### Réservations
| Méthode | Route | Note |
|---|---|---|
| GET | `/bookings` | `?start_date&end_date&page&per_page&status&search&customer_id&vehicle_id` |
| POST | `/bookings` | création (payload ci-dessous) |
| GET | `/bookings/{id}` | détail complet + `customer`, `vehicle`, `company` |
| PUT | `/bookings/{id}` | |
| DELETE | `/bookings/{id}` | |
| POST | `/bookings/{id}/confirm` | → `confirmed` |
| POST | `/bookings/{id}/cancel` | → `cancelled` |
| POST | `/bookings/{id}/decline` | → `declined` |
| POST | `/bookings/{id}/extras` | ajoute une option |
| GET | `/bookings/{id}/inspections` | `{data:[…], last_known_mileage}` |
| POST | `/bookings/{id}/inspections` | état des lieux (départ/retour) |
| POST | `/bookings/{id}/documents` | pièces jointes |
| POST | `/bookings/{id}/sign` | signature contrat |
| GET | `/bookings/{id}/contract` | PDF contrat |
| GET | `/calendar/events` | `?from&to` → événements du calendrier |
| POST | `/bookings/{id}/payment/init` | init PayZen |
| POST | `/bookings/{id}/payment/confirm` | retour PayZen |
| POST | `/bookings/{id}/switch-offline` | bascule paiement hors ligne |
| POST | `/bookings/{id}/validate-promo` | `{code}` → remise |

Payload de création (relevé sur l'écran « Nouvelle réservation ») :
```json
{
  "customer_id": 3027,
  "company_id": null,
  "show_company_on_invoice": false,
  "vehicle_id": 276,
  "pickup_location_id": 148,
  "dropoff_location_id": 148,
  "start_date": "2026-10-21", "start_time": "08:00",
  "end_date": "2026-10-23",   "end_time": "10:00",
  "duration_unit": "days", "duration_value": 2,
  "is_unlimited_kilometers": true,
  "base_kilometers": null, "extra_km_price": null,
  "extras": [{"extra_service_id": 12, "qty": 1}],
  "discounts": [{"label": "Remise", "type": "percent", "value": 10}],
  "notes": null, "internal_notes": null,
  "status": "pending"
}
```

### Finance
| Méthode | Route |
|---|---|
| GET/POST/PUT/DELETE | `/invoices`, `/invoices/{id}` |
| GET | `/invoices/{id}/pdf` · POST `/invoices/{id}/send` |
| GET/POST/PUT/DELETE | `/estimates`, `/estimates/{id}` , `/estimates/{id}/pdf` |
| POST | `/estimates/{id}/convert` → crée une réservation |
| GET/POST/PUT/DELETE | `/payments` |
| POST | `/payments/{id}/refund` |
| GET/POST/PUT/DELETE | `/expenses` |
| GET/POST/PUT/DELETE | `/promo-codes` |
| GET | `/reports/income` , `/reports/earnings` , `/reports/rentals` , `/reports/tva` (params `date_from`,`date_to`) |

### Réglages, équipe, abonnement
| Méthode | Route |
|---|---|
| GET/PUT | `/settings` |
| GET/PUT | `/tenant` |
| GET | `/users` · POST `/users` (invite) · PUT/DELETE `/users/{id}` |
| POST | `/users/{id}/resend-invite` · `/deactivate` · `/reactivate` |
| GET | `/subscription/current` → `{subscription, plan, usage}` |
| GET | `/subscription/plans` |
| POST | `/subscription/change-plan` · `/subscription/cancel` |
| POST | `/contact` (public, reCAPTCHA) |

## Endpoints publics (aucun token)

| Méthode | Route | Réponse |
|---|---|---|
| GET | `/public/booking/{slug}/config` | config de la page publique (couleur, devise, activation) — `404` si désactivé |
| GET | `/public/booking/{slug}/vehicles` | véhicules disponibles pour la période |
| GET | `/public/booking/{slug}/locations` | lieux publics |
| GET | `/public/booking/{slug}/extras` | options |
| POST | `/public/booking/{slug}/validate-promo` | `{code}` |
| POST | `/public/booking/{slug}/reserve` | crée la réservation (`recaptcha_token` obligatoire) → `{booking, payment?}` |
| GET | `/public/check-in/{token}` | résumé de la réservation (sans données sensibles) |
| GET | `/public/check-in/{token}/contract-preview` | HTML/PDF du contrat à signer |
| POST | `/public/check-in/{token}` | `{license_front,license_back,id_front,id_back,signature,name,accept_terms}` |
| GET | `/public/report/{token}` | rapport d'état des lieux départ/retour |
| GET | `/public/pay/{token}` | état du paiement |
| POST | `/public/pay/{token}/intent` | crée l'intention PayZen |
| POST | `/public/pay/{token}/confirm` | confirme |
| POST | `/public/impersonate/exchange` | échange d'un lien d'impersonation (support) |

### Exemple réel — `GET /api/public/check-in/{token}`
```json
{"data":{
  "booking_number":"B-2026-00991","status":"pending",
  "start_date":"2026-10-21","start_time":"08:00",
  "end_date":"2026-10-23","end_time":"10:00","rental_days":2,
  "total_price":13260,"currency":"XPF",
  "line_items":[{"label":"Location Renault Kwid (2 jours)","amount":13260}],
  "vehicle":{"name":"Renault Kwid","license_plate":"276 969 P","brand":"Renault","image":null},
  "pickup_location":"Agence Raiatea Rent Car"
}}
```

### Exemple réel — `GET /api/public/report/{token}`
```json
{"data":{
  "booking":{"id":4899,"booking_number":"B-2026-00991","start_date":"…","end_date":"…"},
  "agency":{"name":"Raiatea Rent Car"},
  "vehicle":{"brand":"Renault","model":"KWID","license_plate":"276 969 P"},
  "customer":{"first_name":"FRANCK"},
  "departure":null,"return":null
}}
```

## Codes d'erreur métier utilisés par le front

| Code | Déclencheur | Réaction du front |
|---|---|---|
| `401` | token absent/expiré | purge du token + redirection `/login` |
| `402` | abonnement impayé | redirection `/admin/subscription/status?grace=true` |
| `403` + `error:"Subscription expired"` | abonnement expiré | redirection `?expired=true` |
| `422` | validation | affichage champ par champ |
| `404` sur `/public/booking/{slug}/config` | réservation en ligne désactivée | écran « Service indisponible » |

## Ce qu'il faut ajouter dans la refonte

- **Rate limiting** sur `/login`, `/register`, `/password/forgot`, `/public/*/reserve`,
  `/public/check-in/{token}`, `/auth/qr/claim`.
- **Idempotency-Key** sur la création de réservation et les paiements (double-clic mobile).
- **Versionnage** : `/api/v1/...`.
- **Webhooks PayZen** signés (aujourd'hui le retour se fait par `confirm` côté client).
- **ETag / cache** sur `/brands`, `/colors`, `/vehicle-categories`.
- `GET /api/health` (absent aujourd'hui).
