import type { Platform } from "../contracts.ts";
import type { MediaType, PublicationAsset } from "../publication-contracts.ts";

/**
 * Arquivos finais prontos para o upload no navegador.
 * São caminhos locais absolutos, resolvidos futuramente a partir do ZIP validado.
 * NUNCA apontam diretamente para o Storage original do Supabase.
 */
export interface LocalUploadMedia {
  readonly absolutePath: string;
  readonly entryName: PublicationAsset["entryName"];
  readonly mimeType: PublicationAsset["mimeType"];
}

/** Configuração opcional, a aplicar somente quando a plataforma permitir. */
export interface MusicOptions {
  readonly trackName: string;
  readonly artistName?: string;
  /** 0–100, quando houver controle de volume na interface. */
  readonly volumePercent?: number;
  readonly startSeconds?: number;
}

export type MusicResult =
  | { readonly status: "applied" }
  | { readonly status: "unsupported"; readonly reason: string };

/**
 * Só é confirmação se houver prova verificável da postagem externa.
 * Resultados ambíguos devem ir para review_required, SEM retry automático.
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
 * Contrato de operações de interface web. Uma implementação por plataforma.
 *
 * Fluxo esperado:
 *   openTab -> openComposer -> uploadMedia -> setCaption -> [setMusic]
 *   -> publish -> verifyPublication -> closeTab
 *
 * 'publish' é o limite de efeito externo: NUNCA deve ser chamado na simulação
 * ou reexecutado após um resultado incerto sem reconciliação da postagem.
 */
export interface SocialPublisher {
  readonly platform: Platform;

  /** Abrir nova aba da rede social na sessão de navegador já autorizada. */
  openTab(): Promise<void>;

  /** Navegar e selecionar o compositor correspondente ao formato preparado. */
  openComposer(mediaType: MediaType): Promise<void>;

  /** Selecionar mídia(s) locais prontas; não extrair ZIP nem consultar Supabase aqui. */
  uploadMedia(files: readonly LocalUploadMedia[]): Promise<void>;

  /** Inserir a legenda específica da rede social. */
  setCaption(caption: string): Promise<void>;

  /**
   * Método presente em todas as classes, mas chamada opcional.
   * Deve retornar "unsupported" quando a função de música/volume não existir.
   */
  setMusic(options: MusicOptions): Promise<MusicResult>;

  /** Confirmar envio na interface web. EFEITO EXTERNO, não idempotente. */
  publish(): Promise<void>;

  /** Verificar postagem com evidência, nunca inferir sucesso apenas pelo clique. */
  verifyPublication(): Promise<PublicationVerification>;

  /** Fechar a aba aberta pelo serviço, preservando outras abas/sessões. */
  closeTab(): Promise<void>;
}

export type SocialPublisherStep =
  | "openTab" | "openComposer" | "uploadMedia" | "setCaption"
  | "setMusic" | "publish" | "verifyPublication" | "closeTab";

/**
 * Falha explícita e previsível. Nenhum stub simula publicação ou devolve sucesso.
 * As classes serão implementadas posteriormente com Playwright.
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
