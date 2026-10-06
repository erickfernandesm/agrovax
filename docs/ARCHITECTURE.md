# AgroVax - Arquitetura

Documento de referência da arquitetura, das decisões e do que está implementado.

## 1. Visão geral

```
┌──────────────────────────── celular ────────────────────────────┐
│  Telas (expo-router)                                            │
│     │  só exibem dados e disparam ações                         │
│  Features / operações  (regras de negócio do app)               │
│     │                                                           │
│  LocalStore ──► SQLite (fonte da verdade no aparelho)           │
│     │              └─► fila de operações (outbox)               │
│  SyncEngine ◄── detecção de conexão                             │
└─────────┬───────────────────────────────────────────────────────┘
          │ HTTPS / REST (JSON)
┌─────────▼──────────── API (Node + Express) ─────────────────────┐
│  rotas ► controllers ► services ► Prisma                        │
│  middlewares: autenticação, acesso à fazenda, admin, rate limit │
└─────────┬───────────────────────────────────────────────────────┘
          │
     PostgreSQL (multi-tenant por fazenda)
```

Princípio que orienta tudo: **o aparelho é autossuficiente**. Toda leitura e toda gravação do
dia a dia acontecem no banco local. A API é o ponto de encontro entre aparelhos e a cópia de
segurança, nunca um pré-requisito para trabalhar.

## 2. Decisões tecnológicas

| Tema | Escolha | Motivo |
| --- | --- | --- |
| App | React Native + Expo (SDK 57) + TypeScript | Preferência do projeto; um código para Android e iOS; build pela nuvem (EAS). |
| Navegação | expo-router | Padrão atual do Expo; rotas por arquivo. |
| Banco local | Repositório em memória persistido em SQLite (expo-sqlite) | Consultas instantâneas e a mesma lógica no aparelho, no navegador e nos testes. Ver seção 5. |
| API | Node 20 + Express 5 + TypeScript | Simples, estável, barato de hospedar. |
| Banco | PostgreSQL + Prisma 6 | Preferência do projeto. Prisma fixado na linha 6 (estável). |
| Validação | zod, em pacote compartilhado | O mesmo schema valida no app (antes de gravar) e na API (ao sincronizar). |
| Autenticação | JWT de acesso (15 min) + refresh token opaco rotacionado (90 dias) | Sessão longa para quem fica semanas sem sinal, com revogação no servidor. |
| Senhas | bcrypt (custo 12) | Hash seguro, sem compilação nativa no deploy. |
| Notificações | Locais (expo-notifications) | Sem custo e sem depender de internet. |
| Monorepo | npm workspaces | Sem ferramenta adicional. |
| Testes | Vitest + Supertest + PostgreSQL real descartável | A API é testada com as migrations reais, sem mocks de banco. |

### Desvios em relação à sugestão inicial

- **Um pacote compartilhado em vez de três** (`shared`, `types`, `validation` viraram pastas de
  `packages/shared`).
- **PostgreSQL embarcado para desenvolvimento e testes**: não exige Docker nem instalação.
- **Cinco abas em vez de sete**: Início, Animais, Rebanhos, Alertas e Mais (Vigilância, Doenças,
  Sincronização e Perfil).
- **A sincronização é o único caminho de escrita dos dados do rebanho.** Não há rotas REST
  separadas de "criar animal" ou "registrar vacina": o app grava localmente e envia operações
  por `/sync/push`. Duas vias de escrita exigiriam manter as mesmas regras em dois lugares.

## 3. Estrutura de pastas

