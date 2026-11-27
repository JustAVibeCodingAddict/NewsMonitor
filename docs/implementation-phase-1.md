# NEWS MONITOR — Especificação de Implementação — Fase 1

> **Nota do repositório (27/11/2026):** este arquivo é o texto original da especificação da Fase 1, guardado sem alterações de conteúdo para consulta. As mudanças aprovadas pelo dono do projeto (por exemplo, **não usar Supabase**) estão registradas em [`decisions.md`](decisions.md). O relatório de entrega da fase será anexado ao final deste arquivo.

**Fundação, infraestrutura e persistência**

- **Versão:** 0.1
- **Data:** 26/11/2026
- **Projeto:** News Monitor
- **Fase:** 1 de 8
- **Status:** Pronto para implementação
- **Orçamento-alvo:** R$ 0/mês

---

## 1. OBJETIVO DA FASE

Construir a infraestrutura técnica inicial do **News Monitor**, garantindo que a aplicação consiga:

- Executar corretamente em ambiente local.
- Ser compilada e validada automaticamente pelo GitHub Actions.
- Conectar-se com segurança ao Supabase.
- Registrar e consultar informações no banco.
- Criar registros de execução do motor.
- Registrar logs e erros.
- Executar verificações automatizadas de saúde.
- Preservar uma estrutura organizada para as próximas fases.

> **Nota:** A Fase 1 não deverá implementar ainda os coletores GDELT, Google News ou RSS. Essas integrações pertencem à Fase 2.

### 1.1 Resultado esperado

Ao final desta fase, deverá existir uma aplicação executável que:

- Inicia corretamente;
- Valida suas configurações;
- Conecta-se ao banco;
- Verifica as tabelas necessárias;
- Registra uma execução de teste;
- Encerra com código de saída apropriado;
- Possui testes automatizados;
- Possui integração contínua;
- Pode executar uma verificação programada na nuvem.

---

## 2. DECISÕES TÉCNICAS

### 2.1 Stack definida

| Tecnologia | Utilização |
| :--- | :--- |
| Node.js 26 LTS | Runtime |
| TypeScript | Linguagem |
| npm | Gerenciador de pacotes |
| Supabase PostgreSQL | Banco de dados |
| Supabase JS | Comunicação com banco |
| Supabase CLI | Migrações |
| Zod | Validação |
| Vitest | Testes |
| GitHub Actions | Automação |
| Git | Versionamento |

- Não utilizar versões experimentais, alpha ou nightly em componentes essenciais.
- Todas as dependências deverão ser registradas no `package-lock.json`.

### 2.2 Repositório

- **Nome sugerido:** `news-monitor`
- **Recomendação inicial:** repositório público.

**Justificativa:**

- Utilização gratuita dos executores padrão do GitHub Actions em repositórios públicos.
- Facilidade para utilizar GitHub Pages futuramente.
- Menos dependência de planos pagos de hospedagem.
- Nenhum segredo, dado privado ou credencial poderá ser armazenado no repositório.

Se houver necessidade de manter o código privado, a arquitetura deverá continuar compatível, mas o consumo gratuito de Actions e as condições de hospedagem deverão ser reavaliados.

### 2.3 Banco de dados

Criar um projeto Supabase independente para o News Monitor.

**Configuração:**

- **Plano:** Free.
- **Banco:** PostgreSQL gerenciado.
- **Região:** mais próxima e adequada entre as disponíveis.
- **Nome do projeto:** `news-monitor`.
- Sem autenticação de usuários nesta fase.
- Sem acesso direto do navegador ao banco.
- O banco deverá ser administrado exclusivamente pelo backend.

---

## 3. ESTRUTURA INICIAL DO REPOSITÓRIO

Criar a seguinte estrutura:

```text
news-monitor/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── health-check.yml
├── docs/
│   ├── architecture.md
│   ├── implementation-phase-1.md
│   ├── operations.md
│   └── decisions.md
├── scripts/
│   ├── health-check.ts
│   └── db-smoke-test.ts
├── src/
│   ├── config/
│   │   └── env.ts
│   ├── core/
│   │   ├── errors.ts
│   │   ├── logger.ts
│   │   └── run-context.ts
│   ├── database/
│   │   ├── client.ts
│   │   └── health.ts
│   ├── repositories/
│   │   └── run.repository.ts
│   ├── services/
│   │   └── health.service.ts
│   └── index.ts
├── supabase/
│   ├── migrations/
│   └── config.toml
├── tests/
│   ├── unit/
│   │   ├── env.test.ts
│   │   └── run-context.test.ts
│   └── integration/
│       └── database.test.ts
├── .env.example
├── .gitignore
├── .nvmrc
├── .npmrc
├── package.json
├── package-lock.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

**Regras:**

- Não criar arquivos sem responsabilidade definida.
- Não concentrar toda a lógica no `index.ts`.
- Não misturar configuração, conexão, regras de negócio e persistência.
- Não antecipar módulos de coleta ainda não implementados.
- Manter documentação atualizada conforme o código evoluir.

---

## 4. CONFIGURAÇÃO DO PROJETO

### 4.1 `package.json`

Criar os scripts de execução:

```json
{
  "name": "news-monitor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=26 <27"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "health": "tsx scripts/health-check.ts",
    "db:smoke": "tsx scripts/db-smoke-test.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "tsc",
    "ci": "npm run typecheck && npm run test && npm run build"
  }
}
```

Instalar as dependências necessárias:

- **Dependências de execução:**
  - `@supabase/supabase-js`
  - `zod`
  - `dotenv`
- **Dependências de desenvolvimento:**
  - `typescript`
  - `tsx`
  - `vitest`
  - `@types/node`
  - `supabase`

> Não instalar bibliotecas adicionais sem justificativa documentada.

### 4.2 TypeScript

Configurar:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `forceConsistentCasingInFileNames: true`
- `esModuleInterop: true`
- `skipLibCheck: true`
- `module: "NodeNext"`
- `moduleResolution: "NodeNext"`
- `target` compatível com Node.js 26.

**Regras de tipagem:**

- O código deverá evitar `any`.
- Quando uma tipagem externa exigir exceções, documentar a razão.

### 4.3 Versão do Node

Criar `.nvmrc` com:

```text
26
```

- A CI deverá utilizar Node 26.
- A versão efetivamente utilizada nos testes deverá ser registrada nos logs.

### 4.4 Configuração de ambiente

Criar `.env.example`:

```env
NODE_ENV=development
LOG_LEVEL=info
SUPABASE_URL=
SUPABASE_SECRET_KEY=
```

**Regras:**

- `.env` nunca poderá ser versionado.
- `.env.example` deverá conter somente nomes de variáveis e valores vazios ou demonstrativos.
- Credenciais não poderão aparecer nos logs.
- Variáveis obrigatórias deverão ser validadas na inicialização.
- A aplicação deverá interromper a inicialização se uma credencial obrigatória estiver ausente ou inválida.
- Preferir a chave secreta atual do Supabase (`sb_secret_...`) no backend. A chave antiga `service_role` está em processo de descontinuação, previsto para o início de 2027.
- A chave secreta terá privilégios elevados e nunca poderá ser incluída no frontend.

---

## 5. BANCO DE DADOS — PRIMEIRA MIGRAÇÃO

### 5.1 Objetivo

Criar somente as tabelas necessárias para sustentar a infraestrutura e as próximas fases.

**Tabelas iniciais:**

- `system_runs`
- `sources`
- `system_settings`

> Não criar antecipadamente todas as tabelas de notícias e acontecimentos nesta etapa. Elas serão implementadas nas fases em que seus modelos e regras estiverem definidos.

### 5.2 Tabela `system_runs`

Responsável por registrar cada execução do sistema.

| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary key |
| `workflow_name` | `TEXT` | Obrigatório |
| `trigger_type` | `TEXT` | `manual`, `scheduled` ou `api` |
| `status` | `TEXT` | Estado da execução |
| `started_at` | `TIMESTAMPTZ` | Obrigatório |
| `finished_at` | `TIMESTAMPTZ` | Opcional |
| `duration_ms` | `BIGINT` | Opcional |
| `summary` | `JSONB` | Resumo da execução |
| `error_summary` | `TEXT` | Opcional |
| `created_at` | `TIMESTAMPTZ` | Default `now()` |

**Estados permitidos:**

- `pending`
- `running`
- `succeeded`
- `partial`
- `failed`

**Regras de transição:**

- O sistema deverá validar as transições de estado.
- Não permitir que uma execução já encerrada retorne automaticamente para `running`.

### 5.3 Tabela `sources`

Responsável pelo cadastro inicial de fontes monitoráveis.

| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `id` | `UUID` | Primary key |
| `name` | `TEXT` | Obrigatório |
| `domain` | `TEXT` | Obrigatório |
| `base_url` | `TEXT` | Obrigatório |
| `feed_url` | `TEXT` | Opcional |
| `source_type` | `TEXT` | Tipo de fonte |
| `source_status` | `TEXT` | Estado |
| `assessment_status` | `TEXT` | Avaliação |
| `country` | `TEXT` | Opcional |
| `language` | `TEXT` | Opcional |
| `is_primary_source` | `BOOLEAN` | Default `false` |
| `enabled` | `BOOLEAN` | Default `true` |
| `consecutive_failures` | `INTEGER` | Default zero |
| `last_checked_at` | `TIMESTAMPTZ` | Opcional |
| `last_successful_fetch_at` | `TIMESTAMPTZ` | Opcional |
| `metadata` | `JSONB` | Default objeto vazio (`{}`) |
| `created_at` | `TIMESTAMPTZ` | Default `now()` |
| `updated_at` | `TIMESTAMPTZ` | Default `now()` |

**Tipos permitidos (`source_type`):**

- `official`
- `publisher`
- `news_agency`
- `aggregator`
- `community`
- `other`

**Estados da fonte (`source_status`):**

- `candidate`
- `monitored`
- `restricted`
- `blocked`

**Estados de avaliação (`assessment_status`):**

- `pending`
- `assessed`
- `rejected`

> Criar índice único para o domínio normalizado, evitando duplicação de fontes com diferenças apenas de maiúsculas e minúsculas.

### 5.4 Tabela `system_settings`

Responsável por guardar configurações não secretas.

| Campo | Tipo |
| :--- | :--- |
| `key` | `TEXT` (Primary key) |
| `value` | `JSONB` |
| `description` | `TEXT` |
| `updated_at` | `TIMESTAMPTZ` |

> Não guardar API keys, senhas, tokens ou credenciais nesta tabela.

### 5.5 Regras SQL

A primeira migração deverá:

- Criar as três tabelas.
- Criar os índices necessários.
- Criar as constraints.
- Definir os valores padrão.
- Ativar Row Level Security (RLS).
- Não criar políticas de acesso público.
- Configurar atualização de `updated_at` quando necessário.

**Governança de esquema:**

- O acesso ao banco nesta fase será feito exclusivamente por backend autorizado.
- A migração deverá ser versionada em `supabase/migrations/`.
- Toda alteração futura no esquema deverá possuir uma migração própria.
- Não realizar alterações manuais no banco remoto sem posteriormente registrar a mudança em uma migração.

---

## 6. CLIENTE DE BANCO DE DADOS

### 6.1 Arquivo

`src/database/client.ts`

**Responsabilidades:**

- Ler as variáveis de ambiente.
- Criar o cliente Supabase.
- Desativar persistência de sessão.
- Não permitir uso no navegador.
- Exportar uma instância controlada do cliente.

**Configuração de autenticação:**

- `autoRefreshToken: false`
- `persistSession: false`
- `detectSessionInUrl: false`

### 6.2 Tratamento de falhas

A conexão deverá tratar:

- URL inválida.
- Chave ausente.
- Falha de DNS.
- Timeout.
- Falha de autenticação.
- Banco indisponível.
- Tabela inexistente.
- Falha de permissão.

**Segurança nos erros:**

- Não expor detalhes sensíveis das requisições em mensagens públicas.
- Os erros técnicos completos deverão ser registrados nos logs internos, com qualquer credencial ou dado sensível removido.

---

## 7. CONTEXTO DE EXECUÇÃO

### 7.1 `RunContext`

Criar `src/core/run-context.ts`.

Cada execução deverá possuir:

- UUID.
- Nome da rotina.
- Origem da execução.
- Data de início.
- Estado atual.
- Métricas.
- Erros encontrados.

A execução deverá ser criada no banco no começo do processo. Ao terminar, atualizar:

- Estado final.
- Horário final.
- Duração.
- Resumo.
- Erro resumido, quando aplicável.

### 7.2 Idempotência

- O sistema deverá evitar criar duas execuções para o mesmo identificador de execução externa quando isso for explicitamente fornecido.
- Não utilizar apenas horário de início como identificador.

### 7.3 Encerramento

A aplicação deverá:

- Registrar sucesso quando todas as verificações forem concluídas.
- Registrar falha quando uma etapa essencial falhar.
- Registrar encerramento parcial quando houver etapas opcionais com falhas.
- Encerrar com código `0` em sucesso.
- Encerrar com código diferente de `0` em falhas críticas.
- Erros não deverão ser engolidos silenciosamente.

---

## 8. LOGS E OBSERVABILIDADE

Criar `src/core/logger.ts`.

**Níveis:**

- `debug`
- `info`
- `warn`
- `error`

**Formato preferencial:** JSON estruturado.

```json
{
  "timestamp": "2026-11-26T10:00:00.000Z",
  "level": "info",
  "module": "database.health",
  "message": "Database connection verified",
  "run_id": "UUID"
}
```

**Regras de logging:**

- O logger deverá permitir configurar o nível por variável de ambiente.
- Não registrar:
  - Senhas.
  - Tokens.
  - Chaves de API.
  - Headers de autenticação.
  - Dados sensíveis desnecessários.
- Toda execução deverá produzir informações suficientes para diagnóstico posterior.

---

## 9. SERVIÇOS DE SAÚDE

### 9.1 Health Check

Criar um serviço para verificar:

- Aplicação inicializada.
- Configuração validada.
- Cliente Supabase criado.
- Comunicação com o banco funcionando.
- Tabelas essenciais acessíveis.
- Registro de execução funcionando.

**Formato da resposta interna esperada:**

```json
{
  "status": "healthy",
  "checks": {
    "configuration": "ok",
    "database": "ok",
    "system_runs": "ok",
    "sources": "ok",
    "system_settings": "ok"
  }
}
```

> *Nota:* O exemplo acima representa um resultado esperado, não um resultado já obtido.

### 9.2 Smoke Test

Criar um teste que:

1. Consulte o banco.
2. Crie uma execução de teste.
3. Atualize o estado para concluído.
4. Consulte novamente o registro.
5. Valide os campos obrigatórios.

**Regras:**

- O teste deverá utilizar um identificador claramente marcado como teste.
- Não criar registros de teste indistinguíveis de execuções reais.

---

## 10. GITHUB ACTIONS

Criar dois workflows em `.github/workflows/`.

### 10.1 `ci.yml`

**Gatilhos:**

- `push` para `main`.
- `pull_request` direcionados à `main`.

**Etapas:**

1. Checkout.
2. Configurar Node.js 26.
3. Instalar dependências com `npm ci`.
4. Executar TypeScript typecheck.
5. Executar testes unitários.
6. Executar build.

**Regras:**

- Encerrar com falha quando qualquer etapa não passar.
- A CI inicial não deverá exigir credenciais reais do Supabase para executar os testes unitários.

### 10.2 `health-check.yml`

**Gatilhos:**

- Manualmente pelo `workflow_dispatch`.
- Uma vez por dia por agendamento (`schedule`).
- **Horário sugerido:** `06:17 UTC`.

**Etapas:**

1. Fazer checkout.
2. Configurar Node.js 26.
3. Instalar dependências.
4. Carregar os secrets.
5. Executar `npm run health`.
6. Registrar resultado.
7. Falhar se uma verificação essencial não passar.

**Configurações obrigatórias:**

- Utilizar grupo de concorrência (`concurrency`) para impedir execuções sobrepostas.
- Permissões mínimas:
  - `contents: read`
- Secrets necessários:
  - `SUPABASE_URL`
  - `SUPABASE_SECRET_KEY`
- Nunca colocar valores reais diretamente no arquivo YAML.

### 10.3 Observações operacionais

- O agendador do GitHub não é um sistema de execução em tempo real; horários programados podem atrasar.
- A rotina diária da Fase 1 é suficiente para validar a infraestrutura. A frequência de 30 minutos será introduzida somente quando os coletores forem implementados e testados.
- O agendamento utiliza o horário UTC por padrão, salvo configuração explícita de fuso.

---

## 11. SEGURANÇA

**Requisitos obrigatórios:**

- Não versionar `.env`.
- Não expor chave secreta do Supabase.
- Não utilizar chave administrativa no frontend.
- Não publicar logs com credenciais.
- Não permitir acesso público às tabelas internas.
- Não conceder permissões excessivas aos workflows.
- Não utilizar dependências desconhecidas sem justificativa.
- Não executar arquivos de origem externa.
- Manter `package-lock.json` atualizado.
- Não armazenar senhas em `system_settings`.
- Não incluir credenciais em documentação ou screenshots.

**`.gitignore` obrigatório contemplando:**

- `.env`
- `.env.*`, exceto `.env.example`
- `node_modules`
- `dist`
- `.supabase`
- Arquivos temporários
- Arquivos de log locais

> A chave secreta deverá existir somente no ambiente local protegido e nos GitHub Secrets.

---

## 12. TESTES

### 12.1 Unitários

Testar:

- Validação de ambiente.
- Configuração ausente.
- Configuração inválida.
- Criação de `RunContext`.
- Transições de estado.
- Cálculo de duração.
- Formatação de logs.
- Tratamento de exceções.

### 12.2 Integração

Testar:

- Conexão real com Supabase.
- Consulta às tabelas.
- Criação de execução.
- Atualização de execução.
- Consulta do registro atualizado.
- Falha de autenticação.
- Tabela ausente.
- Banco indisponível.

> Testes de integração deverão ser executados separadamente dos testes unitários, pois dependem de serviços externos.

### 12.3 CI

- A CI deverá ser verde antes de permitir integração na branch principal.
- Não ignorar testes que falhem para conseguir concluir a implementação.

---

## 13. DOCUMENTAÇÃO

Criar e manter atualizados os seguintes arquivos:

- **`README.md`**: Deverá explicar:
  - Objetivo do projeto.
  - Requisitos de instalação.
  - Como instalar dependências.
  - Como configurar ambiente local.
  - Como executar testes.
  - Como iniciar a aplicação.
  - Como executar health check.
- **`docs/architecture.md`**: Descrever arquitetura inicial e responsabilidades.
- **`docs/operations.md`**: Descrever:
  - Configuração de secrets.
  - Execução manual.
  - Execução agendada.
  - Diagnóstico de falhas.
  - Recuperação de conexão.
- **`docs/decisions.md`**: Registrar decisões técnicas importantes e suas justificativas.

> Toda alteração que modifique arquitetura deverá ser registrada.

---

## 14. ORDEM DE EXECUÇÃO

A implementação deverá obedecer à seguinte sequência:

### Tarefa 1 — Preparação
- Criar repositório.
- Configurar branch principal.
- Criar estrutura de arquivos.
- Criar `.gitignore`.
- Criar documentação inicial.

### Tarefa 2 — Projeto TypeScript
- Configurar `package.json`.
- Instalar dependências.
- Configurar `tsconfig.json`.
- Configurar Vitest.
- Validar instalação limpa.

### Tarefa 3 — Supabase
- Criar projeto.
- Configurar credenciais.
- Inicializar CLI.
- Criar primeira migração.
- Aplicar migração.
- Validar estrutura remota.

### Tarefa 4 — Core
- Implementar validação de ambiente.
- Implementar cliente Supabase.
- Implementar logger.
- Implementar `RunContext`.
- Implementar repositório de execuções.

### Tarefa 5 — Health Check
- Implementar verificação de configuração.
- Implementar conexão.
- Implementar validação das tabelas.
- Implementar smoke test.
- Validar códigos de saída.

### Tarefa 6 — Testes
- Criar testes unitários.
- Criar testes de integração.
- Validar erros.
- Executar CI localmente.

### Tarefa 7 — GitHub Actions
- Criar `ci.yml`.
- Criar `health-check.yml`.
- Configurar secrets.
- Executar workflow manualmente.
- Validar execução agendada.

### Tarefa 8 — Auditoria final
- Revisar segurança.
- Revisar dependências.
- Revisar migração.
- Verificar logs.
- Validar documentação.
- Confirmar ausência de segredos no repositório.

---

## 15. CRITÉRIOS DE ACEITE

A Fase 1 somente estará concluída quando todos os critérios abaixo forem atendidos:

| ID | Critério | Obrigatório |
| :--- | :--- | :--- |
| F1-01 | Projeto instala com `npm ci` | Sim |
| F1-02 | TypeScript compila sem erros | Sim |
| F1-03 | Configuração de ambiente é validada | Sim |
| F1-04 | Supabase conecta corretamente | Sim |
| F1-05 | Migração é versionada | Sim |
| F1-06 | Três tabelas essenciais existem | Sim |
| F1-07 | RLS está habilitado | Sim |
| F1-08 | Não há acesso público indevido | Sim |
| F1-09 | Execução é registrada no banco | Sim |
| F1-10 | Estados são atualizados corretamente | Sim |
| F1-11 | Logs estruturados funcionam | Sim |
| F1-12 | Testes unitários passam | Sim |
| F1-13 | Testes de integração passam | Sim |
| F1-14 | CI passa no GitHub | Sim |
| F1-15 | Health Check executa manualmente | Sim |
| F1-16 | Health Check executa por agendamento | Sim |
| F1-17 | Nenhum segredo está versionado | Sim |
| F1-18 | Documentação está atualizada | Sim |

> Não marcar como concluído um critério que não tenha evidência de execução.

---

## 16. RELATÓRIO OBRIGATÓRIO DE ENTREGA

Ao terminar a fase, o desenvolvedor deverá fornecer um relatório contendo:

- Resumo das implementações.
- Arquivos criados.
- Arquivos alterados.
- Dependências instaladas.
- Versões efetivamente utilizadas.
- Migrações aplicadas.
- Estrutura real do banco.
- Testes executados e resultados.
- Execuções do GitHub Actions.
- Teste de conectividade com Supabase.
- Auditoria de segurança.
- Problemas encontrados.
- Pendências.
- Confirmação de cada critério de aceite.
- Evidências verificáveis dos resultados.

**Regras de integridade:**

- Não declarar uma integração funcionando apenas porque seu código foi escrito.
- Não declarar um teste aprovado sem executá-lo.
- Não substituir uma funcionalidade incompleta por um mock sem identificar claramente essa limitação.

---

## 17. LIMITES DA FASE

**Não começar nesta fase:**

- Integração com GDELT.
- Google News RSS.
- Coletores RSS.
- Descoberta de notícias.
- Descoberta de fontes.
- Classificação editorial.
- Deduplicação de artigos.
- Detecção de acontecimentos.
- Resumos com IA.
- Interface web.
- Relatórios jornalísticos.

> Esses módulos dependem da infraestrutura que será construída agora.

---

## 18. DEFINIÇÃO DE CONCLUSÃO

Ao concluir a Fase 1, teremos uma infraestrutura funcional, segura e testável.

A aplicação ainda não saberá pesquisar notícias, mas estará preparada para receber os coletores e processar informações nas próximas etapas.

A Fase 1 deve priorizar **confiabilidade**, **rastreabilidade** e **organização**. Não deve antecipar funcionalidades da Fase 2.

---

*Fim da especificação de implementação — Fase 1.*