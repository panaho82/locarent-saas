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

## 5. Déploiement effectué (Lot 0) — Tahiti Keys

| Élément | Valeur |
|---|---|
| Instance Dokploy | `https://dokploy.tahiti-iotservices.cloud` |
| Projet Dokploy | **`Tahiti Keys`** (`d0blBd4EWfGpIPVdWIH10`) |
| Application | compose **`tahitikeys`** (`TdfuTKIN0bamVepc1xWsz`) |
| Dépôt source | `panaho82/locarent-saas`, branche `main`, `./docker-compose.prod.yml` |
| URL | **https://tahitikeys.uk** (et `https://www.tahitikeys.uk`) |
| DNS | Cloudflare, zone `0694f184f0ec82ae9d750c4f3060bbed`, 2 × A → `62.146.172.163`, **DNS only** |
| Certificat | Let's Encrypt, `CN = tahitikeys.uk` puis `CN = www.tahitikeys.uk` |
| Santé | `/api/health` → `{"status":"ok","database":"up","latencyMs":…}` |

### Isolation vis-à-vis de la production

`app.locarent.uk` sert une **autre application** (dépôt `panaho82/car-rental-saas`,
MySQL + MinIO + Resend), utilisée par des agences. Elle ne doit pas être touchée.

| | Production | Lot 0 |
|---|---|---|
| Projet Dokploy | `locarent` | `Tahiti Keys` |
| Application | `locarent` (`B1SX-UYq…`) | `tahitikeys` (`TdfuTKIN…`) |
| Conteneurs | `car-rental-{app,mysql,cron,minio}` | `compose-…-{app,postgres,migrate}` |
| Base | MySQL, son volume | PostgreSQL, **son volume** |
| Signature `/api/health` | `{"status":"healthy","database":"connected"}` | `{"status":"ok","database":"up"}` |

Le domaine est **hors de `locarent.uk`** : plus de joker qui capte les
sous-domaines, plus d'ambiguïté sur l'environnement consulté.

### Règles d'isolation dans le fichier compose

`docker-compose.prod.yml` ne contient **ni `name:` de pile, ni port publié** :

- un `name:` codé en dur fait que deux applications déployées depuis le même
  fichier visent **la même pile Docker** — conteneurs et volumes partagés ;
- un port publié fixe provoque une collision au deuxième déploiement.

Le mapping de port vit dans `docker-compose.local.yml`, réservé au poste de
développement.

### Deux pièges rencontrés lors de ce déploiement

1. **Supprimer une application Dokploy ne supprime pas ses conteneurs.** Après
   suppression, une pile est restée en marche plusieurs jours, avec son
   PostgreSQL, et a bloqué le déploiement suivant (port occupé). Vérifier avec
   `docker.getContainersByAppNameMatch` et arrêter/supprimer explicitement.
2. **Ajouter un domaine à une application déjà déployée ne régénère pas la
   configuration dynamique de Traefik.** Un redéploiement n'a pas suffi : il a
   fallu `settings.reloadTraefik` (API Dokploy) pour que le routeur TLS et le
   certificat soient créés. ⚠️ Ce rechargement interrompt brièvement **tous**
   les services de l'instance, production comprise (quelques secondes).

### Vérifications faites sur tahitikeys.uk

- certificat Let's Encrypt valide sur l'apex et sur `www` ;
- `/api/health` renvoie la signature du Lot 0, distincte de la production ;
- `/admin/index` sans session → 307 vers `/login` ;
- inscription réelle dans un navigateur → tableau de bord, cookie `httpOnly`
  **et `secure`**, `SameSite=Lax` ;
- écran Équipe accessible au propriétaire ;
- production toujours à 200 sur `/`, `/login`, `/api/health`, conteneurs
  « Up 11 days » (jamais redémarrés).

### Redéployer

```bash
curl -X POST "$DOKPLOY/api/trpc/compose.deploy" \
  -u "$BASIC_AUTH" -H "x-api-key: $DOKPLOY_KEY" \
  -H "content-type: application/json" \
  -d '{"json":{"composeId":"TdfuTKIN0bamVepc1xWsz"}}'
```
