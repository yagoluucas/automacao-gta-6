import path from "node:path";
import { PLATFORMS, type Platform } from "./contracts.ts";
import { isValidUuid } from "./ids.ts";
import type { InspectionResult } from "./inspector.ts";

/**
 * Formatos já definidos em public.images.media_type.
 * O leitor Feed V5 atual entrega apenas "feed".
 */
export type MediaType = "feed" | "video" | "carousel";

/** Referência a um arquivo DENTRO do pacote local, nunca ao Storage original. */
export type PublicationAsset = {
  entryName: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "video/mp4";
  bytes: number;
  sha256: string;
};

type LocalPublication = {
  /** ID existente em public.images.id, transportado pelo gerador de pacotes. */
  imageId: string;
  /** ID existente em public.image_publications.id; não gerar outro ID. */
  publicationId: string;
  platform: Platform;
  scheduledAt: string;
  /** ZIP local já inspecionado; não aponta para o Storage do Supabase. */
  archivePath: string;
  caption: string;
};

/**
 * Contrato de execução do bot. É uma representação LOCAL, não uma tabela do Supabase.
 * A união discriminada impede vídeos sem vídeo e carrosséis com apenas um slide.
 */
export type PreparedPublication =
  | (LocalPublication & { mediaType: "feed"; assets: readonly [PublicationAsset] })
  | (LocalPublication & { mediaType: "video"; assets: readonly [PublicationAsset] })
  | (LocalPublication & { mediaType: "carousel"; assets: readonly [PublicationAsset, PublicationAsset, ...PublicationAsset[]] });

const SHA256 = /^[a-f0-9]{64}$/i;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_ERROR_LENGTH = 1000;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && ISO_WITH_OFFSET.test(value) && Number.isFinite(Date.parse(value));
}

/**
 * Adaptador do leitor existente para o novo contrato local.
 * Sem acesso à rede, sem alterar o ZIP, sem publicar e sem atualizar o Supabase.
 * Compatibilidade: apenas manifest.schema_version=1 / Feed V5.
 */
export function preparedFromInspection(inspection: InspectionResult): PreparedPublication[] {
  if (inspection.status !== "OK" || !inspection.manifest || !inspection.outputs) {
    throw new Error("Apenas pacotes inspecionados com status OK podem ser preparados");
  }
  const { manifest, outputs } = inspection;
  if (!isValidUuid(manifest.image_id)) throw new Error("image_id não é um UUID do Supabase");
  if (outputs.length !== manifest.publications.length) throw new Error("Número de saídas não corresponde ao manifesto");

  const seen = new Set<string>();
  return manifest.publications.map((publication): PreparedPublication => {
    if (!isValidUuid(publication.id)) throw new Error("publications[].id não é um UUID do Supabase");
    if (seen.has(publication.id)) throw new Error("ID de publicação duplicado no manifesto");
    seen.add(publication.id);

    const output = outputs.find((item) => item.platform === publication.platform);
    if (!output || output.publicationId !== publication.id ||
        output.scheduledAt !== publication.scheduled_at ||
        output.media.filename !== publication.platform.toUpperCase() + ".png" ||
        !SHA256.test(output.media.sha256) ||
        !Number.isSafeInteger(output.media.bytes) || output.media.bytes <= 0 ||
        !output.caption.trim()) {
      throw new Error("A saída local não corresponde à publicação do manifesto: " + publication.platform);
    }
    return {
      imageId: manifest.image_id,
      publicationId: publication.id,
      platform: publication.platform,
      mediaType: "feed",
      scheduledAt: publication.scheduled_at,
      archivePath: path.join(inspection.jobDir, manifest.zip_file),
      caption: output.caption,
      assets: [{
        entryName: output.media.filename,
        mimeType: "image/png",
        bytes: output.media.bytes,
        sha256: output.media.sha256,
      }],
    };
  });
}

/**
 * Resultado CONFIRMADO ou inconclusivo de uma tentativa.
 * Um timeout após clicar em Publicar deve ser review_required, nunca "published"
 * ou "failed" automaticamente: pode ter ocorrido uma postagem no servidor remoto.
 */
