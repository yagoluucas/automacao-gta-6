import type { Page } from "playwright-core";
import { pauseAfterInteraction } from "../../browser/interaction-delay.ts";
import type { TikTokDraft } from "../../publication/tiktok-draft.ts";

/** Prepara a publicação no TikTok Studio e para antes do botão Publicar. */
export async function previewTikTok(
  tiktokPage: Page,
  draft: TikTokDraft,
  timeout: number,
): Promise<Page> {
  await tiktokPage.bringToFront();
  console.log("[TIKTOK] Aba do TikTok selecionada.");
  await pauseAfterInteraction(tiktokPage);

  const uploadNav = tiktokPage.locator('button[data-key-interaction="nav_upload"]');
  await uploadNav.waitFor({ state: "visible", timeout });
  const destination = Promise.any([
    tiktokPage.waitForEvent("popup", { timeout }),
    tiktokPage.waitForURL(url => /(^|\.)tiktok\.com$/.test(url.hostname) && /upload/.test(url.pathname), { timeout })
      .then(() => tiktokPage),
  ]);
  await uploadNav.click({ timeout });
  await pauseAfterInteraction(tiktokPage);
  const uploadPage = await destination;
  await uploadPage.bringToFront();
  await pauseAfterInteraction(uploadPage);
  console.log("[TIKTOK] Tela de carregamento aberta.");

  const tab = draft.mediaKind === "video"
    ? uploadPage.getByRole("tab", { name: /^(Vídeos|Videos)$/i })
    : uploadPage.getByRole("tab", { name: /^(Fotos|Photos)$/i });
  await tab.waitFor({ state: "visible", timeout });
  if (await tab.getAttribute("aria-selected") !== "true") {
    await tab.click({ timeout });
    await pauseAfterInteraction(uploadPage);
  }

  const selectMedia = draft.mediaKind === "video"
    ? uploadPage.locator('[data-e2e="select_video_button"]')
    : uploadPage.getByRole("button", { name: /^(Selecionar fotos|Select photos)$/i });
  await selectMedia.waitFor({ state: "visible", timeout });
  const fileChooser = uploadPage.waitForEvent("filechooser", { timeout });
  await selectMedia.click({ timeout });
  await pauseAfterInteraction(uploadPage);
  await (await fileChooser).setFiles(draft.mediaPath);
  console.log("[TIKTOK] Mídia local selecionada.");
  await pauseAfterInteraction(uploadPage);

  const caption = uploadPage.locator('[contenteditable="true"][role="combobox"]').first();
  await caption.waitFor({ state: "visible", timeout });
  await caption.fill(draft.caption, { timeout });
  await pauseAfterInteraction(uploadPage);

  const publish = draft.mediaKind === "video"
    ? uploadPage.locator('[data-e2e="post_video_button"]')
    : uploadPage.getByRole("button", { name: /^(Publicar|Post)$/i }).last();
  await publish.waitFor({ state: "visible", timeout });
  // Publicação futura: await publish.click({ timeout });
  console.log("[TIKTOK] Legenda preenchida. Botão Publicar localizado para revisão manual; nenhum clique foi feito.");
  return uploadPage;
}
