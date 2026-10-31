import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSocialLinks } from "../src/browser/chrome-startup.ts";

test("abre as três redes usando links oficiais padrão", () => {
  const links = resolveSocialLinks({});
  assert.deepEqual(links.map(item => item.platform), ["instagram", "tiktok", "youtube"]);
  assert.equal(links.length, 3);
  assert.ok(links.every(item => item.url.startsWith("https://")));
});

test("usa links individuais do .env", () => {
  const links = resolveSocialLinks({
    LINK_INSTAGRAM: "https://www.instagram.com/",
    LINK_TIKTOK: "https://www.tiktok.com/pt-BR/",
    LINK_YOUTUBE: "https://www.youtube.com/",
  });
  assert.equal(links[1]?.url, "https://www.tiktok.com/pt-BR/");
});

test("rejeita URLs Markdown, HTTP e destinos de terceiros", () => {
  for (const bad of [
    "[https://www.instagram.com/](https://www.instagram.com/)",
    "http://www.instagram.com/",
    "https://instagram.com.evil.test/",
    "https://user:pass@www.instagram.com/"
  ]) {
    assert.throws(() => resolveSocialLinks({ LINK_INSTAGRAM: bad }));
  }
});

test("usuários e senhas não fazem parte dos links nem da navegação", () => {
  const links = resolveSocialLinks({
    USER_INSTAGRAM: "pessoa",
    PASSWORD_INSTAGRAM: "segredo",
  });
  assert.ok(!JSON.stringify(links).includes("segredo"));
  assert.ok(!JSON.stringify(links).includes("pessoa"));
});
