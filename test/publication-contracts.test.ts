import assert from "node:assert/strict";
import { test } from "node:test";
import { preparedFromInspection, parsePublicationOutcome, toStatusPatch, assertOutcomeMatchesPublication } from "../src/publication-contracts.ts";
import type { InspectionResult } from "../src/inspector.ts";

const imageId = "11111111-1111-4111-8111-111111111111";
const publicationId = "22222222-2222-4222-8222-222222222222";
const input = {
  imageId, publicationId, platform: "instagram" as const,
};
const job: InspectionResult = {
  jobDir: "/tmp/publicacoes/2026-10-23/" + imageId,
  status: "OK",
  manifest: {
    image_id: imageId,
    rule_set_code: "noticias", approach: "noticia",
    translate: false, zip_file: "publifeed_2310261200.zip",
    publications: [{id:publicationId,platform:"instagram",scheduled_at:"2026-10-23T15:00:00-03:00"}],
  },
  outputs: [{
    platform: "instagram", publicationId, scheduledAt: "2026-10-23T15:00:00-03:00",
    caption: "Legenda #gta6", media: {filename:"INSTAGRAM.png",bytes:12345,width:1080,height:1350,sha256:"a".repeat(64)},
  }],
};

test("adapta pacote Feed V5 válido sem recorrer ao Supabase", () => {
  const [result] = preparedFromInspection(job);
  assert.ok(result);
  assert.equal(result.mediaType, "feed");
  assert.equal(result.publicationId, publicationId);
  assert.equal(result.assets[0].entryName, "INSTAGRAM.png");
});

test("não aceita publicação sem IDs persistidos", () => {
  const changed = structuredClone(job);
  changed.manifest!.publications[0]!.id = "novo-id";
  assert.throws(() => preparedFromInspection(changed), /UUID/);
});

test("não aceita pacote pendente", () => {
  assert.throws(() => preparedFromInspection({...job,status:"PENDING"}), /status OK/);
});

test("conversão de publicação comprovada gera somente campos autorizados", () => {
  const outcome = parsePublicationOutcome({...input,status:"published",publishedAt:"2026-10-23T15:05:00-03:00",externalPostUrl:"https://www.instagram.com/p/abc123/"});
  assertOutcomeMatchesPublication(preparedFromInspection(job)[0]!,outcome);
  assert.deepEqual(toStatusPatch(outcome),{
    status:"published",published_at:"2026-10-23T15:05:00-03:00",
    external_post_id:null,external_post_url:"https://www.instagram.com/p/abc123/",error_message:null,
  });
});

test("não confirma publicação sem evidência externa", () => {
  assert.throws(() => parsePublicationOutcome({...input,status:"published",publishedAt:"2026-10-23T15:05:00Z"}),/ID ou URL/);
});

test("não aceita URL de plataforma incorreta", () => {
  assert.throws(() => parsePublicationOutcome({...input,status:"published",publishedAt:"2026-10-23T15:05:00Z",externalPostUrl:"https://example.com/post"}),/ID ou URL/);
});

test("falha e revisão nunca são status publicado", () => {
  const failure=parsePublicationOutcome({...input,status:"review_required",errorMessage:"Timeout após confirmação: verificar manualmente"});
  assert.deepEqual(toStatusPatch(failure),{status:"review_required",error_message:"Timeout após confirmação: verificar manualmente"});
});

test("resultado de publicação diferente não pode atualizar o trabalho", () => {
  const outcome=parsePublicationOutcome({...input,publicationId:"33333333-3333-4333-8333-333333333333",status:"failed",errorMessage:"Falha de upload"});
  assert.throws(()=>assertOutcomeMatchesPublication(preparedFromInspection(job)[0]!,outcome),/outra publicação/);
});

test("simulated não é estado persistido no Supabase", () => {
  assert.throws(()=>parsePublicationOutcome({...input,status:"simulated"}),/Status inválido/);
});
