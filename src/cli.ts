import path from "node:path";
import { stat } from "node:fs/promises";
import { startSocialBrowser } from "./browser/chrome-startup.ts";
import { captureError } from "./errors/handler.ts";
import { AppError } from "./errors/catalog.ts";
import { inspectRoot, type InspectionResult } from "./inspector.ts";
import { findYouTubeShortDrafts, selectYouTubeShortDraft } from "./publication/youtube-short-drafts.ts";
import { findInstagramDrafts, readInstagramDraft, selectInstagramDraft, type InstagramDraft } from "./publication/instagram-draft.ts";
import { findTikTokDrafts, readTikTokDraft, selectTikTokDraft, type TikTokDraft } from "./publication/tiktok-draft.ts";
import { previewInstagram } from "./platforms/instagram/instagram-preview.ts";
import { previewTikTok } from "./platforms/tiktok/tiktok-preview.ts";
import { previewYouTubeShort, readYouTubePreviewConfig } from "./platforms/youtube/youtube-preview.ts";

function directoryFromArgs(args: string[]): string {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Uso: npm run dev -- --dir <pasta> (ou npm run preview:tiktok -- --image-id <UUID>)\nPadrão: PUBLICATIONS_DIR ou ../publicacoes\nOs modos de prévia carregam .env e .env.local automaticamente.\nEste comando NÃO publica em redes sociais.");
    process.exit(0);
  }
  const idx = args.indexOf("--dir");
  if (idx !== -1 && !args[idx + 1]) throw new Error("Informe uma pasta após --dir");
  const raw = idx !== -1 ? args[idx + 1]! : process.env.PUBLICATIONS_DIR || path.join(process.cwd(), "..", "publicacoes");
  return path.resolve(raw);
}

function show(result: InspectionResult): void {
  const id = path.basename(result.jobDir);
  console.log(`\n[${result.status}] Trabalho ${id}`);
  if (result.reason) {
    console.log(`  Motivo: ${result.reason}`);
    return;
  }
  const m = result.manifest!;
  console.log(`  Regra: ${m.rule_set_code} | Abordagem: ${m.approach} | Traduzir: ${m.translate ? "sim" : "não"}`);
  console.log(`  Pacote: ${m.zip_file}`);
  for (const p of result.outputs!) {
    console.log(`  [${p.platform.toUpperCase()}] id=${p.publicationId} | horário=${p.scheduledAt}`);
    console.log(`    MÍDIA ENCONTRADA: ${p.media.filename} (${p.media.width}x${p.media.height}, ${p.media.bytes} bytes)`);
    console.log(`    SHA-256: ${p.media.sha256}`);
    console.log("    LEGENDA ENCONTRADA:");
    for (const line of p.caption.split("\n")) console.log(`      ${line}`);
  }
}

