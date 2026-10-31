import assert from "node:assert/strict";
import {test} from "node:test";
import {mkdtemp, mkdir, writeFile, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {findYouTubeShortDrafts, selectYouTubeShortDraft} from "../src/publication/youtube-short-drafts.ts";
import {readYouTubePreviewConfig} from "../src/platforms/youtube/youtube-preview.ts";

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
 assert.deepEqual(readYouTubePreviewConfig({}),{navigationTimeoutMs:30000,uiSettleMs:2000});
 assert.throws(()=>readYouTubePreviewConfig({BOT_UI_SETTLE_MS:"-1"}),/BOT_UI_SETTLE_MS/);
});
