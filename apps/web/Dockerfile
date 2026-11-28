# ---- Base ----
FROM node:24-alpine AS base
WORKDIR /app

# ---- Desenvolvimento (Vite HMR) ----
FROM base AS development
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/
RUN npm ci
COPY packages/types ./packages/types
COPY apps/web ./apps/web
RUN npm run build --workspace=@sinaleiro/types
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace=@sinaleiro/web", "--", "--host", "0.0.0.0"]

# ---- Build de Produção ----
FROM base AS builder
COPY package.json package-lock.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/
RUN npm ci
COPY packages/types ./packages/types
COPY apps/web ./apps/web

RUN --mount=type=secret,id=web_env,target=/app/apps/web/.env.production,required=false \
    npm run build --workspace=@sinaleiro/types \
 && npm run build --workspace=@sinaleiro/web

# ---- Runtime de Produção (Nginx) ----
FROM nginx:1.27-alpine AS production

RUN printf 'server {\n\
  listen 80;\n\
  server_name _;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  gzip on;\n\
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;\n\
  location /assets/ {\n\
    expires 1y;\n\
    add_header Cache-Control "public, immutable";\n\
    try_files $uri =404;\n\
  }\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ > /dev/null || exit 1
