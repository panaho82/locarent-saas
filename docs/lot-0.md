# Lot 0 — Socle : plan détaillé

> Statut : **proposé, en attente de validation**. Aucun code n'a été écrit.
> Rédigé le 25/10/2026. Sera déplacé en `docs/lot-0.md` une fois validé.
> Références : `spec/08-reconstruction.md` § Lot 0, `spec/02-architecture.md`, `spec/03-modele-donnees.md`, `db/schema.sql`.

---

## 1. Objectif du Lot 0

À la fin du Lot 0, on doit pouvoir :

1. **Créer une agence** (inscription) → tenant + user `owner` + `settings` + abonnement d'essai, en une transaction.
2. **Se connecter** et rester connecté (cookie httpOnly), se déconnecter.
3. **Inviter un employé** par email, qui accepte l'invitation et arrive avec le bon rôle et les bonnes permissions.
4. **Voir un back-office vide mais réel** : sidebar 5 sections, header, tableau de bord à zéro, écran Entreprise, écran Équipe.
5. **Être certain que l'isolation multi-tenant tient** : prouvé par un test automatisé, pas par convention.
6. **Avoir une CI verte** (lint + types + tests + build) et un **déploiement Dokploy** qui répond sur `/api/health`.

Ce qui n'est **pas** dans le Lot 0 : moteur de prix, réservations, planning, PDF, upload S3 réel, PayZen, QR/mobile, TVA, gating d'abonnement, emails réels (Mailpit en dev).

---

## 2. Décisions à valider

Chacune a une recommandation. Sauf objection, je pars sur la recommandation.

### D1 — Versions : on ne prend pas Next 15

La spec de la session précédente dit « Next.js 15 ». Vérifié sur le registre npm le 25/10/2026 : **Next 16.4.3 est la version stable**, Next 15 est la majeure précédente. Prendre 15 aujourd'hui, c'est démarrer un projet neuf sur une branche en fin de vie.

| Paquet | Version retenue | Remarque |
|---|---|---|
| next | **16.4.3** | stable ; avertissement ci-dessous |
| react / react-dom | 19.3.1 | requis par Next 16 |
| prisma / @prisma/client | **7.10.1** | ⚠️ `latest` = `8.0.0-rc.27` (RC) → on **épingle 7.10.1** |
| @prisma/adapter-pg | 7.10.1 | obligatoire en Prisma 7 |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | config CSS-first |
| zod | 4.6.7 | validation |
| vitest | 5.0.5 | tests |
| @node-rs/argon2 | 2.2.2 | hachage Argon2id natif |
| shadcn | 4.22.1 | CLI d'ajout de composants |
| @playwright/test | 1.64.1 | installé, utilisé au Lot 2 |

**Conséquence de Prisma 7** (breaking changes réels, pas cosmétiques) :
- ESM obligatoire → `"type": "module"` dans `package.json` ;
- générateur `prisma-client` (Rust-free) avec `output` **obligatoire** → client généré dans `src/generated/prisma`, plus d'import depuis `@prisma/client` ;
- **driver adapter obligatoire** (`PrismaPg`) pour instancier le client ;
- `url` de la datasource déplacée dans `prisma.config.ts`.

**Conséquence de Next 16** : `middleware.ts` est renommé **`proxy.ts`**, et la doc précise que le proxy ne doit **pas** être la couche d'autorisation (uniquement des redirections optimistes). Voir D6.

> **Amendement à la spec** : « Next.js 15 » → « Next.js 16.4.3 ». À valider explicitement.

### D2 — Types des identifiants et des montants : `Int`, pas `BigInt`

`schema.sql` utilise `BIGSERIAL` et `BIGINT` (XPF). En Prisma, `BigInt` produit des `bigint` JS : ils cassent `JSON.stringify` (donc les Server Actions, les réponses RSC, `zod`, les props React) et imposent un shim global.

