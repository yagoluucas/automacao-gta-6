import type { Page } from "playwright-core";
import { pauseAfterInteraction } from "../../browser/interaction-delay.ts";
import type { InstagramDraft } from "../../publication/instagram-draft.ts";

/** Prepara a mídia no Post assistant do INSSIST e para antes de publicar. */
export async function previewInstagram(
  instagramPage: Page,
  draft: InstagramDraft,
  timeout: number,
): Promise<Page> {
  await instagramPage.bringToFront();
  console.log("[INSTAGRAM] Aba do Instagram selecionada.");
  await pauseAfterInteraction(instagramPage);

  const panel = instagramPage.locator('[data-embed-panel-body="true"]');
  await panel.waitFor({ state: "visible", timeout });
  await panel.hover({ timeout });
  await pauseAfterInteraction(instagramPage);

  const assistant = instagramPage.locator('[data-embed-panel-item-button="true"]')
    .filter({ hasText: "Post assistant" }).first();
  await assistant.click({ timeout });
  console.log("[INSTAGRAM] Post assistant aberto.");
  await pauseAfterInteraction(instagramPage);

  const addFiles = instagramPage.locator(".LaterUploader").first();
  await addFiles.waitFor({ state: "visible", timeout });
  const fileChooser = instagramPage.waitForEvent("filechooser", { timeout });
  await addFiles.click({ timeout });
  await pauseAfterInteraction(instagramPage);
  await (await fileChooser).setFiles(draft.mediaPath);
  console.log("[INSTAGRAM] Mídia local selecionada.");
  await pauseAfterInteraction(instagramPage);

  const caption = instagramPage.locator('textarea[placeholder="Write a caption..."]').first();
  await caption.waitFor({ state: "visible", timeout });
  await caption.fill(draft.caption, { timeout });
  await pauseAfterInteraction(instagramPage);

  const publishName = draft.mediaKind === "video" ? "Publish Video" : "Publish Photo";
  const publish = instagramPage.getByRole("button", { name: publishName, exact: true }).first();
  await publish.waitFor({ state: "visible", timeout });
  // Publicação futura: await publish.click({ timeout });
  console.log(`[INSTAGRAM] Legenda preenchida. Botão ${publishName} localizado para revisão manual; nenhum clique foi feito.`);
  return instagramPage;
}