```
agro/
├── apps/
│   ├── api/
│   │   ├── prisma/                    schema, migrations, seed DEMO
│   │   ├── scripts/                   banco embarcado, make-admin, set-password
│   │   ├── src/
│   │   │   ├── config/env.ts          variáveis de ambiente validadas
│   │   │   ├── lib/                   prisma, logger, erros, validação, criptografia
│   │   │   ├── middleware/            authenticate, farmAccess, requireAdmin, rateLimit, errorHandler
│   │   │   ├── modules/
│   │   │   │   ├── auth/              cadastro, login, sessão, recuperação de senha
│   │   │   │   ├── farms/             fazendas e vínculos
│   │   │   │   ├── sync/              push, pull, conflitos, limites de plano
│   │   │   │   ├── catalog/           doenças, sintomas e vigilância para o app
│   │   │   │   ├── surveillance/      fontes externas de alertas
│   │   │   │   ├── admin/             rotas administrativas
│   │   │   │   └── plans/             planos padrão
│   │   │   ├── services/mailer.ts
│   │   │   ├── app.ts                 montagem do Express (dependências injetadas)
│   │   │   └── server.ts
│   │   └── tests/                     auth, farms, sync, admin
│   └── mobile/
│       └── src/
│           ├── app/                   rotas (telas)
│           │   ├── (auth)/            login, cadastro, recuperação de senha
│           │   └── (app)/             abas, animais, lotes, registros, vigilância, doenças, sync, perfil
│           ├── components/            componentes reutilizáveis
│           ├── data/
│           │   ├── store/             LocalStore e adaptadores de persistência
│           │   ├── sync/              SyncEngine
│           │   ├── operations.ts      regras de gravação (ex.: vacinação por lote)
│           │   ├── catalog.ts         cópia local dos catálogos
│           │   └── DataContext.tsx    liga dados e sincronização à interface
│           ├── features/              auth, herd (animais e lotes), health (registros e linha do tempo)
│           ├── hooks/, lib/, services/, config/, theme/
├── packages/shared/src/
│   ├── domain/                        enums e rótulos em português
│   ├── sync/                          schemas dos registros e contrato da sincronização
│   ├── logic/                         datas, alertas, notificações, contagens, linha do tempo
│   ├── types/                         contratos da API e catálogos
│   └── validation/                    schemas de autenticação e fazenda
└── docs/ARCHITECTURE.md
```

Regras de organização:

- Telas não contêm regra de negócio nem acessam API ou banco. Usam `features/`, `data/` e hooks.
- Na API, só os `services` falam com o Prisma.
- Regras que valem nos dois lados (validação dos registros, cálculo de alertas, contagens)
  vivem em `packages/shared` e são funções puras, testadas em Node.

## 4. Modelo de dados

O modelo completo está em `apps/api/prisma/schema.prisma`.

```
User ──< Membership >── Farm ──1 Subscription >── Plan
                         │
        ┌────────────────┼──────────────────────────────┐
      Animal >── Lot     │                              │
        └────┬────┘      │                              │
   Vaccination, PreventiveTreatment,               SyncOperation
   SymptomRecord, HealthEvent
   (cada um aponta para animal OU lote)

Catálogos globais: Disease >──< Symptom (DiseaseSymptom), SurveillanceAlert
Sessão: RefreshToken, PasswordResetToken
```

### Multi-tenant

- A **fazenda** (`Farm`) é a unidade de isolamento. Toda tabela de dados do produtor tem `farmId`.
- Um usuário se liga a fazendas por `Membership`, com papel `OWNER`, `MANAGER` ou `WORKER`.
- Toda rota de dados tem o formato `/v1/farms/:farmId/...` e passa pelo middleware `farmAccess`,
  que confere o vínculo no banco. Sem vínculo, a resposta é 404.
- Na sincronização, um registro só pode referenciar registros da mesma fazenda, e um id que
  pertence a outra fazenda é recusado sem revelar nada.

### Individual e lote na mesma conta

- `Lot.declaredQuantity` é o número de cabeças informado pelo produtor.
- `Animal.lotId` é opcional. Os animais vinculados são o subconjunto identificado do lote.
- Um lote pode existir sem nenhum animal cadastrado.
- Cabeças do lote = quantidade informada. Se houver mais animais identificados do que o
  informado, vale a contagem real e a tela sugere corrigir a quantidade.
