/**
 * Arquivos iniciais da branch `data`.
 *
 * É o equivalente da "primeira migração" do banco de dados da especificação:
 * cria a estrutura e registra a versão do formato. Quem usa:
 *   - `npm run storage:init -- <pasta>` (veja docs/operations.md, seção 7);
 *   - os testes, que conferem que tudo aqui segue o formato.
 */

import { settingPath } from "./layout.js";
import { SCHEMA_VERSION, SettingRecordSchema, type SettingRecord } from "./records.js";
import { serializeRecord } from "./serialize.js";

export interface InitialFile {
  /** Caminho relativo à raiz da branch `data`, sempre com "/". */
  readonly path: string;
  readonly content: string;
}

/** Chave da configuração que guarda a versão do formato dos dados. */
export const SCHEMA_VERSION_KEY = "schema_version";

export const SCHEMA_VERSION_DESCRIPTION =
  "Versão do formato dos dados desta branch. Só muda junto com uma migração descrita em docs/data-model.md.";

const DATA_BRANCH_README = `# Dados do News Monitor

Esta branch (\`data\`) guarda os **dados** do projeto [News Monitor](https://github.com/JustAVibeCodingAddict/NewsMonitor). O código fica na branch \`main\`.

- \`runs/\`: uma pasta por dia, com um arquivo para cada execução do sistema.
- \`sources/\`: as fontes de notícias, em subpastas.
- \`settings/\`: configurações do sistema. O arquivo \`schema_version.json\` informa a versão do formato dos dados.

Os arquivos são gravados automaticamente pelos workflows do projeto. **Não edite à mão.**

O formato está explicado em [docs/data-model.md](https://github.com/JustAVibeCodingAddict/NewsMonitor/blob/main/docs/data-model.md).

O repositório é público, então tudo o que está aqui é público. Nenhum segredo é guardado nesta branch.
`;

/** Registro da versão do formato, no formato exigido pela coleção \`settings\`. */
export function schemaVersionRecord(now: Date): SettingRecord {
  return SettingRecordSchema.parse({
    key: SCHEMA_VERSION_KEY,
    value: SCHEMA_VERSION,
    description: SCHEMA_VERSION_DESCRIPTION,
    updated_at: now.toISOString(),
  });
}

/** Todos os arquivos que uma branch `data` nova precisa ter. */
export function initialFiles(now: Date): InitialFile[] {
  return [
    { path: "README.md", content: DATA_BRANCH_README },
    // O Git não guarda pastas vazias. Estes arquivos mantêm as pastas visíveis desde o começo.
    { path: "runs/.gitkeep", content: "" },
    { path: "sources/.gitkeep", content: "" },
    { path: settingPath(SCHEMA_VERSION_KEY), content: serializeRecord(schemaVersionRecord(now)) },
  ];
}
