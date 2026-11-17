# Sinaleiro

Repositório monorepo do projeto **Sinaleiro** (Metrorec Colaborativo). Plataforma colaborativa para reportar em tempo real a situação das linhas, estações e trens do Metrô do Recife.

## Arquitetura do Projeto

Este projeto utiliza a estrutura de **npm workspaces** para gerenciar múltiplas aplicações de forma centralizada, orquestradas em ambiente de desenvolvimento via **Docker**.

```text
sinaleiro/
├── apps/
│   └── api/                    # Backend principal construído com NestJS
│       ├── src/
│       │   ├── auth/           # Firebase Admin SDK, AuthService e FirebaseAuthGuard
│       │   ├── estacoes/       # Domínio, entidade e DTOs validados de Estações
│       │   ├── linhas/         # Domínio, entidades e DTOs de Linhas e Sentidos
│       │   ├── reportes/       # Domínio, entidades e DTOs de Reportes e Confirmações
│       │   ├── trens/          # Domínio, entidade e DTOs de Trens
│       │   ├── usuarios/       # Domínio, entidade e DTOs de Usuários
│       │   ├── app.module.ts   # Módulo raiz (TypeORM, módulos de domínio)
│       │   └── main.ts         # Bootstrap (ValidationPipe global + Swagger)
│       └── Dockerfile          # Configuração da imagem Docker (Node 24 Alpine)
├── packages/
│   └── types/                  # Pacote compartilhado (@sinaleiro/types)
│       └── src/                # Enums e interfaces globais do domínio
├── .env                        # Variáveis de ambiente locais (ignorado pelo Git)
├── .env.example                # Modelo de variáveis de ambiente
├── docker-compose.yml          # Orquestração dos contêineres (API + PostgreSQL)
└── package.json                # Configuração raiz do npm workspaces
```

## Tecnologias Utilizadas

* **Runtime:** Node.js 24 (Alpine Linux)
* **Framework Backend:** NestJS (TypeScript / ES Modules)
* **Banco de Dados & ORM:** PostgreSQL 17 & TypeORM
* **Autenticação:** Firebase Admin SDK (`firebase-admin/app` + `firebase-admin/auth`)
* **Validação:** `class-validator` + `class-transformer` com `ValidationPipe` global
* **Documentação:** `@nestjs/swagger` + `swagger-ui-express` em `/api/docs`
* **Monorepo & Tipagem:** npm workspaces (`@sinaleiro/types`)
* **Infraestrutura Local:** Docker & Docker Compose (com *hot reload* ativo)

## Pré-requisitos

