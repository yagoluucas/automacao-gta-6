import path from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import type { Platform } from "../contracts.ts";

export interface SocialLink {
  readonly platform: Platform;
  readonly url: string;
}

const SOCIAL_LINKS = [
  { platform: "instagram", key: "LINK_INSTAGRAM", fallback: "https://www.instagram.com/", hosts: ["instagram.com", "www.instagram.com"] },
  { platform: "tiktok", key: "LINK_TIKTOK", fallback: "https://www.tiktok.com/pt-BR/", hosts: ["tiktok.com", "www.tiktok.com"] },
  { platform: "youtube", key: "LINK_YOUTUBE", fallback: "https://www.youtube.com/", hosts: ["youtube.com", "www.youtube.com"] },
] as const;

/**
 * Apenas LINK_* participa desta etapa. USER_* e PASSWORD_* NÃO são lidos.
 * Não permitir destinos externos nem links HTTP: o navegador exibirá sessões
 * autenticadas futuramente, portanto a origem precisa ser confiável.
 */
export function resolveSocialLinks(env: NodeJS.ProcessEnv): SocialLink[] {
  return SOCIAL_LINKS.map((item) => {
    const value = env[item.key]?.trim() || item.fallback;
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`Variável ${item.key} inválida: use apenas a URL HTTPS, sem colchetes ou Markdown.`);
    }
    if (parsed.protocol !== "https:" ||
        !item.hosts.some(host => host === parsed.hostname.toLowerCase()) ||
        parsed.username || parsed.password || parsed.port) {
      throw new Error(`Variável ${item.key} deve apontar para o site oficial HTTPS da rede.`);
    }
    return { platform: item.platform, url: parsed.href };
  });
}

export interface SocialBrowserSession {
  readonly context: BrowserContext;
  readonly tabs: ReadonlyMap<Platform, Page>;
  readonly navigationFailures: readonly Platform[];
}

/**
 * Uma janela real do Chrome maximizada (sem F11), com perfil próprio do bot:
 * o Chrome pessoal do usuário nunca é controlado nem sobrescrito.
 *
 * O perfil é local e ignorado pelo Git, para preservar sessões feitas
 * manualmente em execuções posteriores. Nenhuma senha é preenchida aqui.
 */
export async function startSocialBrowser(
  env: NodeJS.ProcessEnv = process.env,
  activePlatform: Platform = "youtube",
): Promise<SocialBrowserSession> {
  // Validar os três destinos ANTES de abrir uma janela.
  const links = resolveSocialLinks(env);
  const profileDir = path.resolve(process.cwd(), ".chrome-profile");
  await mkdir(profileDir, { recursive: true, mode: 0o700 });

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: null,
    args: ["--start-maximized", "--disable-background-mode"],
    ignoreDefaultArgs: ["--enable-automation"],
    acceptDownloads: false,
  });

  try {
    const blank = context.pages().find(page => page.url() === "about:blank");
    const tabs = [];
    const tabsByPlatform = new Map<Platform, Page>();
    for (const [index] of links.entries()) {
      const page = index === 0 && blank ? blank : await context.newPage();
      tabs.push(page);
      tabsByPlatform.set(links[index]!.platform, page);
    }
    const outcomes = await Promise.allSettled(
      tabs.map((page, index) => page!.goto(links[index]!.url, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      })),
    );
    await tabsByPlatform.get(activePlatform)!.bringToFront();
    return {
      context,
      tabs: tabsByPlatform,
      navigationFailures: outcomes.flatMap((result, index) =>
        result.status === "rejected" ? [links[index]!.platform] : []),
    };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}
