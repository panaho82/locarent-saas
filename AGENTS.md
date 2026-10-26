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
- **Langue** : interface 100 % en français. Textes centralisés dans
  `src/i18n/fr.ts`, pas de framework i18n pour l'instant.
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

## Tests

- `tests/integration/` : vraie base Postgres, fixtures créées puis supprimées.
  Aucun mock de la base — l'isolation multi-tenant ne se teste pas avec un mock.
- Ne jamais faire tourner les tests contre une base de production
  (`tests/setup.ts` refuse `NODE_ENV=production`).
- Le test `tenancy.test.ts` est un garde-fou de conception : s'il tombe, c'est
  que la couche de données n'est plus sûre.

## Ce qui n'existe pas encore (ne pas supposer)

Réservations, moteur de prix, planning, PDF de contrat, upload S3, PayZen,
QR/mobile, écrans de facturation. Voir `docs/lot-0.md` pour la suite planifiée.