Para rodar este projeto localmente, você precisa ter instalado em sua máquina:
* [Docker](https://docker.com)
* [Docker Compose](https://docker.com)
* Credenciais de conta de serviço (*Service Account*) de um projeto no **Firebase Console**.

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
   Preencha as credenciais do Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) e as variáveis do banco (`DB_*`).

3. **Suba o ambiente com Docker Compose:**
   Na raiz do projeto, execute:
   ```bash
   docker compose up --build
   ```
   > **Dica:** Para rodar em segundo plano (sem prender o terminal), utilize `docker compose up -d`.

4. **Acesse a API:**
   Após a inicialização do NestJS, a API estará disponível em:
   `http://localhost:3000`

5. **Acesse a documentação interativa:**
   A UI do Swagger fica em `http://localhost:3000/api/docs`.

## Documentação da API (Swagger)

A documentação é gerada automaticamente a partir dos decorators `@ApiProperty` (nos DTOs) e `@ApiTags`/`@ApiBearerAuth` (nos controllers).

* **UI interativa:** `http://localhost:3000/api/docs`
* **JSON OpenAPI:** `http://localhost:3000/api/docs-json`
* **Agrupamento por domínio:** `auth`, `usuarios`, `linhas`, `estacoes`, `trens`, `reportes`
* **Esquema de autenticação:** `Bearer` nomeado `firebase-auth` (ID Token emitido pelo Firebase Authentication)

**Como testar endpoints protegidos:**

1. Obtenha um **ID Token** do Firebase via SDK cliente (login Google) ou via `signInWithCustomToken` (login local, quando implementado).
2. Na UI do Swagger, clique em **Authorize** no esquema `firebase-auth`.
3. Cole o token (sem o prefixo `Bearer`) e confirme. O `persistAuthorization` mantém o token entre recarregamentos.

## Autenticação e Autorização

A autenticação é delegada ao **Firebase Authentication**. O backend **não gerencia senhas** nem sessões próprias — ele apenas valida o ID Token em cada requisição.

* **`FirebaseAuthGuard`** (`apps/api/src/auth/firebase-auth/firebase-auth.guard.ts`) valida o header `Authorization: Bearer <idToken>` via `AuthService.verifyToken`.
* Após validar, o guard chama `UsuariosService.findOrCreateFromFirebase(decodedToken)`, garantindo que o usuário exista no PostgreSQL e injetando a entidade completa em `request.user`.
* Use o decorator **`@CurrentUser()`** para acessar o usuário autenticado no controller (aceita `@CurrentUser()` ou `@CurrentUser('id')`).
* `UsuariosModule` está marcado como `@Global` e é reexportado por `AuthModule`, de modo que `UsuariosService` está disponível em toda a aplicação sem import explícito.

**Rotas protegidas atualmente:**

| Controller | Proteção |
| :--- | :--- |
| `UsuariosController` | **Todas as rotas** (guard no nível do controller) |
| `LinhasController` | `POST`, `PATCH`, `DELETE` |
| `EstacoesController` | `POST`, `PATCH`, `DELETE` |
| `TrensController` | `POST`, `PATCH`, `DELETE` |
| `ReportesController` | `POST`, `PATCH`, `DELETE` |

Os endpoints `GET` de listagem permanecem públicos no MVP, para permitir consulta anônima de status.

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

* **Parar os contêineres (mantendo os dados do banco):**
  ```bash
  docker compose down
  ```

* **Visualizar logs da API ou do Banco em tempo real:**
  ```bash
  docker compose logs -f api
  docker compose logs -f postgres
  ```

* **Instalar uma nova dependência na API:**
  Instale o pacote a partir da raiz especificando o workspace e reconstrua o contêiner renovando os volumes anônimos de `node_modules`:
  ```bash
  npm install <nome-do-pacote> --workspace=apps/api
  docker compose up --build --renew-anon-volumes -d
  ```

* **Recompilar o pacote compartilhado `@sinaleiro/types`:**
  Caso adicione novos enums ou interfaces em `packages/types/src`:
  ```bash
  npm run build --workspace=@sinaleiro/types
  ```

* **Gerar recursos com o Nest CLI dentro do contêiner:**
  ```bash
  docker compose exec -w /app/apps/api api npx nest g resource <nome-do-recurso> --no-spec
  ```

* **Verificar a documentação OpenAPI em JSON:**
  ```bash
  curl http://localhost:3000/api/docs-json | jq
  ```

## Status Atual

- [x] Estrutura base do Monorepo (`npm workspaces`)
- [x] Ambiente Docker de desenvolvimento (Node 24 Alpine + PostgreSQL 17)
- [x] Pacote de tipos compartilhados (`@sinaleiro/types`)
- [x] Módulo de Autenticação com Firebase Admin SDK e Guard de rotas
- [x] Modelagem e Entidades TypeORM (`Usuario`, `Linha`, `LinhaSentido`, `Estacao`, `Trem`, `Reporte`, `ConfirmacaoReporte`)
- [x] Seed do banco de dados com linhas e estações reais do Metrorec
- [x] Documentação automática da API com Swagger em `/api/docs`
- [x] Esquema de autenticação Bearer (`firebase-auth`) na UI do Swagger
- [x] `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform`
- [x] DTOs de `linhas`, `estacoes`, `trens` e `reportes` com `class-validator` + `@ApiProperty`
- [x] DTOs parciais (`Update*Dto`) usando `PartialType` de `@nestjs/swagger`
- [x] Guardas de autenticação aplicadas a todas as rotas de escrita
- [x] `UsuariosModule` como `@Global`, reexportado por `AuthModule`
- [x] Correção do typo `UpdateTrenDto` → `UpdateTremDto`
- [ ] **Correção do bug de recursão em `AuthService.verifyToken`** (Prioridade 1)
- [ ] Migração do `AuthService` para a API modular (`firebase-admin/app` + `firebase-admin/auth`)
- [ ] Implementação das regras de negócio nos services (hoje são *stubs*)
- [ ] Validação cruzada do `tipo` do reporte (defesa em profundidade)
- [ ] Lógica de expiração de reportes
- [ ] Cálculo de status efetivo (`vw_status_estacao`)
- [ ] Heurística de matching de trem
- [ ] Endpoint de confirmação de reporte (`POST /reportes/:id/confirmacoes`)
- [ ] Endpoints de auth dedicados (`/auth/*`)
- [ ] `HttpExceptionFilter` para padronização de erros
- [ ] CORS, Helmet e rate limiting (`@nestjs/throttler`)
- [ ] Migrações versionadas do TypeORM (hoje usa `synchronize: true`)
- [ ] `docker-compose.prod.yml` e configuração do Nginx
- [ ] Testes unitários e de integração (TDD)
- [ ] Pipeline CI/CD no GitHub Actions
- [ ] Aplicação Frontend Web (`apps/web`)
