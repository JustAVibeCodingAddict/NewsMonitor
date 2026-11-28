import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ASSESSMENT_STATUSES,
  RunRecordSchema,
  SCHEMA_VERSION,
  SOURCE_STATUSES,
  SOURCE_TYPES,
  SettingRecordSchema,
  SourceInputSchema,
  SourceRecordSchema,
  TRIGGER_TYPES,
} from "../../src/storage/records.js";

type Fields = Record<string, unknown>;

// Segredo FALSO montado na hora (veja tests/unit/secrets.test.ts).
const fakeGithubToken = ["gh", "p_"].join("") + "A".repeat(36);

/** Caminhos (ex.: "finished_at") dos problemas encontrados, ou lista vazia se o dado é válido. */
function problemPaths(schema: { safeParse(input: unknown): { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } } }, input: unknown): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.path.map(String).join("."));
}

// ---------------------------------------------------------------------------
// Execuções (system_runs)
// ---------------------------------------------------------------------------

function runningRun(overrides: Fields = {}): Fields {
  return {
    id: "0192f3a4-5b6c-7d8e-9f01-23456789abcd",
    workflow_name: "health-check",
    trigger_type: "scheduled",
    status: "running",
    started_at: "2026-11-28T06:17:03.000Z",
    finished_at: null,
    duration_ms: null,
    summary: {},
    error_summary: null,
    external_run_id: "github-actions:123456789:1",
    created_at: "2026-11-28T06:17:03.000Z",
    ...overrides,
  };
}

function finishedRun(overrides: Fields = {}): Fields {
  return runningRun({
    status: "succeeded",
    finished_at: "2026-11-28T06:17:05.250Z",
    duration_ms: 2250,
    summary: { checks: { storage: "ok" } },
    ...overrides,
  });
}

describe("constantes", () => {
  it("seguem as listas da especificação", () => {
    expect(SCHEMA_VERSION).toBe(1);
    expect([...TRIGGER_TYPES]).toEqual(["manual", "scheduled", "api"]);
    expect([...SOURCE_TYPES]).toEqual(["official", "publisher", "news_agency", "aggregator", "community", "other"]);
    expect([...SOURCE_STATUSES]).toEqual(["candidate", "monitored", "restricted", "blocked"]);
    expect([...ASSESSMENT_STATUSES]).toEqual(["pending", "assessed", "rejected"]);
  });
});

