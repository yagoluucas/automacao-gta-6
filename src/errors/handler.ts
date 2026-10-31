import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidUuid } from "../ids.ts";
import { ERROR_CATALOG, normalizeError } from "./catalog.ts";
import type { ErrorContext, ErrorRecorder, ErrorRecord } from "./types.ts";

function safeId(value: string | null | undefined): string | null {
  return isValidUuid(value) ? value : null;
}

type CaptureOptions = {
  recorder?: ErrorRecorder;
  logDirectory?: string;
  attempt?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  now?: Date;
};

/** Um JSON por evento; jamais escrever tokens, stacks, URLs assinadas ou mensagens arbitrárias. */
function createJsonErrorRecorder(root = path.resolve(process.cwd(), "logs", "errors")): ErrorRecorder {
  return async (record) => {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const filename = record.occurredAt.replace(/[:.]/g, "-") + "_" + record.eventId + ".json";
    await writeFile(path.join(root, filename), JSON.stringify(record, null, 2) + "\n", {
      encoding: "utf8", flag: "wx", mode: 0o600,
    });
  };
}

function makeErrorRecord(
  error: unknown, context: ErrorContext, options: CaptureOptions = {},
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
  options: CaptureOptions = {},
): Promise<ErrorRecord> {
  const record = makeErrorRecord(error, context, options);
  await (options.recorder ?? createJsonErrorRecorder(options.logDirectory))(record);
  return record;
}
