# Sinaleiro

Repositório monorepo do projeto **Sinaleiro** (Metrorec Colaborativo). Plataforma colaborativa para reportar e acompanhar em tempo real a situação das linhas, estações e trens do Metrô do Recife.

## Arquitetura do Projeto

Este projeto utiliza a estrutura de **npm workspaces** para gerenciar o backend, o frontend e os contratos compartilhados de forma centralizada, orquestrados em ambiente de desenvolvimento via **Docker**.

```text
sinaleiro/
├── .github/
│   └── workflows/
│       └── ci.yml              # Pipeline de CI (API: lint, build, unit/E2E · Web: lint, tsc, build)
├── apps/
│   ├── api/                    # Backend principal construído com NestJS (/v1)
│   │   ├── src/
│   │   │   ├── auth/           # Firebase Admin SDK, AuthService e FirebaseAuthGuard
│   │   │   ├── common/         # Utilitários compartilhados (Haversine e CacheService)
│   │   │   ├── database/       # Configuração TypeORM, migrations versionadas e catálogo Metrorec
│   │   │   ├── estacoes/       # Domínio, entidade, DTOs e proximidade geográfica (Haversine)
│   │   │   ├── health/         # Endpoint de healthcheck (/v1/health) para contêineres
│   │   │   ├── linhas/         # Domínio, entidades e DTOs de Linhas e Sentidos
│   │   │   ├── reportes/       # Reportes, confirmações/refutações, regras anti-abuso e StatusService (/v1/mapa)
│   │   │   ├── reputacao/      # Cálculo de pesos e atualização transacional de reputação
│   │   │   ├── trens/          # Domínio, heurística de matching de trem e trens ativos
│   │   │   ├── usuarios/       # Domínio, entidade e DTOs de Usuários
│   │   │   ├── app.module.ts   # Módulo raiz (TypeORM, Throttler e módulos de domínio)
│   │   │   └── main.ts         # Bootstrap (URI versioning /v1, ValidationPipe, Helmet, CORS + Swagger)
│   │   ├── test/               # Fixtures compartilhadas e suíte E2E (Vitest + Supertest)
│   │   └── Dockerfile          # Configuração da imagem Docker (Node 24 Alpine)
│   └── web/                    # Frontend SPA construído com React 19, Vite, Material UI e Leaflet
│       ├── src/
│       │   ├── api/            # Cliente HTTP tipado, endpoints de mapa/reportes e contratos
│       │   ├── auth/           # Firebase Client SDK, AuthContext e proteção de rotas
│       │   ├── components/     # MapaMetrorec (OpenStreetMap, traçado dos ramais, siglas e legenda) e StatusIcon
│       │   ├── constants/      # Tokens visuais, cores institucionais e mapeamento de status
│       │   ├── hooks/          # Geolocalização do usuário e cálculo de estações próximas
│       │   ├── pages/          # Tela principal interativa (Home) e fluxo de login
│       │   └── main.tsx        # Ponto de entrada da aplicação React
│       └── Dockerfile          # Configuração da imagem Docker do frontend
├── packages/
│   └── types/                  # Pacote compartilhado (@sinaleiro/types)
│       └── src/                # Enums e interfaces globais do domínio
├── .env                        # Variáveis de ambiente locais (ignorado pelo Git)
├── .env.example                # Modelo de variáveis de ambiente (API + Firebase Web)
├── docker-compose.yml          # Orquestração dos contêineres (PostgreSQL + API + Web)
└── package.json                # Configuração raiz do npm workspaces

```

## Tecnologias Utilizadas

### Backend (`apps/api`)

* **Runtime:** Node.js 24 (Alpine Linux)
* **Framework:** NestJS (TypeScript / ES Modules) com versionamento de URI (`/v1`)
* **Banco de Dados & ORM:** PostgreSQL 17 & TypeORM (com migrations versionadas e catálogo completo do Metrorec/VLT)
* **Autenticação:** Firebase Admin SDK (`firebase-admin/app` + `firebase-admin/auth`)
* **Segurança & Validação:** `helmet`, `@nestjs/throttler`, CORS configurável e `ValidationPipe` global (`class-validator` + `class-transformer`)
* **Documentação:** `@nestjs/swagger` + `swagger-ui-express` em `/api/docs`
* **Testes & Qualidade:** Vitest (`vitest`), Supertest (E2E) & `oxlint` (`--type-aware`)

### Frontend (`apps/web`)

* **Framework & Bundler:** React 19 + Vite + TypeScript
* **Interface & Ícones:** Material UI (`@mui/material`) & Material Icons (`@mui/icons-material`)
* **Mapas & Geolocalização:** Leaflet (`leaflet` + `react-leaflet`) com tiles OpenStreetMap, marcadores com siglas oficiais das estações (`REC`, `JOA`, `COQ`, `JAB`, `CAJ`, etc.), anéis de baldeação e legenda flutuante
* **Autenticação Cliente:** Firebase Client SDK (`firebase/auth`)