- Total da fazenda = cabeças dos lotes + animais ativos sem lote.

### Registro para o lote inteiro

Vacinação, tratamento, sintoma e evento apontam para **um animal ou um lote** (restrição `CHECK`
no banco e validação no app). Ao registrar vacinação ou tratamento para o lote:

1. grava-se o registro do lote (a fonte da verdade do evento);
2. na mesma operação atômica, grava-se uma cópia para cada animal ativo vinculado ao lote, com
   `parentId` apontando para o registro do lote.

O histórico acompanha o animal mesmo que ele mude de lote. Excluir o registro do lote exclui as
cópias. O alerta é gerado uma vez, para o lote, e não para cada cópia.

### Campos de sincronização

| Campo | Função |
| --- | --- |
| `id` (UUID) | Gerado no aparelho. É o mesmo id no celular e no servidor. |
| `version` | Incrementado a cada alteração no servidor. |
| `syncSeq` | Posição da alteração na sequência da fazenda (`Farm.syncSeq`); cursor do download incremental. |
| `deletedAt` | Exclusão lógica, para que a exclusão também sincronize. |

## 5. Offline-first

### Banco local

`LocalStore` mantém os registros da fazenda em memória e os persiste por um adaptador:

| Ambiente | Adaptador |
| --- | --- |
| Android / iOS | SQLite (`expo-sqlite`), uma transação por gravação |
| Pré-visualização web | `localStorage` |
| Testes | memória |

Por que em memória: as consultas ficam instantâneas em celulares intermediários e a mesma
lógica (filtros, alertas, fila) é exercitada pelos testes automatizados, sem um caminho de SQL
separado que só rodaria no aparelho. O custo é carregar a fazenda inteira ao abrir o app, o que
limita o tamanho prático a algumas dezenas de milhares de registros (ver riscos).

### Regras

1. **Leitura**: as telas leem somente do banco local.
2. **Gravação**: cada ação valida os dados, grava o registro e insere uma operação na fila, tudo
   em uma única gravação atômica. Se o disco falhar, nada fica pela metade.
3. **Ids**: UUID gerado no aparelho. Não existe id temporário a trocar depois.
4. **Alertas**: calculados no aparelho por função pura sobre os registros locais.
5. **Notificações**: locais, agendadas no próprio aparelho.
6. **Sessão**: tokens no armazenamento seguro do sistema; perfil no banco local.
7. **Falha de rede nunca desloga e nunca apaga dados.**
8. **Sair da conta não apaga os dados locais**: alterações ainda não enviadas continuam no
   aparelho e são enviadas quando o mesmo usuário entrar de novo.

Exige internet: criar conta, entrar pela primeira vez no aparelho, recuperar senha, alterar
dados da fazenda e baixar pela primeira vez os catálogos (doenças e vigilância).

## 6. Sincronização

### Envio (push)

`POST /v1/farms/:farmId/sync/push` recebe operações em ordem:

```
{ opId, entity, recordId, action: UPSERT | DELETE, baseVersion, changes }
```

- `opId` é gerado no aparelho e gravado em `SyncOperation`. Reenviar a mesma operação devolve o
  resultado anterior sem aplicar de novo (**idempotência**).
- Cada operação tem transação própria, que incrementa `Farm.syncSeq`. Esse incremento bloqueia a
  linha da fazenda, colocando as alterações em ordem total.
- Resultado por operação: `APPLIED`, `CONFLICT` ou `REJECTED`. O que foi aplicado sai da fila; o
  resto permanece (**sincronização parcial**).
- Edições seguidas no mesmo registro, feitas offline, são fundidas em uma única operação.

### Recebimento (pull)

`GET /v1/farms/:farmId/sync/pull?cursor=N` devolve, em páginas, os registros com `syncSeq > N`.
Só trafega o que mudou. Alterações locais ainda não enviadas não são sobrescritas pelo que chega.

