# Formato dos dados

Este documento explica como o News Monitor guarda os seus dados. Ele faz o papel das "tabelas do banco de dados" da especificação (Fase 1, seção 5), porque o projeto guarda tudo no GitHub, sem Supabase (decisão D-001 em [`decisions.md`](decisions.md)).

**Versão atual do formato: 1**

## 1. Onde ficam os dados

- Os dados ficam na branch **`data`** deste mesmo repositório. Ela é separada da `main` e não tem código, só arquivos de dados.
- Cada registro é **um arquivo JSON**. Um arquivo faz o papel de uma linha de tabela.
- Quem grava são os workflows do GitHub Actions (por exemplo, a verificação de saúde diária) e, no computador do dono do projeto, os comandos do próprio projeto. Ninguém precisa editar esses arquivos à mão.
- O repositório é público, então **todos os dados são públicos**. Por isso o sistema se recusa a gravar qualquer coisa que pareça um segredo (seção 7).
- O histórico do Git da branch `data` serve de cópia de segurança: cada gravação é um commit e nada se perde.

## 2. Mapa: tabela da especificação → pasta

| Tabela da especificação | Coleção | Pasta na branch `data` | Nome do arquivo (é a chave do registro) |
| :--- | :--- | :--- | :--- |
| `system_runs` | execuções | `runs/AAAA/MM/DD/` | `<id>.json` |
| `sources` | fontes | `sources/<xx>/` | `<domínio normalizado>.json` |
| `system_settings` | configurações | `settings/` | `<chave>.json` |

- `AAAA/MM/DD` é a data UTC em que a execução começou.
- `<xx>` são os dois primeiros caracteres do SHA-256 do domínio normalizado. Isso espalha as fontes em até 256 subpastas.
- O GitHub recomenda no máximo 3.000 itens por pasta. Com esse desenho, cada pasta fica muito abaixo disso.

Exemplo de como a branch `data` fica depois de alguns dias de uso:

```text
data
├── README.md
├── runs/
│   ├── .gitkeep
│   └── 2026/11/28/0192f3a4-5b6c-5d8e-9f01-23456789abcd.json
├── sources/
│   ├── .gitkeep
│   └── 4e/g1.globo.com.json
└── settings/
    └── schema_version.json
```

## 3. Regras gerais dos arquivos

- JSON em UTF-8, com recuo de 2 espaços e uma quebra de linha no final.
- Datas e horas sempre em UTC, no formato ISO 8601 terminado em `Z` (por exemplo, `2026-11-28T06:17:03.000Z`). Datas com fuso (`-03:00`) são recusadas.
- Os campos aparecem na mesma ordem das tabelas abaixo.
- Registros guardados são **estritos**: um campo que não está na tabela, ou um campo faltando, indica arquivo corrompido ou de outra versão, e o arquivo é recusado.
- Um arquivo deve ter menos de 1 MB (recomendação do GitHub). Os campos livres (`summary`, `metadata` e `value`) aceitam no máximo 64 KB.
- A **chave** do registro é o nome do arquivo. Duas chaves iguais caem no mesmo arquivo, então nunca existem dois registros com a mesma chave. É o equivalente do "índice único" do banco de dados.

## 4. Execuções (`runs`, tabela `system_runs`)

| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `id` | texto (UUID) | Obrigatório. É o nome do arquivo. UUID em minúsculas |
| `workflow_name` | texto | Obrigatório. Minúsculas, números, ponto, hífen e sublinhado; começa com letra; até 64 caracteres. Ex.: `health-check` |
| `trigger_type` | texto | `manual`, `scheduled` ou `api` |
| `status` | texto | `pending`, `running`, `succeeded`, `partial` ou `failed` |
| `started_at` | data e hora UTC | Obrigatório |
| `finished_at` | data e hora UTC | Só existe depois que a execução termina. Antes disso é `null`. Não pode ser anterior a `started_at` |
| `duration_ms` | número inteiro | Duração em milissegundos. Só existe depois que a execução termina. Antes disso é `null` |
| `summary` | objeto JSON | Resumo da execução. Pode ser `{}`. Sem segredos |
| `error_summary` | texto | Até 2.000 caracteres. `null` quando não houve erro. Sem segredos |
| `external_run_id` | texto | **Campo extra: não existe na tabela da especificação** (veja abaixo). `null` quando não há |
| `created_at` | data e hora UTC | Quando o registro foi criado |

**Estados e transições** (a especificação pede que o sistema valide as transições):

```text
pending ──► running ──► succeeded
   │           ├──────► partial
   └───────────┴──────► failed
```