### Infraestrutura & CI/CD

* **Monorepo & Tipagem:** npm workspaces (`@sinaleiro/types`)
* **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`)
* **Infraestrutura Local:** Docker & Docker Compose com volume compartilhado `types_dist` e healthchecks

## Pré-requisitos

Para rodar este projeto localmente, você precisa ter instalado em sua máquina:

* [Docker](https://docker.com)
* [Docker Compose](https://docker.com)
* Um projeto configurado no **Firebase Console** (credenciais de *Service Account* para a API e configurações do Web App SDK para o frontend).

## Como Rodar o Projeto (Desenvolvimento)

1. **Clone o repositório:**
```bash
git clone <url-do-seu-repositorio>
cd sinaleiro

```


2. **Configure as variáveis de ambiente:**
Copie o arquivo de exemplo na raiz do projeto para criar o seu `.env` local:
```bash
cp .env.example .env

```


Preencha as variáveis do banco (`DB_*`), as credenciais de conta de serviço do Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) e as chaves públicas do cliente Web (`VITE_API_URL=http://localhost:3000/v1` e `VITE_FIREBASE_*`).
3. **Suba o ambiente completo com Docker Compose:**
Na raiz do projeto, execute:
```bash
docker compose up -d --build

```


> O Compose aguarda o PostgreSQL (`sinaleiro_db`) e a API (`backend_api_dev`) ficarem `healthy` antes de liberar o servidor Vite (`sinaleiro_web_dev`).


4. **Acesse os serviços:**
* **Aplicação Web (Mapa Colaborativo):** `http://localhost:5173`
* **API REST (`/v1`):** `http://localhost:3000/v1`
* **Healthcheck da API:** `http://localhost:3000/v1/health`
* **Documentação Swagger:** `http://localhost:3000/api/docs`



## Documentação da API (Swagger)

A documentação é gerada automaticamente a partir dos decorators `@ApiProperty` (nos DTOs) e `@ApiTags`/`@ApiBearerAuth` (nos controllers).

* **UI interativa:** `http://localhost:3000/api/docs`
* **JSON OpenAPI:** `http://localhost:3000/api/docs-json`
* **Agrupamento por domínio:** `auth`, `usuarios`, `linhas`, `estacoes`, `trens`, `reportes`, `status`, `health`
* **Esquema de autenticação:** `Bearer` nomeado `firebase-auth` (ID Token emitido pelo Firebase Authentication)

**Como testar endpoints protegidos:**

1. Obtenha um **ID Token** do Firebase via SDK cliente (login Google na aplicação web ou via `signInWithCustomToken`).
2. Na UI do Swagger, clique em **Authorize** no esquema `firebase-auth`.
3. Cole o token (sem o prefixo `Bearer`) e confirme. O `persistAuthorization` mantém o token entre recarregamentos.

## Autenticação e Autorização

A autenticação é delegada ao **Firebase Authentication**. O backend **não gerencia senhas** nem sessões próprias — ele valida o ID Token em cada requisição protegida.

* **`FirebaseAuthGuard`** (`apps/api/src/auth/firebase-auth/firebase-auth.guard.ts`) valida o header `Authorization: Bearer <idToken>` via `AuthService.verifyToken`.
* Após validar, o guard chama `UsuariosService.findOrCreateFromFirebase(decodedToken)`, garantindo que o usuário exista no PostgreSQL e injetando a entidade completa em `request.user`.
* Use o decorator **`@CurrentUser()`** para acessar o usuário autenticado no controller (aceita `@CurrentUser()` ou `@CurrentUser('id')`).
* `UsuariosModule` e `ReputacaoModule` estão marcados como `@Global` e disponíveis em toda a aplicação.

**Rotas protegidas atualmente:**

| Controller | Proteção |
| --- | --- |
| `UsuariosController` | **Todas as rotas** (guard no nível do controller) |
| `LinhasController` | `POST`, `PATCH`, `DELETE` |
| `EstacoesController` | `POST`, `PATCH`, `DELETE` |
| `TrensController` | `POST`, `PATCH`, `DELETE` |
| `ReportesController` | `POST /v1/reportes`, `POST /v1/reportes/:id/confirmacoes`, `PATCH`, `DELETE` |

Os endpoints `GET` de listagem, proximidade (`GET /v1/estacoes/proximas`), trens ativos (`GET /v1/trens/ativos`) e status agregado (`GET /v1/estacoes/:id/status`, `GET /v1/linhas/:id/status`, `GET /v1/trens/:id/status`, `GET /v1/mapa`) permanecem públicos para permitir consulta anônima.

## Validação de Dados

A validação é centralizada no **`ValidationPipe` global** configurado em `main.ts`:

```typescript
new ValidationPipe({
  whitelist: true,              // remove campos não declarados no DTO
  forbidNonWhitelisted: true,   // rejeita requisições com campos extras
  transform: true,              // converte tipos automaticamente
  transformOptions: { enableImplicitConversion: true },
});

```

