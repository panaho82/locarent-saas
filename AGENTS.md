# AGENTS.md — conventions du dépôt

Ce fichier est destiné aux agents (et aux humains) qui reprennent ce dépôt.
Il prime sur les habitudes génériques. À mettre à jour à chaque décision
structurante.

## Le produit

SaaS multi-tenant de gestion pour agences de location de véhicules en
**Polynésie française**. Nom de code : `locarent` (le nom du produit n'est pas
arrêté ; la marque « FenuaCar » analysée pendant la phase de reconnaissance ne
doit **jamais** être réutilisée : ni le nom, ni le logo, ni les CGV, ni les
photos).

Le dossier d'analyse d'origine est versionné dans `docs/spec/` et
`docs/schema.sql`. C'est la **référence fonctionnelle** ; le code en diverge
volontairement sur quelques points, listés dans `docs/lot-0.md`.

## Stack (versions pinnées — ne pas « mettre à jour » à la légère)

| Brique | Version | Pourquoi cette précision |
|---|---|---|
| Next.js | **16.4.3** | App Router, Turbopack par défaut |
| React | 19.3.1 | requis par Next 16 |
| Prisma | **7.10.1** | ⚠️ `latest` npm = `8.0.0-rc` (release candidate) : ne **pas** passer en 8 sans guide de migration |
| PostgreSQL | 16 | `docker-compose.yml` |
| Tailwind | 4.3.3 | chargé par `@tailwindcss/turbopack` (pas de `postcss.config.mjs`) |
| Auth | maison | Argon2id + sessions en base (pas d'Auth.js) |

ESM partout : `package.json` a `"type": "module"`.

## Commandes

```bash
docker compose up -d postgres   # base locale sur 55432
pnpm dev                        # http://localhost:3210
pnpm typecheck                  # tsc --noEmit
pnpm lint
pnpm test                       # vitest (tests d'intégration sur la base locale)
pnpm build
pnpm preview                    # serveur standalone = celui de l'image Docker
pnpm exec playwright test       # parcours end-to-end (Chromium)
pnpm db:migrate --name <nom>    # nouvelle migration
pnpm db:reset                   # repart de zéro + seed
pnpm db:seed                    # idempotent
```

Compte de démonstration local : `demo@locarent.test` / `locarent-demo-1`.

## Règles d'accès aux données (les plus importantes du dépôt)

### 1. Toujours importer `db`, jamais `prisma`

```ts
import { db }      from "@/server/db";  // ✅ application : tenant-scoped
import { prisma }  from "@/server/db";  // ❌ réservé au seed, aux scripts, aux tests bas niveau
```

`db` est le client Prisma étendu : il injecte `tenant_id` dans les filtres des
24 tables tenantées et **lève** `TenantContextError` si aucun contexte d'agence
n'est ouvert. `prisma` est le client brut, non filtré.

### 2. Toujours envelopper dans `withTenant`

```ts
const vehicles = await withTenant(tenantId, () => db.vehicle.findMany());
```

⚠️ **Piège** : les requêtes Prisma sont paresseuses. Un `withTenant` qui
renvoie la promesse sans l'attendre à l'intérieur ne protège rien. L'API est
donc **asynchrone uniquement** et fait l'`await` à l'intérieur — ne pas
« optimiser » en ajoutant une variante synchrone.

### 3. À la création, `tenantId` est explicite

Le type Prisma l'exige (choix assumé : visible en revue) et l'extension
revérifie qu'il correspond au contexte, en levant sinon :

```ts
await withTenant(tenantId, () =>
  db.customer.create({ data: { tenantId: requireTenantId(), type: "private" } }),
);
```

### 4. Tables filles sans `tenant_id`

`booking_extras`, `booking_drivers`, `booking_discounts`, `invoice_lines`,
`estimate_lines`, `contracts`, `vehicle_images`, `vehicle_damages`,
`inspection_photos`, `inspection_damages` n'ont pas de `tenant_id` (fidélité au
schéma d'origine). Elles s'atteignent **via leur parent** (`include`), qui est
filtré. Une requête de premier niveau sur ces tables contourne la garde : à
éviter, ou à filtrer manuellement sur le parent.

`Tenant` n'est pas dans le périmètre automatique (sa clé est `id`) : y accéder
via `db.tenant.findUnique({ where: { id: requireTenantId() } })`.

## Conventions métier

- **Montants** : entiers en **XPF**, jamais de décimales, jamais de `float`.
  `formatXPF(6630)` → `6 630 XPF`.
- **Dates** : `Pacific/Tahiti` (UTC-10). Jamais de `new Date()` nu pour
  afficher ; passer par les helpers de `src/lib/format.ts`.
- **Langue** : interface 100 % en français. Les textes sont **inline** dans les
  composants pour l'instant — pas de fichier de traduction ni de framework i18n.
  Si l'anglais public devient nécessaire, introduire un dictionnaire à ce
  moment-là, pas avant.
- **Heures de réservation** : `start_time` / `end_time` sont des chaînes
  `"08:00"` (pas des `DateTime`) — évite les dates fantômes du type
  1970-01-01.
- **TVA** : 13 % par défaut, activable par agence (`settings.tvaEnabled`).

## Next.js 16 — deux pièges de version

1. `middleware.ts` s'appelle désormais **`proxy.ts`**.
2. Le proxy ne doit **pas** porter l'autorisation (la doc Next est explicite).
   Il ne fait que des redirections optimistes ; la vérification réelle de
   session se fait dans les layouts / server actions / couches données.

## Base de données

- Le schéma fait foi dans `prisma/schema.prisma`. `docs/schema.sql` est la
  référence documentaire d'origine, **pas** la source exécutable.
- Les listes fermées sont des `enum` Postgres. Ajouter une valeur = une
  migration ; en retirer une est plus délicat (vérifier les données).
- Les invariants que Prisma ne sait pas exprimer (CHECK, index sur expression)
  vivent dans une migration dédiée (`*_invariants`). Toute nouvelle règle de ce
  type va dans une migration, pas dans le schéma.
- Toute migration doit être rejouable : `pnpm db:reset` doit fonctionner après
  un `git clone`.

## Accessibilité (exigence de la spec 07)

Le produit d'origine a des contrastes insuffisants ; la refonte doit viser
**4.5:1** pour le texte courant. Valeurs vérifiées :

| Token | Valeur | Sur fond app | Usage |
|---|---|---|---|
| `--color-body` | `#666F77` | 4.85:1 | texte courant |
| `--color-muted` | `#667085` | 4.72:1 | libellés, hints, métadonnées |
| `--color-brand` | `#1D4ED8` | 6.7:1 (texte blanc) | boutons, surfaces |
| `--color-brand-text` | `#1D4ED8` | 6.15:1 sur fond crème | liens, accents |

**Identité visuelle** : bleu océan profond. C'est un choix assumé pour se
démarquer de l'orange de FenuaCar tout en restant lisible. Les turquoises ont
été écartés : trop proches du vert « succès » (ratio de contraste 1,2 entre les
deux — indistinguables).

Règles :
- `--color-brand` sert de **fond** avec du texte **blanc** (jamais encre foncée :
  6.7:1 en blanc contre 3.5:1 en encre) ;
- le vert, l'ambre et le rouge restent **réservés aux statuts** — ne pas les
  réutiliser comme couleur décorative ;
- `tests/e2e/accessibilite.spec.ts` échoue sur toute violation axe de gravité
  `serious` ou `critical`. Ne pas le désactiver pour faire passer une PR.

## Tests

- `tests/integration/` : vraie base Postgres, fixtures créées puis supprimées.
  Aucun mock de la base — l'isolation multi-tenant ne se teste pas avec un mock.
- Ne jamais faire tourner les tests contre une base de production
  (`tests/setup.ts` refuse `NODE_ENV=production`).
- Le test `tenancy.test.ts` est un garde-fou de conception : s'il tombe, c'est
  que la couche de données n'est plus sûre.

## Pièges de configuration

### `.env.production` est réservé par Next

Next charge automatiquement `.env`, `.env.local`, `.env.production` (et
`.env.development`) selon `NODE_ENV`. Un fichier `.env.production` à la racine
**écrase la configuration du serveur**, y compris pendant `pnpm preview` : c'est
arrivé, et les liens d'invitation pointaient vers un conteneur éteint.

- Le fichier d'environnement de la pile Docker s'appelle **`.env.stack`**
  (`docker-compose.prod.yml --env-file .env.stack`).
- Ne jamais créer de `.env.production` à la racine du dépôt.

### Le build recopie les fichiers `.env`

`next build` copie les `.env` dans `.next/standalone/`. Ne jamais publier ce
dossier tel quel ; l'image Docker l'évite via `.dockerignore` (`.env*` exclus).
Après un build local fait avec un `.env` inattendu, `rm -rf .next` avant de
reconstruire.

## Authentification et autorisations

- Mots de passe : Argon2id (`src/server/auth/password.ts`). Ne jamais comparer
  un mot de passe autrement que via `verifyPassword`.
- Sessions : token opaque de 32 octets, **stocké haché** (SHA-256) dans
  `sessions`. Cookie `locarent_session` en `httpOnly`, `SameSite=Lax`, 30 jours.
- `requireSession()` dans un layout, et `can(session, "…")` dans **chaque**
  Server Action. Une action est un endpoint public : ne jamais faire confiance
  à l'interface qui a masqué un bouton.
- Le proxy (`src/proxy.ts`) ne fait que rediriger si le cookie est absent.
- Emails : `MAIL_TRANSPORT=console` (défaut) journalise sans envoyer. Tant
  qu'il vaut `console`, les liens d'invitation sont affichés à l'invitant —
  c'est volontaire, pas un oubli.
- Toute action sensible doit laisser une trace via `logActivity()`
  (`src/server/audit.ts`).

## Contrat et check-in (Lot 3)

- Le **contrat** est un HTML autonome (`src/lib/contract.ts`) servi par deux
  routes : back-office (permission `contract.print`) et public par token.
  ⚠️ Il n'affiche **que le prix appliqué** : jamais le prix catalogue, même
  quand la location a été négociée. C'est vérifié par test.
- Le **check-in** est public (`/check-in/{token}`) : le token UUID est la seule
  autorisation, la page est en `noindex`.
- L'envoi de photos passe par une **Route Handler**, pas une Server Action :
  quatre photos dépassent la limite de corps des actions.
- Le contrat signé est **figé** : HTML archivé + empreinte SHA-256 calculée sur
  le document *sans sa propre ligne d'empreinte*, IP et user-agent conservés.

## Stockage des fichiers

`src/server/storage.ts` : lecteur disque local (`STORAGE_DIR`, volume Docker
`storage-data`) et point d'extension S3. Les fichiers sont nommés par UUID et
servis par `/api/files/{uuid}` — l'URL n'est pas devinable. Ne jamais servir une
pièce d'identité depuis le dossier public de Next.

## Emails

`MAIL_TRANSPORT` : `console` (défaut, aucun envoi), `resend` (API HTTP, clé
`RESEND_API_KEY`), `smtp` (non implémenté, échoue volontairement). Un échec
d'envoi ne doit jamais faire échouer l'opération métier : il est journalisé
(`booking.notification_failed`).

## Ce qui n'existe pas encore (ne pas supposer)

États des lieux (le schéma est prêt : `inspections`, `inspection_photos`,
`vehicle_damages`), PDF binaire côté serveur, upload S3, PayZen, QR/mobile,
écrans de facturation. Voir `docs/lot-0.md` pour la suite planifiée.
