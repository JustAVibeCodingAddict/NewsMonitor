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

1. Os critérios de aceite F1-04 a F1-09 e F1-13 falam de banco de dados. Os equivalentes foram aprovados pelo dono do projeto e estão na D-012.
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

## D-012 — Critérios de aceite sem banco de dados

- **Data:** 27/11/2026
- **Decidido por:** dono do projeto (aprovou a proposta do Claude)
- **Estado:** vale

Sem o Supabase, sete critérios da seção 15 da especificação da Fase 1 não podem ser cumpridos ao pé da letra. Cada um ganhou um equivalente, aprovado pelo dono do projeto. Os outros onze (F1-01, 02, 03, 10, 11, 12, 14, 15, 16, 17 e 18) continuam como estão. O F1-03 passa a validar as variáveis do novo desenho (`NODE_ENV`, `LOG_LEVEL` e `DATA_DIR`), no lugar das do Supabase.

| ID | Critério original | Critério aprovado | Evidência |
| :--- | :--- | :--- | :--- |
| F1-04 | Supabase conecta corretamente | O armazenamento funciona: grava, lê e apaga um registro de teste | `npm run storage:smoke`, no computador e no GitHub Actions (PR 3) |
| F1-05 | Migração é versionada | O formato dos dados é versionado | `SCHEMA_VERSION`, `settings/schema_version.json`, [`data-model.md`](data-model.md) e `npm run storage:init` |
| F1-06 | Três tabelas essenciais existem | Três coleções existem, com os campos da especificação | Esquemas, testes e o `storage:smoke`, que usa as três |
| F1-07 | RLS está habilitado | Não se aplica, porque não há banco. Equivalente: só quem tem permissão grava nos dados | `main` protegida (D-014), permissões mínimas nos workflows e escrita isolada num job próprio (PR 3) |
| F1-08 | Não há acesso público indevido | Os dados são públicos por natureza e nenhum segredo vai para eles | Proteção contra segredos (D-017), testes e varredura do histórico |
| F1-09 | Execução é registrada no banco | Execução é registrada como arquivo na branch `data` | Arquivo criado por uma execução real no GitHub Actions |
| F1-13 | Testes de integração passam | Testes de integração contra o sistema de arquivos real, mais uma execução real no GitHub Actions | `npm run test:integration` e CI (PR 3) |

## D-013 — Os dados ficam na branch `data` (única exceção à regra "tudo por pull request")

- **Data:** 27/11/2026 (aprovada); branch criada em 28/11/2026
- **Decidido por:** dono do projeto
- **Estado:** vale

Os dados ficam numa branch separada chamada `data`, sem nenhum código. A `main` guarda só código e documentação.

**A exceção.** A regra de trabalho diz "nenhum push direto na ramificação principal". Ela continua valendo para a `main`. A `data` não é a ramificação principal e recebe dados gerados automaticamente, uma gravação por execução. Exigir um pull request para cada execução diária seria inviável. Por isso os workflows gravam direto na `data`. É a **única** exceção.

**Como a gravação é protegida.** O workflow usa um job só para gravar, com permissão de escrita e sem rodar o código do projeto. O job que roda o código só tem permissão de leitura (PR 3).

**Sugestão opcional** (o dono do projeto decide): em *Settings → Rules*, bloquear a exclusão e o force push na `data`, deixando os envios normais liberados para os workflows.

## D-014 — Proteção da `main`

- **Data:** 27/11/2026
- **Decidido por:** dono do projeto (configurou no GitHub); verificado pelo Claude pela API do GitHub
- **Estado:** vale

Configuração ativa na `main`:

- pull request obrigatório, com 0 aprovações exigidas (o dono do projeto é a única pessoa);
- verificação `CI` obrigatória e verde antes de juntar;
- "Do not allow bypassing the above settings": vale também para administradores;
- force push e exclusão da branch bloqueados.

Para mudar ou desfazer: *Settings → Branches*, editar a regra da `main`. Sem aprovações obrigatórias, o dono do projeto pode juntar o próprio PR. O Claude só junta depois que o CI fica verde (D-004).

## D-015 — Formato dos arquivos de dados

- **Data:** 28/11/2026
- **Decidido por:** Claude
- **Estado:** vale

- Um arquivo JSON por registro. O nome do arquivo é a chave do registro, por isso não existem duas chaves iguais.
- JSON com recuo de 2 espaços e quebra de linha no final; datas em UTC terminadas em `Z`; campos na ordem das tabelas. O mesmo registro gera sempre o mesmo texto, e o histórico do Git mostra só o que mudou.
- Pastas: `runs/AAAA/MM/DD/`, `sources/<2 caracteres do SHA-256 do domínio>/` e `settings/`. Cada pasta fica bem abaixo dos 3.000 itens que o GitHub recomenda.
- Os registros guardados são estritos: campo desconhecido ou faltando é erro.

