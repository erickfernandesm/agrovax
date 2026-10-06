# AgroVax

Plataforma de gestão sanitária para bovinos e equinos, voltada ao produtor rural. Controle
individual e por lote na mesma conta, com funcionamento offline.

> As informações do AgroVax são educativas e de acompanhamento. Elas não substituem a avaliação
> de um médico-veterinário.

**Situação:** as seis fases do MVP estão implementadas. O que ficou de fora (cobrança, painel
administrativo, envio de fotos ao servidor, push, fonte oficial de vigilância) e o que ainda não
foi validado em aparelho estão em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), seção 11.

## O que o app faz

- Conta, fazenda, login, sessão persistente e recuperação de senha
- Animais individuais (bovinos e equinos) com ficha, foto local e linha do tempo sanitária
- Lotes com quantidade informada, com ou sem animais identificados
- Vacinação e tratamento preventivo por animal ou para o lote inteiro
- Registro de sintomas e eventos, com informação educativa e sem diagnóstico
- Alertas de vacinas e tratamentos (30, 15 e 7 dias antes, e vencidos) e notificações locais
- Dashboard com visão individual e visão por rebanho
- Vigilância sanitária e biblioteca de doenças, com conteúdo fictício marcado como DEMO
- Funcionamento offline com sincronização automática ao reconectar
- Planos (FREE, PRO, ENTERPRISE) com limites aplicados

## Stack

- **App:** React Native, Expo SDK 57, expo-router, expo-sqlite, TypeScript
- **API:** Node.js 20, Express 5, TypeScript, REST
- **Banco:** PostgreSQL, Prisma 6
- **Compartilhado:** zod, tipos, regras de alertas e contagens em `packages/shared`
- **Testes:** Vitest, Supertest

## Estrutura

```
apps/api         API REST
apps/mobile      aplicativo (Expo)
packages/shared  enums, validação, contrato de sincronização e regras de negócio puras
docs/            arquitetura
```

## Pré-requisitos

- Node.js 20 ou superior e npm 10
- Para rodar o app: Expo Go no celular, um emulador, ou apenas o navegador (pré-visualização)

Não é preciso instalar PostgreSQL nem Docker: o projeto inclui um PostgreSQL embarcado.

## Instalação

```bash
npm install
```

## Configuração

### API

```bash
cp apps/api/.env.example apps/api/.env
```

