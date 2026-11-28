# Operação

Este guia explica como rodar, verificar e diagnosticar o projeto. As partes que dependem de código dos próximos PRs da Fase 1 estão marcadas como **em breve** e serão completadas nesta mesma fase.

## 1. Rodar no seu computador

Requisitos: Git, Node.js 26 (o arquivo `.nvmrc` indica a versão) e npm (vem junto com o Node).

```bash
nvm use                # se você usa o nvm; senão, instale o Node 26
npm ci                 # instalação limpa, exatamente como no package-lock.json
cp .env.example .env   # cria a configuração local (o .env nunca vai para o repositório)
npm run ci             # typecheck + testes + build, igual à verificação automática
```

Se aparecer o erro `EBADENGINE`, a versão do Node está errada. Use a 26.

## 2. Configuração de Secrets

A Fase 1 **não usa nenhum Secret**. Se algum dia for preciso (por exemplo, se o Supabase for adotado, veja a D-001 em [`decisions.md`](decisions.md)), o lugar certo é *Settings → Secrets and variables → Actions*, no GitHub, e variáveis de ambiente no seu computador. Chaves e senhas nunca entram em arquivos do repositório, em logs, em prints ou na documentação.

## 3. Verificação automática (CI)

O workflow `CI` (`.github/workflows/ci.yml`) roda em todo pull request para a `main` e em todo envio para a `main`. Ele faz, nesta ordem: instalação limpa (`npm ci`), typecheck, testes unitários e build. Se qualquer passo falhar, o PR não deve ser juntado.

Para ver o resultado, abra a aba **Actions** do repositório ou a seção de verificações dentro do próprio PR.

## 4. Execução manual — em breve

A verificação de saúde manual (botão *Run workflow* na aba Actions) será descrita aqui quando o `health-check.yml` existir.

## 5. Execução agendada — em breve

A verificação de saúde diária (06:17 UTC, que é 03:17 no horário de Brasília) será descrita aqui. Duas observações já conhecidas sobre os agendamentos do GitHub:

- eles podem atrasar e não funcionam em tempo real;
- em repositório público, o GitHub desativa os agendamentos quando passa muito tempo (60 dias) sem atividade no repositório. Para reativar: aba *Actions* → escolher o workflow → *Enable workflow*.

## 6. Diagnóstico de falhas

| Sintoma | O que verificar |
| :--- | :--- |
| CI vermelho no PR | Aba Actions → abrir a execução → abrir o passo marcado em vermelho e ler a mensagem |
| `npm ci` falha com `EBADENGINE` | A versão do Node é diferente da 26 |
| `npm ci` reclama do `package-lock.json` | O arquivo não combina com o `package.json`. Refazer com `npm install` e enviar os dois arquivos |
| Teste falha só no GitHub | Comparar a versão do Node (aparece no começo do log) com a usada no seu computador |

## 7. Dados: como ver, e como recuperar

Os dados ficam na branch `data` (veja [`data-model.md`](data-model.md)).

**Ver os dados.** No GitHub, troque a branch de `main` para `data` no menu de branches e navegue pelas pastas `runs/`, `sources/` e `settings/`. No computador:

```bash
git clone --branch data --single-branch https://github.com/JustAVibeCodingAddict/NewsMonitor.git dados
```

**Cópia de segurança.** Cada gravação é um commit na branch `data`, então o histórico do Git guarda tudo. Um clone da branch (comando acima) é uma cópia completa que fica no seu computador.

**Recriar a branch `data` vazia** (só se ela for apagada por engano e nenhum clone tiver os dados). Precisa de Git 2.42 ou mais novo. Rode dentro do clone do projeto, na pasta onde está o código:

```bash
git fetch origin
git worktree add --orphan -b data ../NewsMonitor-dados   # cria uma branch nova, sem histórico
npm run storage:init -- ../NewsMonitor-dados             # cria README, pastas e schema_version.json
cd ../NewsMonitor-dados
git add -A
git commit -m "Dados: estrutura inicial"
git push origin data
cd -
git worktree remove ../NewsMonitor-dados
```

Isso recria só a estrutura. Os dados antigos só voltam se alguém tiver um clone com a branch: nesse caso, basta rodar `git push origin data` a partir dele.

**Se a versão do formato não bater** (a verificação de saúde avisa que o `schema_version.json` é diferente do código): siga a seção 8 de [`data-model.md`](data-model.md).

**Sugestão opcional de proteção.** Em *Settings → Rules*, bloquear a exclusão e o force push da branch `data`, deixando os envios normais liberados para os workflows (D-013).
