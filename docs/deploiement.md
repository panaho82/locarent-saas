# Déploiement

Deux environnements : **local** (`docker-compose.yml`) et **production**
(`docker-compose.prod.yml`, ou Dokploy). Les migrations sont toujours une
**étape séparée**, jamais dans l'entrypoint de l'application.

## 1. Local

```bash
docker compose up -d postgres     # base seule, port 55432
pnpm db:migrate && pnpm db:seed
pnpm dev                          # http://localhost:3210
```

## 2. Vérifier la pile de production en local

C'est la répétition générale : même image, mêmes migrations, même ordre de
démarrage que sur le serveur.

```bash
cp .env.stack.example .env.stack
#   renseigner AUTH_SECRET et POSTGRES_PASSWORD

docker compose -f docker-compose.prod.yml -f docker-compose.local.yml --env-file .env.stack up -d --build
curl http://localhost:3212/api/health
docker compose -f docker-compose.prod.yml -f docker-compose.local.yml --env-file .env.stack down -v
```

Ordre garanti par Compose : `postgres` (healthy) → `migrate` (une fois) →
`app` (démarre seulement si les migrations ont réussi).

> `--env-file` sert uniquement à l'interpolation Compose. Le service `app` n'a
> **aucun `env_file`** : toutes les variables lui sont passées explicitement,
> ce qui permet à Dokploy de les injecter depuis son interface sans qu'un
> fichier existe sur le serveur.

Le déploiement échoue **immédiatement et clairement** si `POSTGRES_PASSWORD`,
`AUTH_SECRET` ou `APP_URL` manquent (syntaxe `${VAR:?message}`), plutôt que de
démarrer une application à moitié configurée.

## 3. Dokploy

### 3.1 Ce qu'il faut créer

| Élément | Valeur |
|---|---|
| Type d'application | **Docker Compose** (fichier `docker-compose.prod.yml`) |
| Dépôt | le dépôt GitHub du projet, branche `main` |
| Domaine | `app.<votre-domaine>` → service `app`, port **3000** |
| Health check | chemin `/api/health`, attendu **200** |

### 3.2 Variables d'environnement

À saisir dans Dokploy (jamais dans le dépôt) :

```bash
POSTGRES_PASSWORD=<fort, 32+ caractères>
AUTH_SECRET=<openssl rand -base64 48>
APP_URL=https://app.<votre-domaine>
MAIL_TRANSPORT=console        # passer à smtp quand le transport sera branché
APP_HOST_PORT=3212            # port publié, seulement utile hors Traefik
```

Les trois premières sont **obligatoires** : sans elles, `docker compose` refuse
de démarrer et nomme la variable manquante.

`DATABASE_URL` n'est **pas** à saisir : le compose la construit à partir des
variables `POSTGRES_*` et du nom de service `postgres`.

### 3.3 Points de vigilance

1. **Migrations** : le service `migrate` s'exécute une fois par déploiement et
   doit réussir avant que `app` démarre. Si vous déployez l'application seule
   (sans le service `migrate`), lancez `docker build --target migrator -t
   locarent:migrator .` puis `docker run --rm -e DATABASE_URL=… locarent:migrator`
   en *pre-deploy command* — jamais dans l'entrypoint : avec plusieurs réplicas,
   les migrations s'exécuteraient en parallèle.
2. **Volume PostgreSQL** : monter `postgres-data` sur un volume persistant, et
   activer les sauvegardes Dokploy (quotidiennes, rétention ≥ 7 jours).
3. **HTTPS** : activer le certificat Let's Encrypt sur le domaine ; l'app pose
   déjà `Strict-Transport-Security`.
4. **Un seul réplica au démarrage** : le temps de valider. Le passage à
   plusieurs réplicas ne demande aucune modification (sessions en base).
5. **`APP_URL`** doit être l'URL publique réelle : elle sert à construire les
   liens d'invitation et de réinitialisation envoyés par email.
6. **Aucun port publié en production** : Traefik joint le conteneur par le
   réseau interne. Le mapping de port vit dans `docker-compose.local.yml`
   (override de développement). Publier un port fixe dans le fichier de
   production ferait entrer en collision deux déploiements sur un même hôte.
7. **Aucun nom de pile codé en dur** : le fichier ne contient pas de `name:`.
   Chaque déploiement (chaque application Dokploy) doit posséder sa propre
   pile Docker, ses conteneurs et ses volumes. C'est ce qui garantit qu'une
   application ne peut pas hériter des conteneurs ou du volume d'une autre.

