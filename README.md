# Sinaleiro

Repositório monorepo do projeto **Sinaleiro** (Metrorec Colaborativo).

## Arquitetura do Projeto

Este projeto utiliza a estrutura de **npm workspaces** para gerenciar múltiplas aplicações de forma centralizada, orquestradas em ambiente de desenvolvimento via **Docker**.

```text
sinaleiro/
├── apps/
│   └── api/                    # Backend principal construído com NestJS
│       ├── src/
│       │   ├── auth/           # Integração com Firebase Admin SDK e Guards
│       │   ├── estacoes/       # Domínio e entidade de Estações
│       │   ├── linhas/         # Domínio e entidades de Linhas e Sentidos
│       │   ├── reportes/       # Domínio e entidades de Reportes e Confirmações
│       │   ├── trens/          # Domínio e entidade de Trens
│       │   └── usuarios/       # Domínio e entidade de Usuários
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
* **Autenticação:** Firebase Admin SDK
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

3. **Suba o ambiente com Docker Compose:**
   Na raiz do projeto, execute:
   ```bash
   docker compose up --build
   ```
   > **Dica:** Para rodar em segundo plano (sem prender o terminal), utilize `docker compose up -d`.

4. **Acesse a API:**
   Após a inicialização do NestJS, a API estará disponível em:
   `http://localhost:3000`

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

## Status Atual

- [x] Estrutura base do Monorepo (`npm workspaces`)
- [x] Ambiente Docker de desenvolvimento (Node 24 Alpine + PostgreSQL 17)
- [x] Pacote de tipos compartilhados (`@sinaleiro/types`)
- [x] Módulo de Autenticação com Firebase Admin SDK e Guard de rotas
- [x] Modelagem e Entidades TypeORM (`Usuario`, `Linha`, `LinhaSentido`, `Estacao`, `Trem`, `Reporte`, `ConfirmacaoReporte`)
- [x] Seed do banco de dados com linhas e estações reais do Metrorec
- [ ] Sincronização de usuários Firebase com o PostgreSQL e regras de negócio
- [ ] Aplicação Frontend Web (`apps/web`)
