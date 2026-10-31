import type { MediaType } from "../../publication-contracts.ts";
import {
  PlatformStepNotImplementedError,
  type LocalUploadMedia,
  type MusicOptions,
  type MusicResult,
  type PublicationPreparation,
  type PublicationVerification,
  type SocialPublisher,
} from "../social-publisher.interface.ts";

/** TikTok: esqueleto sem navegação, publicação ou acesso ao Supabase. */
export class TikTokPublisher implements SocialPublisher {
  readonly platform = "tiktok" as const;

  async prepare(_input: PublicationPreparation): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "prepare");
  }

  async publish(): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "publish");
  }

  async verifyPublication(): Promise<PublicationVerification> {
    throw new PlatformStepNotImplementedError(this.platform, "verifyPublication");
  }

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

  async closeTab(): Promise<void> {
    throw new PlatformStepNotImplementedError(this.platform, "closeTab");
  }
}
