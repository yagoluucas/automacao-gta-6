import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseReady } from "../contracts.ts";
import { isValidUuid } from "../ids.ts";

const MAX_MEDIA_BYTES = 256 * 1024 * 1024;
const MAX_CAPTION_BYTES = 32_000;
const MEDIA_NAME = /^TIKTOK\.(?:mp4|png|jpe?g|webp)$/i;

export interface TikTokDraft {
  readonly imageId: string;
  readonly mediaPath: string;
  readonly mediaKind: "photo" | "video";
  readonly caption: string;
}

export async function readTikTokDraft(dir: string, imageId: string): Promise<TikTokDraft> {
  if (!isValidUuid(imageId)) throw new Error("Pasta do TikTok deve conter image_id UUID válido");
  parseReady(JSON.parse(await readFile(path.join(dir, "ready.json"), "utf8")) as unknown);
  const raw = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Manifesto do TikTok inválido");
  const manifest = raw as Record<string, unknown>;
  if (manifest.image_id !== imageId) throw new Error("image_id do TikTok difere do trabalho selecionado");
  if (Array.isArray(manifest.platforms) && !manifest.platforms.includes("tiktok")) {
    throw new Error("O trabalho selecionado não contém publicação para TikTok");
  }

  const media = manifest.media && typeof manifest.media === "object" && "tiktok" in manifest.media
    ? manifest.media.tiktok : undefined;
  if (media !== undefined && (typeof media !== "string" || !MEDIA_NAME.test(media))) {
    throw new Error("Mídia TikTok no manifesto deve ser TIKTOK.mp4, .png, .jpg, .jpeg ou .webp");
  }
  let mediaPath = "";
  let mediaInfo;
  const candidates = media ? [media] :
    ["TIKTOK.mp4", "TIKTOK.png", "TIKTOK.jpg", "TIKTOK.jpeg", "TIKTOK.webp"];
  for (const candidate of candidates) {
    const candidatePath = path.join(dir, candidate);
    try {
      const info = await lstat(candidatePath);
      if (mediaPath) throw new Error("Há várias mídias TikTok; declare media.tiktok no manifesto");
      mediaPath = candidatePath;
      mediaInfo = info;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (!mediaInfo?.isFile() || mediaInfo.size < 1 || mediaInfo.size > MAX_MEDIA_BYTES) {
    throw new Error("Mídia TikTok ausente, inválida ou maior que 256 MiB");
  }

  const declaredCaption = manifest.captions && typeof manifest.captions === "object" && "tiktok" in manifest.captions
    ? manifest.captions.tiktok : undefined;
  const captionName = declaredCaption ?? "LEGENDA_TIKTOK.txt";
  if (captionName !== "LEGENDA_TIKTOK.txt") throw new Error("Legenda TikTok inválida no manifesto");
  const captionPath = path.join(dir, captionName);
  const captionInfo = await lstat(captionPath);
  if (!captionInfo.isFile() || captionInfo.size < 1 || captionInfo.size > MAX_CAPTION_BYTES) {
    throw new Error("LEGENDA_TIKTOK.txt ausente, vazia ou grande demais");
  }
  const caption = (await readFile(captionPath, "utf8")).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!caption) throw new Error("LEGENDA_TIKTOK.txt está vazia");
  return { imageId, mediaPath, mediaKind: /\.mp4$/i.test(mediaPath) ? "video" : "photo", caption };
}

export async function findTikTokDrafts(root: string, imageId?: string): Promise<TikTokDraft[]> {
  const drafts: TikTokDraft[] = [];
  const dates = await readdir(root, { withFileTypes: true });
  for (const date of dates.filter(x => x.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(x.name))
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const dateDir = path.join(root, date.name);
    const jobs = await readdir(dateDir, { withFileTypes: true });
    for (const job of jobs.filter(x => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      if (imageId && job.name !== imageId) continue;
      const dir = path.join(dateDir, job.name);
      const names = await readdir(dir);
      if (!names.some(name => MEDIA_NAME.test(name))) continue;
      drafts.push(await readTikTokDraft(dir, job.name));
    }
  }
  return drafts;
}

export function selectTikTokDraft(drafts: readonly TikTokDraft[], imageId?: string): TikTokDraft {
  const matches = imageId ? drafts.filter(draft => draft.imageId === imageId) : drafts;
  if (matches.length === 0) throw new Error("Nenhuma mídia TikTok preparada foi encontrada.");
  if (matches.length > 1) throw new Error("Há várias publicações TikTok preparadas. Use --image-id <UUID> para escolher uma.");
  return matches[0]!;
}