**Alternativas descartadas.** Um arquivo só por coleção (uma linha JSON por registro): duas gravações ao mesmo tempo conflitariam e o arquivo cresceria sem limite. Um arquivo SQLite no repositório: é binário, não mostra diferenças no GitHub e também conflita.

O formato completo está em [`data-model.md`](data-model.md).

## D-016 — Identificação das execuções

- **Data:** 28/11/2026
- **Decidido por:** Claude
- **Estado:** vale (o cálculo do `id` entra no PR 3)

Num banco de dados, a chave única impede registrar duas vezes a mesma execução. Sem banco, a solução é esta:

- Foi acrescentado o campo `external_run_id` em `runs`. **Ele não existe na tabela `system_runs` da especificação.** Guarda o identificador da execução de fora, por exemplo `github-actions:<run_id>:<tentativa>`.
- Quando ele é informado, o `id` é um UUID versão 5 calculado a partir dele. A mesma execução externa sempre gera o mesmo `id`, portanto o mesmo arquivo, e o sistema percebe a repetição ao ver que o arquivo já existe.
- Sem `external_run_id`, o `id` é um UUID aleatório.
- O estado de uma execução só avança pelas transições permitidas. Ao gravar, o sistema lê o arquivo que já existe e confere a transição. Execução terminada não muda mais.

## D-017 — Proteção contra segredos nos dados

- **Data:** 28/11/2026
- **Decidido por:** Claude
- **Estado:** vale

Como o repositório é público, um segredo gravado nos dados ficaria exposto para sempre (o histórico do Git guarda tudo). O código em `src/core/secrets.ts` barra o problema antes de gravar:

- reconhece formatos conhecidos de credenciais (Supabase, GitHub, AWS, Google, Slack, `sk-`, JWT, chave privada, `Bearer` e endereços com usuário e senha);
- desconfia de qualquer texto dentro de um campo cujo nome sugere uma credencial (`senha`, `token`, `api_key`...);
- recusa estruturas fundas demais para verificar (mais de 32 níveis);
- nunca repete o valor encontrado: a mensagem diz só o caminho e o motivo;
- usa expressões com limites de tamanho, para continuar rápido mesmo com textos enormes.

**Limite conhecido.** Nenhuma detecção é perfeita. Só texto é verificado (um número dentro de um campo com nome de credencial passa), e um segredo num formato desconhecido também passa. É uma segunda barreira: a regra principal continua sendo nunca colocar segredo nos dados. A mesma verificação será usada nos logs (PR 3).

Os testes montam os segredos falsos na hora, em pedaços, para que nenhum texto parecido com uma credencial real entre no repositório.

## D-018 — Regras das fontes

- **Data:** 28/11/2026
- **Decidido por:** Claude
- **Estado:** vale

- Toda fonte nova começa como candidata (`candidate`), com avaliação pendente (`pending`), `is_primary_source` falso, `enabled` verdadeiro e zero falhas, como a especificação manda ("nada é tratado como confiável só por ter sido encontrado").
- O domínio é a chave da fonte. Ele é normalizado: minúsculas, sem espaços nem ponto final, e acentos em punycode. O `www.` não é removido, porque pode ser outro site.
- Não são aceitos domínios com `http://`, caminho, porta, usuário ou endereço IP, nem nomes de rede interna (`localhost`, `.local`, `.internal`, `.lan`...), porque o sistema nunca deve tentar acessar a rede interna. O limite é de 250 caracteres, para o nome do arquivo caber nos 255 que os sistemas de arquivos aceitam.
- URLs: só `http` e `https`, até 2.048 caracteres, sem usuário e senha e sem parâmetros de credencial (`api_key`, `token`, `signature`...). Uma URL assim iria para o repositório público.

## D-019 — Versão do formato dos dados

- **Data:** 28/11/2026
- **Decidido por:** Claude
- **Estado:** vale (a comparação automática entra no PR 3)

É o equivalente das "migrações" do banco de dados. A versão atual é 1. Ela fica no código (`SCHEMA_VERSION`) e nos dados (`settings/schema_version.json`). A verificação de saúde (PR 3) compara as duas e falha se forem diferentes. O procedimento para mudar o formato está na seção 8 de [`data-model.md`](data-model.md). O conteúdo inicial da branch `data` é criado por `npm run storage:init`.

---

## Pendências de decisão

Nenhuma no momento.
