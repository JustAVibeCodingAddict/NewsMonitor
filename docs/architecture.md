# Arquitetura

Estado: Fase 1, PR 2. O que ainda não existe no código está marcado como **planejado**. Esta página é atualizada a cada PR.

## 1. Os quatro blocos

A especificação técnica (§4.3) divide o sistema em quatro blocos independentes:

| Bloco | O que faz | Quando entra |
| :--- | :--- | :--- |
| Engine | Coleta, processamento, classificação e correlação das notícias | A partir da Fase 2 |
| Storage | Guarda dados, histórico, configurações e cópias de segurança | Base na Fase 1 |
| Publisher | Gera os dados públicos e os relatórios | Fase 6 |
| Frontend | O site (GitHub Pages) | Fase 7 |

O site nunca coleta notícias e nunca recebe credenciais.

## 2. Onde ficam o código e os dados

- **Código e documentação:** branch `main`. Ela só muda por pull request, com a verificação automática (CI) verde.
- **Dados:** guardados no próprio GitHub, sem banco de dados externo (decisão D-001 em [`decisions.md`](decisions.md)). Ficam na branch `data`, que não tem código e é gravada pelos workflows (D-013). Um arquivo JSON por registro, em três coleções: `runs` (execuções), `sources` (fontes) e `settings` (configurações). O formato completo está em [`data-model.md`](data-model.md).

## 3. Camadas do código

Cada camada só usa as camadas de baixo dela. Configuração, armazenamento e regras do sistema nunca ficam misturados no mesmo arquivo.

| Camada | Pasta | Responsabilidade | Estado |
| :--- | :--- | :--- | :--- |
| config | `src/config` | Ler e validar as variáveis de ambiente. Parar a inicialização se algo estiver ausente ou inválido | planejado (PR 3) |
| core | `src/core` | Erros, logs estruturados sem segredos e o contexto de execução (`RunContext`) | parcial: `secrets.ts` (detecção de segredos) e `run-state.ts` (estados e transições) no PR 2; o resto no PR 3 |
| storage | `src/storage` | Formato dos registros e leitura e gravação segura dos arquivos de dados | parcial: formato dos registros, caminhos dos arquivos e arquivos iniciais no PR 2; leitura e gravação no PR 3 |
| repositories | `src/repositories` | Única porta de entrada para guardar e consultar dados. Permite trocar o armazenamento no futuro | planejado (PR 3) |
| services | `src/services` | Regras do sistema, por exemplo a verificação de saúde | planejado (PR 3) |
| scripts | `scripts` | Comandos que o GitHub e o dono do projeto executam | planejado (PR 3) |
| entrada | `src/index.ts` | Só liga as peças e inicia. Sem regras de negócio | planejado (PR 3) |

## 4. Verificação automática (CI)

Existe desde o PR 1. O arquivo `.github/workflows/ci.yml` roda em todo pull request e em todo envio para a `main`:

1. baixa o código;
2. configura o Node.js 26 (versão do `.nvmrc`);
3. instala as dependências com `npm ci` (instalação limpa);
4. roda o typecheck;
5. roda os testes unitários;
6. roda o build.

Se um passo falha, o CI fica vermelho e o PR não deve ser juntado. O CI não usa nenhuma credencial.

## 5. Segurança

- Nenhum segredo no repositório, nos logs ou na documentação.
- Workflows com a menor permissão possível (`contents: read`). Ações oficiais fixadas pelo SHA do commit (D-008 e D-009).
- O `.gitignore` bloqueia o `.env`. O `.env.example` só tem nomes de variáveis e valores de exemplo, e um teste automático confere isso.
- O repositório é público, então tudo o que for guardado nele é público. Só entram dados que já são públicos por natureza.
- Antes de gravar qualquer registro, o código recusa o que parece um segredo (chaves, tokens, senhas, URLs com credenciais). Os registros também têm tamanho máximo (D-017 e D-018).
- A `main` só muda por pull request com o CI verde (D-014). A branch `data` é a única que recebe gravação direta, e só dos workflows (D-013).

## 6. O que a Fase 1 não faz

Os coletores (GDELT, Google News, RSS), a descoberta de fontes, a classificação, a detecção de acontecimentos, os relatórios e o site pertencem às fases seguintes. A Fase 1 entrega apenas a base: estrutura, armazenamento, registro de execuções, logs, testes e verificação de saúde.
