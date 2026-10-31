import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseManifest, parseReady, type Platform, type Manifest } from "./contracts.ts";
import { inspectPng, readZip } from "./zip.ts";

const MAX_METADATA = 128 * 1024;
const MAX_ARCHIVE = 60 * 1024 * 1024;
const HASHTAGS = "#gta6 #gtavi #gtav #gta #viral";

export type MediaSummary = { filename: string; bytes: number; width: number; height: number; sha256: string };
export type PlatformSummary = {
  platform: Platform;
  publicationId: string;
  scheduledAt: string;
  media: MediaSummary;
  caption: string;
};
export type InspectionResult = {
  jobDir: string;
  status: "OK" | "PENDING" | "ERROR";
  reason?: string;
  manifest?: Manifest;
  outputs?: PlatformSummary[];
};

async function readSmallJson(file: string): Promise<unknown> {
  const info = await stat(file);
  if (!info.isFile() || info.size > MAX_METADATA) throw new Error(`Arquivo JSON inválido/grande: ${path.basename(file)}`);
  return JSON.parse(await readFile(file, "utf8")) as unknown;
}

function captionText(buffer: Buffer, filename: string): string {
  if (buffer.length > 256 * 1024) throw new Error(`Legenda excede 256 KB: ${filename}`);
  const str = new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  return str.replace(/\r\n?/g, "\n").trim();
}

export function parseCaptions(text: string): Map<Platform, string> {
  const sections = new Map<Platform, string>();
  let current: Platform | undefined;
  let lines: string[] = [];
  const save = () => {
    if (!current) return;
    const content = lines.join("\n").trim();
    if (!content) throw new Error(`Legenda vazia no LEGENDAS.txt: ${current}`);
    sections.set(current, content);
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const label = line.trim().toUpperCase();
    if (label === "INSTAGRAM" || label === "YOUTUBE" || label === "TIKTOK") {
      save();
      const next = label.toLowerCase() as Platform;
      if (sections.has(next) || current === next) throw new Error(`Legenda duplicada: ${next}`);
      current = next;
      lines = [];
    } else if (current) {
      lines.push(line);
    } else if (line.trim()) {
      throw new Error("LEGENDAS.txt contém texto antes da primeira seção");
    }
  }
  save();
  return sections;
}

export async function inspectJob(jobDir: string): Promise<InspectionResult> {
  const fail = (status: "ERROR" | "PENDING", reason: string): InspectionResult => ({ jobDir, status, reason });
  try {
    const readyPath = path.join(jobDir, "ready.json");
    try {
      const info = await stat(readyPath);
      if (!info.isFile()) return fail("PENDING", "ready.json ainda não é um arquivo");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fail("PENDING", "Aguardando ready.json");
      throw error;
    }
    parseReady(await readSmallJson(readyPath));
    const manifest = parseManifest(await readSmallJson(path.join(jobDir, "manifest.json")));
    if (path.basename(jobDir).toLowerCase() !== manifest.image_id.toLowerCase()) {
      throw new Error("image_id não corresponde ao nome da pasta do trabalho");
    }
    const zipPath = path.join(jobDir, manifest.zip_file);
    const info = await stat(zipPath);
    if (!info.isFile() || info.size > MAX_ARCHIVE) throw new Error("ZIP ausente, inválido ou maior que 60 MB");
    const files = readZip(await readFile(zipPath));
    const allCaptions = files.get("LEGENDAS.txt");
    if (!allCaptions) throw new Error("LEGENDAS.txt não encontrado dentro do ZIP");
    const sections = parseCaptions(captionText(allCaptions, "LEGENDAS.txt"));
    const outputs: PlatformSummary[] = [];
    for (const pub of manifest.publications) {
      const key = pub.platform.toUpperCase();
      const name = `${key}.png`;
      const image = files.get(name);
      const rawCaption = files.get(`LEGENDA_${key}.txt`);
      if (!image || !rawCaption) throw new Error(`Faltou ${name} ou LEGENDA_${key}.txt`);
      const dimensions = inspectPng(image);
      const caption = captionText(rawCaption, `LEGENDA_${key}.txt`);
      if (!sections.has(pub.platform) || sections.get(pub.platform) !== caption) {
        throw new Error(`Legenda ${key} diverge de LEGENDAS.txt`);
      }
      if (!caption.endsWith(HASHTAGS) || caption.split(HASHTAGS).length !== 2) {
        throw new Error(`Hashtags não correspondem ao padrão V5: ${key}`);
      }
      if (pub.platform === "youtube" && Array.from(caption).length > 100) {
        throw new Error("Legenda do YouTube excede 100 caracteres");
      }
      outputs.push({
        platform: pub.platform,
        publicationId: pub.id,
        scheduledAt: pub.scheduled_at,
        media: { filename: name, bytes: image.length, ...dimensions, sha256: createHash("sha256").update(image).digest("hex") },
        caption,
      });
    }
    return { jobDir, status: "OK", manifest, outputs };
  } catch (error) {
    return fail("ERROR", error instanceof Error ? error.message : String(error));
  }
}

/** Localiza <raiz>/AAAA-MM-DD/<image_id> sem seguir links simbólicos. */
export async function inspectRoot(root: string): Promise<InspectionResult[]> {
  const results: InspectionResult[] = [];
  // A pasta raiz é opcional durante a configuração inicial do bot.
  // Apenas ENOENT da própria raiz significa uma fila ainda vazia.
  // Não mascarar falta de permissão ou erro em diretórios internos.
  let rootEntries: import("node:fs").Dirent[];
  try {
    const info = await stat(root);
    if (!info.isDirectory()) throw Object.assign(new Error("O caminho de publicações não é uma pasta"), { code: "ENOTDIR" });
    rootEntries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const dates = rootEntries
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const date of dates) {
    const folder = path.join(root, date.name);
    const jobs = (await readdir(folder, { withFileTypes: true })).filter((d) => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const job of jobs) results.push(await inspectJob(path.join(folder, job.name)));
  }
  return results;
}
