# 02 — Architecture observée

## Vue d'ensemble

```
                 ┌──────────────────────────────┐
   navigateur ──▶│  fenuacar.com (Apache)       │  fichiers statiques uniquement
                 │  SPA Angular 18+ (standalone)│  index.html + 166 chunks lazy
                 └──────────────┬───────────────┘
                                │ HTTPS  JSON + Bearer
                                ▼
                 ┌──────────────────────────────┐
                 │  api.fenuacar.com (Laravel)  │  /api/*
                 │  multi-tenant, Sanctum       │
                 └───┬──────────┬───────────┬───┘
                     │          │           │
              MySQL/Postgres  Storage    PayZen / OSB
              (au choix)    (photos, PDF)  (CB)
```

### Front

| Élément | Valeur observée |
|---|---|
| Framework | **Angular 17+** standalone components (`loadComponent`, signals, `@angular/material`) |
| Build | Vite/esbuild Angular CLI, hash dans les noms de fichiers |
| UI | **Bootstrap 5** + template admin (« DreamsPOS/Dreams Tours » like) + Font Awesome 7, Tabler Icons, PrimeIcons, Material |
| i18n | `@ngx-translate` + `assets/i18n/{fr,en}.json`, défaut `fr-FR` |
| Éditeur riche | ProseMirror/ngx-editor (CGV du contrat) |
| QR | `angularx-qrcode` |
| Graphiques | ApexCharts |
| PDF côté client | `jsPDF` + `html2canvas` (export des rapports) |
| Auth | token opaque **Bearer** en `localStorage` (`auth_token`), injecté par un `HttpInterceptor` |
| Erreurs | Sentry (`@sentry/angular`), DSN public dans le bundle |
| Analytics | Plausible auto-hébergé (`analytics.pluto.ovh`), avec exclusion des routes à token |
| Anti-bot | Google **reCAPTCHA v3** (site key publique `6Le1j3Us…`), actions `register`, `public_booking_reserve`, `contact` |

Le site statique renvoie **le même `index.html` pour toutes les URL** (fallback SPA Apache) : robots.txt,
sitemap, `/api/*` sur le domaine web renvoient tous le HTML de l'app. Le vrai backend est sur un
sous-domaine séparé : `https://api.fenuacar.com/api`.

### Backend