try {
  const root = directoryFromArgs(process.argv.slice(2));
  const tiktokPreview = process.argv.includes("--tiktok-preview");
  const youtubePreview = process.argv.includes("--youtube-preview");
  const instagramPreview = process.argv.includes("--instagram-preview");
  const anyPreview = tiktokPreview || youtubePreview || instagramPreview;
  const previewConfig = anyPreview ? readYouTubePreviewConfig(process.env) : undefined;
  if (anyPreview && !process.argv.includes("--chrome")) {
    throw new Error("Prévia de rede social exige o modo Chrome.");
  }
  const idIndex = process.argv.indexOf("--image-id");
  const imageId = idIndex < 0 ? undefined : process.argv[idIndex + 1];
  if (anyPreview && idIndex >= 0 && !imageId) throw new Error("Informe um UUID após --image-id.");
  const youtubeDrafts = youtubePreview ? await findYouTubeShortDrafts(root) : [];
  if (youtubePreview && youtubeDrafts.length === 0) {
    console.error("[YOUTUBE] Nenhum YOUTUBE.mp4 preparado em PUBLICATIONS_DIR/AAAA-MM-DD/<image_id>/.");
  }
  const youtubeDraft = youtubePreview ? selectYouTubeShortDraft(youtubeDrafts, imageId) : undefined;
  let tiktokDraft: TikTokDraft | undefined;
  if (tiktokPreview) {
    try {
      tiktokDraft = youtubeDraft
        ? await readTikTokDraft(path.dirname(youtubeDraft.videoPath), youtubeDraft.imageId)
        : selectTikTokDraft(await findTikTokDrafts(root, imageId), imageId);
    } catch (error) {
      console.error("[TIKTOK] Não foi possível preparar o trabalho:", error instanceof Error ? error.message : error);
      if (!youtubePreview && !instagramPreview) throw error;
      process.exitCode = 1;
    }
  }
  let instagramDraft: InstagramDraft | undefined;
  if (instagramPreview) {
    try {
      instagramDraft = youtubeDraft
        ? await readInstagramDraft(path.dirname(youtubeDraft.videoPath), youtubeDraft.imageId)
        : selectInstagramDraft(await findInstagramDrafts(root, imageId), imageId);
    } catch (error) {
      console.error("[INSTAGRAM] Não foi possível preparar o trabalho:", error instanceof Error ? error.message : error);
      if (!youtubePreview) throw error;
      process.exitCode = 1;
    }
  }
  const session = process.argv.includes("--chrome")
    ? await startSocialBrowser(process.env, tiktokPreview ? "tiktok" : instagramPreview && !youtubePreview ? "instagram" : "youtube") : null;
  if (session) {
    console.log("[CHROME] Chrome aberto maximizado: Instagram, TikTok e YouTube.");
    if (session.navigationFailures.length) {
      console.warn("[CHROME] Abas com falha de carregamento:", session.navigationFailures.join(", "));
    }
  }
  const previewNames = [tiktokPreview && "TikTok", youtubePreview && "YouTube", instagramPreview && "Instagram"]
    .filter(Boolean).join(" + ");
  console.log(anyPreview
    ? `GTA 6 PIRA | Prévia ${previewNames} | SEM PUBLICAR\nPasta: ${root}`
    : `GTA 6 PIRA | Leitor local V5 | MODO SOMENTE LEITURA\nPasta: ${root}`);
  let folderExists = true;
  try {
    const info = await stat(root);
    if (!info.isDirectory()) {
      const record = await captureError(new AppError("PUBLICATIONS_DIR_NOT_DIRECTORY"), { stage: "inspection" });
      console.warn("[PASTA]", record.description, root);
      folderExists = false;
      process.exitCode = 1;
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      folderExists = false;
      console.warn("[PASTA] Diretório de publicações não encontrado:", root);
      console.warn("[PASTA] Configure PUBLICATIONS_DIR no .env ou .env.local. O Chrome continuará aberto.");
      await captureError(new AppError("PUBLICATIONS_DIR_MISSING"), { stage: "inspection" });
    } else {
      throw error;
    }
  }
  if (anyPreview) {
    if (!session) throw new Error("Prévia exige o modo Chrome.");
    if (!folderExists) throw new Error("Diretório local não disponível para prévia.");
    if (tiktokDraft) {
      try {
        const tiktokTab = session.tabs.get("tiktok");
        if (!tiktokTab) throw new Error("A aba do TikTok não foi aberta.");
        await previewTikTok(tiktokTab, tiktokDraft, previewConfig!.navigationTimeoutMs);
      } catch (error) {
        console.error("[TIKTOK] Prévia não concluída:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    }
    if (youtubePreview) {
      if (!youtubeDraft) throw new Error("Nenhum vídeo selecionado para a prévia do YouTube.");
      console.log("[YOUTUBE] Preparando rascunho para inspeção:", youtubeDraft.publicationId);
      const youtubeTab = session.tabs.get("youtube");
      if (!youtubeTab) throw new Error("A aba do YouTube não foi aberta.");
      try {
        await previewYouTubeShort(youtubeTab, youtubeDraft, previewConfig!);
      } catch (error) {
        if (!tiktokPreview && !instagramPreview) throw error;
        console.error("[YOUTUBE] Prévia não concluída:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    }
    if (instagramDraft) {
      try {
        const instagramTab = session.tabs.get("instagram");
        if (!instagramTab) throw new Error("A aba do Instagram não foi aberta.");
        await previewInstagram(instagramTab, instagramDraft, previewConfig!.navigationTimeoutMs);
      } catch (error) {
        console.error("[INSTAGRAM] Prévia não concluída:", error instanceof Error ? error.message : error);
        process.exitCode = 1;
      }
    }
  }
  const results = folderExists && !anyPreview ? await inspectRoot(root) : [];
  for (const result of results) {
    show(result);
    if (result.status === "ERROR") {
      await captureError(result.reason ?? "Falha desconhecida na inspeção", {
        stage: "inspection",
        imageId: path.basename(result.jobDir),
        // Sem ID confiável da publicação: não inventar destino nem sincronizar com Supabase.
      });
    }
  }
  if (!anyPreview) {
    const count = (status: InspectionResult["status"]) => results.filter((r) => r.status === status).length;
    console.log(`\nResumo: ${count("OK")} válidos, ${count("PENDING")} aguardando, ${count("ERROR")} com erro (${results.length} trabalho(s)).`);
    if (!results.length) console.log("Nenhum trabalho encontrado. Esperado: AAAA-MM-DD/<image_id>/manifest.json + ready.json + ZIP V5.");
    if (count("ERROR")) process.exitCode = 1;
  }
  if (session) {
    console.log("[CHROME] Feche a janela do Chrome para encerrar.");
    await new Promise<void>(resolve => session.context.once("close", () => resolve()));
  }
} catch (error) {
  try {
    const record = await captureError(error, { stage: "runtime" });
    console.error(record.code === "CHROME_PROFILE_IN_USE" ? "Erro ao iniciar o Chrome:" : "Erro na execução:", record.code, "-", record.description);
  } catch {
    // A falha do registrador não deve resultar em falso sucesso.
    console.error("Erro na execução; falha adicional ao gravar log local.");
  }
  process.exitCode = 1;
}
