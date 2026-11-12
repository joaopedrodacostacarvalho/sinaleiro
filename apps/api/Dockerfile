FROM node:24-alpine

WORKDIR /app

# Copia os manifestos da raiz e da API
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/types/package*.json ./packages/types/

# Instala as dependências do workspace da API
RUN npm install

# Copia o código-fonte
COPY . .

RUN npm run build --workspace=@sinaleiro/types

EXPOSE 3000

# Usa o script nativo de desenvolvimento do NestJS (com hot reload)
CMD ["npm", "run", "start:dev", "--workspace=apps/api"]
