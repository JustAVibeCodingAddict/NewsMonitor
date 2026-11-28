/**
 * Estados de uma execução e as transições permitidas entre eles.
 *
 *   pending ──► running ──► succeeded
 *      │           ├──────► partial
 *      └───────────┴──────► failed
 *
 * Um estado final (succeeded, partial ou failed) nunca volta a um estado
 * anterior e a execução encerrada não pode mais ser alterada.
 */

export const RUN_STATUSES = ["pending", "running", "succeeded", "partial", "failed"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const FINAL_RUN_STATUSES = ["succeeded", "partial", "failed"] as const;
export type FinalRunStatus = (typeof FINAL_RUN_STATUSES)[number];

export function isFinalStatus(status: RunStatus): status is FinalRunStatus {
  return (FINAL_RUN_STATUSES as readonly RunStatus[]).includes(status);
}

const ALLOWED_TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  pending: ["running", "failed"],
  running: ["succeeded", "partial", "failed"],
  succeeded: [],
  partial: [],
  failed: [],
};

/**
 * Diz se uma execução pode ir de um estado para outro.
 * Ficar no mesmo estado só vale para execuções ainda não encerradas
 * (por exemplo, para atualizar o resumo durante a execução).
 */
export function canTransition(from: RunStatus, to: RunStatus): boolean {
  if (from === to) {
    return !isFinalStatus(from);
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}