Recommandation :
- **IDs → `Int @id @default(autoincrement())`** (`SERIAL` en Postgres). Plafond 2,1 milliards : aucun risque pour un SaaS d'agences locales.
- **Montants XPF → `Int`**. 2 147 483 647 XPF ≈ 18 M€. Une location de voiture ne s'en approche pas.
- **Taux (`tax_rate`, `qty`, `fuel_level`) → `Decimal`** (conforme à `NUMERIC`).

`schema.sql` reste la **référence documentaire**, pas la source exécutable : les migrations Prisma sont la source de vérité.

> Alternative si tu préfères la fidélité stricte au SQL : garder `BigInt` + `BigInt.prototype.toJSON` global. Je le déconseille (effet de bord global, piège pour plus tard).

### D3 — Les `CHECK (x IN (...))` deviennent des `enum` Prisma

Le schéma compte **25 listes fermées** (statuts de réservation, rôles, types de maintenance, méthodes de paiement…). En Prisma : `enum` natif Postgres → types TS générés, plus de faute de frappe possible.

Les invariants non énumérables (`end_date >= start_date`, `UNIQUE` composites) restent en SQL brut, ajoutés à la main dans la migration.

### D4 — Authentification : couche maison, pas Auth.js

`next-auth` stable est encore en **4.24.15** ; la v5 est en **beta.32**. Et surtout : il nous faut **trois modes** que Auth.js ne modélise pas ensemble — cookie web, Bearer mobile, et échange de token QR (`/auth/qr/claim`).

Recommandation : une couche session maison, ~250 lignes, entièrement testable :
- mot de passe **Argon2id** (`@node-rs/argon2`) ;
- token de session **opaque** (32 octets aléatoires), **stocké haché** (SHA-256) en base → une fuite de base ne donne pas de sessions ;
- cookie `httpOnly; Secure; SameSite=Lax; Path=/`, expiration glissante 30 j ;
- table `sessions` **nouvelle** (absente de `schema.sql`) : `id, user_id, token_hash, ip, user_agent, created_at, last_used_at, expires_at, revoked_at` ;
- une seule fonction `resolveSession(request)` qui renvoie un `SessionContext` identique quel que soit le mode (cookie ou Bearer). Les Lots 5 et 7 réutilisent la même brique.

### D5 — Login par email : ambiguïté à corriger maintenant

`schema.sql` ligne 96 : `UNIQUE (tenant_id, email)`. Or l'écran de connexion observé ne demande **que l'email et le mot de passe** — sans slug d'agence. Si deux agences ont le même email, la connexion est indécidable.

Recommandation : **email globalement unique** (index unique sur `lower(email)`), plus le composite existant. On accepte pour le MVP qu'une personne ne puisse pas appartenir à deux agences avec la même adresse. À rouvrir si le besoin apparaît (l'alternative — `/login/<slug>` — change l'UX).

> C'est une **modification du schéma**, pas un détail d'implémentation. À valider.

### D6 — Autorisation : en profondeur, pas dans le proxy

La doc Next 16 est explicite : le proxy sert aux « optimistic checks », pas à l'autorisation. Donc :

| Couche | Rôle |
|---|---|
| `src/proxy.ts` | redirige `/admin/*` → `/login` si **absence** de cookie de session (optimiste, pas de requête DB) |
| `src/app/(admin)/layout.tsx` | `requireSession()` réel : vérifie le token en base, charge user + tenant + permissions |
| chaque Server Action / Route Handler | `requirePermission("booking.create")` |

Aucune données n'est lue sans être passée par une couche qui a vérifié la session.

### D7 — Isolation multi-tenant : garantie mécanique, pas disciplinaire

Le risque n°1 d'un SaaS multi-tenant est un `where` oublié. Recommandation : **extension Prisma** (`$extends` query hook) + `AsyncLocalStorage` :

- `runWithTenant(tenantId, fn)` ouvre le contexte ;
- l'extension injecte `tenant_id` sur tout `findMany/findFirst/update/delete/create` des modèles qui en portent un ;
- **si aucune valeur n'est fournie par le code appelant, l'extension lève une erreur** au lieu de renvoyer toutes les agences ;
- un test d'intégration prouve les deux cas (contexte absent → throw ; agence A ne voit pas les données de B).