type OutcomeIdentity = { imageId: string; publicationId: string; platform: Platform };
export type PublicationOutcome =
  | (OutcomeIdentity & {
      status: "published";
      publishedAt: string;
      externalPostId?: string;
      externalPostUrl?: string;
    })
  | (OutcomeIdentity & {
      status: "failed" | "review_required";
      errorMessage: string;
    });

/** Dados permitidos numa futura operação controlada do backend; não é uma chamada HTTP. */
export type PublicationStatusPatch =
  | { status: "published"; published_at: string; external_post_id: string | null; external_post_url: string | null; error_message: null }
  | { status: "failed" | "review_required"; error_message: string };

function validPostUrl(value: unknown, platform: Platform): value is string {
  if (typeof value !== "string" || value.length > 2048 || value.trim() !== value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return false;
    const domains: Record<Platform, readonly string[]> = {
      instagram: ["instagram.com"],
      tiktok: ["tiktok.com"],
      youtube: ["youtube.com", "youtu.be"],
    };
    return domains[platform].some((domain) => url.hostname === domain || url.hostname.endsWith("." + domain));
  } catch {
    return false;
  }
}

/** Validação de runtime: TypeScript não valida JSON recebido de outros processos. */
export function parsePublicationOutcome(input: unknown): PublicationOutcome {
  if (!isObject(input) || !isValidUuid(input.imageId) || !isValidUuid(input.publicationId) ||
      !PLATFORMS.includes(input.platform as Platform)) {
    throw new Error("Identificadores ou plataforma inválidos no resultado de publicação");
  }
  const identity: OutcomeIdentity = {
    imageId: input.imageId,
    publicationId: input.publicationId,
    platform: input.platform as Platform,
  };
  if (input.status === "published") {
    const externalPostId = input.externalPostId;
    const externalPostUrl = input.externalPostUrl;
    if (!validTime(input.publishedAt) ||
        (externalPostId !== undefined && (typeof externalPostId !== "string" || !externalPostId.trim() || externalPostId.length > 512)) ||
        (externalPostUrl !== undefined && !validPostUrl(externalPostUrl, identity.platform)) ||
        (externalPostId === undefined && externalPostUrl === undefined)) {
      throw new Error("Confirmação da publicação exige data real e ID ou URL externa válida");
    }
    return {
      ...identity,
      status: "published",
      publishedAt: input.publishedAt,
      ...(externalPostId !== undefined ? { externalPostId: externalPostId as string } : {}),
      ...(externalPostUrl !== undefined ? { externalPostUrl: externalPostUrl as string } : {}),
    };
  }
  if (input.status === "failed" || input.status === "review_required") {
    if (typeof input.errorMessage !== "string" || !input.errorMessage.trim() || input.errorMessage.length > MAX_ERROR_LENGTH) {
      throw new Error("Falhas e revisões precisam de mensagem resumida");
    }
    return { ...identity, status: input.status, errorMessage: input.errorMessage };
  }
  throw new Error("Status inválido: somente published, failed ou review_required representam resultados");
}

/** Bloqueia a associação de um resultado à publicação local errada. */
export function assertOutcomeMatchesPublication(job: PreparedPublication, outcome: PublicationOutcome): void {
  if (job.imageId !== outcome.imageId || job.publicationId !== outcome.publicationId || job.platform !== outcome.platform) {
    throw new Error("Resultado pertence a outra publicação; atualização bloqueada");
  }
}

/** Apenas mapeia campos; o envio e a autorização serão implementados em fase posterior. */
export function toStatusPatch(outcome: PublicationOutcome): PublicationStatusPatch {
  if (outcome.status === "published") {
    return {
      status: "published",
      published_at: outcome.publishedAt,
      external_post_id: outcome.externalPostId ?? null,
      external_post_url: outcome.externalPostUrl ?? null,
      error_message: null,
    };
  }
  return { status: outcome.status, error_message: outcome.errorMessage };
}
