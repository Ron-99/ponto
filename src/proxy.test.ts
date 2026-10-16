import { afterAll, beforeAll, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

afterAll(() => {
  delete process.env.APP_PASSWORD;
});

beforeAll(() => {
  process.env.APP_PASSWORD = "segredo";
});

const visit = (pathname: string) => proxy(new NextRequest(`http://localhost${pathname}`));

test("arquivos do PWA são públicos", () => {
  for (const pathname of [
    "/manifest.webmanifest",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/apple-icon.png",
  ]) {
    const response = visit(pathname);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  }
});

test("páginas continuam exigindo sessão", () => {
  for (const pathname of ["/", "/relatorio"]) {
    const response = visit(pathname);
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
  }
});

test("exportação exige sessão", () => {
  const response = visit("/relatorio/csv?periodo=mes&ref=2026-10-05");
  expect(response.status).toBe(307);
  const location = new URL(response.headers.get("location") ?? "");
  expect(location.pathname).toBe("/login");
  expect(location.searchParams.get("next")).toBe("/relatorio/csv?periodo=mes&ref=2026-10-05");
});
