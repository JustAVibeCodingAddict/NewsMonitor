/**
 * Formato dos registros guardados nos dados do News Monitor (versão 1).
 *
 * Cada coleção equivale a uma tabela da especificação:
 *   runs      = system_runs      (execuções do sistema)
 *   sources   = sources          (fontes de notícias)
 *   settings  = system_settings  (configurações)
 *
 * Os esquemas dos registros GUARDADOS são estritos: campos desconhecidos ou
 * faltando indicam arquivo corrompido ou de outra versão e são recusados.
 * Os campos livres (summary, metadata, value, textos) nunca aceitam segredos,
 * porque o repositório é público.
 */

import { z } from "zod";
import { findSecretLikeValues, isSecretLikeKey } from "../core/secrets.js";
import { RUN_STATUSES, isFinalStatus } from "../core/run-state.js";
import { SETTING_KEY_REGEX, UUID_REGEX, normalizeDomain } from "./layout.js";

/** Versão do formato dos dados. Só muda junto com uma migração documentada em docs/data-model.md. */
export const SCHEMA_VERSION = 1;

export const TRIGGER_TYPES = ["manual", "scheduled", "api"] as const;
export const SOURCE_TYPES = ["official", "publisher", "news_agency", "aggregator", "community", "other"] as const;
export const SOURCE_STATUSES = ["candidate", "monitored", "restricted", "blocked"] as const;
export const ASSESSMENT_STATUSES = ["pending", "assessed", "rejected"] as const;

/** Tamanho máximo, em bytes, de um campo JSON livre (o GitHub recomenda arquivos pequenos). */
const MAX_FREE_JSON_BYTES = 64 * 1024;

// ---------------------------------------------------------------------------
// Peças reutilizáveis
// ---------------------------------------------------------------------------

/** Data e hora em UTC, no formato ISO 8601 terminado em Z (ex.: 2026-11-27T21:00:00.000Z). */
const utcDateTime = z.iso.datetime();

const uuid = z.string().regex(UUID_REGEX, { message: "Precisa ser um UUID em minúsculas" });

/** Texto livre: com tamanho limitado e sem nada que pareça um segredo. */
function freeText(maxLength: number) {
  return z
    .string()
    .max(maxLength)
    .refine((text) => findSecretLikeValues(text).length === 0, {
      message: "O texto contém algo que parece um segredo",
    });
}

function jsonProblems(value: unknown): string[] {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    serialized = undefined;
  }
  if (serialized === undefined) {
    return ["O valor não é JSON válido"];
  }

  const problems: string[] = [];
  const bytes = Buffer.byteLength(serialized, "utf8");
  if (bytes > MAX_FREE_JSON_BYTES) {
    problems.push(`JSON grande demais: ${bytes} bytes (máximo ${MAX_FREE_JSON_BYTES})`);
  }
  for (const finding of findSecretLikeValues(value)) {
    problems.push(`Possível segredo em ${finding.path} (${finding.reason}). Segredos não podem ser gravados nos dados.`);
  }
  return problems;
}

/** Objeto JSON livre (summary, metadata). */
const freeJsonObject = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  for (const message of jsonProblems(value)) {
    ctx.addIssue({ code: "custom", message });
  }
});

/** Qualquer valor JSON (value de uma configuração). */
const freeJsonValue = z.unknown().superRefine((value, ctx) => {
  for (const message of jsonProblems(value)) {
    ctx.addIssue({ code: "custom", message });
  }
});

/** Parâmetros de URL que normalmente carregam credenciais. */
const CREDENTIAL_QUERY_PARAMS = /^(?:api[-_]?key|key|token|access[-_]?token|auth|secret|password|passwd|signature|sig)$/i;

function urlWithoutCredentials(text: string): boolean {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  if (url.username !== "" || url.password !== "") {
    return false;
  }
  for (const name of url.searchParams.keys()) {
    if (CREDENTIAL_QUERY_PARAMS.test(name)) {
      return false;
    }
  }
  return true;
}

/** URL http ou https, sem usuário, senha ou parâmetros de credencial. */
const httpUrl = z
  .url({ protocol: /^https?$/ })
  .max(2048)
  .refine(urlWithoutCredentials, {
    message: "A URL não pode ter usuário, senha nem parâmetros de credencial",
  });

const sourceName = z.string().trim().min(1).max(200).refine((text) => findSecretLikeValues(text).length === 0, {
  message: "O nome contém algo que parece um segredo",
});

const shortLabel = z.string().trim().min(1).max(100);

// ---------------------------------------------------------------------------
// runs (system_runs)
// ---------------------------------------------------------------------------

