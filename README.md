# News Monitor

Um monitor automático de notícias, de uso pessoal. Ele busca publicações em várias fontes, junta as que falam do mesmo fato e mostra tudo num site simples, com relatórios diários.

> **Estado atual: Fase 1 de 8 (Fundação), em andamento.**
> Ainda não coleta notícias. Agora estamos montando a base do projeto: estrutura, testes automáticos e uma verificação diária de saúde.

## O que o News Monitor vai fazer

- **Coletar** publicações de quatro tipos de fonte: GDELT (um grande índice público de notícias), pesquisas no Google News (por RSS), feeds RSS de veículos e fontes oficiais (agências e órgãos públicos).
- **Descobrir** veículos e fontes novos. Toda fonte nova entra como "candidata", com avaliação pendente. Nada é tratado como confiável só por ter sido encontrado.
- **Organizar**: tirar publicações repetidas, classificar por tema, país e região, e dar uma nota de relevância.
- **Agrupar acontecimentos**: reunir publicações diferentes que falam do mesmo fato, com linha do tempo.
- **Mostrar as evidências**: dizer se um fato aparece em uma só fonte, em várias fontes ou em fonte oficial, sem declarar o que é "verdade".
- **Gerar relatórios**: resumo das últimas 24 horas, contexto dos últimos 3 a 7 dias e impactos para o Brasil.
- **Publicar um site** (GitHub Pages) para consultar tudo no computador ou no celular.

## Princípios

- **Custo de R$ 0 por mês.** Só serviços gratuitos.
- **Sempre com a origem.** Cada informação guarda o link da fonte. Matérias inteiras não são copiadas.
- **Informativo, não oficial.** O sistema ajuda a acompanhar notícias. Ele não é uma autoridade de confirmação jornalística.
- **Sem login e sem analytics.** É de uso pessoal.
- **Nenhum segredo no repositório.** Senhas e chaves nunca vão para o código.
- **Dados guardados no próprio GitHub**, sem banco de dados externo por enquanto.

## Como o projeto é construído

O trabalho segue 8 fases. Cada fase tem uma especificação e uma lista de critérios de aceite. Só se avança para a próxima fase quando todos os critérios da fase atual têm evidência de que funcionam.

Toda mudança entra por branch e pull request, com verificação automática antes de ser juntada à `main`.

| Fase | Tema | Estado |
| :--- | :--- | :--- |
| 1 | Fundação: estrutura, testes, verificação automática e verificação de saúde | Em andamento |
| 2 | Coletores: GDELT, Google News, RSS e fontes oficiais | Não iniciada |
| 3 | Descoberta de fontes | Não iniciada |
| 4 | Processamento: normalização, repetidas, classificação e acontecimentos | Não iniciada |
| 5 | Evidências e contexto | Não iniciada |
| 6 | Relatórios | Não iniciada |
| 7 | Interface (site no GitHub Pages) | Não iniciada |
| 8 | Auditoria e operação contínua | Não iniciada |

## Para rodar no computador

Requisitos: Git, Node.js 26 (o arquivo `.nvmrc` indica a versão) e npm.

```bash
npm ci                 # instala as dependências (instalação limpa)
cp .env.example .env   # cria a configuração local (nunca vai para o repositório)
npm test               # roda os testes
npm run ci             # typecheck + testes + build, igual à verificação automática
```

Por enquanto não há nada mais para executar. A aplicação e a verificação de saúde chegam nos próximos PRs da Fase 1.

## Documentação

- [Arquitetura](docs/architecture.md): como o sistema é dividido.
- [Operação](docs/operations.md): como rodar, verificar e diagnosticar problemas.
- [Decisões](docs/decisions.md): o que foi decidido e por quê.
- [Especificação da Fase 1](docs/implementation-phase-1.md): o que a fase atual precisa entregar.

## Tecnologias

Node.js 26, TypeScript, Vitest, Zod, GitHub Actions e GitHub Pages.
