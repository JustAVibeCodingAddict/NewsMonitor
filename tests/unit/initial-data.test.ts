import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { containsSecret, findSecretLikeValues } from "../../src/core/secrets.js";
import { SCHEMA_VERSION_DESCRIPTION, initialFiles, schemaVersionRecord } from "../../src/storage/initial-data.js";
import { SCHEMA_VERSION, SettingRecordSchema } from "../../src/storage/records.js";
import { serializeRecord } from "../../src/storage/serialize.js";

const NOW = new Date("2026-11-28T06:17:03.456Z");

describe("serializeRecord", () => {
  it("usa recuo de 2 espaços e termina com uma quebra de linha", () => {
    expect(serializeRecord({ a: 1, b: [2] })).toBe('{\n  "a": 1,\n  "b": [\n    2\n  ]\n}\n');
  });

  it("mantém a ordem dos campos", () => {
    expect(serializeRecord({ z: 1, a: 2 })).toBe('{\n  "z": 1,\n  "a": 2\n}\n');
  });

  it("recusa o que o JSON não consegue guardar", () => {
    expect(() => serializeRecord(undefined)).toThrow(TypeError);
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    expect(() => serializeRecord(circular)).toThrow(TypeError);
  });
});

describe("initialFiles", () => {
  const files = initialFiles(NOW);
  const byPath = new Map(files.map((file) => [file.path, file.content]));

  it("cria o README, as pastas de execuções e fontes e a versão do formato", () => {
    expect(files.map((file) => file.path)).toEqual([
      "README.md",
      "runs/.gitkeep",
      "sources/.gitkeep",
      "settings/schema_version.json",
    ]);
  });

  it("o schema_version.json é um registro válido com a versão atual do formato", () => {
    const content = byPath.get("settings/schema_version.json") ?? "";
    const record = SettingRecordSchema.parse(JSON.parse(content));
    expect(record.key).toBe("schema_version");
    expect(record.value).toBe(SCHEMA_VERSION);
    expect(record.updated_at).toBe("2026-11-28T06:17:03.456Z");
    // Reescrever o registro dá exatamente o mesmo texto: o formato é estável.
    expect(serializeRecord(record)).toBe(content);
    expect(content.endsWith("}\n")).toBe(true);
  });

  it("schemaVersionRecord usa a hora informada", () => {
    expect(schemaVersionRecord(new Date("2030-01-02T03:04:05.000Z")).updated_at).toBe("2030-01-02T03:04:05.000Z");
  });

  it("o README explica a branch e aponta para o documento do formato", () => {
    const readme = byPath.get("README.md") ?? "";
    expect(readme).toContain("docs/data-model.md");
    expect(readme).toContain("Não edite à mão");
    expect(readme.endsWith("\n")).toBe(true);
  });

  it("nenhum arquivo inicial contém segredos", () => {
    for (const file of files) {
      expect(containsSecret(file.content), file.path).toBe(false);
    }
    expect(findSecretLikeValues(JSON.parse(byPath.get("settings/schema_version.json") ?? "null"))).toEqual([]);
  });

  it("a descrição bate com o exemplo de docs/data-model.md", () => {
    const doc = readFileSync(fileURLToPath(new URL("../../docs/data-model.md", import.meta.url)), "utf8");
    expect(doc).toContain(JSON.stringify(SCHEMA_VERSION_DESCRIPTION));
  });
});
