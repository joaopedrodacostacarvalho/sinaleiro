# Sinaleiro

Repositório monorepo do projeto **Sinaleiro** (Metrorec Colaborativo).

## Arquitetura do Projeto

Este projeto utiliza a estrutura de **npm workspaces** para gerenciar múltiplas aplicações de forma centralizada, orquestradas em ambiente de desenvolvimento via **Docker**.

```text
sinaleiro/
├── apps/
│   └── api/                # Backend principal construído com NestJS
│       ├── src/            # Código-fonte da API
│       └── Dockerfile      # Configuração da imagem Docker (Node 24 Alpine)
├── .env                    # Variáveis de ambiente locais (ignorado pelo Git)
├── .env.example            # Modelo de variáveis de ambiente
├── docker-compose.yml      # Orquestração dos contêineres de desenvolvimento
└── package.json            # Configuração raiz do npm workspaces
```

## Tecnologias Utilizadas

* **Ambiente de Execução:** Node.js 24 (Alpine Linux)
* **Framework Backend:** NestJS (TypeScript)
* **Gerenciamento de Pacotes:** npm workspaces
* **Containerização:** Docker & Docker Compose (com *hot reload* ativo)

---

## Pré-requisitos

Para rodar este projeto localmente, você precisa ter instalado em sua máquina:
* [Docker](https://docker.com)
* [Docker Compose](https://docker.com)

*(Opcional)* Caso queira rodar comandos ou instalar pacotes fora do contêiner, recomenda-se o **Node.js v24+**.

---

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

---

## Comandos Úteis

* **Parar os contêineres:**
  ```bash
  docker compose down
  ```

* **Visualizar logs da API em tempo real:**
  ```bash
  docker compose logs -f api
  ```

* **Instalar uma nova dependência na API:**
  Sempre instale pacotes a partir da raiz especificando o workspace, e depois reconstrua o contêiner para atualizar o `node_modules` interno:
  ```bash
  npm install <nome-do-pacote> --workspace=apps/api
  docker compose up --build
  ```

* **Gerar recursos com o Nest CLI (Controllers, Services, Modules):**
  ```bash
  npx @nestjs/cli generate resource <nome-do-recurso> --project api
  ```

---

## Status Atual

- [x] Estrutura base do Monorepo (`npm workspaces`)
- [x] Ambiente Docker de desenvolvimento com Node 24 Alpine e Hot Reload
- [x] Setup inicial da API em NestJS (`apps/api`)
- [ ] Configuração do Banco de Dados e ORM
- [ ] Implementação das rotas e regras de negócio
