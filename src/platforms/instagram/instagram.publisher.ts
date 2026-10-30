import type { MediaType } from "../../publication-contracts.ts";
import {
  PlatformStepNotImplementedError,
  type LocalUploadMedia,
  type MusicOptions,
  type MusicResult,
  type PublicationVerification,
  type SocialPublisher,
} from "../social-publisher.interface.ts";

/**
 * Contrato de publicação web: Instagram.
 * Somente esqueleto. Não abre abas, não interage com o navegador e não publica.
 */
export class InstagramPublisher implements SocialPublisher {
  readonly platform = "instagram" as const;

  async openTab(): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "openTab");
  }

  async openComposer(_mediaType: MediaType): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "openComposer");
  }

  async uploadMedia(_files: readonly LocalUploadMedia[]): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "uploadMedia");
  }

  async setCaption(_caption: string): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "setCaption");
  }

  async setMusic(_options: MusicOptions): Promise<MusicResult> {
    throw new PlatformStepNotImplementedError(this.platform, "setMusic");
  }

  async publish(): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "publish");
  }

  async verifyPublication(): Promise<PublicationVerification> {
    throw new PlatformStepNotImplementedError(this.platform, "verifyPublication");
  }

  async closeTab(): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "closeTab");
  }
}
