import type { Page } from "playwright-core";
import { pauseAfterInteraction } from "../../browser/interaction-delay.ts";
import type { YouTubeShortDraft } from "../../publication/youtube-short-drafts.ts";

export type YouTubePreviewConfig = {
  navigationTimeoutMs: number;
};

export function readYouTubePreviewConfig(env: NodeJS.ProcessEnv): YouTubePreviewConfig {
  const raw = env.BOT_NAVIGATION_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === "") return { navigationTimeoutMs: 30000 };
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1000 || value > 120000) {
    throw new Error("BOT_NAVIGATION_TIMEOUT_MS deve ser um inteiro entre 1000 e 120000");
  }
  return { navigationTimeoutMs: value };
}

/**
 * Prepara o upload na aba do YouTube criada pela sessão do bot.
 * Seleciona Público, mas não aciona o botão Publicar.
 */
export async function previewYouTubeShort(
  youtubePage: Page,
  draft: YouTubeShortDraft,
  config: YouTubePreviewConfig,
): Promise<Page> {
  const timeout = config.navigationTimeoutMs;
  await youtubePage.bringToFront();
  console.log("[YOUTUBE] Aba do YouTube selecionada.");
  await pauseAfterInteraction(youtubePage);

  const create = youtubePage.getByRole("button", { name: /^(Criar|Create)$/i }).first();
  await create.click({ timeout });
  await pauseAfterInteraction(youtubePage);

  const upload = youtubePage.getByText(/^(Enviar vídeo|Enviar vídeos|Upload video|Upload videos)$/i).first();
  await upload.waitFor({ state: "visible", timeout });
  const studioDestination = Promise.any([
    youtubePage.waitForEvent("popup", { timeout }),
    youtubePage.waitForURL(/^https:\/\/studio\.youtube\.com\//, { timeout }).then(() => youtubePage),
  ]);
  await upload.click({ timeout });
  const studioPage = await studioDestination;
  await pauseAfterInteraction(youtubePage);
  await studioPage.waitForURL(/^https:\/\/studio\.youtube\.com\//, { timeout });
  await studioPage.bringToFront();
  console.log("[YOUTUBE] Envio de vídeo aberto no Studio.");
  await pauseAfterInteraction(studioPage);

  const selectFiles = studioPage.getByRole("button", { name: /^(Selecionar arquivos|Select files)$/i }).first();
  await selectFiles.waitFor({ state: "visible", timeout });
  const fileChooser = studioPage.waitForEvent("filechooser", { timeout });
  await selectFiles.click({ timeout });
  await pauseAfterInteraction(studioPage);
  await (await fileChooser).setFiles(draft.videoPath);
  console.log("[YOUTUBE] Arquivo MP4 selecionado.");
  await pauseAfterInteraction(studioPage);

  const title = studioPage.locator('ytcp-video-title #textbox[contenteditable="true"], #title-textarea #textbox[contenteditable="true"]').first();
  const description = studioPage.locator('ytcp-video-description #textbox[contenteditable="true"], #description-textarea #textbox[contenteditable="true"]').first();
  await title.waitFor({ state: "visible", timeout });
  await title.fill(draft.title, { timeout });
  await pauseAfterInteraction(studioPage);
  await description.waitFor({ state: "visible", timeout });
  await description.fill(draft.caption, { timeout });
  await pauseAfterInteraction(studioPage);

  const notForKids = studioPage.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
  await notForKids.click({ timeout });
  console.log("[YOUTUBE] Título, descrição e audiência preenchidos.");
  await pauseAfterInteraction(studioPage);

  const next = studioPage.getByRole("button", { name: /^(Avançar|Next)$/i }).first();
  for (let step = 0; step < 3; step++) {
    await next.click({ timeout });
    await pauseAfterInteraction(studioPage);
  }

  const publicVisibility = studioPage.locator('tp-yt-paper-radio-button[name="PUBLIC"]');
  await publicVisibility.click({ timeout });
  await pauseAfterInteraction(studioPage);

  const publish = studioPage.getByRole("button", { name: /^(Publicar|Publish)$/i }).first();
  await publish.waitFor({ state: "visible", timeout });
  console.log("[YOUTUBE] Público selecionado. Botão Publicar localizado para revisão manual; nenhum clique foi feito.");
  return studioPage;
}