- `pending` pode ir para `running` ou `failed`.
- `running` pode ir para `succeeded`, `partial` ou `failed`.
- Uma execução que terminou (`succeeded`, `partial` ou `failed`) **nunca mais muda**. Em especial, ela não volta para `running`.
- Ficar no mesmo estado só vale enquanto a execução não terminou (por exemplo, para atualizar o resumo).
- Execução terminada precisa ter `finished_at` e `duration_ms`. Execução que não terminou precisa tê-los como `null`.

**Por que existe `external_run_id`.** Num banco de dados, a "chave única" evita registrar duas vezes a mesma execução. Aqui, o GitHub às vezes repete uma execução. Quando o `external_run_id` é informado (por exemplo, `github-actions:123456789:1`), o `id` é calculado a partir dele (UUID versão 5). Assim, a mesma execução externa sempre resulta no mesmo arquivo e não pode ser registrada duas vezes. Sem `external_run_id`, o `id` é um UUID aleatório. Detalhes na decisão D-016.

Exemplo (`runs/2026/11/28/0192f3a4-5b6c-5d8e-9f01-23456789abcd.json`):

```json run
{
  "id": "0192f3a4-5b6c-5d8e-9f01-23456789abcd",
  "workflow_name": "health-check",
  "trigger_type": "scheduled",
  "status": "succeeded",
  "started_at": "2026-11-28T06:17:03.000Z",
  "finished_at": "2026-11-28T06:17:05.250Z",
  "duration_ms": 2250,
  "summary": {
    "checks": {
      "storage": "ok",
      "schema_version": "ok"
    }
  },
  "error_summary": null,
  "external_run_id": "github-actions:123456789:1",
  "created_at": "2026-11-28T06:17:03.000Z"
}
```

## 5. Fontes (`sources`, tabela `sources`)

| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `id` | texto (UUID) | Obrigatório |
| `name` | texto | Obrigatório, de 1 a 200 caracteres |
| `domain` | texto | Obrigatório. Domínio **normalizado** (regras abaixo). É o nome do arquivo |
| `base_url` | texto (URL) | Obrigatório. Só `http` ou `https` |
| `feed_url` | texto (URL) | Opcional (`null`). Só `http` ou `https` |
| `source_type` | texto | `official`, `publisher`, `news_agency`, `aggregator`, `community` ou `other` |
| `source_status` | texto | `candidate`, `monitored`, `restricted` ou `blocked`. Padrão: `candidate` |
| `assessment_status` | texto | `pending`, `assessed` ou `rejected`. Padrão: `pending` |
| `country` | texto | Opcional (`null`) |
| `language` | texto | Opcional (`null`) |
| `is_primary_source` | verdadeiro ou falso | Padrão: `false` |
| `enabled` | verdadeiro ou falso | Padrão: `true` |
| `consecutive_failures` | número inteiro | Zero ou mais. Padrão: `0` |
| `last_checked_at` | data e hora UTC | Opcional (`null`) |
| `last_successful_fetch_at` | data e hora UTC | Opcional (`null`) |
| `metadata` | objeto JSON | Padrão: `{}`. Sem segredos |
| `created_at` | data e hora UTC | Obrigatório |
| `updated_at` | data e hora UTC | Obrigatório |

Toda fonte nova começa como **candidata** (`candidate`) e com avaliação **pendente** (`pending`). Os valores padrão são aplicados pelo código na hora do cadastro. O arquivo guardado sempre tem todos os campos.

**Domínio normalizado.** O domínio é a chave da fonte, então duas formas de escrever o mesmo domínio precisam virar uma só:

| Digitado | Guardado |
| :--- | :--- |
| `G1.Globo.com` | `g1.globo.com` |
| ` g1.globo.com. ` (espaços e ponto final) | `g1.globo.com` |
| `bücher.de` | `xn--bcher-kva.de` |
| `www.g1.globo.com` | `www.g1.globo.com` (o `www.` **não** é removido, porque pode ser outro site) |

São recusados: texto com `http://`, caminho (`/politica`), porta (`:443`), usuário (`@`), endereços IP (`10.0.0.1`), nomes de rede interna (`localhost`, `servidor.local`, `.internal`, `.lan`...), domínios com uma parte só (`example`) e domínios com mais de 250 caracteres (o nome do arquivo precisa caber nos 255 caracteres que os sistemas de arquivos aceitam).

**URLs.** Só `http` e `https`, com até 2.048 caracteres. Não podem ter usuário nem senha (`https://usuario:senha@...`) nem parâmetros que costumam carregar credenciais: `api_key`, `key`, `token`, `access_token`, `auth`, `secret`, `password`, `passwd`, `signature`, `sig`.

Exemplo (`sources/4e/g1.globo.com.json`):

