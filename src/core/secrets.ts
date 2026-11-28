/**
 * Detecção de segredos.
 *
 * Os dados do News Monitor ficam num repositório público, então nenhuma
 * credencial pode chegar a eles. Este módulo reconhece valores e nomes de campo
 * que parecem credenciais. Ele barra a gravação dos dados e, mais adiante,
 * ajuda a limpar os logs.
 *
 * Regra importante: nenhuma função daqui devolve o valor encontrado, só o
 * caminho e o tipo. Assim o segredo não vaza nem na mensagem de erro.
 */

export interface SecretFinding {
  /** Onde o valor está dentro do dado, por exemplo "$.summary.url". Nunca contém o valor. */
  readonly path: string;
  /** O que o valor parece ser. */
  readonly reason: string;
}

interface SecretPattern {
  readonly name: string;
  readonly regex: RegExp;
}

/** Formatos conhecidos de credenciais. Nenhuma expressão usa a flag "g", para não guardar estado. */
const VALUE_PATTERNS: readonly SecretPattern[] = [
  { name: "chave secreta do Supabase", regex: /\bsb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: "token do GitHub", regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/ },
  { name: "chave de acesso da AWS", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "chave de API do Google", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: "token do Slack", regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { name: "chave de API (formato sk-)", regex: /\bsk-[A-Za-z0-9_-]{20,}/ },
  { name: "token JWT", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "chave privada", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "cabeçalho de autorização Bearer", regex: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/i },
  // Os limites ({0,30}, {1,200}) mantêm a verificação rápida mesmo em textos enormes e mal-intencionados.
  { name: "endereço com usuário e senha", regex: /\b[a-z][a-z0-9+.-]{0,30}:\/\/[^\s/@:]{1,200}:[^\s/@]{1,200}@/i },
];

/** Nomes de campo que sugerem credencial (em inglês e em português). */
const KEY_NAME_PATTERN =
  /(secret|segredo|token|passw(?:or)?d|senha|pwd|api[-_]?key|credential|private[-_]?key|authorization|bearer)/i;

/** Profundidade máxima verificada. Estruturas mais fundas são tratadas como suspeitas (falha fechada). */
const MAX_DEPTH = 32;

/** Diz se o NOME de um campo sugere uma credencial, por exemplo "api_key" ou "senha". */
export function isSecretLikeKey(name: string): boolean {
  return KEY_NAME_PATTERN.test(name);
}

/** Diz se um texto contém algo com formato de credencial. */
export function containsSecret(text: string): boolean {
  return VALUE_PATTERNS.some((pattern) => pattern.regex.test(text));
}

const HIDDEN_KEY = "«chave oculta»";

/** Nome de campo como aparece no caminho. Se o próprio nome parecer uma credencial, ele é escondido. */
function keyLabel(key: string): string {
  if (VALUE_PATTERNS.some((pattern) => pattern.regex.test(key))) {
    return HIDDEN_KEY;
  }
  return key.length > 60 ? `${key.slice(0, 60)}…` : key;
}

/**
 * `underSecretKey` fica verdadeiro quando algum campo acima tem nome de
 * credencial: aí qualquer texto não vazio lá dentro é suspeito.
 */
function scan(value: unknown, path: string, depth: number, underSecretKey: boolean): SecretFinding[] {
  if (depth > MAX_DEPTH) {
    return [{ path, reason: "estrutura funda demais para ser verificada" }];
  }

  if (typeof value === "string") {
    const found = VALUE_PATTERNS.find((pattern) => pattern.regex.test(value));
    if (found) {
      return [{ path, reason: found.name }];
    }
    if (underSecretKey && value !== "") {
      return [{ path, reason: "o nome do campo sugere uma credencial" }];
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => scan(item, `${path}[${index}]`, depth + 1, underSecretKey));
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      const label = keyLabel(key);
      const itemPath = `${path}.${label}`;
      const findings = scan(item, itemPath, depth + 1, underSecretKey || isSecretLikeKey(key));
      if (label === HIDDEN_KEY) {
        findings.unshift({ path: itemPath, reason: "o nome do campo parece uma credencial" });
      }
      return findings;
    });
  }

  // Números, verdadeiro/falso e nulo não são verificados: não carregam credenciais em texto.
  return [];
}

/**
 * Procura, dentro de qualquer valor JSON, textos com formato de credencial e
 * campos com nome de credencial. Devolve só os caminhos e os motivos.
 */
export function findSecretLikeValues(value: unknown): SecretFinding[] {
  return scan(value, "$", 0, false);
}
