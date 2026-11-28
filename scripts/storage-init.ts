/**
 * Cria os arquivos iniciais da branch `data` dentro de uma pasta.
 *
 * Uso: npm run storage:init -- <pasta>
 *
 * A pasta precisa estar vazia (a pasta oculta .git é ignorada), para nunca
 * sobrescrever dados. O passo a passo completo está em docs/operations.md, seção 7.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { initialFiles } from "../src/storage/initial-data.js";

function main(args: readonly string[]): number {
  const [target] = args;
  if (target === undefined || args.length !== 1) {
    console.error("Uso: npm run storage:init -- <pasta>");
    return 2;
  }

  const directory = resolve(target);
  if (existsSync(directory) && readdirSync(directory).some((name) => name !== ".git")) {
    console.error(`A pasta ${directory} não está vazia. Use uma pasta vazia para não sobrescrever dados.`);
    return 1;
  }

  for (const file of initialFiles(new Date())) {
    const destination = join(directory, file.path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, file.content, { flag: "wx" });
    console.log(`criado: ${file.path}`);
  }
  return 0;
}

process.exitCode = main(process.argv.slice(2));
