import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { AppError, normalizeError } from "../src/errors/catalog.ts";
import { captureError } from "../src/errors/handler.ts";
import type { ErrorRecord } from "../src/errors/types.ts";
import { isValidUuid } from "../src/ids.ts";
import { withPublicationRetry } from "../src/errors/retry.ts";
import { toFailureSyncPayload } from "../src/errors/supabase-sync.ts";

const identity = {
  imageId: "11111111-1111-4111-8111-111111111111",
  publicationId: "22222222-2222-4222-8222-222222222222",
  platform: "instagram" as const, stage: "publication" as const,
};

test("erro fatal não é retentado; registra uma ocorrência", async () => {
  const events: ErrorRecord[] = [];
  let called = 0;
  const result = await withPublicationRetry(async () => {
    called++;
    throw new AppError("MEDIA_MISSING");
  }, identity, { recorder: async event => { events.push(event); }, wait: async () => { throw new Error("não deveria aguardar"); } });
  assert.equal(called, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.code, "MEDIA_MISSING");
  assert.equal(result.status, "failed");
  assert.equal(events[0]?.action, "abort");
});

test("falha temporária executa no máximo três tentativas com 5 e 10 minutos", async () => {
  let called = 0;
  const intervals: number[] = [];
  const events: ErrorRecord[] = [];
  let final: ErrorRecord | undefined;
  const result = await withPublicationRetry(async () => {
    called++;
    throw new AppError("NETWORK_UNAVAILABLE");
  }, identity, {
    recorder: async event => { events.push(event); },
    wait: async ms => { intervals.push(ms); },
    onFinal: async event => { final = event; }
  });
  assert.equal(result.status, "failed");
  assert.equal(called, 3);
  assert.deepEqual(intervals, [300_000, 600_000]);
  assert.deepEqual(events.map(x => x.attempt), [1, 2, 3]);
  assert.deepEqual(events.map(x => x.action), ["retry", "retry", "abort"]);
  assert.equal(final?.code, "NETWORK_UNAVAILABLE");
});

test("retentativa retorna sucesso sem enviar falha ao Supabase", async () => {
  let count = 0;
  let finalized = false;
  const result = await withPublicationRetry(async () => {
    if (++count < 2) throw new AppError("RATE_LIMITED");
    return "ok";
  }, identity, {
    recorder: async () => {},
    wait: async () => {},
    onFinal: async () => { finalized = true; }
  });
  assert.deepEqual(result, { status: "success", value: "ok", attempts: 2 });
  assert.equal(finalized, false);
});

test("resultado ambíguo não tenta novamente", async () => {
  let count = 0;
  const result = await withPublicationRetry(async () => {
    count++;
    throw new AppError("PUBLICATION_UNCONFIRMED");
  }, identity, { recorder: async () => {}, wait: async () => { throw new Error("não deveria esperar"); } });
  assert.equal(count, 1);
  assert.equal(result.status, "review_required");
});

test("logs locais são JSON individuais, sem vazar informações inesperadas", async t => {
  const folder = await mkdtemp(path.join(tmpdir(), "bot-errors-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await captureError(new Error("Senha privada token=SECRET"), identity, { logDirectory: folder });
  await captureError(new AppError("CAPTION_MISSING"), identity, { logDirectory: folder });
  const files = await readdir(folder);
  assert.equal(files.length, 2);
  const text = (await Promise.all(files.map(f => readFile(path.join(folder, f), "utf8")))).join("\n");
  assert.doesNotMatch(text, /SECRET|Senha privada/);
  const events = await Promise.all(files.map(async f => JSON.parse(await readFile(path.join(folder, f), "utf8")) as ErrorRecord));
  assert.ok(events.some(e => e.code === "CAPTION_MISSING"));
  assert.ok(events.every(e => e.imageId === identity.imageId && e.publicationId === identity.publicationId));
});

test("sincronização só é permitida com IDs válidos e erro final", async () => {
  const retry = await captureError(new AppError("RATE_LIMITED"), identity, { attempt: 1, maxAttempts: 3, recorder: async () => {} });
  assert.equal(toFailureSyncPayload(retry), null);
  const exhausted = await captureError(new AppError("RATE_LIMITED"), identity, { attempt: 3, maxAttempts: 3, recorder: async () => {} });
  assert.deepEqual(toFailureSyncPayload(exhausted)?.status, "failed");
  const unlinked = await captureError(new AppError("MEDIA_MISSING"), { stage: "inspection" }, { recorder: async () => {} });
  assert.equal(toFailureSyncPayload(unlinked), null);
});

test("UUID compartilhado preserva IDs válidos e descarta inválidos", async () => {
  assert.equal(isValidUuid(identity.imageId), true);
  assert.equal(isValidUuid("not-a-uuid"), false);
  const record = await captureError(new AppError("MEDIA_MISSING"),
    { ...identity, imageId: "bad", publicationId: "bad" }, { recorder: async () => {} });
  assert.equal(record.imageId, null);
  assert.equal(record.publicationId, null);
  assert.equal(toFailureSyncPayload(record), null);
});

test("classifica erros do leitor e não vaza o texto original", () => {
  assert.equal(normalizeError(new Error("Faltou INSTAGRAM.png ou LEGENDA_INSTAGRAM.txt")), "MEDIA_MISSING");
  assert.equal(normalizeError(new Error("scheduled_at inválido")), "SCHEDULE_INVALID");
  assert.equal(normalizeError(new Error("Legenda INSTAGRAM diverge de LEGENDAS.txt")), "CAPTION_INVALID");
  assert.equal(normalizeError(new Error("Abrindo em uma sessão de navegador existente.")), "CHROME_PROFILE_IN_USE");
  assert.equal(normalizeError(new Error("Opening in existing browser session.")), "CHROME_PROFILE_IN_USE");
  assert.equal(normalizeError(new Error("Falha desconhecida; senha=SUPER_SECRET")), "UNEXPECTED_ERROR");
});
