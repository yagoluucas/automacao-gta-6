import path from "node:path";
import { stat } from "node:fs/promises";
import { startSocialBrowser } from "./browser/chrome-startup.ts";
import { captureError } from "./errors/handler.ts";
import { AppError } from "./errors/catalog.ts";
import { inspectRoot, type InspectionResult } from "./inspector.ts";
import { findYouTubeShortDrafts, selectYouTubeShortDraft } from "./publication/youtube-short-drafts.ts";
import { previewYouTubeShort, readYouTubePreviewConfig } from "./platforms/youtube/youtube-preview.ts";

function directoryFromArgs(args: string[]): string {
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Uso: npm run dev -- --dir <pasta> (ou npm run inspect -- --dir <pasta>)\nPadrão: PUBLICATIONS_DIR ou ../publicacoes\nO modo dev carrega .env e .env.local automaticamente.\nEste comando NÃO publica em redes sociais.");
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
  const youtubePreview = process.argv.includes("--youtube-preview");
  if (youtubePreview && !process.argv.includes("--chrome")) {
    throw new Error("Prévia do YouTube exige o modo Chrome.");
  }
  const idIndex = process.argv.indexOf("--image-id");
  const imageId = idIndex < 0 ? undefined : process.argv[idIndex + 1];
  if (youtubePreview && idIndex >= 0 && !imageId) throw new Error("Informe um UUID após --image-id.");
  const youtubeDrafts = youtubePreview ? await findYouTubeShortDrafts(root) : [];
  if (youtubePreview && youtubeDrafts.length === 0) {
    console.error("[YOUTUBE] Nenhum YOUTUBE.mp4 preparado em PUBLICATIONS_DIR/AAAA-MM-DD/<image_id>/.");
  }
  const draft = youtubePreview ? selectYouTubeShortDraft(youtubeDrafts, imageId) : undefined;
  const session = process.argv.includes("--chrome") ? await startSocialBrowser() : null;
  if (session) {
    console.log("[CHROME] Chrome aberto maximizado: Instagram, TikTok e YouTube.");
    if (session.navigationFailures.length) {
      console.warn("[CHROME] Abas com falha de carregamento:", session.navigationFailures.join(", "));
    }
  }
  console.log(youtubePreview
    ? `GTA 6 PIRA | Prévia YouTube | SEM PUBLICAR\nPasta: ${root}`
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
  if (youtubePreview) {
    if (!session) throw new Error("Prévia do YouTube exige o modo Chrome.");
    if (!folderExists) throw new Error("Diretório local não disponível para prévia.");
    if (!draft) throw new Error("Nenhum vídeo selecionado para a prévia do YouTube.");
    console.log("[YOUTUBE] Preparando rascunho para inspeção:", draft.publicationId);
    const youtubeTab = session.tabs.get("youtube");
    if (!youtubeTab) throw new Error("A aba do YouTube não foi aberta.");
    await previewYouTubeShort(youtubeTab, draft, readYouTubePreviewConfig(process.env));
  }
  const results = folderExists && !youtubePreview ? await inspectRoot(root) : [];
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
  if (!youtubePreview) {
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
