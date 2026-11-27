FROM node:24-alpine

WORKDIR /app

# Manifestos (workspace)
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
COPY packages/types/package*.json ./packages/types/

RUN npm install

COPY . .

RUN npm run build --workspace=@sinaleiro/types

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=@sinaleiro/web"]