Cada DTO em `apps/api/src/**/dto/` usa decorators do `class-validator` (`@IsInt`, `@IsLatitude`, `@IsHexColor`, `@IsEnum`, `@IsUUID`, etc.) e do `@nestjs/swagger` (`@ApiProperty`, `@ApiPropertyOptional`) para descrever o schema na documentação.

## Comandos Úteis

* **Rodar lint, build e testes da API:**
```bash
npm run lint --workspace=apps/api
npm run build --workspace=apps/api
npm test --workspace=apps/api
npm run test:e2e --workspace=apps/api

```


* **Rodar lint, verificação de tipos e build do Frontend Web:**
```bash
npm run lint --workspace=@sinaleiro/web
npx tsc --noEmit -p apps/web/tsconfig.app.json
npm run build --workspace=@sinaleiro/web

```


* **Parar os contêineres (mantendo os dados do banco):**
```bash
docker compose down

```


* **Visualizar logs dos serviços em tempo real:**
```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f db

```


* **Instalar uma nova dependência em um workspace:**
Instale o pacote a partir da raiz especificando o workspace e reconstrua os contêineres renovando os volumes anônimos de `node_modules`:
```bash
npm install <nome-do-pacote> --workspace=apps/api
# ou
npm install <nome-do-pacote> --workspace=@sinaleiro/web

docker compose up --build --renew-anon-volumes -d

```


* **Recompilar o pacote compartilhado `@sinaleiro/types`:**
```bash
npm run build --workspace=@sinaleiro/types

```


* **Gerar recursos com o Nest CLI dentro do contêiner:**
```bash
docker compose exec -w /app/apps/api api npx nest g resource <nome-do-recurso> --no-spec

```



## Status Atual

* [x] Estrutura base do Monorepo (`npm workspaces`)
* [x] Ambiente Docker de desenvolvimento (PostgreSQL 17 + API NestJS + Frontend React/Vite com healthchecks e volume compartilhado `types_dist`)
* [x] Pacote de tipos compartilhados (`@sinaleiro/types`)
* [x] Módulo de Autenticação com Firebase Admin SDK modular (`firebase-admin/app` + `firebase-admin/auth`) e Guard de rotas
* [x] Modelagem e Entidades TypeORM (`Usuario`, `Linha`, `LinhaSentido`, `Estacao`, `Trem`, `Reporte`, `ConfirmacaoReporte`)
* [x] Migrations versionadas e catálogo completo das linhas e estações do Metrorec (Centro-1, Centro-2, Sul e ramais VLT)
* [x] Documentação automática da API com Swagger em `/api/docs` e versionamento `/v1`
* [x] Esquema de autenticação Bearer (`firebase-auth`) na UI do Swagger
* [x] `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`
* [x] CORS, Helmet, rate limiting global por IP (`@nestjs/throttler`) e endpoint `/v1/health`
* [x] Guardas de autenticação aplicadas a todas as rotas de escrita
* [x] `UsuariosModule` e `ReputacaoModule` como `@Global`
* [x] Sistema de reputação (`ReputacaoService`) com função degrau, piso (`-50`) e atualização transacional
* [x] Regras de criação de reporte: anti-duplicata (5 min), rate limit (10/hora), cooldown pós-refutação (15 min), geolocalização soft (≤ 2 km) e bloqueio de trem em estação `FECHADA`
* [x] Validação cruzada do `tipo` do reporte (`assertAlvoCoerente` + `@Check('reporte_alvo_unico')`)
* [x] Expiração preguiçosa (*lazy*) de reportes (30 min Estação/Linha, 5 min Trem) e renovação por reconfirmação
* [x] Endpoint de confirmação/refutação de reporte (`POST /v1/reportes/:id/confirmacoes`) com limiares por tipo e validação geográfica
* [x] Cálculo de status efetivo (`StatusService`) com agregação ponderada, desempate por gravidade, derivação de linha, cache de 30s e payload agregado (`GET /v1/mapa`)
* [x] Estimativa de estações mais próximas via Haversine (`GET /v1/estacoes/proximas`)
* [x] Heurística de matching de trem (`id_vagao`, candidato único, *round-robin* e reputação ≥ 10) e listagem de ativos (`GET /v1/trens/ativos`)
* [x] Suíte de testes unitários (Vitest), testes E2E (Supertest + PostgreSQL) e análise estática (`oxlint`)
* [x] Aplicação Frontend Web (`apps/web`) com React, Material UI, Leaflet/OpenStreetMap, traçado de ramais/baldeações, envio de reportes e validação comunitária em tempo real
* [x] Pipeline CI no GitHub Actions (`.github/workflows/ci.yml`) validando API (lint, build, unitários e E2E) e Web (lint, typecheck e build)
* [ ] `docker-compose.prod.yml` e estágio de produção com Nginx para servir a SPA e proxy reverso `/api/*`
