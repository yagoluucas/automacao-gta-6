import { open, readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { parseReady } from "../contracts.ts";
import { isValidUuid } from "../ids.ts";

const MAX_TEXT_BYTES = 32_000;
const MAX_VIDEO_BYTES = 256 * 1024 * 1024;

export interface YouTubeShortDraft {
  readonly imageId: string;
  readonly publicationId: string;
  readonly scheduledAt: string;
  readonly videoPath: string;
  readonly caption: string;
  readonly title: string;
}

/** Contrato local temporário: YOUTUBE.mp4 e LEGENDA_YOUTUBE.txt ao lado de manifest.json/ready.json. */
export async function findYouTubeShortDrafts(root: string): Promise<YouTubeShortDraft[]> {
  const drafts: YouTubeShortDraft[] = [];
  const dates = await readdir(root, { withFileTypes: true });
  for (const date of dates.filter(x => x.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(x.name)).sort((a,b) => a.name.localeCompare(b.name))) {
    const dateDir = path.join(root, date.name);
    for (const entry of (await readdir(dateDir, { withFileTypes: true })).filter(x => x.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
      const dir = path.join(dateDir, entry.name);
      const videoPath = path.join(dir, "YOUTUBE.mp4");
      // Sem vídeo local, este é um pacote de Feed V5 ou uma publicação ainda não preparada.
      try {
        const file = await lstat(videoPath);
        if (!file.isFile() || file.size <= 8 || file.size > MAX_VIDEO_BYTES) throw new Error("YOUTUBE.mp4 inválido ou maior que 256 MiB");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (!isValidUuid(entry.name)) throw new Error("Pasta de vídeo deve conter image_id UUID válido");
      const ready = JSON.parse(await readFile(path.join(dir, "ready.json"), "utf8")) as unknown;
      parseReady(ready);
      const raw = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8")) as unknown;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Manifesto de vídeo inválido");
      const manifest = raw as Record<string, unknown>;
      if (manifest.image_id !== entry.name) throw new Error("image_id do manifesto difere da pasta local");
      const ids = manifest.publication_ids;
      const publicationRows = manifest.publications;
      const id = Array.isArray(publicationRows)
        ? (publicationRows as unknown[]).find(x => !!x && typeof x === "object" && "platform" in x && x.platform === "youtube")
        : null;
      const publicationId = id && typeof id === "object" && "id" in id ? id.id
        : ids && typeof ids === "object" && "youtube" in ids ? ids.youtube : undefined;
      const platforms = manifest.platforms;
      if (Array.isArray(platforms) && !platforms.includes("youtube")) continue;
      if (!publicationId) continue;
      if (!isValidUuid(publicationId)) throw new Error("ID da publicação YouTube inválido");
      const scheduledAt = id && typeof id === "object" && "scheduled_at" in id ? id.scheduled_at : manifest.scheduled_at;
      if (typeof scheduledAt !== "string" || !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(scheduledAt) ||
          !Number.isFinite(Date.parse(scheduledAt))) throw new Error("scheduled_at YouTube inválido");

      const captionPath = path.join(dir, "LEGENDA_YOUTUBE.txt");
      const captionInfo = await lstat(captionPath);
      if (!captionInfo.isFile() || captionInfo.size < 1 || captionInfo.size > MAX_TEXT_BYTES) {
        throw new Error("LEGENDA_YOUTUBE.txt ausente, inválido ou grande demais");
      }
      const caption = (await readFile(captionPath, "utf8")).replace(/^\uFEFF/, "").trim();
      if (!caption || caption.length > 5000) throw new Error("Legenda YouTube vazia ou acima do limite de descrição");
      const title = caption.split(/\r?\n/).map(x=>x.trim()).find(Boolean) || "";
      if (Array.from(title).length > 100) throw new Error("Primeira linha da legenda excede 100 caracteres para título do YouTube");
      const handle = await open(videoPath, "r");
      try {
        const header = Buffer.alloc(12);
        await handle.read(header, 0, header.length, 0);
        if (header.toString("ascii", 4, 8) !== "ftyp") throw new Error("YOUTUBE.mp4 não possui cabeçalho MP4 reconhecível");
      } finally {
        await handle.close();
      }
      drafts.push({
        imageId: entry.name, publicationId,
        scheduledAt, videoPath, caption, title,
      });
    }
  }
  return drafts;
}

export function selectYouTubeShortDraft(drafts: readonly YouTubeShortDraft[], imageId?: string): YouTubeShortDraft {
  const matches = imageId ? drafts.filter(x => x.imageId === imageId) : [...drafts];
  if (matches.length === 0) throw new Error("Nenhuma publicação YouTube MP4 preparada foi encontrada.");
  if (matches.length > 1) throw new Error("Há vários Shorts preparados. Use --image-id <UUID> para escolher um.");
  return matches[0]!;
}
