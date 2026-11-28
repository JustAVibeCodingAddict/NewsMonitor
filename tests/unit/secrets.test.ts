import { describe, expect, it } from "vitest";
import { containsSecret, findSecretLikeValues, isSecretLikeKey } from "../../src/core/secrets.js";

// Credenciais FALSAS, montadas na hora: assim nenhum texto do repositório tem o
// formato de uma credencial real e a proteção de envio do GitHub não é acionada.
// Cada item é [motivo esperado, valor falso].
const fakeSecrets: ReadonlyArray<readonly [string, string]> = [
  ["chave secreta do Supabase", ["sb", "secret", "AbCd1234EfGh5678"].join("_")],
  ["token do GitHub", ["gh", "p_"].join("") + "A".repeat(36)],
  ["token do GitHub", ["github", "pat", ""].join("_") + "B".repeat(40)],
  ["chave de acesso da AWS", "AKIA" + "A".repeat(16)],
  ["chave de API do Google", "AIza" + "A".repeat(35)],
  ["token do Slack", ["xo", "xb-"].join("") + "1234567890-abcdefghij"],
  ["chave de API (formato sk-)", "sk-" + "A".repeat(30)],
  ["token JWT", ["eyJ" + "a".repeat(12), "b".repeat(12), "c".repeat(12)].join(".")],
  ["chave privada", "-----BEGIN " + "RSA PRIVATE KEY-----"],
  ["cabeçalho de autorização Bearer", "Bearer " + "a".repeat(30)],
  ["endereço com usuário e senha", "https://usuario:" + "senha-secreta" + "@exemplo.com/feed"],
];

const [, fakeGithubToken] = fakeSecrets[1] ?? ["", ""];

describe("containsSecret", () => {
  it.each(fakeSecrets)("reconhece: %s", (_reason, secret) => {
    expect(containsSecret(secret)).toBe(true);
    expect(containsSecret(`erro ao acessar o serviço com ${secret} no cabeçalho`)).toBe(true);
  });

  it.each([
    "Governo anuncia novo pacote de medidas",
    "https://g1.globo.com/politica/noticia/2026/11/27/exemplo.ghtml",
    "https://exemplo.com:8080/caminho@outro",
    "mailto:fulano@exemplo.com",
    "task-force-with-a-very-long-descriptive-name-here",
    "risk-assessment-for-the-new-policy-framework",
    "sk-curto",
    "Bearer",
    "A chave secreta fica guardada nos Secrets do GitHub",
    "",
  ])("não confunde texto comum com segredo: %j", (text) => {
    expect(containsSecret(text)).toBe(false);
  });
});

describe("isSecretLikeKey", () => {
  it.each([
    "api_key",
    "apiKey",
    "API-KEY",
    "senha",
    "password",
    "passwd",
    "pwd",
    "token",
    "access_token",
    "SUPABASE_SECRET_KEY",
    "authorization",
    "private_key",
    "credentials",
    "segredo",
    "bearer",
  ])("o nome %s sugere uma credencial", (name) => {
    expect(isSecretLikeKey(name)).toBe(true);
  });

  it.each(["title", "summary", "domain", "published_at", "keyword", "source_count", "url", "name", "status"])(
    "o nome %s é comum",
    (name) => {
      expect(isSecretLikeKey(name)).toBe(false);
    },
  );
});

describe("findSecretLikeValues", () => {
  it("devolve lista vazia para dados comuns", () => {
    const common = { fontes: 3, ok: true, nada: null, titulo: "Notícia", itens: [1, "dois", { x: 3 }] };
    expect(findSecretLikeValues(common)).toEqual([]);
    expect(findSecretLikeValues("texto")).toEqual([]);
    expect(findSecretLikeValues(null)).toEqual([]);
    expect(findSecretLikeValues(undefined)).toEqual([]);
    expect(findSecretLikeValues(42)).toEqual([]);
  });

  it.each(fakeSecrets)("aponta o motivo certo: %s", (reason, secret) => {
    expect(findSecretLikeValues({ texto: secret })).toEqual([{ path: "$.texto", reason }]);
  });

  it("aponta o caminho exato de cada achado", () => {
    const [, other] = fakeSecrets[3] ?? ["", ""];
    const found = findSecretLikeValues({ summary: { items: [{ url: fakeGithubToken }] }, outro: other });
    expect(found.map((finding) => finding.path)).toEqual(["$.summary.items[0].url", "$.outro"]);
  });

  it("nunca devolve o valor encontrado, só o caminho e o motivo", () => {
    for (const [, secret] of fakeSecrets) {
      const found = findSecretLikeValues({ a: { b: [secret] } });
      expect(found).toHaveLength(1);
      expect(found[0]?.path).toBe("$.a.b[0]");
      expect(JSON.stringify(found)).not.toContain(secret);
    }
  });

  it("desconfia de texto não vazio em campo com nome de credencial", () => {
    expect(findSecretLikeValues({ api_key: "qualquer-coisa" })).toEqual([
      { path: "$.api_key", reason: "o nome do campo sugere uma credencial" },
    ]);
    expect(findSecretLikeValues({ senha: "123" })).toHaveLength(1);
  });

  it("aceita campo com nome de credencial vazio, nulo ou numérico", () => {
    expect(findSecretLikeValues({ api_key: "", token: null, max_tokens: 4000, password: false })).toEqual([]);
  });

  it("desconfia de tudo que está dentro de um campo com nome de credencial", () => {
    const found = findSecretLikeValues({ credentials: { usuario: "x", lista: ["a", "b"] } });
    expect(found.map((finding) => finding.path)).toEqual([
      "$.credentials.usuario",
      "$.credentials.lista[0]",
      "$.credentials.lista[1]",
    ]);
  });

  it("esconde o nome do campo quando ele próprio parece uma credencial", () => {
    const found = findSecretLikeValues({ [fakeGithubToken]: true });
    expect(found).toEqual([{ path: "$.«chave oculta»", reason: "o nome do campo parece uma credencial" }]);
    expect(JSON.stringify(found)).not.toContain(fakeGithubToken);
  });

  it("trata estruturas fundas demais como suspeitas (falha fechada)", () => {
    let deep: unknown = "texto";
    for (let level = 0; level < 40; level += 1) {
      deep = { a: deep };
    }
    const found = findSecretLikeValues(deep);
    expect(found).toHaveLength(1);
    expect(found[0]?.reason).toBe("estrutura funda demais para ser verificada");
  });

  it("verifica rápido mesmo com textos enormes e mal-intencionados", () => {
    const hostile = ["a.", "http://", "Bearer ", "sk-", "eyJ"].map((piece) => piece.repeat(30_000)).join("\n");
    const start = performance.now();
    findSecretLikeValues({ texto: hostile });
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