Les modèles globaux (`plans`, `brands`, `colors`) sont explicitement exclus de la liste.

### D8 — Emplacement du dépôt

Recommandation : **racine du workspace** (`/home/dev/Bureau/SAAS LOCARENT`) = racine du dépôt.
- `docs/spec/01…08.md` + `docs/schema.sql` : **copiés et versionnés** (la spec fait partie du dépôt) ;
- `_extract/` (52 Mo de brut) : **`.gitignore`**, reste sur le disque comme archive ;
- nom de code du produit : **`locarent`** (provisoire, aligné sur le dossier). La marque « FenuaCar » n'est jamais réutilisée.

### D9 — Divers tranchés sans toi (dis-moi si tu veux les rouvrir)

| Sujet | Choix |
|---|---|
| i18n | pas de framework au Lot 0 : un dictionnaire `src/i18n/fr.ts`. L'app est en français, c'est suffisant. |
| Emails | Mailpit en local (SMTP), transport abstrait ; Resend/Brevo branché au Lot 3. |
| Fichiers | bucket MinIO en local, client S3 configuré mais **aucun upload** au Lot 0. |
| Temps | Date/heure via `Intl` avec `timeZone: "Pacific/Tahiti"`, jamais de `Date` locale implicite. |
| Monnaie | `formatXPF(n)` → `6 630 XPF`, zéro décimale, espace insécable. |
| Tests E2E | pas au Lot 0 (Playwright installé, écrit au Lot 2 quand il y a des parcours à tester). |
| Conventions agent | `AGENTS.md` à la racine : stack, versions, règles de tenancy, où sont les docs Next 16 / Prisma 7. |

---

## 3. Arborescence cible

```
/
├── AGENTS.md                     conventions pour l'agent (stack, tenancy, versions)
├── README.md                     démarrage local en 5 commandes
├── PLAN-LOT-0.md                 ce document → deviendra docs/lot-0.md
├── package.json                  "type": "module"
├── pnpm-lock.yaml
├── tsconfig.json                 strict, moduleResolution bundler, target ES2023
├── next.config.ts                output: "standalone"
├── postcss.config.mjs
├── eslint.config.mjs
├── prisma.config.ts              url + shadowDatabaseUrl (Prisma 7)
├── Dockerfile                    multi-stage, node:22-alpine, corepack pnpm
├── docker-compose.yml            dev : postgres:16, minio, mailpit
├── .env.example
├── .gitignore                    dont _extract/
├── .dockerignore
├── .github/workflows/ci.yml
├── docs/
│   ├── spec/01-produit.md … 08-reconstruction.md
│   ├── schema.sql                référence documentaire
│   └── lot-0.md
├── prisma/
│   ├── schema.prisma             40 modèles, 25 enums
│   ├── migrations/
│   └── seed.ts                   3 plans, 12 couleurs, 1 agence démo + owner
├── src/
│   ├── proxy.ts                  redirection optimiste /admin → /login
│   ├── generated/prisma/         client Prisma généré (gitignoré)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css           @import "tailwindcss" + tokens du design system
│   │   ├── page.tsx              landing minimale
│   │   ├── (auth)/
│   │   │   ├── layout.tsx        split 50/50 de la maquette
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   └── accept-invite/page.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx        requireSession + sidebar + header
│   │   │   ├── index/page.tsx    dashboard à zéro
│   │   │   └── settings/
│   │   │       ├── company/page.tsx
│   │   │       ├── team/page.tsx
│   │   │       └── security/page.tsx
│   │   └── api/
│   │       └── health/route.ts   ping DB → 200/503
│   ├── server/
│   │   ├── db.ts                 PrismaClient + PrismaPg + extension tenancy
│   │   ├── tenant-context.ts     AsyncLocalStorage
│   │   ├── audit.ts              écrit activity_log
│   │   ├── mail.ts               interface transport + impl SMTP dev
│   │   ├── auth/
│   │   │   ├── password.ts       argon2id hash/verify
│   │   │   ├── session.ts        create / resolve / revoke
│   │   │   ├── cookies.ts
│   │   │   └── permissions.ts    union typée des 40+ permissions + can()
│   │   └── actions/              login, logout, register, invite, accept-invite, reset
│   ├── components/
│   │   ├── ui/                   shadcn
│   │   └── admin/                Sidebar, Header, PageHeader, StatCard, StatusBadge, EmptyState
│   ├── lib/
│   │   ├── format.ts             formatXPF, formatDate (Pacific/Tahiti)
│   │   ├── validation/           schémas zod partagés
│   │   └── cn.ts
│   └── i18n/fr.ts
└── tests/
    ├── unit/permissions.test.ts
    ├── unit/format.test.ts
    └── integration/
        ├── tenancy.test.ts       ← le test qui compte
        └── auth.test.ts
```

