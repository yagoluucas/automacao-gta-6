import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Platform } from "../contracts.ts";
import { ERROR_CATALOG, normalizeError, type ErrorCode, type ErrorStage } from "./catalog.ts";

export type ErrorContext = {
  imageId?: string | null;
  publicationId?: string | null;
  platform?: Platform | null;
  stage: ErrorStage;
};

export type ErrorRecord = {
  eventId: string;
  occurredAt: string;
  imageId: string | null;
  publicationId: string | null;
  platform: Platform | null;
  code: ErrorCode;
  kind: (typeof ERROR_CATALOG)[ErrorCode]["kind"];
  description: string;
  stage: ErrorStage;
  attempt: number;
  maxAttempts: number;
  action: "abort" | "retry" | "continue" | "manual_review";
  nextRetryAt: string | null;
  supabaseSync: "not_required" | "pending" | "not_configured";
};

export type ErrorRecorder = (record: ErrorRecord) => Promise<void>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function safeId(value: string | null | undefined): string | null {
  return value && UUID.test(value) ? value : null;
}

/** Um JSON por evento; jamais escrever tokens, stacks, URLs assinadas ou mensagens arbitrárias. */
export function createJsonErrorRecorder(root = path.resolve(process.cwd(), "logs", "errors")): ErrorRecorder {
  return async (record) => {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const filename = record.occurredAt.replace(/[:.]/g, "-") + "_" + record.eventId + ".json";
    await writeFile(path.join(root, filename), JSON.stringify(record, null, 2) + "\n", {
      encoding: "utf8", flag: "wx", mode: 0o600,
    });
  };
}

export function makeErrorRecord(
  error: unknown, context: ErrorContext, options: {
    attempt?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    now?: Date;
  } = {},
): ErrorRecord {
  const code = normalizeError(error);
  const catalog = ERROR_CATALOG[code];
  const attempt = options.attempt ?? 1;
  const maxAttempts = options.maxAttempts ?? 3;
  if (!Number.isSafeInteger(attempt) || attempt < 1 ||
      !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 ||
      attempt > maxAttempts) throw new Error("Contagem de tentativas inválida");

  const action: ErrorRecord["action"] =
    catalog.kind === "warning" ? "continue" :
    catalog.kind === "uncertain" ? "manual_review" :
    catalog.kind === "transient" && attempt < maxAttempts ? "retry" : "abort";
  const now = options.now ?? new Date();
  const retryDelayMs = options.retryDelayMs ?? 0;
  const nextRetryAt = action === "retry" && retryDelayMs > 0
    ? new Date(now.getTime() + retryDelayMs).toISOString() : null;
  return {
    eventId: randomUUID(), occurredAt: now.toISOString(),
    imageId: safeId(context.imageId), publicationId: safeId(context.publicationId),
    platform: context.platform ?? null, stage: context.stage,
    code, kind: catalog.kind, description: catalog.description,
    attempt, maxAttempts, action, nextRetryAt,
    supabaseSync: action === "abort" || action === "manual_review" ? "pending" : "not_required",
  };
}

/** Captura erros controlados. Nunca engole falha de gravação do log. */
export async function captureError(
  error: unknown, context: ErrorContext,
  recorder: ErrorRecorder = createJsonErrorRecorder(),
  options: Parameters<typeof makeErrorRecord>[2] = {},
): Promise<ErrorRecord> {
  const record = makeErrorRecord(error, context, options);
  await recorder(record);
  return record;
}
