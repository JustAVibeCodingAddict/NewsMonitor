# Decisões técnicas

Aqui ficam registradas as decisões importantes do projeto e o motivo de cada uma. Toda mudança de arquitetura entra neste arquivo.

Quando a especificação e a realidade não combinam (por exemplo, um limite diferente do documentado), a divergência também é registrada aqui e o dono do projeto é consultado antes de seguir.

Cada decisão tem número, data, quem decidiu e o estado.

---

## D-001 — Dados guardados no GitHub, sem Supabase

- **Data:** 27/11/2026
- **Decidido por:** dono do projeto
- **Estado:** vale

**O que mudou.** A especificação técnica e a da Fase 1 usam o Supabase (PostgreSQL) como banco de dados. O dono do projeto pediu para construir sem o Supabase, guardando tudo no próprio GitHub. Se achar conveniente, ele cria o Supabase mais tarde e dá acesso ao Claude para gerenciá-lo.

**Motivo.** Simplicidade e custo zero, sem conta externa e sem chaves.

**Como fica.** O código só fala com o armazenamento por uma camada de repositórios (`src/repositories`). Hoje ela vai gravar arquivos. No futuro, uma versão para Supabase poderá ser acrescentada sem reescrever o resto. Isso já era um requisito da especificação técnica (§1.2: "substituir fontes, banco de dados e hospedagem sem reescrever o núcleo").

**Consequências.**

1. Os critérios de aceite F1-04 a F1-10 e F1-13 falam de banco de dados. Eles precisam de equivalentes, que serão apresentados ao dono do projeto antes de implementar. A versão aprovada será registrada aqui.
2. As Fases 2 a 8 têm migrações SQL, regras de acesso do banco (RLS) e funções de banco. A persistência de cada fase será adaptada e apresentada no plano daquela fase.
3. Os Secrets `SUPABASE_URL` e `SUPABASE_SECRET_KEY` deixam de existir. A Fase 1 não precisa de nenhum Secret.

**Limites de usar o GitHub como armazenamento** (documentação "repository limits" do GitHub, consultada em 27/11/2026):

- repositório com até 10 GB (recomendado);
- cada arquivo idealmente abaixo de 1 MB (bloqueio em 100 MB);
- no máximo 3.000 itens por pasta (recomendado);
- no máximo cerca de 6 envios (pushes) por minuto no repositório (recomendado);
- não há consultas rápidas nem transações como num banco;
- o repositório é público, então todos os dados guardados nele também são públicos.

---

## D-002 — Commit inicial direto na `main` (exceção única)

- **Data:** 27/11/2026
- **Decidido por:** dono do projeto
- **Estado:** vale (já usada)

O repositório estava vazio, e uma branch só existe depois do primeiro commit. O dono do projeto autorizou criar o documento inicial direto na `main`. Foi feito um único commit (`4b04a26`) com `README.md` e `.gitignore`. Daqui em diante, tudo entra por branch e pull request.

## D-003 — Verificação automática (`ci.yml`) já no PR 1

- **Data:** 27/11/2026
- **Decidido por:** Claude
- **Estado:** vale

A especificação lista o `ci.yml` na Tarefa 7, mas também exige CI verde antes de integrar à `main` (§12.3). Para valer desde o primeiro PR, o `ci.yml` entra no PR 1. O `health-check.yml` continua na Tarefa 7.

## D-004 — Quem junta os PRs

- **Data:** 27/11/2026
- **Decidido por:** Claude (o dono do projeto pode mudar quando quiser)
- **Estado:** vale

Depois que a verificação automática fica verde, o Claude junta o PR à `main` (modo "squash": um commit por PR) e avisa o dono do projeto. Nunca há push direto na `main`, fora a exceção da D-002.

## D-005 — Nome do repositório

- **Data:** 27/11/2026
- **Decidido por:** dono do projeto (o repositório já estava criado)
- **Estado:** vale

A especificação sugere `news-monitor`, e o repositório se chama `NewsMonitor`. O nome do pacote continua `news-monitor`. O endereço base do site (GitHub Pages) será definido na Fase 7, levando em conta o nome real do repositório.

## D-006 — Versões

- **Data:** 27/11/2026
- **Decidido por:** Claude
- **Estado:** vale

- Node.js 26 (`.nvmrc` = `26`; `engines` = `>=26 <27`; `engine-strict` ligado). Em 27/11/2026, o Node 26 é a versão LTS ativa.
- Versões estáveis mais recentes no npm em 27/11/2026, gravadas **exatas** (`save-exact`) em `package.json` e `package-lock.json`: TypeScript 7.0.2, Vitest 5.1.2, tsx 4.23.15, Zod 4.6.7, dotenv 18.0.10 e @types/node 26.6.11.
- Nada de versões alpha, beta, rc ou nightly.

## D-007 — Dependências da Tarefa 2 sem as do Supabase

- **Data:** 27/11/2026
- **Decidido por:** Claude, em consequência da D-001
- **Estado:** vale

A lista da especificação (§4.1) foi seguida, sem `@supabase/supabase-js` e sem `supabase` (a ferramenta de linha de comando). `zod` e `dotenv` já são instalados na Tarefa 2, como a especificação pede, e passam a ser usados nos PRs seguintes.

## D-008 — Ações do GitHub fixadas pelo código do commit (SHA)

- **Data:** 27/11/2026
- **Decidido por:** Claude
- **Estado:** vale

As ações oficiais (`actions/checkout`, `actions/setup-node`) são referenciadas pelo SHA completo do commit, com a versão em comentário. Assim, uma etiqueta movida no GitHub não altera o que roda no nosso workflow. Para atualizar, troca-se o SHA de forma consciente.

## D-009 — Permissões mínimas e sem credenciais gravadas no workflow

- **Data:** 27/11/2026
- **Decidido por:** Claude
- **Estado:** vale

Os workflows usam `permissions: contents: read` e `persist-credentials: false` no checkout. Uma permissão maior só entra onde for realmente necessária e fica registrada aqui.

## D-010 — Teste de configuração base

- **Data:** 27/11/2026
- **Decidido por:** Claude
- **Estado:** vale

`tests/unit/project-config.test.ts` garante que o Node usado é o 26, que `.nvmrc` e `engines` combinam, que o `.gitignore` bloqueia o `.env` e que o `.env.example` só tem nomes e valores de exemplo.

A versão do Node é registrada nos logs de duas formas: o passo "Mostrar as versões em uso" do CI e o teste, que imprime a versão (visível com `npx vitest run --reporter=verbose`), como a especificação pede (§4.3).

## D-011 — O CI cancela execuções antigas só em pull requests

- **Data:** 27/11/2026
- **Decidido por:** Claude
- **Estado:** vale

Num PR, um novo envio cancela a verificação anterior, o que economiza tempo. Na `main`, nenhuma verificação é cancelada, para que todo commit tenha o seu resultado.

---

## Pendências de decisão

- **Proteção da `main`** (exigir PR e CI verde): sugerida ao dono do projeto, que faz a configuração no GitHub. Padrão proposto: ativar.
- **Equivalentes dos critérios de aceite sem banco de dados** (ver D-001): aguardam aprovação do dono do projeto.
