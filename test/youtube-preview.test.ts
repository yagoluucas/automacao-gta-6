import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtemp, mkdir, writeFile, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Page } from "playwright-core";
import {findYouTubeShortDrafts, selectYouTubeShortDraft} from "../src/publication/youtube-short-drafts.ts";
import {previewYouTubeShort, readYouTubePreviewConfig} from "../src/platforms/youtube/youtube-preview.ts";

const imageId="11111111-1111-4111-8111-111111111111";
const publicationId="22222222-2222-4222-8222-222222222222";
test("lê somente vídeo local com manifesto compatível e preserva IDs",async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),"youtube-preview-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const dir=path.join(root,"2026-10-31",imageId);
 await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,"ready.json"),JSON.stringify({ready:true}));
 await writeFile(path.join(dir,"manifest.json"),JSON.stringify({
  image_id:imageId,rule_set_code:"video",approach:"video",translation:false,
  zip:"publifeed_3110261200.zip",platforms:["youtube"],publication_ids:{youtube:publicationId},
  scheduled_at:"2026-10-31T15:00:00-03:00"
 }));
 await writeFile(path.join(dir,"LEGENDA_YOUTUBE.txt"),"Meu Short\n#gtavi");
 await writeFile(path.join(dir,"YOUTUBE.mp4"),Buffer.from([0,0,0,16,102,116,121,112,105,115,111,109,0,0,0,0]));
 const drafts=await findYouTubeShortDrafts(root);
 assert.equal(drafts.length,1);
 assert.equal(selectYouTubeShortDraft(drafts).publicationId,publicationId);
 assert.equal(drafts[0]!.title,"Meu Short");
});
test("falha diante de várias postagens sem seleção explícita",()=>{
 const d={imageId, publicationId,scheduledAt:"2026-10-31T15:00:00Z",videoPath:"a",caption:"x",title:"x"};
 assert.throws(()=>selectYouTubeShortDraft([d,d]),/vários Shorts/);
});
test("configuração de espera exige valores válidos",()=>{
 assert.deepEqual(readYouTubePreviewConfig({}),{navigationTimeoutMs:30000});
 assert.throws(()=>readYouTubePreviewConfig({BOT_NAVIGATION_TIMEOUT_MS:"-1"}),/BOT_NAVIGATION_TIMEOUT_MS/);
});

test("percorre o upload na aba do YouTube e para antes de publicar", async () => {
 const actions: string[] = [];
 const control = (name: string) => ({
  first() { return this; },
  async waitFor() { actions.push(`wait:${name}`); },
  async click() { actions.push(`click:${name}`); },
  async fill(value: string) { actions.push(`fill:${name}:${value}`); },
 });
 const studioPage = {
  async bringToFront() { actions.push("focus:studio"); },
  async waitForURL() { actions.push("url:studio"); },
  async waitForTimeout(ms: number) { assert.ok(ms >= 5000 && ms <= 10000); actions.push("pause"); },
  getByRole(_role: string, options: {name: RegExp}) {
   return control(options.name.test("Selecionar arquivos") ? "select-files" :
    options.name.test("Avançar") ? "next" : "publish");
  },
  locator(selector: string) {
   return control(selector.includes("VIDEO_MADE_FOR_KIDS_NOT_MFK") ? "not-for-kids" :
    selector.includes('name="PUBLIC"') ? "public" :
    selector.includes("video-title") ? "title" : "description");
  },
  async waitForEvent() { return { async setFiles(file: string) { actions.push(`file:${file}`); } }; },
 } as unknown as Page;
 const youtubePage = {
  async bringToFront() { actions.push("focus:youtube"); },
  async waitForTimeout(ms: number) { assert.ok(ms >= 5000 && ms <= 10000); actions.push("pause"); },
  getByRole() { return control("create"); },
  getByText() { return control("upload"); },
  async waitForEvent() { return studioPage; },
  waitForURL() { return new Promise<void>(() => {}); },
 } as unknown as Page;
 const draft = {
  imageId, publicationId, scheduledAt: "2026-10-31T15:00:00-03:00",
  videoPath: "C:/video/YOUTUBE.mp4", caption: "Meu Short\n#gta6", title: "Meu Short",
 };
 const result = await previewYouTubeShort(youtubePage, draft, {navigationTimeoutMs:30000});
 assert.equal(result, studioPage);
 assert.equal(actions[0], "focus:youtube");
 assert.equal(actions.filter(action => action === "click:next").length, 3);
 assert.ok(actions.indexOf("click:public") > actions.lastIndexOf("click:next"));
 assert.ok(actions.includes("wait:publish"));
 assert.ok(!actions.includes("click:publish"));
 assert.equal(actions.filter(action => action === "pause").length,
  actions.filter(action => /^(focus:|click:|fill:|file:)/.test(action)).length);
});
