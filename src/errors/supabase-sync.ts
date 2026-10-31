import type { ErrorRecord } from "./types.ts";
import type { PublicationOutcome } from "../publication-contracts.ts";

export type FailureSyncPayload = {
  imageId: string;
  publicationId: string;
  platform: "instagram" | "tiktok" | "youtube";
  status: "failed" | "review_required";
  /** Mesmo campo já existente em public.image_publications.error_message. */
  errorMessage: string;
  occurredAt: string;
  eventId: string;
  attempts: number;
};

/**
 * Contrato enviado futuramente à API restrita do bot.
 * Não contém SQL, URL, token ou chave privilegiada.
 */
export function toFailureSyncPayload(record: ErrorRecord): FailureSyncPayload | null {
  if ((record.action !== "abort" && record.action !== "manual_review") ||
      !record.imageId || !record.publicationId || !record.platform) return null;
  const status = record.action === "manual_review" ? "review_required" : "failed";
  return {
    imageId: record.imageId,
    publicationId: record.publicationId,
    platform: record.platform,
    status,
    errorMessage: record.code + ": " + record.description,
    occurredAt: record.occurredAt,
    eventId: record.eventId,
    attempts: record.attempt,
  };
}

/** Mantém compatibilidade com PublicationOutcome definido na fase de contratos. */
export function toFailureOutcome(record: ErrorRecord): PublicationOutcome | null {
  const payload = toFailureSyncPayload(record);
  if (!payload) return null;
  return {
    imageId: payload.imageId,
    publicationId: payload.publicationId,
    platform: payload.platform,
    status: payload.status,
    errorMessage: payload.errorMessage,
  };
}