Preencha `JWT_ACCESS_SECRET` com um valor próprio:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `DATABASE_URL` | sim | URL do PostgreSQL |
| `JWT_ACCESS_SECRET` | sim | Segredo dos tokens de acesso (mínimo de 32 caracteres) |
| `PORT` | não | Porta da API (padrão 3333) |
| `ACCESS_TOKEN_TTL_MINUTES` | não | Validade do token de acesso (padrão 15) |
| `REFRESH_TOKEN_TTL_DAYS` | não | Validade da sessão (padrão 90) |
| `CORS_ORIGINS` | não | Origens de navegador permitidas, separadas por vírgula |
| `TRUST_PROXY` | não | Número de proxies à frente da API (padrão 0) |
| `LOG_LEVEL` | não | Nível de log (padrão `info`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` | em produção | Envio do código de recuperação de senha |
| `SURVEILLANCE_FEED_URL` | não | Feed JSON de alertas de vigilância sanitária |
| `SEED_DEMO_PASSWORD` | não | Senha do usuário demo criado pelo seed |

Em desenvolvimento, sem `SMTP_HOST`, o código de recuperação de senha aparece no log da API.
Para a pré-visualização web, inclua `http://localhost:8081` em `CORS_ORIGINS`.

### App

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

`EXPO_PUBLIC_API_URL` é o endereço da API visto pelo celular:

| Onde o app roda | Valor |
| --- | --- |
| Emulador Android | `http://10.0.2.2:3333` |
| Simulador iOS | `http://localhost:3333` |
| Celular físico | `http://<IP da máquina na rede>:3333` |
| Navegador (desenvolvimento) | ignorado: usa a mesma máquina que serviu a página |

## Banco de dados

```bash
npm run db:dev       # inicia o PostgreSQL embarcado (porta 5433, dados em apps/api/.pgdata)
npm run db:migrate   # aplica as migrations e gera o Prisma Client
npm run db:seed      # cria planos, catálogo DEMO e a "Fazenda Demo AgroVax"
npm run db:stop      # encerra o PostgreSQL embarcado
```

O seed pode ser executado várias vezes. Ele cria o usuário `demo@agrovax.app` (senha em
`SEED_DEMO_PASSWORD`, ou aleatória exibida uma única vez), lotes, animais, vacinações,
tratamentos, um sintoma, doenças e alertas de vigilância. **Tudo o que o seed cria é fictício e
marcado como DEMO.**

Utilitários (executar em `apps/api`):

```bash
npx tsx scripts/set-password.ts <email> <nova-senha>   # redefine a senha de um usuário
npx tsx scripts/make-admin.ts <email>                  # concede acesso de administrador
npx tsx scripts/make-admin.ts <email> --revoke
```

### Migrations

- Alterou `schema.prisma`: `npm run db:migrate` cria e aplica uma nova migration.
- Produção: `npm run db:deploy -w @agrovax/api`.
- Restrições que o Prisma não expressa (por exemplo, "animal OU lote") estão em SQL na migration.

## Execução local

```bash
npm run db:dev
npm run api                       # API em http://localhost:3333
npm run mobile                    # Expo: QR code para o Expo Go, ou "a" para o emulador
npm run web -w @agrovax/mobile    # pré-visualização no navegador, em http://localhost:8081
```

A pré-visualização web usa o armazenamento do navegador no lugar do SQLite e não tem
notificações. Serve para testar telas e fluxos; o produto é o aplicativo Android e iOS.

## Rotas da API

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | Verificação de saúde |
| POST | `/v1/auth/register` | Cria usuário, fazenda e assinatura gratuita |
| POST | `/v1/auth/login` · `/refresh` · `/logout` | Sessão |
| POST | `/v1/auth/forgot-password` · `/reset-password` | Recuperação de senha |
| GET | `/v1/me` | Usuário autenticado, fazendas e planos |
| GET, POST | `/v1/farms` | Fazendas do usuário |
| GET, PATCH | `/v1/farms/:farmId` | Dados da fazenda |
| POST | `/v1/farms/:farmId/sync/push` | Envia operações do aparelho |
| GET | `/v1/farms/:farmId/sync/pull?cursor=` | Recebe o que mudou desde o cursor |
| GET | `/v1/catalog?version=` | Doenças, sintomas e alertas de vigilância |
| * | `/v1/admin/...` | Usuários, fazendas, doenças, sintomas, vigilância, planos, assinaturas |

Animais, lotes, vacinações, tratamentos, sintomas e eventos são gravados pela sincronização
(`sync/push`), que é o único caminho de escrita desses dados.

## Testes

```bash
npm test             # todos os pacotes
npm run typecheck    # verificação de tipos em todos os pacotes
```

| Pacote | O que cobre |
| --- | --- |
| `packages/shared` | Datas, alertas (faixas de 30/15/7 dias e vencidos), notificações planejadas, contagens de lote, dashboard, linha do tempo, validação dos registros |
| `apps/api` | Autenticação, sessão, recuperação de senha, rate limit, isolamento entre organizações, criação e edição de animal e lote, vacinação individual e por lote, idempotência, sincronização parcial, recebimento incremental e paginado, conflitos, limites de plano, catálogo, vigilância, administração |
| `apps/mobile` | Cliente da API, funcionamento offline, persistência entre aberturas, reconexão, resposta perdida sem duplicar, rejeições e novas tentativas, dois aparelhos convergindo, conflitos, vacinação por lote |

Os testes da API sobem um PostgreSQL descartável (porta 5434) com as migrations reais. Para usar
outro banco, defina `TEST_DATABASE_URL`.

## Funcionamento offline e sincronização

Descrição completa em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), seções 5 e 6. Em resumo:

- O app lê e grava em um banco local; a API não é necessária para o trabalho diário.
- Cada gravação entra em uma fila e é enviada quando houver conexão.
- Os registros usam UUID gerado no aparelho, então não há troca de ids após sincronizar.
- O envio é idempotente (reenviar não duplica) e o recebimento é incremental.
- O que o servidor recusa fica marcado com o motivo, e o dado local é mantido.
- O selo no topo das abas mostra Sincronizado, Sincronizando, Offline ou Erro de sincronização.

## Build do aplicativo

O build para as lojas é feito pelo EAS (serviço de build do Expo):

```bash
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android
npx eas-cli@latest build --platform ios
```

Antes de publicar: definir `EXPO_PUBLIC_API_URL` com o endereço HTTPS de produção, substituir os
ícones padrão em `apps/mobile/assets` pela marca do AgroVax, revisar os identificadores
`app.agrovax.mobile` em `apps/mobile/app.json` e testar em aparelho real.

Para conferir localmente se o app empacota:

```bash
npm run bundle -w @agrovax/mobile
```

## Deploy da API

A API é um processo Node comum e precisa de um PostgreSQL.

1. Crie o banco PostgreSQL e obtenha a `DATABASE_URL`.
2. Configure as variáveis de ambiente (`NODE_ENV=production`, `DATABASE_URL`,
   `JWT_ACCESS_SECRET`, `SMTP_*`, `TRUST_PROXY=1`).
3. Comando de build: `npm install && npm run build -w @agrovax/api`
4. Antes de iniciar: `npm run db:deploy -w @agrovax/api`
5. Comando de início: `npm run start -w @agrovax/api`
6. Use `/health` como verificação de saúde.

A API exige HTTPS à frente dela em produção (fornecido pela hospedagem). Os planos padrão são
criados na primeira inicialização. Não execute o seed em produção: ele cria dados DEMO.
