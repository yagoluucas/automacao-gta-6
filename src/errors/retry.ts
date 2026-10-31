import { AppError } from "./catalog.ts";
import { captureError } from "./handler.ts";
import type { ErrorContext, ErrorRecorder, ErrorRecord } from "./types.ts";

/** Agendamento de 3 tentativas: imediato, +5 min, +10 min. */
export const RETRY_DELAYS_MS = [5 * 60_000, 10 * 60_000] as const;

export type RetryResult<T> =
  | { status: "success"; value: T; attempts: number }
  | { status: "failed" | "review_required"; error: ErrorRecord; attempts: number };

/** Uma eventual sincronização é injetada. Nenhuma chamada ao Supabase nesta fase. */
export type FinalErrorSink = (record: ErrorRecord) => Promise<void>;

export type RetryOptions = {
  recorder?: ErrorRecorder;
  onFinal?: FinalErrorSink;
  wait?: (milliseconds: number) => Promise<void>;
  maxAttempts?: number;
};

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Reexecuta apenas uma operação comprovadamente segura para retry.
 * O chamador deve separar preparação/upload de etapas após o clique de publicação.
 */
export async function withPublicationRetry<T>(
  action: () => Promise<T>,
  context: ErrorContext,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const wait = options.wait ?? defaultWait;
  const maxAttempts = options.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new AppError("MANIFEST_INVALID");
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return { status: "success", value: await action(), attempts: attempt };
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 0;
      const record = await captureError(error, context, {
        recorder: options.recorder, attempt, maxAttempts, retryDelayMs: delay,
      });
      if (record.action === "retry") {
        await wait(delay);
        continue;
      }
      if (record.action === "continue") {
        // Avisos não devem ser transformados silenciosamente em sucesso com T inventado.
        return { status: "failed", error: record, attempts: attempt };
      }
      if (record.action === "abort" || record.action === "manual_review") {
        if (options.onFinal) await options.onFinal(record);
        return {
          status: record.action === "manual_review" ? "review_required" : "failed",
          error: record, attempts: attempt,
        };
      }
    }
  }
  throw new Error("Fluxo de tentativas terminou sem resultado");
}
