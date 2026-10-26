# Locarent

Logiciel de gestion pour les agences de location de véhicules de **Polynésie
française** : flotte, réservations, contrats, états des lieux, facturation, TVA
— plus un portail public de réservation et de check-in.

> État actuel : **Lot 0 (socle)**. Voir [`docs/lot-0.md`](docs/lot-0.md) pour le
> découpage, [`AGENTS.md`](AGENTS.md) pour les conventions de code.

## Démarrage

```bash
# 1. dépendances
pnpm install

# 2. variables d'environnement
cp .env.example .env
#    remplacer AUTH_SECRET : openssl rand -base64 48

# 3. base de données locale (PostgreSQL 16 sur le port 55432)
docker compose up -d postgres

# 4. schéma + données de démonstration
pnpm db:migrate
pnpm db:seed

# 5. c'est parti
pnpm dev     # http://localhost:3210
```

Compte de démonstration : **demo@locarent.test** / **locarent-demo-1**

## Ports

Les ports habituels (3000, 5432, 9000, 8025) sont déjà pris sur la machine de
développement, d'où des ports décalés — à garder cohérents avec `.env`.

| Service | Port |
|---|---|
| Application | 3210 |
| PostgreSQL | 55432 |
| MinIO (API / console) | 59000 / 59001 |
| Mailpit (SMTP / web) | 58125 / 58025 |

## Scripts

| Commande | Effet |
|---|---|
| `pnpm dev` | serveur de développement |
| `pnpm build` | build de production |
| `pnpm preview` | sert le build standalone sur le port 3210 (le même serveur que l'image Docker) |
| `pnpm exec playwright test` | parcours end-to-end dans Chromium |
| `pnpm typecheck` | TypeScript strict, sans émission |
| `pnpm lint` | ESLint |
| `pnpm test` | tests Vitest (dont l'isolation multi-tenant) |
| `pnpm db:migrate` | applique / crée une migration |
| `pnpm db:reset` | remet la base à zéro puis seed |
| `pnpm db:seed` | données de démonstration (idempotent) |
| `pnpm db:studio` | Prisma Studio |

## Structure

```
prisma/            schéma (40 modèles), migrations, seed
src/app/           App Router (pages, layouts, route handlers)
src/server/        accès aux données, auth, contexte d'agence
src/components/    UI (design system dérivé de docs/spec/07)
src/lib/           formatage XPF/dates, validation zod
tests/             unitaires + intégration (vraie base)
docs/              specs d'analyse + schema.sql + plan des lots
```

## Ce qui est fait (Lot 0)

- [x] Socle Next.js 16 + TypeScript strict + Tailwind 4, build vert
- [x] PostgreSQL 16 en conteneur, 40 tables, 27 types énumérés
- [x] Seed idempotent (3 plans, 12 couleurs, 12 marques, agence de démo)
- [x] Isolation multi-tenant garantie par extension Prisma + `AsyncLocalStorage`,
      prouvée par 8 tests d'intégration
- [x] Authentification maison : Argon2id, sessions en base (token haché),
      cookie httpOnly, mot de passe oublié, invitations
- [x] Permissions granulaires (53) et écran Équipe
- [x] Layout admin (sidebar 5 sections, header, tableau de bord, réglages)
- [x] CI GitHub Actions, image Docker standalone (229 Mo, non-root)
- [ ] Déploiement Dokploy (en attente d'accès)

Vérifications : `pnpm test` (17 tests d'intégration) et `pnpm exec playwright test`
(6 parcours réels sur le serveur standalone).

## Crédits & licence

Le dossier `docs/spec/` décrit les **fonctionnalités** d'un produit observé par
rétro-ingénierie en lecture seule. Les actifs de l'éditeur d'origine (marque,
logo, CGV, photos, code) ne sont pas réutilisés et ne doivent pas l'être.