| Élément | Valeur observée |
|---|---|
| Framework | **Laravel** (pages d'erreur Symfony/Laravel typiques : « The route api/… could not be found. ») |
| Auth | **Laravel Sanctum** tokens personnels (`id|hash`), en-tête `Authorization: Bearer <token>` |
| Tenancy | `tenant_id` sur toutes les tables métier ; le token identifie l'utilisateur → son tenant |
| Pagination | Laravel `{"data":[…],"links":{…},"meta":{…}}` |
| Stockage | `https://api.fenuacar.com/storage/...` (Laravel filesystem public) |
| Erreurs | 401 (token), 402 (abonnement impayé), 403 `{"error":"Subscription expired"}`, 404, 422 (validation) |
| Paiement | **PayZen / OSB** (Lyra) : `site_id`, clé REST privée, clé publique JS, HMAC SHA-256, mode TEST/PROD |
| Push mobile | notifications push par appareil (`has_push` sur `auth/devices`) |

### App mobile

- Bundle Android `com.fenuacar.app`, iOS `id6784717592` (App Store).
- Techno probable **Ionic/Capacitor** ou Flutter — non tranchable sans l'APK ; peu importe pour la refonte.
- Elle consomme la **même API REST** que le web (mêmes endpoints `/api/*`).
- Fonctionnalités annoncées sur la fiche Play Store : journée du jour (départs/retours), réservations
  (créer, confirmer, refuser, rechercher par client/plaque/numéro), planning flotte, états des lieux
  photo + signature, et **scan de QR code** pour se connecter.

## Appairage mobile par QR (mécanisme exact)

1. Dans le back-office : `Paramètres → Connecter l'app mobile`.
2. Le front appelle **`GET /api/auth/qr/current`** → `{"token":"<48 chars>","expires_at":"…","ttl_seconds":30}`.
3. Le composant affiche un QR dont le **contenu est le token brut** (pas d'URL, pas de JSON).
4. Le QR se régénère tout seul toutes les 30 s (compte à rebours affiché, bouton « Générer un nouveau code »).
5. Le téléphone lit le token, l'envoie à l'API, reçoit un token de session **valable 90 jours**
   (`expires_at` à +90 j sur `auth/devices`).
6. L'appareil apparaît dans `Paramètres → Appareils mobiles` : nom, modèle, plateforme,
   dernière activité, notifications push activées, bouton **Déconnecter** (révocation).
7. L'endpoint d'échange côté mobile n'est pas exposé dans le bundle web (logique serveur/mobile).
   Il faudra le recréer : `POST /api/auth/qr/claim {token}` → session + device.

> Détail sécurité intéressant à reprendre : le token QR est **à usage unique, courte durée, et
> rotatif** ; la session mobile est **longue** mais **révocable par appareil**.

## Endpoints d'authentification repérés

| Méthode | Route | Note |
|---|---|---|
| POST | `/api/login` | `{email, password}` (+ `recaptcha_token` sur l'inscription) → `{message, user{…}, token}` |
| POST | `/api/register` | inscription agence : `tenant_name`, `tenant_email`, `name`, `email`, `password`, `password_confirmation`, `recaptcha_token` |
| GET | `/api/me` | utilisateur + `tenant` + `permissions[]` |
| POST | `/api/refresh-token` | renouvellement |
| POST | `/api/logout` | suppression du token (déduit de l'intercepteur) |
| POST | `/api/password/forgot`, `/api/password/reset` | récupération |
| POST | `/api/auth/qr/claim` *(à recréer)* | échange token QR ↔ session mobile |
| GET | `/api/auth/qr/current` | génère le token affiché en QR |
| GET | `/api/auth/devices` | appareils appairés |
| DELETE | `/api/auth/devices/{id}` | révoque un appareil |
| POST | `/api/users/{id}/resend-invite` \| `/deactivate` \| `/reactivate` | gestion d'équipe |

## Sécurité observée (et ce qu'on garde / corrige)

| Point | Constat | Recommandation pour la refonte |
|---|---|---|
| Transport | HTTPS partout, HSTS non vérifié | forcer HSTS + TLS 1.2+ |
| Token web | opaque, en `localStorage` → exposé au XSS | **cookie httpOnly + SameSite=Lax** (ou BFF) |
| Tokens publics | UUID v4 non devinables, exclus de l'analytics | garder, + rate-limit et expiration |
| Mots de passe | non testé | Argon2id, min 10 car., blocage après N échecs |
| Permissions | 40+ permissions granulaires côté client **et** serveur | garder le modèle, vérifier systématiquement côté API |
| reCAPTCHA | v3 sur inscription/réservation/contact | garder (ou Turnstile, gratuit) |
| Journalisation | Sentry côté front, pas d'audit visible | ajouter une table `activity_log` (qui a fait quoi) |
| Impersonation | `/impersonate` + `/api/public/impersonate/exchange` | réservé au support, tracer chaque usage |

## Inventaire technique du bundle (utile pour la refonte)

- 166 chunks lazy → un chunk par écran, chargement à la demande (bonne pratique à conserver).
- Un `HttpInterceptor` central gère : ajout du Bearer, exclusion login/register/password/public,
  redirection 401 → login, 402 → abonnement (grâce), 403 « Subscription expired » → abonnement (expiré).
- Les guards sont **déclaratifs** dans la table de routage : `canActivate:[Nn]` (feature du plan),
  `canActivate:[At(["invoice.view"])]` (permission).
