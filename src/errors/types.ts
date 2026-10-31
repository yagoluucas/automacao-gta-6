import type { Platform } from "../contracts.ts";
import type { ErrorCode, ErrorKind, ErrorStage } from "./catalog.ts";

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
  kind: ErrorKind;
  description: string;
  stage: ErrorStage;
  attempt: number;
  maxAttempts: number;
  action: "abort" | "retry" | "continue" | "manual_review";
  nextRetryAt: string | null;
  supabaseSync: "not_required" | "pending" | "not_configured";
};

export type ErrorRecorder = (record: ErrorRecord) => Promise<void>;

