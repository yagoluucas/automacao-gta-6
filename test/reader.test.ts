import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { deflateRawSync, deflateSync } from "node:zlib";
import { inspectJob, inspectRoot } from "../src/inspector.ts";
import { crc32 } from "../src/zip.ts";

const imageId = "11111111-1111-4111-8111-111111111111";
const hashtag = "#gta6 #gtavi #gtav #gta #viral";
const captions = {
  INSTAGRAM: `Novidades de Vice City!\n${hashtag}`,
  YOUTUBE: `Novidades de Vice City ${hashtag}`,
  TIKTOK: `Vice City chegou?\n${hashtag}`,
};

function chunk(type: string, content: Buffer): Buffer {
  const typeBuffer = Buffer.from(type);
  const header = Buffer.alloc(4);
  header.writeUInt32BE(content.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, content])));
  return Buffer.concat([header, typeBuffer, content, crc]);
}

function createPng(): Buffer {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1080, 0);
  ihdr.writeUInt32BE(1350, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((1080 * 4 + 1) * 1350);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function createZip(entries: [string, Buffer][]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, contents] of entries) {
    const label = Buffer.from(name);
    const packed = deflateRawSync(contents);
    const crc = crc32(contents);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(contents.length, 22);
    header.writeUInt16LE(label.length, 26);
    local.push(header, label, packed);
    const index = Buffer.alloc(46);
    index.writeUInt32LE(0x02014b50, 0);
    index.writeUInt16LE(20, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(8, 10);
    index.writeUInt32LE(crc, 16);
    index.writeUInt32LE(packed.length, 20);
    index.writeUInt32LE(contents.length, 24);
    index.writeUInt16LE(label.length, 28);
    index.writeUInt32LE(offset, 42);
    central.push(index, label);
    offset += header.length + label.length + packed.length;
  }
  const localBuffer = Buffer.concat(local);
  const indexBuffer = Buffer.concat(central);
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0);
  footer.writeUInt16LE(entries.length, 8);
  footer.writeUInt16LE(entries.length, 10);
  footer.writeUInt32LE(indexBuffer.length, 12);
  footer.writeUInt32LE(localBuffer.length, 16);
  return Buffer.concat([localBuffer, indexBuffer, footer]);
}

function createEntries(): [string, Buffer][] {
  const png = createPng();
  const entries: [string, Buffer][] = [["LEGENDAS.txt", Buffer.from(Object.entries(captions).map(([key, val]) => `${key}\n${val}`).join("\n\n") + "\n")]];
  for (const [key, val] of Object.entries(captions)) {
    entries.push([`${key}.png`, png], [`LEGENDA_${key}.txt`, Buffer.from(val)]);
  }
  return entries;
}

const manifest = {
  image_id: imageId,
  rule_set_code: "noticias",
  approach: "noticia",
  translation: false,
  zip: "publifeed_2310261200.zip",
  scheduled_at: "2026-10-23T15:00:00-03:00",
  platforms: ["instagram", "youtube", "tiktok"],
  publication_ids: { instagram: "id-ig", youtube: "id-yt", tiktok: "id-tt" },
};

async function setupJob() {
  const root = await mkdtemp(path.join(tmpdir(), "gta6pira-"));
  const dir = path.join(root, "2026-10-23", imageId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  await writeFile(path.join(dir, "ready.json"), JSON.stringify({ ready: true }));
  await writeFile(path.join(dir, manifest.zip), createZip(createEntries()));
  return { root, dir };
}

test("lê ZIP Feed V5 e encontra mídias e legendas por rede", async (t) => {
  const { root } = await setupJob();
  t.after(() => rm(root, { recursive: true, force: true }));
  const [job] = await inspectRoot(root);
  assert.equal(job.status, "OK");
  assert.equal(job.outputs?.length, 3);
  assert.equal(job.outputs?.find((p) => p.platform === "instagram")?.caption, captions.INSTAGRAM);
  assert.equal(job.outputs?.find((p) => p.platform === "youtube")?.media.width, 1080);
});

test("não consome trabalho sem marcador ready.json", async (t) => {
  const { root, dir } = await setupJob();
  t.after(() => rm(root, { recursive: true, force: true }));
  await rm(path.join(dir, "ready.json"));
  const result = await inspectJob(dir);
  assert.equal(result.status, "PENDING");
});

test("reprova legenda divergente ou ausente", async (t) => {
  const { root, dir } = await setupJob();
  t.after(() => rm(root, { recursive: true, force: true }));
  const entries = createEntries().filter(([name]) => name !== "LEGENDA_TIKTOK.txt");
  await writeFile(path.join(dir, manifest.zip), createZip(entries));
  const result = await inspectJob(dir);
  assert.equal(result.status, "ERROR");
  assert.match(result.reason!, /Faltou/);
});

test("reprova horário de agendamento sem fuso", async (t) => {
  const { root, dir } = await setupJob();
  t.after(() => rm(root, { recursive: true, force: true }));
  const changed = structuredClone(manifest);
  changed.scheduled_at = "2026-10-23T15:30:00";
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(changed));
  const result = await inspectJob(dir);
  assert.equal(result.status, "ERROR");
  assert.match(result.reason!, /scheduled_at inválido/);
});

test("detecta adulteração do conteúdo comprimido pelo CRC", async (t) => {
  const { root, dir } = await setupJob();
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = path.join(dir, manifest.zip);
  const content = createZip(createEntries());
  const position = content.indexOf(Buffer.from("LEGENDAS.txt"));
  assert.ok(position !== -1);
  content[position + 12] ^= 0xff;
  await writeFile(file, content);
  assert.equal((await inspectJob(dir)).status, "ERROR");
});

test("não permite manifest com caminho de ZIP arbitrário", async (t) => {
  const { root, dir } = await setupJob();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify({ ...manifest, zip: "../../secret.zip" }));
  assert.equal((await inspectJob(dir)).status, "ERROR");
});