export const RunRecordSchema = z
  .strictObject({
    id: uuid,
    workflow_name: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/, {
      message: "Use minúsculas, números, ponto, hífen e sublinhado (até 64 caracteres, começando por letra)",
    }),
    trigger_type: z.enum(TRIGGER_TYPES),
    status: z.enum(RUN_STATUSES),
    started_at: utcDateTime,
    finished_at: utcDateTime.nullable(),
    duration_ms: z.number().int().nonnegative().nullable(),
    summary: freeJsonObject,
    error_summary: freeText(2000).nullable(),
    external_run_id: freeText(200).min(1).nullable(),
    created_at: utcDateTime,
  })
  .superRefine((run, ctx) => {
    if (isFinalStatus(run.status)) {
      if (run.finished_at === null) {
        ctx.addIssue({ code: "custom", path: ["finished_at"], message: "Execução encerrada precisa ter finished_at" });
      }
      if (run.duration_ms === null) {
        ctx.addIssue({ code: "custom", path: ["duration_ms"], message: "Execução encerrada precisa ter duration_ms" });
      }
    } else {
      if (run.finished_at !== null) {
        ctx.addIssue({ code: "custom", path: ["finished_at"], message: "Execução não encerrada não pode ter finished_at" });
      }
      if (run.duration_ms !== null) {
        ctx.addIssue({ code: "custom", path: ["duration_ms"], message: "Execução não encerrada não pode ter duration_ms" });
      }
    }
    if (run.finished_at !== null && Date.parse(run.finished_at) < Date.parse(run.started_at)) {
      ctx.addIssue({ code: "custom", path: ["finished_at"], message: "finished_at não pode ser anterior a started_at" });
    }
  });

export type RunRecord = z.infer<typeof RunRecordSchema>;

// ---------------------------------------------------------------------------
// sources
// ---------------------------------------------------------------------------

const domainField = z.string().transform((text, ctx) => {
  const normalized = normalizeDomain(text);
  if (normalized === null) {
    ctx.addIssue({
      code: "custom",
      message: "Domínio inválido. Use só o domínio (ex.: g1.globo.com), sem http://, caminho, porta ou endereço IP",
    });
    return z.NEVER;
  }
  return normalized;
});

/**
 * Dados para cadastrar uma fonte nova. Aplica os valores padrão e normaliza o
 * domínio. Toda fonte nova começa como candidata, com avaliação pendente.
 */
export const SourceInputSchema = z.strictObject({
  name: sourceName,
  domain: domainField,
  base_url: httpUrl,
  feed_url: httpUrl.nullable().default(null),
  source_type: z.enum(SOURCE_TYPES),
  source_status: z.enum(SOURCE_STATUSES).default("candidate"),
  assessment_status: z.enum(ASSESSMENT_STATUSES).default("pending"),
  country: shortLabel.nullable().default(null),
  language: shortLabel.nullable().default(null),
  is_primary_source: z.boolean().default(false),
  enabled: z.boolean().default(true),
  consecutive_failures: z.number().int().nonnegative().default(0),
  last_checked_at: utcDateTime.nullable().default(null),
  last_successful_fetch_at: utcDateTime.nullable().default(null),
  // Função, para que cada cadastro receba o seu próprio objeto (nunca um objeto compartilhado).
  metadata: freeJsonObject.default(() => ({})),
});

export type SourceInput = z.input<typeof SourceInputSchema>;
export type NewSource = z.output<typeof SourceInputSchema>;

/** Fonte como fica guardada: todos os campos presentes e o domínio já normalizado. */
export const SourceRecordSchema = z.strictObject({
  id: uuid,
  name: sourceName,
  domain: z.string().refine((text) => normalizeDomain(text) === text, {
    message: "O domínio precisa estar normalizado (minúsculas, sem ponto final, sem http://)",
  }),
  base_url: httpUrl,
  feed_url: httpUrl.nullable(),
  source_type: z.enum(SOURCE_TYPES),
  source_status: z.enum(SOURCE_STATUSES),
  assessment_status: z.enum(ASSESSMENT_STATUSES),
  country: shortLabel.nullable(),
  language: shortLabel.nullable(),
  is_primary_source: z.boolean(),
  enabled: z.boolean(),
  consecutive_failures: z.number().int().nonnegative(),
  last_checked_at: utcDateTime.nullable(),
  last_successful_fetch_at: utcDateTime.nullable(),
  metadata: freeJsonObject,
  created_at: utcDateTime,
  updated_at: utcDateTime,
});

export type SourceRecord = z.infer<typeof SourceRecordSchema>;

// ---------------------------------------------------------------------------
// settings (system_settings)
// ---------------------------------------------------------------------------

export const SettingRecordSchema = z.strictObject({
  key: z
    .string()
    .regex(SETTING_KEY_REGEX, {
      message: "Use minúsculas, números, ponto, hífen e sublinhado (até 100 caracteres)",
    })
    .refine((key) => !isSecretLikeKey(key), {
      message: "O nome da configuração sugere uma credencial. Credenciais não podem ser guardadas nos dados.",
    }),
  value: freeJsonValue,
  description: freeText(500),
  updated_at: utcDateTime,
});

export type SettingRecord = z.infer<typeof SettingRecordSchema>;
