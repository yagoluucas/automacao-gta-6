import assert from "node:assert/strict";
import { test } from "node:test";
import { InstagramPublisher } from "../src/platforms/instagram/instagram.publisher.ts";
import { TikTokPublisher } from "../src/platforms/tiktok/tiktok.publisher.ts";
import { YouTubePublisher } from "../src/platforms/youtube/youtube.publisher.ts";
import { PlatformStepNotImplementedError, type SocialPublisher } from "../src/platforms/social-publisher.interface.ts";

const publishers: SocialPublisher[] = [
  new InstagramPublisher(), new TikTokPublisher(), new YouTubePublisher()
];

test("todas as classes implementam apenas o núcleo obrigatório", () => {
  for (const publisher of publishers) {
    for (const method of ["prepare", "publish", "verifyPublication"] as const) {
      assert.equal(typeof publisher[method], "function", publisher.platform + "." + method);
    }
  }
  assert.deepEqual(publishers.map(p => p.platform), ["instagram", "tiktok", "youtube"]);
});

test("música não existe no Instagram e outras capacidades são opcionais", () => {
  assert.equal("setMusic" in new InstagramPublisher(), false);
  assert.equal(typeof new TikTokPublisher().setMusic, "function");
  assert.equal(typeof new YouTubePublisher().setMusic, "function");
});

test("nenhuma classe-esqueleto pode publicar ou afirmar sucesso", async () => {
  for (const publisher of publishers) {
    const calls: Array<() => Promise<unknown>> = [
      () => publisher.prepare({} as Parameters<SocialPublisher["prepare"]>[0]),
      () => publisher.publish(),
      () => publisher.verifyPublication(),
    ];
    if (publisher.openTab) calls.push(() => publisher.openTab!());
    if (publisher.openComposer) calls.push(() => publisher.openComposer!("feed"));
    if (publisher.uploadMedia) calls.push(() => publisher.uploadMedia!([]));
    if (publisher.setCaption) calls.push(() => publisher.setCaption!("Teste"));
    if (publisher.setMusic) calls.push(() => publisher.setMusic!({trackName:"Teste"}));
    if (publisher.closeTab) calls.push(() => publisher.closeTab!());
    for (const call of calls) {
      await assert.rejects(call(), error =>
        error instanceof PlatformStepNotImplementedError && error.platform === publisher.platform);
    }
  }
});