describe("RunRecordSchema", () => {
  it("aceita execuções ainda não encerradas", () => {
    expect(RunRecordSchema.safeParse(runningRun()).success).toBe(true);
    expect(RunRecordSchema.safeParse(runningRun({ status: "pending" })).success).toBe(true);
  });

  it.each(["succeeded", "partial", "failed"])("aceita execução encerrada com estado %s", (status) => {
    expect(RunRecordSchema.safeParse(finishedRun({ status })).success).toBe(true);
  });

  it("aceita execução sem identificador externo e com mensagem de erro", () => {
    const run = finishedRun({ status: "failed", external_run_id: null, error_summary: "O armazenamento não respondeu" });
    expect(RunRecordSchema.safeParse(run).success).toBe(true);
  });

  it("aceita execução que começa e termina no mesmo instante", () => {
    const run = finishedRun({ finished_at: "2026-11-28T06:17:03.000Z", duration_ms: 0 });
    expect(RunRecordSchema.safeParse(run).success).toBe(true);
  });

  it("exige finished_at e duration_ms quando a execução terminou", () => {
    expect(problemPaths(RunRecordSchema, finishedRun({ finished_at: null }))).toContain("finished_at");
    expect(problemPaths(RunRecordSchema, finishedRun({ duration_ms: null }))).toContain("duration_ms");
  });

  it("não aceita finished_at nem duration_ms quando a execução não terminou", () => {
    expect(problemPaths(RunRecordSchema, runningRun({ finished_at: "2026-11-28T06:17:05.250Z" }))).toContain("finished_at");
    expect(problemPaths(RunRecordSchema, runningRun({ duration_ms: 10 }))).toContain("duration_ms");
    expect(problemPaths(RunRecordSchema, runningRun({ status: "pending", duration_ms: 10 }))).toContain("duration_ms");
  });

  it("não aceita término antes do início", () => {
    const run = finishedRun({ finished_at: "2026-11-28T06:17:02.000Z" });
    expect(problemPaths(RunRecordSchema, run)).toContain("finished_at");
  });

  it.each<[string, Fields]>([
    ["identificador que não é UUID", { id: "abc" }],
    ["UUID em maiúsculas", { id: "0192F3A4-5B6C-7D8E-9F01-23456789ABCD" }],
    ["nome de workflow com maiúsculas", { workflow_name: "Health-Check" }],
    ["nome de workflow com espaço", { workflow_name: "health check" }],
    ["nome de workflow vazio", { workflow_name: "" }],
    ["nome de workflow longo demais", { workflow_name: `a${"b".repeat(64)}` }],
    ["tipo de disparo desconhecido", { trigger_type: "cron" }],
    ["estado desconhecido", { status: "done" }],
    ["data com fuso em vez de UTC", { started_at: "2026-11-28T03:17:03-03:00" }],
    ["data sem hora", { started_at: "2026-11-28" }],
    ["data inválida", { created_at: "ontem" }],
    ["duração negativa", { status: "succeeded", finished_at: "2026-11-28T06:17:05.250Z", duration_ms: -1 }],
    ["duração fracionada", { status: "succeeded", finished_at: "2026-11-28T06:17:05.250Z", duration_ms: 1.5 }],
    ["resumo que não é objeto", { summary: "texto" }],
    ["resumo nulo", { summary: null }],
    ["mensagem de erro longa demais", { status: "failed", finished_at: "2026-11-28T06:17:05.250Z", duration_ms: 1, error_summary: "x".repeat(2001) }],
    ["identificador externo vazio", { external_run_id: "" }],
    ["campo desconhecido", { extra: true }],
  ])("recusa %s", (_description, overrides) => {
    expect(RunRecordSchema.safeParse(runningRun(overrides)).success).toBe(false);
  });

  it("recusa registro com campo faltando", () => {
    const { created_at: _removed, ...withoutCreatedAt } = runningRun();
    expect(problemPaths(RunRecordSchema, withoutCreatedAt)).toContain("created_at");
  });

  it("recusa segredo no resumo, na mensagem de erro e no identificador externo", () => {
    expect(problemPaths(RunRecordSchema, runningRun({ summary: { url: fakeGithubToken } }))).toContain("summary");
    expect(problemPaths(RunRecordSchema, runningRun({ summary: { api_key: "qualquer-coisa" } }))).toContain("summary");
    const failed = { status: "failed", finished_at: "2026-11-28T06:17:05.250Z", duration_ms: 1 };
    expect(problemPaths(RunRecordSchema, runningRun({ ...failed, error_summary: `falhou com ${fakeGithubToken}` }))).toContain("error_summary");
    expect(problemPaths(RunRecordSchema, runningRun({ external_run_id: fakeGithubToken }))).toContain("external_run_id");
  });

  it("recusa resumo maior que 64 KB e aceita um grande dentro do limite", () => {
    expect(RunRecordSchema.safeParse(runningRun({ summary: { texto: "x".repeat(70_000) } })).success).toBe(false);
    expect(RunRecordSchema.safeParse(runningRun({ summary: { texto: "x".repeat(60_000) } })).success).toBe(true);
  });

  it("não deixa a mensagem de recusa repetir o segredo", () => {
    const result = RunRecordSchema.safeParse(runningRun({ summary: { url: fakeGithubToken } }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).not.toContain(fakeGithubToken);
  });
});

// ---------------------------------------------------------------------------
// Fontes (sources)
// ---------------------------------------------------------------------------

const minimalSource: Fields = {
  name: "G1",
  domain: "g1.globo.com",
  base_url: "https://g1.globo.com/",
  source_type: "publisher",
};

function storedSource(overrides: Fields = {}): Fields {
  return {
    id: "0192f3a4-5b6c-7d8e-9f01-23456789abcd",
    name: "G1",
    domain: "g1.globo.com",
    base_url: "https://g1.globo.com/",
    feed_url: "https://g1.globo.com/rss/g1/",
    source_type: "publisher",
    source_status: "monitored",
    assessment_status: "assessed",
    country: "BR",
    language: "pt-BR",
    is_primary_source: false,
    enabled: true,
    consecutive_failures: 0,
    last_checked_at: "2026-11-28T06:17:03.000Z",
    last_successful_fetch_at: "2026-11-28T06:17:03.000Z",
    metadata: {},
    created_at: "2026-11-27T12:00:00.000Z",
    updated_at: "2026-11-28T06:17:03.000Z",
    ...overrides,
  };
}

describe("SourceInputSchema (cadastro de fonte nova)", () => {
  it("aplica os valores padrão da especificação", () => {
    expect(SourceInputSchema.parse(minimalSource)).toEqual({
      name: "G1",
      domain: "g1.globo.com",
      base_url: "https://g1.globo.com/",
      feed_url: null,
      source_type: "publisher",
      source_status: "candidate",
      assessment_status: "pending",
      country: null,
      language: null,
      is_primary_source: false,
      enabled: true,
      consecutive_failures: 0,
      last_checked_at: null,
      last_successful_fetch_at: null,
      metadata: {},
    });
  });

  it("cada cadastro recebe o seu próprio objeto metadata", () => {
    const first = SourceInputSchema.parse(minimalSource);
    const second = SourceInputSchema.parse(minimalSource);
    first.metadata["marca"] = true;
    expect(second.metadata).toEqual({});
  });

  it("normaliza o domínio", () => {
    expect(SourceInputSchema.parse({ ...minimalSource, domain: " G1.Globo.COM. " }).domain).toBe("g1.globo.com");
    expect(SourceInputSchema.parse({ ...minimalSource, domain: "bücher.de" }).domain).toBe("xn--bcher-kva.de");
  });

  it("mantém o que foi informado em vez dos padrões", () => {
    const parsed = SourceInputSchema.parse({
      ...minimalSource,
      feed_url: "https://g1.globo.com/rss/g1/",
      source_status: "monitored",
      assessment_status: "assessed",
      country: "BR",
      language: "pt-BR",
      is_primary_source: true,
      enabled: false,
      metadata: { observacao: "teste" },
    });
    expect(parsed).toMatchObject({
      feed_url: "https://g1.globo.com/rss/g1/",
      source_status: "monitored",
      assessment_status: "assessed",
      country: "BR",
      language: "pt-BR",
      is_primary_source: true,
      enabled: false,
      metadata: { observacao: "teste" },
    });
  });

  it.each<[string, Fields]>([
    ["domínio com http://", { domain: "http://g1.globo.com" }],
    ["domínio com caminho", { domain: "g1.globo.com/politica" }],
    ["domínio com porta", { domain: "g1.globo.com:443" }],
    ["domínio que é endereço IP", { domain: "10.0.0.1" }],
    ["domínio vazio", { domain: "" }],
    ["nome vazio", { name: "   " }],
    ["nome longo demais", { name: "x".repeat(201) }],
    ["tipo de fonte desconhecido", { source_type: "blog" }],
    ["estado da fonte desconhecido", { source_status: "ativa" }],
    ["avaliação desconhecida", { assessment_status: "ok" }],
    ["URL com protocolo ftp", { base_url: "ftp://g1.globo.com/" }],
    ["URL javascript", { base_url: "javascript:alert(1)" }],
    ["URL sem protocolo", { base_url: "g1.globo.com" }],
    ["URL com usuário e senha", { base_url: "https://usuario:senha@g1.globo.com/" }],
    ["URL com usuário sem senha", { base_url: "https://usuario@g1.globo.com/" }],
    ["feed com api_key", { feed_url: "https://g1.globo.com/rss?api_key=abc123" }],
    ["feed com token", { feed_url: "https://g1.globo.com/rss?pagina=1&token=abc123" }],
    ["feed com access_token", { feed_url: "https://g1.globo.com/rss?access_token=abc123" }],
    ["feed com key", { feed_url: "https://g1.globo.com/rss?KEY=abc123" }],
    ["feed com signature", { feed_url: "https://g1.globo.com/rss?signature=abc123" }],
    ["URL longa demais", { base_url: `https://g1.globo.com/${"a".repeat(2100)}` }],
    ["contagem de falhas negativa", { consecutive_failures: -1 }],
    ["contagem de falhas fracionada", { consecutive_failures: 0.5 }],
    ["data de verificação sem UTC", { last_checked_at: "2026-11-28T03:17:03-03:00" }],
    ["id informado de fora", { id: "0192f3a4-5b6c-7d8e-9f01-23456789abcd" }],
    ["created_at informado de fora", { created_at: "2026-11-28T06:17:03.000Z" }],
    ["campo desconhecido", { extra: 1 }],
    ["metadata com segredo", { metadata: { url: fakeGithubToken } }],
    ["metadata com campo de credencial", { metadata: { senha: "123" } }],
    ["metadata grande demais", { metadata: { texto: "x".repeat(70_000) } }],
  ])("recusa %s", (_description, overrides) => {
    expect(SourceInputSchema.safeParse({ ...minimalSource, ...overrides }).success).toBe(false);
  });

  it("recusa cadastro sem os campos obrigatórios", () => {
    for (const field of ["name", "domain", "base_url", "source_type"]) {
      const incomplete = { ...minimalSource };
      delete incomplete[field];
      expect(SourceInputSchema.safeParse(incomplete).success, `sem ${field}`).toBe(false);
    }
  });

  it("aceita URLs comuns, com parâmetros que não são credenciais", () => {
    for (const url of [
      "https://g1.globo.com/",
      "http://exemplo.com.br/rss.xml",
      "https://exemplo.com/feed?pagina=2&idioma=pt",
      "HTTPS://EXEMPLO.COM/Feed",
      "https://exemplo.com:8443/feed",
    ]) {
      expect(SourceInputSchema.safeParse({ ...minimalSource, base_url: url }).success, url).toBe(true);
    }
  });

  it("não deixa a mensagem de recusa repetir a senha da URL", () => {
    const result = SourceInputSchema.safeParse({ ...minimalSource, base_url: "https://usuario:senha-muito-secreta@g1.globo.com/" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).not.toContain("senha-muito-secreta");
  });
});

describe("SourceRecordSchema (fonte guardada)", () => {
  it("aceita uma fonte completa", () => {
    expect(SourceRecordSchema.safeParse(storedSource()).success).toBe(true);
    expect(SourceRecordSchema.safeParse(storedSource({ feed_url: null, country: null, language: null, last_checked_at: null, last_successful_fetch_at: null })).success).toBe(true);
  });

  it("aceita o resultado do cadastro mais id e datas", () => {
    const input = SourceInputSchema.parse(minimalSource);
    const record = { ...input, id: "0192f3a4-5b6c-7d8e-9f01-23456789abcd", created_at: "2026-11-27T12:00:00.000Z", updated_at: "2026-11-27T12:00:00.000Z" };
    expect(SourceRecordSchema.safeParse(record).success).toBe(true);
  });

  it("recusa domínio que não está normalizado", () => {
    expect(problemPaths(SourceRecordSchema, storedSource({ domain: "G1.globo.com" }))).toContain("domain");
    expect(problemPaths(SourceRecordSchema, storedSource({ domain: "g1.globo.com." }))).toContain("domain");
    expect(problemPaths(SourceRecordSchema, storedSource({ domain: "bücher.de" }))).toContain("domain");
    expect(problemPaths(SourceRecordSchema, storedSource({ domain: "http://g1.globo.com" }))).toContain("domain");
  });

  it("recusa registro com campo faltando ou sobrando", () => {
    const { updated_at: _removed, ...withoutUpdatedAt } = storedSource();
    expect(problemPaths(SourceRecordSchema, withoutUpdatedAt)).toContain("updated_at");
    expect(SourceRecordSchema.safeParse(storedSource({ extra: 1 })).success).toBe(false);
  });

  it("recusa valores fora das listas e URLs com credenciais", () => {
    expect(SourceRecordSchema.safeParse(storedSource({ source_type: "blog" })).success).toBe(false);
    expect(SourceRecordSchema.safeParse(storedSource({ feed_url: "https://g1.globo.com/rss?token=abc" })).success).toBe(false);
    expect(SourceRecordSchema.safeParse(storedSource({ metadata: { chave: fakeGithubToken } })).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Configurações (system_settings)
// ---------------------------------------------------------------------------

function setting(overrides: Fields = {}): Fields {
  return {
    key: "schema_version",
    value: 1,
    description: "Versão do formato dos dados.",
    updated_at: "2026-11-27T12:00:00.000Z",
    ...overrides,
  };
}

describe("SettingRecordSchema", () => {
  it("aceita qualquer valor JSON simples", () => {
    for (const value of [1, 0, "texto", true, false, null, [1, 2, 3], { limite: 10, ativo: true }]) {
      expect(SettingRecordSchema.safeParse(setting({ value })).success, JSON.stringify(value)).toBe(true);
    }
  });

  it.each<[string, Fields]>([
    ["chave com maiúsculas", { key: "Schema_Version" }],
    ["chave vazia", { key: "" }],
    ["chave com barra", { key: "a/b" }],
    ["chave longa demais", { key: "a".repeat(101) }],
    ["chave que sugere credencial (api_key)", { key: "api_key" }],
    ["chave que sugere credencial (supabase_secret_key)", { key: "supabase_secret_key" }],
    ["chave que sugere credencial (senha_do_banco)", { key: "senha_do_banco" }],
    ["valor com segredo", { value: fakeGithubToken }],
    ["valor com segredo escondido num objeto", { value: { a: [{ b: fakeGithubToken }] } }],
    ["valor com campo de credencial", { value: { token: "abc" } }],
    ["valor grande demais", { value: "x".repeat(70_000) }],
    ["descrição com segredo", { description: `usar ${fakeGithubToken}` }],
    ["descrição longa demais", { description: "x".repeat(501) }],
    ["data sem UTC", { updated_at: "2026-11-27T09:00:00-03:00" }],
    ["campo desconhecido", { extra: true }],
  ])("recusa %s", (_description, overrides) => {
    expect(SettingRecordSchema.safeParse(setting(overrides)).success).toBe(false);
  });

  it("recusa registro sem valor", () => {
    const { value: _removed, ...withoutValue } = setting();
    expect(SettingRecordSchema.safeParse(withoutValue).success).toBe(false);
  });

  it("recusa valores que o JSON não consegue guardar", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    expect(SettingRecordSchema.safeParse(setting({ value: circular })).success).toBe(false);
    expect(SettingRecordSchema.safeParse(setting({ value: undefined })).success).toBe(false);
    expect(SettingRecordSchema.safeParse(setting({ value: 10n })).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Os exemplos da documentação precisam continuar válidos
// ---------------------------------------------------------------------------

const dataModelDoc = readFileSync(fileURLToPath(new URL("../../docs/data-model.md", import.meta.url)), "utf8");

function exampleFromDoc(kind: "run" | "source" | "setting"): unknown {
  const match = new RegExp("```json " + kind + "\\r?\\n([\\s\\S]*?)\\r?\\n```").exec(dataModelDoc);
  const text = match?.[1];
  if (text === undefined) {
    throw new Error(`docs/data-model.md não tem o exemplo "${kind}"`);
  }
  return JSON.parse(text);
}

describe("docs/data-model.md", () => {
  it("o exemplo de execução segue o formato", () => {
    expect(problemPaths(RunRecordSchema, exampleFromDoc("run"))).toEqual([]);
  });

  it("o exemplo de fonte segue o formato", () => {
    expect(problemPaths(SourceRecordSchema, exampleFromDoc("source"))).toEqual([]);
  });

  it("o exemplo de configuração segue o formato", () => {
    expect(problemPaths(SettingRecordSchema, exampleFromDoc("setting"))).toEqual([]);
  });

  it("cita a versão atual do formato", () => {
    expect(dataModelDoc).toContain(`Versão atual do formato: ${SCHEMA_VERSION}`);
  });
});
