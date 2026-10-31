import type { BrowserContext, Page } from "playwright-core";
import type { YouTubeShortDraft } from "../../publication/youtube-short-drafts.ts";

export type YouTubePreviewConfig = {
  navigationTimeoutMs: number;
  uiSettleMs: number;
};

export function readYouTubePreviewConfig(env: NodeJS.ProcessEnv): YouTubePreviewConfig {
  const parse = (name: string, defaultValue: number, max: number) => {
    const raw = env[name];
    if (raw === undefined || raw.trim() === "") return defaultValue;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(name + " deve ser um inteiro entre 0 e " + max);
    return value;
  };
  return {
    navigationTimeoutMs: parse("BOT_NAVIGATION_TIMEOUT_MS", 30000, 120000),
    uiSettleMs: parse("BOT_UI_SETTLE_MS", 2000, 15000),
  };
}

/**
 * Prepara exclusivamente um rascunho do YouTube Studio para inspeção humana.
 * Pode iniciar upload e criar um rascunho privado, mas NUNCA clica em
 * Próximo, Salvar ou Publicar. Não faz login, nem contorna verificações.
 */
export async function previewYouTubeShort(
  context: BrowserContext,
  draft: YouTubeShortDraft,
  config: YouTubePreviewConfig,
): Promise<Page> {
  const page = context.pages().find(p => {
    try { return new URL(p.url()).hostname.endsWith(".youtube.com"); }
    catch { return false; }
  }) ?? await context.newPage();
  await page.goto("https://studio.youtube.com/", {waitUntil:"domcontentloaded",timeout:config.navigationTimeoutMs});
  await page.bringToFront();
  const fileInput = page.locator('input[type="file"][accept*="video"], input[type="file"]');
  const create = page.getByRole("button", {name: /criar|create/i}).first();
  if (await create.isVisible({timeout:5000}).catch(()=>false)) {
    await create.click();
    const upload = page.getByText(/enviar vídeos|upload videos/i).first();
    if (await upload.isVisible({timeout:5000}).catch(()=>false)) await upload.click();
  }
  await fileInput.first().waitFor({state:"attached",timeout:config.navigationTimeoutMs});
  await fileInput.first().setInputFiles(draft.videoPath);
  await page.waitForTimeout(config.uiSettleMs);

  // YouTube Studio usa campos contenteditable para título e descrição.
  // Não avançar se a estrutura variar: falhar de modo seguro.
  const title = page.locator('ytcp-social-suggestions-textbox#title-textarea #textbox[contenteditable="true"], ytcp-video-metadata-editor #title-textarea #textbox[contenteditable="true"]').first();
  const description = page.locator('ytcp-social-suggestions-textbox#description-textarea #textbox[contenteditable="true"], ytcp-video-metadata-editor #description-textarea #textbox[contenteditable="true"]').first();
  await title.waitFor({state:"visible",timeout:config.navigationTimeoutMs});
  await title.fill(draft.title);
  await description.waitFor({state:"visible",timeout:config.navigationTimeoutMs});
  await description.fill(draft.caption);
  console.log("[YOUTUBE] Arquivo e texto preparados para revisão manual. Nenhuma publicação confirmada.");
  return page;
}
