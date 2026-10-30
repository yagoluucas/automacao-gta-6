import assert from "node:assert/strict";
import { test } from "node:test";
import { InstagramPublisher } from "../src/platforms/instagram/instagram.publisher.ts";
import { TikTokPublisher } from "../src/platforms/tiktok/tiktok.publisher.ts";
import { YouTubePublisher } from "../src/platforms/youtube/youtube.publisher.ts";
import { PlatformStepNotImplementedError, type SocialPublisher } from "../src/platforms/social-publisher.interface.ts";

const publishers: SocialPublisher[] = [
  new InstagramPublisher(), new TikTokPublisher(), new YouTubePublisher()
];

test("todas as classes implementam os oito métodos esperados", () => {
  for (const publisher of publishers) {
    for (const method of [
      "openTab", "openComposer", "uploadMedia", "setCaption",
      "setMusic", "publish", "verifyPublication", "closeTab",
    ] as const) {
      assert.equal(typeof publisher[method], "function", publisher.platform + "." + method);
    }
  }
  assert.deepEqual(publishers.map(p => p.platform), ["instagram", "tiktok", "youtube"]);
});

test("nenhum método das classes-esqueleto pode publicar ou afirmar sucesso", async () => {
  for (const publisher of publishers) {
    const steps = [
      () => publisher.openTab(),
      () => publisher.openComposer("feed"),
      () => publisher.uploadMedia([]),
      () => publisher.setCaption("Legenda de teste"),
      () => publisher.setMusic({trackName:"Faixa de teste",volumePercent:50}),
      () => publisher.publish(),
      () => publisher.verifyPublication(),
      () => publisher.closeTab(),
    ];
    for (const call of steps) {
      await assert.rejects(call(), error =>
        error instanceof PlatformStepNotImplementedError && error.platform === publisher.platform);
    }
  }
});
