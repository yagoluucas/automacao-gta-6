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
      nth(index: number) { return control(`row:${index}`); },
      locator(selector: string) { return control(name === "favorites-panel" ? "rows" :
        name.startsWith("row:") && selector.includes("MusicPanelMusicItem__info") ? `sound-info:${name.slice(4)}` :
        name.startsWith("row:") && selector.includes("MusicPickerView__addButton") ? `use-sound:${name.slice(4)}` : selector); },
      filter() { return this; },
      async count() { return name === "rows" ? 3 : 0; },
      async waitFor() { actions.push(`wait:${name}`); },
      async getAttribute() { return name === "tab" && mediaKind === "video" ? "true" : "false"; },
      async click() { actions.push(`click:${name}`); },
      async fill(value: string) { actions.push(`fill:${name}:${value}`); },
      async press(key: string) { actions.push(`press:${name}:${key}`); },
      async scrollIntoViewIfNeeded() { actions.push(`scroll:${name}`); },
    });
    const uploadPage = {
      async bringToFront() { actions.push("focus:upload"); },
      async waitForTimeout(ms: number) { assert.ok(ms >= 5000 && ms <= 10000); actions.push("pause"); },
      getByRole(role: string, options: { name: RegExp }) {
        return control(role === "tab" ? options.name.test("Favoritos") ? "favorites" : "tab" :
          options.name.test("Selecionar fotos") ? "select-photo" :
          options.name.test("Adicionar som") ? "add-sound" :
          options.name.test("Salvar") ? "save" : "publish-photo");
      },
      locator(selector: string) {
        assert.ok(!selector.includes("MusicPickerView__addButton"), "Use precisa estar limitado à faixa escolhida");
        return control(selector.includes("select_video_button") ? "select-video" :
          selector.includes("post_video_button") ? "publish-video" :
          selector.includes("panel-favorites") ? "favorites-panel" :
          selector.includes('data-button-name="sounds"') ? "sounds" :
          selector.includes("PropSettingSliderInput") ? "volume" : "caption");
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
    const soundAction = actions.find(action => /^click:sound-info:\d$/.test(action));
    assert.ok(soundAction);
    const useAction = soundAction.replace("sound-info", "use-sound");
    assert.ok(actions.indexOf(useAction) > actions.indexOf(soundAction));
    assert.ok(actions.includes(useAction.replace("click:", "wait:")));
    if (mediaKind === "photo") {
      assert.ok(actions.indexOf("click:add-sound") > actions.indexOf("fill:caption:Legenda\n#gta6"));
      assert.ok(!actions.includes("click:save"));
    } else {
      assert.ok(actions.indexOf("click:sounds") > actions.indexOf("fill:caption:Legenda\n#gta6"));
      assert.ok(actions.includes("fill:volume:-27"));
      assert.ok(actions.indexOf("fill:volume:-27") > actions.indexOf(useAction));
      assert.ok(actions.includes("press:volume:Tab"));
      assert.ok(actions.indexOf("click:save") > actions.indexOf("fill:volume:-27"));
    }
    assert.ok(actions.includes(`wait:publish-${mediaKind}`));
    assert.ok(actions.indexOf(`scroll:publish-${mediaKind}`) > actions.indexOf(`wait:publish-${mediaKind}`));
    assert.ok(!actions.includes(`click:publish-${mediaKind}`));
    assert.equal(actions.filter(action => action === "pause").length,
      actions.filter(action => /^(focus:|click:|fill:|file:|press:|scroll:)/.test(action)).length);
  });
}
