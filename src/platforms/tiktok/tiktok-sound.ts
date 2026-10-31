import { randomInt } from "node:crypto";
import type { Page } from "playwright-core";
import { pauseAfterInteraction } from "../../browser/interaction-delay.ts";

/** Escolhe uma faixa dos Favoritos; falha se a lista estiver vazia. */
export async function chooseFavoriteSound(page: Page, timeout: number): Promise<void> {
  const favorites = page.getByRole("tab", { name: /^(Favoritos|Favorites)$/i });
  await favorites.waitFor({ state: "visible", timeout });
  if (await favorites.getAttribute("aria-selected") !== "true") {
    await favorites.click({ timeout });
    await pauseAfterInteraction(page);
  }

  const panel = page.locator("#panel-favorites");
  await panel.waitFor({ state: "visible", timeout });
  const rows = panel.locator('[role="listitem"][data-item-id]');
  const count = await rows.count();
  if (count === 0) throw new Error("Nenhum som encontrado na aba Favoritos do TikTok.");
  const row = rows.nth(randomInt(count));
  const sound = row.locator(".MusicPanelMusicItem__info");
  await sound.click({ timeout });
  await pauseAfterInteraction(page);

  const use = row.locator("button.MusicPickerView__addButton").filter({ hasText: /^Use$/i });
  await use.waitFor({ state: "visible", timeout });
  await use.click({ timeout });
  await pauseAfterInteraction(page);
  console.log("[TIKTOK] Som dos Favoritos aplicado.");
}

export async function addPhotoSound(page: Page, timeout: number): Promise<void> {
  const addSound = page.getByRole("button", { name: /^(Adicionar som|Add sound)$/i });
  await addSound.waitFor({ state: "visible", timeout });
  await addSound.click({ timeout });
  await pauseAfterInteraction(page);
  await chooseFavoriteSound(page, timeout);
}

export async function addVideoSound(page: Page, timeout: number): Promise<void> {
  const sounds = page.locator('button[data-button-name="sounds"]');
  await sounds.waitFor({ state: "visible", timeout });
  await sounds.click({ timeout });
  await pauseAfterInteraction(page);
  await chooseFavoriteSound(page, timeout);

  const volume = page.locator("label.PropSettingSliderInput__numberInput input");
  await volume.waitFor({ state: "visible", timeout });
  await volume.fill("-27", { timeout });
  await pauseAfterInteraction(page);
  await volume.press("Tab", { timeout });
  await pauseAfterInteraction(page);

  const save = page.getByRole("button", { name: /^(Salvar|Save)$/i });
  await save.waitFor({ state: "visible", timeout });
  await save.click({ timeout });
  await pauseAfterInteraction(page);
  console.log("[TIKTOK] Volume do som definido em -27 dB e salvo.");
}
