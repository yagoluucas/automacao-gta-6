import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseReady } from "../contracts.ts";
import { isValidUuid } from "../ids.ts";

const MAX_MEDIA_BYTES = 256 * 1024 * 1024;
const MAX_CAPTION_BYTES = 32_000;

export interface InstagramDraft {
  readonly imageId: string;
  readonly mediaPath: string;
  readonly mediaKind: "photo" | "video";
  readonly caption: string;
}

/** Lê a mídia do Instagram em um trabalho local, sem exigir arquivos do YouTube. */
export async function readInstagramDraft(dir: string, imageId: string): Promise<InstagramDraft> {
  if (!isValidUuid(imageId)) throw new Error("Pasta do Instagram deve conter image_id UUID válido");
  parseReady(JSON.parse(await readFile(path.join(dir, "ready.json"), "utf8")) as unknown);
  const raw = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as Record<string, unknown>;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Manifesto do Instagram inválido");
  if (raw.image_id !== imageId) throw new Error("image_id do Instagram difere do trabalho selecionado");
  if (Array.isArray(raw.platforms) && !raw.platforms.includes("instagram")) {
    throw new Error("O trabalho selecionado não contém publicação para Instagram");
  }
  const declaredMedia = raw.media && typeof raw.media === "object" && "instagram" in raw.media
    ? raw.media.instagram : undefined;
  if (declaredMedia !== undefined &&
      (typeof declaredMedia !== "string" || !/^INSTAGRAM\.(?:png|jpe?g|mp4)$/i.test(declaredMedia))) {
    throw new Error("Mídia do Instagram no manifesto deve ser INSTAGRAM.png, .jpg, .jpeg ou .mp4");
  }
  let mediaPath = "";
  let mediaInfo;
  const candidates = declaredMedia ? [declaredMedia] :
    ["INSTAGRAM.mp4", "INSTAGRAM.png", "INSTAGRAM.jpg", "INSTAGRAM.jpeg"];
  for (const candidate of candidates) {
    const candidatePath = path.join(dir, candidate);
    try {
      const info = await lstat(candidatePath);
      if (mediaPath) throw new Error("Há várias mídias do Instagram; declare media.instagram no manifesto");
      mediaPath = candidatePath;
      mediaInfo = info;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (!mediaInfo?.isFile() || mediaInfo.size < 1 || mediaInfo.size > MAX_MEDIA_BYTES) {
    throw new Error("Mídia do Instagram ausente, inválida ou maior que 256 MiB");
  }

  const declaredCaption = raw.captions && typeof raw.captions === "object" && "instagram" in raw.captions
    ? raw.captions.instagram : undefined;
  const captionName = declaredCaption ?? "LEGENDA_INSTAGRAM.txt";
  if (captionName !== "LEGENDA_INSTAGRAM.txt") throw new Error("Legenda do Instagram inválida no manifesto");
  const captionPath = path.join(dir, captionName);
  const captionInfo = await lstat(captionPath);
  if (!captionInfo.isFile() || captionInfo.size < 1 || captionInfo.size > MAX_CAPTION_BYTES) {
    throw new Error("LEGENDA_INSTAGRAM.txt ausente, vazia ou grande demais");
  }
  const caption = (await readFile(captionPath, "utf8")).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!caption) throw new Error("LEGENDA_INSTAGRAM.txt está vazia");
  return {
    imageId,
    mediaPath,
    mediaKind: /\.mp4$/i.test(mediaPath) ? "video" : "photo",
    caption,
  };
}

/** Descobre apenas trabalhos que têm mídia Instagram; outros pacotes são ignorados. */
export async function findInstagramDrafts(root: string, imageId?: string): Promise<InstagramDraft[]> {
  const drafts: InstagramDraft[] = [];
  const dates = await readdir(root, { withFileTypes: true });
  for (const date of dates.filter(x => x.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(x.name))
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const dateDir = path.join(root, date.name);
    const jobs = await readdir(dateDir, { withFileTypes: true });
    for (const job of jobs.filter(x => x.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      if (imageId && job.name !== imageId) continue;
      const dir = path.join(dateDir, job.name);
      const names = await readdir(dir);
      if (!names.some(name => /^INSTAGRAM\.(?:png|jpe?g|mp4)$/i.test(name))) continue;
      drafts.push(await readInstagramDraft(dir, job.name));
    }
  }
  return drafts;
}

export function selectInstagramDraft(drafts: readonly InstagramDraft[], imageId?: string): InstagramDraft {
  const matches = imageId ? drafts.filter(draft => draft.imageId === imageId) : drafts;
  if (matches.length === 0) throw new Error("Nenhuma mídia Instagram preparada foi encontrada.");
  if (matches.length > 1) throw new Error("Há várias publicações Instagram preparadas. Use --image-id <UUID> para escolher uma.");
  return matches[0]!;
}
