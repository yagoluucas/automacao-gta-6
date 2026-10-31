import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Page } from "playwright-core";
import { findInstagramDrafts, readInstagramDraft, selectInstagramDraft } from "../src/publication/instagram-draft.ts";
import { previewInstagram } from "../src/platforms/instagram/instagram-preview.ts";

const imageId = "11111111-1111-4111-8111-111111111111";

test("encontra a prévia do Instagram sem arquivo do YouTube", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "instagram-preview-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = path.join(root, "2026-10-31", imageId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "ready.json"), JSON.stringify({ ready: true }));
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify({
    image_id: imageId, platforms: ["instagram"],
    media: { instagram: "INSTAGRAM.png" }, captions: { instagram: "LEGENDA_INSTAGRAM.txt" },
  }));
  await writeFile(path.join(dir, "INSTAGRAM.png"), Buffer.from([137, 80, 78, 71]));
  await writeFile(path.join(dir, "LEGENDA_INSTAGRAM.txt"), "Legenda\r\n#gta6\r\n");
  const expected = {
    imageId, mediaPath: path.join(dir, "INSTAGRAM.png"), mediaKind: "photo", caption: "Legenda\n#gta6",
  };
  assert.deepEqual(await readInstagramDraft(dir, imageId), expected);
  assert.deepEqual(selectInstagramDraft(await findInstagramDrafts(root)), expected);
  const other = path.join(root, "2026-10-31", "33333333-3333-4333-8333-333333333333");
  await mkdir(other);
  await writeFile(path.join(other, "INSTAGRAM.png"), "incompleto");
  assert.deepEqual(selectInstagramDraft(await findInstagramDrafts(root, imageId), imageId), expected);
});

test("prepara a publicação do Instagram e para antes do botão final", async () => {
  const actions: string[] = [];
  const control = (name: string) => ({
    first() { return this; },
    filter() { return this; },
    async waitFor() { actions.push(`wait:${name}`); },
    async hover() { actions.push(`hover:${name}`); },
    async click() { actions.push(`click:${name}`); },
    async fill(value: string) { actions.push(`fill:${name}:${value}`); },
  });
  const page = {
    async bringToFront() { actions.push("focus:instagram"); },
    async waitForTimeout(ms: number) { assert.ok(ms >= 5000 && ms <= 10000); actions.push("pause"); },
    locator(selector: string) {
      return control(selector.includes("embed-panel-body") ? "panel" :
        selector.includes("embed-panel-item-button") ? "assistant" :
        selector.includes("LaterUploader") ? "add-files" : "caption");
    },
    getByRole(_role: string, options: { name: string }) { return control(options.name); },
    async waitForEvent() { return { async setFiles(file: string) { actions.push(`file:${file}`); } }; },
  } as unknown as Page;
  const draft = {
    imageId, mediaPath: "C:/publicacoes/INSTAGRAM.png", mediaKind: "photo" as const, caption: "Legenda\n#gta6",
  };
  assert.equal(await previewInstagram(page, draft, 30000), page);
  assert.deepEqual(actions.filter(action => action !== "pause"), [
    "focus:instagram", "wait:panel", "hover:panel", "click:assistant", "wait:add-files",
    "click:add-files", "file:C:/publicacoes/INSTAGRAM.png", "wait:caption",
    "fill:caption:Legenda\n#gta6", "wait:Publish Photo",
  ]);
  assert.equal(actions.filter(action => action === "pause").length, 6);
  assert.ok(!actions.includes("click:Publish Photo"));
});
