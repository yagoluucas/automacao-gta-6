import type { Platform } from "../contracts.ts";
import type { MediaType, PreparedPublication, PublicationAsset } from "../publication-contracts.ts";

/**
 * Mídias finais extraídas/validadas por outra camada do bot, prontas para o navegador.
 * Não são URLs do Storage original nem caminhos fornecidos diretamente pelo usuário.
 */
export interface LocalUploadMedia {
  readonly absolutePath: string;
  readonly entryName: PublicationAsset["entryName"];
  readonly mimeType: PublicationAsset["mimeType"];
}

export interface PublicationPreparation {
  readonly publication: PreparedPublication;
  readonly mediaFiles: readonly LocalUploadMedia[];
}

/**
 * Capacidade opcional. Declarar MusicOptions não implica suporte a música
 * no Instagram Web ou em qualquer outro compositor.
 */
export interface MusicOptions {
  readonly trackName: string;
  readonly artistName?: string;
  /** Percentual solicitado (0 a 100), se houver controle de volume. */
  readonly volumePercent?: number;
  readonly startSeconds?: number;
}

export type MusicResult = { readonly status: "applied" };

/**
 * Verificação de fato consumado: clicar em publicar não confirma sucesso.
 * Se o resultado for incerto, a camada de orquestração deve exigir revisão,
 * sem executar a publicação novamente automaticamente.
 */
export type PublicationVerification =
  | ({
      readonly status: "confirmed";
      readonly publishedAt: string;
    } & (
      | { readonly externalPostId: string; readonly externalPostUrl?: string }
      | { readonly externalPostId?: string; readonly externalPostUrl: string }
    ))
  | { readonly status: "unconfirmed"; readonly reason: string };

/**
 * Contrato mínimo, compartilhado por todas as plataformas web.
 *
 * O orquestrador chama prepare -> publish -> verifyPublication.
 * Os métodos opcionais são etapas/capacidades que uma plataforma PODE expor,
 * não uma lista de passos obrigatórios nem uma promessa de suporte funcional.
 *
 * publish tem efeito externo e nunca deve ser chamado num dry run.
 */
export interface SocialPublisher {
  readonly platform: Platform;

  /** Preparação completa a partir de um trabalho local já validado. */
  prepare(input: PublicationPreparation): Promise<void>;

  /** Ponto de efeito externo. Não repetir após resultado ambíguo. */
  publish(): Promise<void>;

  /** Verificar evidências externas da publicação realizada. */
  verifyPublication(): Promise<PublicationVerification>;

  /** Operações opcionais, usadas internamente conforme o fluxo da rede. */
  openTab?(): Promise<void>;
  openComposer?(mediaType: MediaType): Promise<void>;
  uploadMedia?(files: readonly LocalUploadMedia[]): Promise<void>;
  setCaption?(caption: string): Promise<void>;
  setMusic?(options: MusicOptions): Promise<MusicResult>;
  closeTab?(): Promise<void>;
}

export type SocialPublisherStep =
  | "prepare" | "openTab" | "openComposer" | "uploadMedia" | "setCaption"
  | "setMusic" | "publish" | "verifyPublication" | "closeTab";

/**
 * Os esqueletos falham explicitamente. Nenhum método simula êxito nem
 * interage com navegador, arquivos locais ou Supabase nesta fase.
 */
export class PlatformStepNotImplementedError extends Error {
  readonly code = "PLATFORM_STEP_NOT_IMPLEMENTED" as const;

  constructor(
    readonly platform: Platform,
    readonly step: SocialPublisherStep,
  ) {
    super(`Etapa ainda não implementada: ${platform}.${step}`);
    this.name = "PlatformStepNotImplementedError";
  }
}
