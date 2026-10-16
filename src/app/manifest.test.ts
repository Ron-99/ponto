import { expect, test } from "bun:test";
import manifest from "./manifest";

test("abre em tela cheia com o login dentro do escopo", () => {
  const m = manifest();
  expect(m.display).toBe("standalone");
  expect(m.scope).toBe("/");
  // O escopo "/" cobre o painel e o redirecionamento para o login.
  for (const page of ["/", "/login"]) expect(page.startsWith(m.scope ?? "")).toBe(true);
});