**Écarts assumés par rapport à `schema.sql`** (à reporter dans `docs/lot-0.md`) :
1. `sessions` ajoutée (auth web, absente du schéma d'origine) ;
2. `UNIQUE` global sur `lower(email)` (D5) ;
3. `INET` → `varchar(45)` : Prisma ne supporte pas le type `inet` ; `activity_log.ip` et `signer_ip` perdent la validation Postgres, on valide en zod ;
4. `personal_access_tokens` conservée (polymorphe : **sans relation Prisma**, utilisée au Lot 7 par le mobile) ;
5. IDs `SERIAL` et montants `INTEGER` (D2) ; `CHECK` → `enum` (D3).

---

## 4. Ordre d'exécution et critères d'acceptation

Chaque étape est livrable et vérifiable seule. Si une étape casse, on ne passe pas à la suivante.

### Étape 1 — Socle projet *(0,5 j)*
Scaffold Next 16 + TS strict + Tailwind 4 + shadcn + eslint + vitest. Page blanche qui rend.
**AC** : `pnpm build` OK · `pnpm tsc --noEmit` OK · `pnpm lint` OK · `pnpm dev` sert `localhost:3000`.

### Étape 2 — Base de données *(1 j)*
`docker compose up` (postgres 16 + minio + mailpit) · `prisma/schema.prisma` complet · première migration · seed.
**AC** : `\dt` → **40 tables** · seed rejouable 2× sans erreur · `pnpm prisma migrate reset` reconstruit tout · un script compare la liste des tables/colonnes entre `docs/schema.sql` chargé à part et la base migrée, et signale tout écart **voulu** (les 5 ci-dessus) versus **accidentel**.

### Étape 3 — Couche données multi-tenant *(0,5 j)*
`db.ts` + `tenant-context.ts` + extension Prisma.
**AC** : `tests/integration/tenancy.test.ts` — (a) requête hors contexte → **throw** ; (b) agence A ne lit aucune ligne de B ; (c) `create` sans `tenant_id` → throw ; (d) les modèles globaux (`plans`) restent lisibles hors contexte.

### Étape 4 — Authentification *(1,5 j)*
Argon2id, `sessions`, cookie, 6 écrans (login, register, forgot, reset, accept-invite, logout), `proxy.ts` optimiste, page `/api/health`.
**AC** : inscription crée tenant+user+settings+essai en **une transaction** (rollback testé) · login OK · mauvais mot de passe → message générique, pas de fuite d'existence de compte · cookie `httpOnly`/`SameSite=Lax` vérifié en test · session expirée → retour login · mot de passe oublié → token à usage unique 1 h · inscription avec un email déjà pris → erreur claire.

### Étape 5 — Autorisations *(1 j)*
Union typée des permissions, `can()`, `requirePermission()`, écran Équipe (inviter, lister, désactiver, réactiver), `activity_log` branché sur les actions sensibles.
**AC** : un `member` sans `user.invite` reçoit 403 côté action **et** ne voit pas le bouton · `owner` passe partout · invitation expirée refusée · désactivation coupe la session immédiatement (pas au bout de 30 j) · chaque invitation/désactivation laisse une ligne `activity_log`.

### Étape 6 — Layout admin et composants *(1,5 j)*
Sidebar 5 sections (selon `spec/05-ecrans.md`), header (bouton « + Nouvelle réservation » désactivé, bascule thème, cloche, menu compte), `StatCard`, `StatusBadge`, `DataTable` (coquille), `EmptyState`, dashboard à zéro, écran Entreprise (nom, coordonnées, couleur principale, logo différé au Lot 1).
**AC** : rendu conforme aux captures de `recon/shots/` (comparaison visuelle) · navigation clavier OK · contrastes ≥ 4.5:1 sur le texte (le orange `#FFA633` reste **en fond**, jamais en texte) · responsive jusqu'à 1024 px.

### Étape 7 — CI, image, santé *(0,5 j)*
GitHub Actions : lint, types, tests (service postgres 16), build. `Dockerfile` standalone. `/api/health` qui ping la base.
**AC** : CI verte sur un commit vide · image < 300 Mo · conteneur démarre sans écrire sur le disque · `/api/health` → 200 avec base up, **503** avec base down.

### Étape 8 — Dokploy *(0,5 j)*
App + Postgres + Redis + MinIO. Migrations en **étape de déploiement séparée** (`prisma migrate deploy`), pas dans l'entrypoint de l'app (sinon N réplicas migrent en parallèle).
**AC** : staging répond en HTTPS · health OK · login OK sur staging · `migrate deploy` idempotent (2 déploiements d'affilée) · backup Postgres planifié.

**Total : ~7 jours-homme.** La spec annonce 1 semaine pour le Lot 0 : c'est cohérent, à condition que Dokploy soit accessible dès le début.

---

## 5. Definition of Done du Lot 0

- [ ] Un inconnu s'inscrit, reçoit son agence, se retrouve sur un dashboard vide.
- [ ] Il invite un collègue, qui accepte et arrive avec le rôle `member`.
- [ ] L'isolation tenant est prouvée par un test qui échoue si on la casse volontairement.
- [ ] Aucune requête de données ne peut s'exécuter sans contexte tenant.
- [ ] CI verte · image Docker construite · staging déployé et joignable.
- [ ] `docs/lot-0.md` liste les écarts assumés avec `docs/schema.sql`.
- [ ] `AGENTS.md` à jour (un agent qui reprend peut continuer sans relire 3 000 lignes).

---

## 6. Risques

| Risque | Probabilité | Mitigation |
|---|---|---|
| Prisma 7 (ESM + adapter) mal supporté par Next 16 | moyenne | **Étape 1 = spike** : un `findMany` réel dès le scaffold, avant tout modèle |
| shadcn / Tailwind 4 / Next 16 en friction | moyenne | composants ajoutés un par un au fil de l'Étape 6, pas en bloc |
| Le `latest` npm de Prisma bascule sur la 8.0 | certaine à terme | versions **exactes** (`"prisma": "7.10.1"`, pas `^7`) |
| Ambiguïté login multi-agence (D5) | faible au MVP | unique global, documenté, réversible |
| Dokploy indisponible / accès manquants | moyenne | Étapes 1→7 ne dépendent pas de Dokploy |
| Le plan dérive (envie de coder les réservations) | élevée | Lot 1 = flotte & clients ; toute demande hors lot est notée, pas exécutée |

---

## 7. Ce dont j'ai besoin de toi

1. **Valider ou corriger les décisions D1→D8** (surtout D1 : Next 16 au lieu de 15, et D5 : email unique global).
2. Le **dépôt GitHub** cible (compte/org + nom), ou « crée-le plus tard ».
3. L'accès **Dokploy** + le nom de domaine de staging (nécessaire seulement à l'Étape 8).
4. Confirmer le **nom de code `locarent`** (provisoire, sans lien avec la marque d'origine).

Réponds « go » si tout te va : je démarre par l'Étape 1 et je te montre le squelette qui tourne avant d'aller plus loin.
