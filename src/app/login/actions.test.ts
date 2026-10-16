import { afterAll, expect, mock, test } from "bun:test";

const redirects: string[] = [];
mock.module("next/navigation", () => ({
  redirect: (to: string) => {
    redirects.push(to);
    throw new Error("NEXT_REDIRECT");
  },
}));
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

process.env.APP_PASSWORD = "segredo";
const { login } = await import("./actions");
afterAll(() => {
  delete process.env.APP_PASSWORD;
});

test("login volta para o painel", async () => {
  await expect(login("segredo", "/")).rejects.toThrow("NEXT_REDIRECT");
  expect(redirects).toEqual(["/"]);
});
