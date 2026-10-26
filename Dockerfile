# syntax=docker/dockerfile:1
#
# Locarent — image de production.
#
# Next 16 produit une sortie `standalone` : un serveur Node autonome, sans
# `next start`. C'est ce serveur qui tourne ici, sous un utilisateur non-root.
#
# Les migrations ne sont PAS lancées au démarrage de l'application : avec
# plusieurs réplicas, elles s'exécuteraient en parallèle. Construire la cible
# `migrator` séparément et l'exécuter en étape de déploiement (voir docs/lot-0.md).
#
#   docker build -t locarent:latest .                      # application (dernier étage)
#   docker build --target migrator -t locarent:migrator .  # migrations

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- dépendances -------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- build -------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `prisma generate` et le build n'ont pas besoin d'une base joignable, mais le
# module d'accès aux données exige une URL définie. Valeur factice, jamais
# utilisée : aucune requête n'est exécutée pendant le build.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

RUN pnpm prisma generate
RUN pnpm build

# --- migrations (cible séparée) ----------------------------------------------
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
CMD ["pnpm", "prisma", "migrate", "deploy"]

# --- exécution (étage par défaut) --------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs \
 && adduser -u 1001 -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
