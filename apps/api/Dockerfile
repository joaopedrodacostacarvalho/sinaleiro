# ---- Base ----
FROM node:24-alpine AS base
WORKDIR /app

# ---- Desenvolvimento (hot reload) ----
FROM base AS development
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN npm ci
COPY packages/types ./packages/types
COPY apps/api ./apps/api
RUN npm run build --workspace=@sinaleiro/types
EXPOSE 3000
CMD ["npm", "run", "start:dev", "--workspace=apps/api"]

# ---- Build de Produção ----
FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN npm ci
COPY packages/types ./packages/types
COPY apps/api ./apps/api
RUN npm run build --workspace=@sinaleiro/types \
  && npm run build --workspace=apps/api \
  && npm prune --omit=dev

# ---- Runtime de Produção ----
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/types/package.json ./packages/types/
COPY --from=builder --chown=node:node /app/packages/types/dist ./packages/types/dist
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/v1/linhas').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