```json source
{
  "id": "0192f3a4-5b6c-7d8e-9f01-23456789abce",
  "name": "G1",
  "domain": "g1.globo.com",
  "base_url": "https://g1.globo.com/",
  "feed_url": "https://g1.globo.com/rss/g1/",
  "source_type": "publisher",
  "source_status": "candidate",
  "assessment_status": "pending",
  "country": "BR",
  "language": "pt-BR",
  "is_primary_source": false,
  "enabled": true,
  "consecutive_failures": 0,
  "last_checked_at": null,
  "last_successful_fetch_at": null,
  "metadata": {},
  "created_at": "2026-11-28T06:17:03.000Z",
  "updated_at": "2026-11-28T06:17:03.000Z"
}
```

## 6. Configurações (`settings`, tabela `system_settings`)

| Campo | Tipo | Regra |
| :--- | :--- | :--- |
| `key` | texto | Obrigatório. Minúsculas, números, ponto, hífen e sublinhado; começa com letra ou número; até 100 caracteres. É o nome do arquivo. Não pode sugerir uma credencial (`senha`, `token`, `api_key`...) |
| `value` | qualquer valor JSON | Obrigatório. Até 64 KB. Sem segredos |
| `description` | texto | Até 500 caracteres |
| `updated_at` | data e hora UTC | Obrigatório |

Exemplo (`settings/schema_version.json`):

```json setting
{
  "key": "schema_version",
  "value": 1,
  "description": "Versão do formato dos dados desta branch. Só muda junto com uma migração descrita em docs/data-model.md.",
  "updated_at": "2026-11-28T06:17:03.000Z"
}
```

## 7. Proteção contra segredos

A especificação proíbe guardar chaves, senhas, tokens e credenciais nos dados. Como o repositório é público, o código barra isso **antes de gravar**:

- Olha todos os campos de texto livres (`summary`, `metadata`, `value`, `description`, `error_summary`, `external_run_id`, `name`) e procura formatos conhecidos de credenciais: chaves do Supabase, tokens do GitHub, chaves de acesso da AWS e do Google, tokens do Slack, chaves no formato `sk-`, tokens JWT, chaves privadas, cabeçalhos `Bearer` e endereços com usuário e senha.
- Desconfia de qualquer texto dentro de um campo cujo **nome** sugere uma credencial (`senha`, `token`, `api_key`, `authorization`...).
- A mensagem de recusa diz **onde** está o problema, mas nunca repete o valor encontrado.
- Estruturas muito fundas (mais de 32 níveis) são recusadas, porque não dá para verificá-las com segurança.

Essa verificação é uma segunda barreira, e nenhuma detecção é perfeita. A regra principal continua sendo: **nunca colocar segredo nos dados**.

## 8. Versão do formato e como mudar (a "migração")

- A versão do formato fica em dois lugares: no código (`SCHEMA_VERSION`, em `src/storage/records.ts`) e nos dados (`settings/schema_version.json`, campo `value`).
- A verificação de saúde compara os dois. Se forem diferentes, ela falha e avisa, em vez de gravar dados num formato errado.

Para mudar o formato:

1. Aumentar o `SCHEMA_VERSION` no código.
2. Descrever a mudança na seção 9 deste documento e em [`decisions.md`](decisions.md).
3. Escrever um script de migração que lê os arquivos antigos e grava os novos.
4. Testar o script numa cópia da branch `data`.
5. Rodar na branch `data` e atualizar o `schema_version.json` no mesmo commit.

## 9. Histórico de versões

| Versão | Data | O que mudou |
| :--- | :--- | :--- |
| 1 | 27/11/2026 | Formato inicial da Fase 1: execuções, fontes e configurações |

## 10. Limites do GitHub como armazenamento

Valores da documentação "repository limits" do GitHub, consultada em 27/11/2026:

- repositório com até 10 GB (recomendado);
- arquivo com menos de 1 MB (recomendado; o bloqueio é em 100 MB);
- no máximo 3.000 itens por pasta (recomendado);
- no máximo cerca de 6 envios (pushes) por minuto no repositório (recomendado);
- não há consultas rápidas nem transações como num banco de dados. Por isso as gravações são feitas uma vez por execução, em lote.

Este formato foi pensado para o volume da Fase 1 (uma execução por dia e poucas fontes). As fases seguintes, que guardam notícias e acontecimentos, vão propor o formato dos seus dados no plano de cada fase, respeitando esses limites. Se um dia o dono do projeto adotar o Supabase, só a camada de repositórios precisa mudar (decisão D-001).

## 11. Como olhar os dados

- **No GitHub:** abra o repositório, troque a branch de `main` para `data` (menu de branches) e navegue pelas pastas.
- **No computador:** `git clone --branch data --single-branch https://github.com/JustAVibeCodingAddict/NewsMonitor.git dados`