### 3.4 Après le déploiement

```bash
curl -i https://app.<votre-domaine>/api/health     # 200 + {"status":"ok"}
```

Puis, dans le navigateur : créer un compte, vérifier le tableau de bord vide,
inviter un membre, accepter l'invitation. Ce sont exactement les parcours
couverts par `tests/e2e/auth.spec.ts`.

## 4. Ce qui reste à brancher (hors Lot 0)

| Élément | Lot |
|---|---|
| Transport SMTP réel (Mailpit local, Resend/Brevo en production) | 3 |
| Stockage S3/MinIO des photos | 3 |
| Paiement PayZen | 5 |
| Sauvegarde et supervision (Sentry) | 7 |

---

## 5. Déploiement effectué (Lot 0)

| Élément | Valeur |
|---|---|
| Instance Dokploy | `https://dokploy.tahiti-iotservices.cloud` |
| Projet Dokploy | **`locarent saas v2`** (`7WHjlULLsXzwP_m9nT239`) |
| Application | compose **`locarent-saas-v2`** — `pdqHP8jxb07WTigap3Fu-` |
| Dépôt source | `panaho82/locarent-saas`, branche `main`, `./docker-compose.prod.yml` |
| URL | **https://v2.locarent.uk** |
| Domaine → service | `app`, port `3000`, HTTPS |
| Santé | `/api/health` → `{"status":"ok","database":"up","latencyMs":…}` |

### Isolation vis-à-vis de la production — à ne pas casser

`app.locarent.uk` sert une **autre application** (dépôt `panaho82/car-rental-saas`,
MySQL + MinIO + Resend), utilisée par des agences. Elle est en production et ne
doit pas être touchée.

| | Production | Lot 0 (v2) |
|---|---|---|
| Projet Dokploy | `locarent` | `locarent saas v2` |
| Application | `locarent` (`B1SX-UYq…`) | `locarent-saas-v2` (`pdqHP8j…`) |
| Conteneurs | app, minio, mysql… | app, postgres, migrate |
| Base | MySQL, son volume | PostgreSQL, **son volume** |
| Signatures `/api/health` | `{"status":"healthy","database":"connected"}` | `{"status":"ok","database":"up"}` |

⚠️ **Piège durable** : la production déclare un domaine **joker**
`*.locarent.uk → app:3000`. Tout sous-domaine non déclaré ailleurs retombe donc
sur elle. C'est pourquoi `v2.locarent.uk` doit garder sa règle d'hôte exacte
dans Dokploy : elle est plus spécifique que le joker et prend le dessus.

Conséquence pratique : si l'application v2 est arrêtée, `v2.locarent.uk` affiche
**la production**, sans erreur. Toujours vérifier la signature de
`/api/health` avant de conclure qu'on regarde le bon environnement.

### Incident du 26/10 (à ne pas reproduire)

Un premier déploiement avait été fait dans le projet `locarent`, c'est-à-dire
mêlé à l'application de production, sous `staging.locarent.uk`. Techniquement
séparé (autres conteneurs, autre base), mais mal placé : même projet Dokploy,
et un domaine posé au-dessus du joker de production. L'application a été
arrêtée puis **supprimée**, et le déploiement refait dans un projet dédié.

Règle qui en découle : **ne jamais créer d'application dans le projet Dokploy
d'une production existante**, même « juste pour tester ».

### Vérifications faites sur v2

- `/api/health` renvoie bien la signature du Lot 0 (et non celle de la production) ;
- `/admin/index` sans session → 307 vers `/login` ;
- inscription réelle dans un navigateur → tableau de bord, cookie `httpOnly` +
  `secure`, `SameSite=Lax` ;
- écran Équipe accessible au propriétaire ;
- production toujours à 200 sur `/`, `/login`, `/api/health`.

### DNS

`*.locarent.uk` est déjà un joker DNS-only vers `62.146.172.163` : `v2.locarent.uk`
résout donc sans enregistrement dédié. Pour rendre le sous-domaine explicite et
indépendant du joker, créer dans Cloudflare :

```
Type    : A
Nom     : v2
Contenu : 62.146.172.163
Proxy   : DNS only (nuage gris)   ← obligatoire pour Let's Encrypt HTTP-01
TTL     : Auto
```
