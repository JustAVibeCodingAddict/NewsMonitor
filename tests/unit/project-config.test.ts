import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Lê um arquivo da raiz do projeto como texto. */
function lerArquivo(nome: string): string {
  return readFileSync(new URL(`../../${nome}`, import.meta.url), "utf8");
}

interface PackageJson {
  type?: string;
  engines?: { node?: string };
  scripts?: Record<string, string>;
}

const pacote = JSON.parse(lerArquivo("package.json")) as PackageJson;

describe("configuração base do projeto", () => {
  it("exige Node 26 em .nvmrc e em engines", () => {
    expect(lerArquivo(".nvmrc").trim()).toBe("26");
    expect(pacote.engines?.node).toBe(">=26 <27");
  });

  it("roda com a versão de Node exigida e registra a versão em uso", () => {
    const principal = Number(process.versions.node.split(".")[0]);
    // Registro da versão efetivamente usada nos testes (especificação, seção 4.3).
    console.info(`[teste] Node.js ${process.version} em uso`);
    expect(principal).toBe(26);
  });

  it("usa módulos ES", () => {
    expect(pacote.type).toBe("module");
  });

  it("tem os scripts de qualidade exigidos", () => {
    for (const nome of ["typecheck", "test", "test:watch", "build", "ci"]) {
      expect(pacote.scripts?.[nome], `script "${nome}" ausente`).toBeTypeOf("string");
    }
  });
});

describe("proteção contra segredos no repositório", () => {
  it(".gitignore bloqueia o .env e libera só o .env.example", () => {
    const linhas = lerArquivo(".gitignore")
      .split(/\r?\n/)
      .map((linha) => linha.trim());
    expect(linhas).toContain(".env");
    expect(linhas).toContain(".env.*");
    expect(linhas).toContain("!.env.example");
  });

  it(".env.example só tem nomes de variáveis e valores de exemplo", () => {
    const linhas = lerArquivo(".env.example")
      .split(/\r?\n/)
      .map((linha) => linha.trim())
      .filter((linha) => linha !== "" && !linha.startsWith("#"));

    expect(linhas.length).toBeGreaterThan(0);
    for (const linha of linhas) {
      expect(linha, `linha fora do formato NOME=valor: ${linha}`).toMatch(/^[A-Z][A-Z0-9_]*=.*$/);
      const nome = linha.slice(0, linha.indexOf("="));
      const valor = linha.slice(linha.indexOf("=") + 1);
      // Valores de exemplo são curtos e simples. Nada que pareça chave ou token.
      expect(valor.length, `valor longo demais em ${nome}`).toBeLessThanOrEqual(40);
      expect(valor, `valor com cara de segredo em ${nome}`).not.toMatch(
        /sb_secret_|ghp_|github_pat_|eyJ[A-Za-z0-9_-]{10,}|-----BEGIN/,
      );
    }
  });
});
