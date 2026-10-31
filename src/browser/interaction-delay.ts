import type { Page } from "playwright-core";

/** Pausa entre ações de interface; pode ser usada pelos fluxos das outras redes. */
export async function pauseAfterInteraction(page: Page): Promise<void> {
  await page.waitForTimeout(5000 + Math.floor(Math.random() * 5001));
}