### Conflitos

- Criações não conflitam (UUID).
- Edições enviam só os campos alterados. Campos diferentes alterados por dois aparelhos são
  ambos preservados.
- Se a operação parte de uma versão antiga e muda o valor de um campo, ela é aplicada (vale o
  último envio), o resultado é `CONFLICT`, o valor sobrescrito fica em `SyncOperation.detail` e
  o usuário vê um aviso na tela de sincronização. O servidor não guarda histórico por campo,
  então o aviso também aparece quando o outro aparelho alterou outro campo.
- Editar um registro excluído em outro aparelho é `REJECTED` (`RECORD_DELETED`).

### Falhas

| Situação | Comportamento |
| --- | --- |
| Sem rede | Fila intacta; nova tentativa em 5 s, 15 s, 1 min, 5 min e ao reconectar. |
| Resposta perdida | O reenvio usa o mesmo `opId`; nada é duplicado. |
| Erro temporário do servidor | A operação continua na fila. |
| Recusa (validação, limite do plano, referência inválida) | A operação fica marcada com o motivo; o dado local é mantido. O usuário pode corrigir o registro (que volta à fila), tentar de novo ou descartar. |

### Quando sincroniza

Ao abrir o app, ao reconectar, 1,5 s após cada gravação, a cada 5 minutos, ao voltar para o app
e pelo botão "Sincronizar agora".

### Estados na interface

`Sincronizado`, `Sincronizando`, `Offline`, `Erro de sincronização`, em um selo no topo das abas.
Tocar no selo abre a tela com pendências, recusas e avisos.

## 7. Alertas e notificações

- Antecedências: 30, 15 e 7 dias, mais o estado "vencido", para vacinas e tratamentos.
- Uma aplicação posterior do mesmo produto no mesmo animal ou lote encerra o alerta anterior.
- O usuário pode dispensar e restaurar alertas. Esse estado fica só no aparelho.
- Notificações locais são reagendadas a cada mudança nos registros: uma por antecedência e uma
  no dia do vencimento, às 7h, limitadas às 40 mais próximas.
- **Push**: não implementado. O módulo `services/notifications.ts` concentra tudo o que se
  refere a notificações; adicionar push é registrar o token do aparelho ali e criar o envio no
  servidor. A tabela `Alert` do servidor está reservada para isso.

## 8. Vigilância sanitária e biblioteca

- `SurveillanceAlert` sempre tem `sourceName`; a API recusa alerta sem fonte.
- Fontes externas implementam `SurveillanceProvider`. Há um provedor genérico de feed JSON
  (`SURVEILLANCE_FEED_URL`). Alertas importados guardam provedor e id de origem, o que evita
  duplicar, e nunca são gravados como DEMO.
- Sem fonte configurada, o app mostra só o que o administrador cadastrou. O seed cria alertas
  DEMO, exibidos com selo e aviso de que são fictícios.
- A biblioteca vem da tabela `Disease`. O seed cria os nomes das doenças com texto marcador
  ("Conteúdo DEMO..."), sem nível de risco e sem sintomas associados, para não apresentar
  informação veterinária inventada. Uma doença inteiramente fictícia demonstra a relação
  sintoma-doença.
- Ao registrar um sintoma do catálogo, o app mostra as doenças que o listam com a frase "pode
  estar associado... procure orientação de um médico-veterinário". Nunca há diagnóstico.

## 9. Segurança

- Senhas com bcrypt; a API nunca devolve o hash.
- Refresh token guardado com hash, rotacionado a cada uso, com detecção de reuso e tolerância de
  2 minutos para resposta perdida.
- Recuperação de senha: código de 6 dígitos, 15 minutos, uso único, bloqueio após 5 erros,
  resposta idêntica para e-mail existente ou não.
