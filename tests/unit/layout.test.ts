import { describe, expect, it } from "vitest";
import { COLLECTIONS, normalizeDomain, runPath, settingPath, sourcePath } from "../../src/storage/layout.js";

const RUN_ID = "0192f3a4-5b6c-7d8e-9f01-23456789abcd";

describe("COLLECTIONS", () => {
  it("são as três coleções da Fase 1", () => {
    expect([...COLLECTIONS]).toEqual(["runs", "sources", "settings"]);
  });
});

describe("normalizeDomain", () => {
  it.each([
    ["example.com", "example.com"],
    ["Example.COM", "example.com"],
    ["  g1.globo.com  ", "g1.globo.com"],
    ["example.com.", "example.com"],
    ["folha.uol.com.br", "folha.uol.com.br"],
    // O "www." não é removido: pode ser outro site.
    ["www.example.com", "www.example.com"],
    ["bücher.de", "xn--bcher-kva.de"],
    ["ｅｘａｍｐｌｅ.com", "example.com"],
  ])("normaliza %j para %j", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });

  it("dá o mesmo resultado se for aplicada duas vezes", () => {
    for (const input of ["Example.COM.", "bücher.de", "  G1.Globo.com "]) {
      const once = normalizeDomain(input);
      expect(once).not.toBeNull();
      expect(normalizeDomain(once ?? "")).toBe(once);
    }
  });

  it.each([
    "",
    "   ",
    "localhost",
    "example",
    "http://example.com",
    "https://example.com/",
    "example.com/caminho",
    "example.com\\caminho",
    "example.com:8080",
    "usuario@example.com",
    "example.com?x=1",
    "example.com#topo",
    "exa mple.com",
    "example..com",
    ".example.com",
    "example.com..",
    "-ruim.example.com",
    "ruim-.example.com",
    "192.168.0.1",
    "1.2.3.4",
    "0x7f.0x0.0x0.0x1",
    "exemplo.123",
    "servidor.local",
    "servidor.internal",
    "servidor.localhost",
    "%65xample.com",
    `${"a".repeat(64)}.com`,
    `${"a".repeat(60)}.${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.${"e".repeat(60)}.com`,
  ])("recusa %j", (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });

  it("aceita domínio com 250 caracteres e recusa com 251 (o arquivo precisa caber em 255)", () => {
    const labels = (lastLength: number) =>
      `${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(lastLength)}.com`;
    expect(labels(54)).toHaveLength(250);
    expect(normalizeDomain(labels(54))).toBe(labels(54));
    expect(labels(55)).toHaveLength(251);
    expect(normalizeDomain(labels(55))).toBeNull();
    expect(`${sourcePath(labels(54)).split("/").pop()}`.length).toBeLessThanOrEqual(255);
  });

  it("recusa o que não é texto", () => {
    expect(normalizeDomain(undefined as unknown as string)).toBeNull();
    expect(normalizeDomain(null as unknown as string)).toBeNull();
    expect(normalizeDomain(42 as unknown as string)).toBeNull();
  });
});

describe("runPath", () => {
  it("usa uma pasta por dia, com a data UTC do início", () => {
    expect(runPath(RUN_ID, "2026-11-27T06:17:03.000Z")).toBe(`runs/2026/11/27/${RUN_ID}.json`);
    expect(runPath(RUN_ID, "2026-11-27T06:17:03Z")).toBe(`runs/2026/11/27/${RUN_ID}.json`);
  });

  it("troca de pasta exatamente na virada do dia UTC", () => {
    expect(runPath(RUN_ID, "2026-12-31T23:59:59.999Z")).toBe(`runs/2026/12/31/${RUN_ID}.json`);
    expect(runPath(RUN_ID, "2027-01-01T00:00:00.000Z")).toBe(`runs/2027/01/01/${RUN_ID}.json`);
  });

  it.each([
    "ontem",
    "2026-11-27",
    "2026-11-27T06:17:03",
    "2026-11-27T06:17:03-03:00",
    "2026-11-27T06:17:03+00:00",
    "2026-11-27 06:17:03Z",
    "November 27, 2026 10:00 Z",
    "2026-02-31T00:00:00Z",
    "2026-13-01T00:00:00Z",
    "",
  ])("recusa a data %j", (startedAt) => {
    expect(() => runPath(RUN_ID, startedAt)).toThrow(RangeError);
  });

  it.each([
    "",
    "abc",
    "../../etc/passwd",
    RUN_ID.toUpperCase(),
    `${RUN_ID}/../x`,
    // versão 0 e variante inválidas
    "0192f3a4-5b6c-0d8e-9f01-23456789abcd",
    "0192f3a4-5b6c-7d8e-1f01-23456789abcd",
  ])("recusa o identificador %j", (id) => {
    expect(() => runPath(id, "2026-11-27T06:17:03.000Z")).toThrow(RangeError);
  });
});

describe("sourcePath", () => {
  it.each([
    ["example.com", "sources/a3/example.com.json"],
    ["g1.globo.com", "sources/4e/g1.globo.com.json"],
    ["www.example.com", "sources/80/www.example.com.json"],
    ["folha.uol.com.br", "sources/cb/folha.uol.com.br.json"],
    ["bücher.de", "sources/df/xn--bcher-kva.de.json"],
  ])("%j fica em %j", (domain, expected) => {
    expect(sourcePath(domain)).toBe(expected);
  });

  it("maiúsculas e minúsculas caem no mesmo arquivo", () => {
    expect(sourcePath("G1.Globo.COM")).toBe(sourcePath("g1.globo.com"));
    expect(sourcePath("g1.globo.com.")).toBe(sourcePath("g1.globo.com"));
  });

  it("sempre devolve um caminho curto, sem '..' e sem sair da pasta sources", () => {
    for (const domain of ["example.com", "a.b", "xn--bcher-kva.de", "sub.dominio.exemplo.com.br"]) {
      expect(sourcePath(domain)).toMatch(/^sources\/[0-9a-f]{2}\/[a-z0-9.-]+\.json$/);
      expect(sourcePath(domain)).not.toContain("..");
    }
  });

  it.each(["", "http://example.com", "../x.com", "example.com/../x", "localhost", "192.168.0.1"])(
    "recusa o domínio %j",
    (domain) => {
      expect(() => sourcePath(domain)).toThrow(RangeError);
    },
  );
});

describe("settingPath", () => {
  it("usa a chave como nome do arquivo", () => {
    expect(settingPath("schema_version")).toBe("settings/schema_version.json");
    expect(settingPath("limite.diario-maximo")).toBe("settings/limite.diario-maximo.json");
  });

  it.each(["", "../x", "Maiuscula", "a/b", "a\\b", ".oculto", "-comeca-com-hifen", "tem espaço", "a".repeat(101)])(
    "recusa a chave %j",
    (key) => {
      expect(() => settingPath(key)).toThrow(RangeError);
    },
  );

  it("aceita chave com 100 caracteres", () => {
    expect(settingPath("a".repeat(100))).toBe(`settings/${"a".repeat(100)}.json`);
  });

  it("a mensagem de erro não repete um texto enorme", () => {
    let message = "";
    try {
      settingPath(`A${"x".repeat(5000)}`);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe("");
    expect(message.length).toBeLessThan(400);
  });
});
