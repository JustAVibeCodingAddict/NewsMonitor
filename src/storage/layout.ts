/**
 * Onde cada registro fica guardado e como as chaves são normalizadas.
 *
 * Os dados ficam em arquivos JSON, um por registro. O nome do arquivo é a chave
 * do registro, então duas chaves iguais nunca coexistem: gravar de novo na mesma
 * chave cai no mesmo arquivo. Os caminhos são sempre relativos e usam "/".
 *
 * Cada pasta guarda poucos itens, abaixo do limite recomendado pelo GitHub
 * (3.000 por pasta):
 *   runs/AAAA/MM/DD/<id>.json      uma pasta por dia (data UTC do início)
 *   sources/<xx>/<domínio>.json    "xx" = 2 primeiros caracteres do SHA-256 do domínio
 *   settings/<chave>.json          poucas configurações, sem subpastas
 */

import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";

export const COLLECTIONS = ["runs", "sources", "settings"] as const;
export type Collection = (typeof COLLECTIONS)[number];

/** UUID em minúsculas, com os bits de versão (1 a 8) e de variante corretos. */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Chave de configuração: minúsculas, números, ponto, hífen e sublinhado. */
export const SETTING_KEY_REGEX = /^[a-z0-9][a-z0-9._-]{0,99}$/;

/**
 * Tamanho máximo de um domínio. O DNS aceita 253, mas o nome do arquivo
 * ("<domínio>.json") precisa caber nos 255 caracteres que os sistemas de arquivos aceitam.
 */
const MAX_DOMAIN_LENGTH = 250;

/** Data e hora em UTC: AAAA-MM-DDTHH:MM:SS, fração opcional, terminada em Z. */
const UTC_DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

const DOMAIN_LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Terminações que apontam para redes internas e nunca são fontes públicas. */
const INTERNAL_TOP_LEVEL_DOMAINS = new Set(["localhost", "local", "internal", "intranet", "lan", "corp", "home", "invalid"]);

/**
 * Normaliza um domínio para ser usado como chave única de uma fonte.
 *
 * Regras: só o domínio (nada de http://, caminho, porta ou usuário); minúsculas;
 * sem ponto final; domínios com acento viram punycode; pelo menos 2 partes;
 * sem endereços IP; sem terminações de rede interna. O "www." NÃO é removido,
 * porque pode ser um site diferente.
 *
 * Devolve `null` quando o texto não é um domínio válido.
 */
export function normalizeDomain(input: string): string | null {
  if (typeof input !== "string") {
    return null;
  }

  let text = input.trim();
  if (text === "" || /[\s/\\?#@:%]/.test(text)) {
    return null;
  }
  if (text.endsWith(".")) {
    text = text.slice(0, -1);
  }

  const ascii = domainToASCII(text.toLowerCase());
  if (ascii === "" || ascii.length > MAX_DOMAIN_LENGTH) {
    return null;
  }

  const labels = ascii.split(".");
  if (labels.length < 2 || !labels.every((label) => DOMAIN_LABEL_REGEX.test(label))) {
    return null;
  }

  const topLevel = labels[labels.length - 1];
  if (topLevel === undefined || INTERNAL_TOP_LEVEL_DOMAINS.has(topLevel)) {
    return null;
  }
  // Uma última parte numérica (ou em hexadecimal) seria lida como endereço IP numa URL.
  if (/^(?:[0-9]+|0x[0-9a-f]*)$/.test(topLevel)) {
    return null;
  }

  return ascii;
}

function shortText(value: string): string {
  return JSON.stringify(value.length > 80 ? `${value.slice(0, 80)}…` : value);
}

/** Caminho do arquivo de uma execução. A pasta usa a data UTC de `startedAt` (ISO 8601 terminado em Z). */
export function runPath(id: string, startedAt: string): string {
  if (!UUID_REGEX.test(id)) {
    throw new RangeError(`Identificador de execução inválido (precisa ser um UUID em minúsculas): ${shortText(id)}`);
  }
  // Formato exato AAAA-MM-DDTHH:MM:SS[.fração]Z, e a data precisa existir (30/02 não vira 02/03).
  const date = UTC_DATE_TIME_REGEX.test(startedAt) ? new Date(startedAt) : null;
  if (date === null || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 19) !== startedAt.slice(0, 19)) {
    throw new RangeError(`Data de início inválida (precisa estar em UTC, terminando em Z): ${shortText(startedAt)}`);
  }
  const [year, month, day] = date.toISOString().slice(0, 10).split("-");
  return `runs/${year}/${month}/${day}/${id}.json`;
}

/** Caminho do arquivo de uma fonte. Domínios que viram a mesma forma normalizada usam o mesmo arquivo. */
export function sourcePath(domain: string): string {
  const normalized = normalizeDomain(domain);
  if (normalized === null) {
    throw new RangeError(`Domínio inválido para guardar uma fonte: ${shortText(domain)}`);
  }
  const shard = createHash("sha256").update(normalized).digest("hex").slice(0, 2);
  return `sources/${shard}/${normalized}.json`;
}

/** Caminho do arquivo de uma configuração. */
export function settingPath(key: string): string {
  if (!SETTING_KEY_REGEX.test(key)) {
    throw new RangeError(
      `Chave de configuração inválida (use minúsculas, números, ".", "-" e "_", até 100 caracteres): ${shortText(key)}`,
    );
  }
  return `settings/${key}.json`;
}