- Isolamento por fazenda verificado no banco a cada requisição e a cada operação sincronizada.
- Rotas `/v1/admin/*` exigem `User.isPlatformAdmin`.
- Validação de toda entrada com zod; corpo limitado a 1 MB; `helmet`; CORS fechado por padrão.
- Rate limit geral e mais restrito nas rotas de autenticação.
- Logs estruturados com credenciais ocultadas.
- Segredos somente em variáveis de ambiente; a API não inicia com configuração inválida.

## 10. Assinatura e administração

- `Plan` (FREE, PRO, ENTERPRISE) guarda limites e feature flags em JSON, editáveis sem deploy.
  **Os limites e preços atuais são provisórios.**
- `Subscription` liga a fazenda ao plano, com status, vencimento e campos reservados para o
  gateway de pagamento. Toda fazenda nasce no plano gratuito.
- **Limites**: o servidor recusa (`PLAN_LIMIT`) a criação de animais ou lotes além do limite. O
  app avisa antes e bloqueia o botão quando sabe que o limite foi atingido.
- **Cobrança**: não integrada. A troca de plano é feita pelo administrador.
- **Administração**: somente API (`/v1/admin`), sem painel web: usuários, fazendas, doenças,
  sintomas, vigilância (incluindo importação), planos e assinaturas.

## 11. Limitações conhecidas e riscos

1. **Não executado em aparelho ou emulador.** O fluxo completo foi testado de ponta a ponta na
   pré-visualização web. No aparelho, mudam três peças que não foram executadas: a persistência
   em SQLite, as notificações locais e a câmera. O bundle Android compila.
2. **Foto do animal fica só no aparelho.** Enviar ao servidor exige um serviço de armazenamento
   de arquivos. A tabela `AnimalPhoto` existe para isso.
3. **Fonte oficial de vigilância indefinida.** Não há confirmação de uma API pública oficial de
   surtos. A estrutura está pronta; falta a fonte e sua licença de uso.
4. **Conteúdo veterinário inexistente.** A biblioteca precisa de conteúdo revisado por
   médico-veterinário.
5. **Volume de dados.** O banco local carrega a fazenda inteira em memória. Um lote com
   milhares de animais identificados gera milhares de cópias por vacinação. Acima de algumas
   dezenas de milhares de registros será preciso migrar as consultas para SQL (a interface do
   `LocalStore` isola essa troca).
6. **Aviso de conflito impreciso** (ver seção 6): avisa a mais, nunca a menos.
7. **Relógio do aparelho.** Alertas offline dependem da data do celular.
8. **Notificações no Android.** Economia de bateria de alguns fabricantes atrasa notificações
   agendadas. O iOS limita a 64. A central de alertas é a referência.
9. **Sessão vencida após 90 dias sem conexão.** O usuário precisa entrar de novo; os dados
   locais são mantidos.
10. **Dados locais sem criptografia** e mantidos após sair da conta.
11. **Limite de plano offline.** O app só bloqueia o que conhece localmente; quem decide é o
    servidor, e o excedente fica como alteração recusada.
12. **LGPD.** Faltam termos de uso, política de privacidade e exclusão de conta, exigidos pelas
    lojas.
13. **Cobrança e painel administrativo** não existem.
14. **Atualizações do Expo** trazem mudanças incompatíveis; atualizar exige teste completo.

## 12. Fases

| Fase | Conteúdo | Situação |
| --- | --- | --- |
| 1 | Arquitetura, banco, autenticação, navegação, tema | Concluída |
| 2 | Animais, lotes, dashboard, vacinação, tratamentos | Concluída |
| 3 | Alertas, histórico sanitário, sintomas, biblioteca | Concluída |
| 4 | Offline-first, sincronização, fila, conflitos | Concluída |
| 5 | Vigilância, fontes externas, notificações locais | Concluída (sem fonte oficial; push não implementado) |
| 6 | Planos, assinatura, limites, administração | Concluída (sem cobrança e sem painel) |
