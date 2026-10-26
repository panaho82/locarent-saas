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

docker compose -f docker-compose.prod.yml --env-file .env.stack up -d --build
curl http://localhost:3212/api/health
docker compose -f docker-compose.prod.yml --env-file .env.stack down -v
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
6. **Port publié** : sur Dokploy, Traefik joint le conteneur par le réseau
   interne, le mapping `${APP_HOST_PORT}:3000` n'est pas nécessaire. Le laisser
   par défaut est inoffensif si le port 3212 est libre sur l'hôte ; sinon, le
   changer ou supprimer la ligne `ports`.

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
| Projet | `locarent` (environnement `production`) |
| Application | compose **`locarent-saas`** — `uEMz95BWn-tCEC4T27Zdq` |
| Dépôt source | `panaho82/locarent-saas`, branche `main`, `./docker-compose.prod.yml` |
| URL | **https://staging.locarent.uk** |
| Domaine → service | `app`, port `3000`, HTTPS Let's Encrypt |
| Santé | `/api/health` → `{"status":"ok","database":"up"}` |

⚠️ **`app.locarent.uk` n'est pas ce déploiement.** Ce domaine sert une autre
application Locarent (dépôt `panaho82/car-rental-saas`, MySQL/MinIO/Resend),
en production. Elle n'a **pas été modifiée**. Le socle du Lot 0 vit sur
`staging.locarent.uk`, qui est un simple sous-domaine (le DNS `*.locarent.uk`
pointe déjà vers le serveur).

### Vérifications faites sur le staging

- certificat Let's Encrypt valide ;
- `/api/health` à 200 avec base joignable ;
- `/admin/index` sans session → 307 vers `/login` ;
- inscription réelle dans un navigateur → tableau de bord, cookie
  `httpOnly` **et `secure`** (HTTPS), `SameSite=Lax` ;
- écran Équipe accessible au propriétaire.

Un compte de vérification (`verif-…@locarent.test`) subsiste sur le staging :
il n'existe pas d'écran de suppression d'agence au Lot 0.

### Redéployer

```bash
# depuis l'interface Dokploy : application locarent-saas → Deploy
# ou par API :
curl -X POST "$DOKPLOY/api/trpc/compose.deploy" \
  -u "$BASIC_AUTH" -H "x-api-key: $DOKPLOY_KEY" \
  -H "content-type: application/json" \
  -d '{"json":{"composeId":"uEMz95BWn-tCEC4T27Zdq"}}'
```
