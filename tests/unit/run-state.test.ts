import { describe, expect, it } from "vitest";
import {
  FINAL_RUN_STATUSES,
  RUN_STATUSES,
  canTransition,
  isFinalStatus,
  type RunStatus,
} from "../../src/core/run-state.js";

describe("estados de uma execução", () => {
  it("tem os cinco estados da especificação", () => {
    expect([...RUN_STATUSES]).toEqual(["pending", "running", "succeeded", "partial", "failed"]);
  });

  it("reconhece os estados finais", () => {
    expect([...FINAL_RUN_STATUSES]).toEqual(["succeeded", "partial", "failed"]);
    for (const status of FINAL_RUN_STATUSES) {
      expect(isFinalStatus(status)).toBe(true);
    }
    expect(isFinalStatus("pending")).toBe(false);
    expect(isFinalStatus("running")).toBe(false);
  });
});

describe("transições entre estados", () => {
  const allowed: ReadonlyArray<readonly [RunStatus, RunStatus]> = [
    ["pending", "running"],
    ["pending", "failed"],
    ["running", "succeeded"],
    ["running", "partial"],
    ["running", "failed"],
    // Continuar no mesmo estado vale enquanto a execução não terminou (atualizar o resumo).
    ["pending", "pending"],
    ["running", "running"],
  ];

  it.each(allowed)("permite %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it("recusa todas as outras combinações", () => {
    const allowedKeys = new Set(allowed.map(([from, to]) => `${from}>${to}`));
    const refused: string[] = [];
    for (const from of RUN_STATUSES) {
      for (const to of RUN_STATUSES) {
        if (!allowedKeys.has(`${from}>${to}`) && canTransition(from, to)) {
          refused.push(`${from} → ${to}`);
        }
      }
    }
    expect(refused).toEqual([]);
  });

  it("uma execução encerrada nunca volta para running (regra da especificação)", () => {
    for (const final of FINAL_RUN_STATUSES) {
      expect(canTransition(final, "running")).toBe(false);
      expect(canTransition(final, "pending")).toBe(false);
    }
  });

  it("um estado final não muda, nem para ele mesmo", () => {
    for (const final of FINAL_RUN_STATUSES) {
      for (const to of RUN_STATUSES) {
        expect(canTransition(final, to)).toBe(false);
      }
    }
  });

  it("não deixa pular direto de pending para um final de sucesso", () => {
    expect(canTransition("pending", "succeeded")).toBe(false);
    expect(canTransition("pending", "partial")).toBe(false);
  });

  it("não deixa voltar de running para pending", () => {
    expect(canTransition("running", "pending")).toBe(false);
  });
});
