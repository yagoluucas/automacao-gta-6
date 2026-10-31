import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { inspectRoot } from "../src/inspector.ts";
import { AppError, normalizeError } from "../src/errors/catalog.ts";

test("diretório raiz ausente não interrompe a inspeção", async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "gta-dir-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  assert.deepEqual(await inspectRoot(path.join(parent, "publicacoes-ainda-inexistentes")), []);
});

test("diretório raiz existente mas vazio também produz fila vazia", async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "gta-dir-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  assert.deepEqual(await inspectRoot(parent), []);
});

test("caminho apontando para arquivo é erro de configuração, não fila vazia", async t => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "gta-dir-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const file = path.join(parent, "publicacoes.txt");
  await writeFile(file, "arquivo");
  await assert.rejects(() => inspectRoot(file), /não é uma pasta/);
});

test("código local de ausência não é classificado como falha inesperada", () => {
  assert.equal(normalizeError(new AppError("PUBLICATIONS_DIR_MISSING")), "PUBLICATIONS_DIR_MISSING");
});
