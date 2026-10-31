import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Page } from "playwright-core";
import { findTikTokDrafts, readTikTokDraft, selectTikTokDraft, type TikTokDraft } from "../src/publication/tiktok-draft.ts";
import { previewTikTok } from "../src/platforms/tiktok/tiktok-preview.ts";

const imageId = "11111111-1111-4111-8111-111111111111";

test("seleciona a mídia TikTok sem depender das outras redes", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "tiktok-preview-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = path.join(root, "2026-10-31", imageId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "ready.json"), JSON.stringify({ ready: true }));
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify({
    image_id: imageId, platforms: ["tiktok"],
    media: { tiktok: "TIKTOK.png" }, captions: { tiktok: "LEGENDA_TIKTOK.txt" },
  }));
  await writeFile(path.join(dir, "TIKTOK.png"), Buffer.from([137, 80, 78, 71]));
  await writeFile(path.join(dir, "LEGENDA_TIKTOK.txt"), "Legenda\r\n#gta6\r\n");
  const expected = {
    imageId, mediaPath: path.join(dir, "TIKTOK.png"), mediaKind: "photo", caption: "Legenda\n#gta6",
  };
  assert.deepEqual(await readTikTokDraft(dir, imageId), expected);
  assert.deepEqual(selectTikTokDraft(await findTikTokDrafts(root)), expected);
  const other = path.join(root, "2026-10-31", "33333333-3333-4333-8333-333333333333");
  await mkdir(other);
  await writeFile(path.join(other, "TIKTOK.mp4"), "incompleto");
  assert.deepEqual(selectTikTokDraft(await findTikTokDrafts(root, imageId), imageId), expected);
});

for (const mediaKind of ["photo", "video"] as const) {
  test(`prepara ${mediaKind} no TikTok e não clica em Publicar`, async () => {
    const actions: string[] = [];
    const control = (name: string) => ({
      first() { return this; },
      last() { return this; },
      async waitFor() { actions.push(`wait:${name}`); },
      async getAttribute() { return mediaKind === "video" ? "true" : "false"; },
      async click() { actions.push(`click:${name}`); },
      async fill(value: string) { actions.push(`fill:${name}:${value}`); },
    });
    const uploadPage = {
      async bringToFront() { actions.push("focus:upload"); },
      async waitForTimeout(ms: number) { assert.ok(ms >= 5000 && ms <= 10000); actions.push("pause"); },
      getByRole(role: string, options: { name: RegExp }) {
        return control(role === "tab" ? "tab" : options.name.test("Selecionar fotos") ? "select-photo" : "publish-photo");
      },
      locator(selector: string) {
        return control(selector.includes("select_video_button") ? "select-video" :
          selector.includes("post_video_button") ? "publish-video" : "caption");
      },
      async waitForEvent() { return { async setFiles(file: string) { actions.push(`file:${file}`); } }; },
    } as unknown as Page;
    const tiktokPage = {
      async bringToFront() { actions.push("focus:tiktok"); },
      async waitForTimeout(ms: number) { assert.ok(ms >= 5000 && ms <= 10000); actions.push("pause"); },
      locator() { return control("upload-nav"); },
      async waitForEvent() { return uploadPage; },
      waitForURL() { return new Promise<void>(() => {}); },
    } as unknown as Page;
    const mediaPath = `C:/publicacoes/TIKTOK.${mediaKind === "video" ? "mp4" : "png"}`;
    const draft: TikTokDraft = { imageId, mediaPath, mediaKind, caption: "Legenda\n#gta6" };
    assert.equal(await previewTikTok(tiktokPage, draft, 30000), uploadPage);
    assert.ok(actions.indexOf("focus:upload") > actions.indexOf("click:upload-nav"));
    assert.ok(actions.indexOf(`file:${mediaPath}`) > actions.indexOf(`click:select-${mediaKind}`));
    assert.ok(actions.indexOf("fill:caption:Legenda\n#gta6") > actions.indexOf(`file:${mediaPath}`));
    assert.ok(actions.includes(`wait:publish-${mediaKind}`));
    assert.ok(!actions.includes(`click:publish-${mediaKind}`));
    assert.equal(actions.filter(action => action === "pause").length,
      actions.filter(action => /^(focus:|click:|fill:|file:)/.test(action)).length);
  });
}
