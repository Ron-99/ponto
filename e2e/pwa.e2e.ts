/**
 * Testes de borda do PWA contra o build de produção. Rode `bun run build` antes:
 *   bun run build && bun test ./e2e/pwa.e2e.ts
 * Sobe `next start` com APP_PASSWORD e um banco temporário; o teste de layout usa o Chrome
 * headless (CHROME_PATH ou o caminho padrão do Windows).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import type { Subprocess } from "bun";

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = "e2e-senha";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ponto-e2e-"));

let server: Subprocess;

beforeAll(async () => {
  server = Bun.spawn(["node", "node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: { ...process.env, APP_PASSWORD: PASSWORD, PONTO_DB: path.join(tmp, "e2e.db") },
    stdout: "ignore",
    stderr: "inherit",
  });
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${BASE}/login`);
      return;
    } catch {
      await Bun.sleep(200);
    }
  }
  throw new Error("next start não respondeu");
}, 30_000);

afterAll(() => {
  server?.kill();
});

const get = (pathname: string) => fetch(`${BASE}${pathname}`, { redirect: "manual" });

/** Largura e altura do cabeçalho IHDR de um PNG. */
const pngSize = (bytes: ArrayBuffer) => {
  const view = new DataView(bytes);
  return `${view.getUint32(16)}x${view.getUint32(20)}`;
};

describe("PWA", () => {
  test("manifest é servido sem sessão", async () => {
    const response = await get("/manifest.webmanifest");
    expect(response.status).toBe(200);
    const m = await response.json();
    expect(m).toMatchObject({
      name: "Ponto · Banco de horas",
      short_name: "Ponto",
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
    for (const icon of m.icons) expect((await get(icon.src)).status).toBe(200);
    expect((await get("/apple-icon.png")).status).toBe(200);
  });

  test("ícones do manifest existem com o tamanho declarado", async () => {
    const { icons } = await (await get("/manifest.webmanifest")).json();
    const sizes = icons.map((i: { sizes: string }) => i.sizes).sort();
    expect(sizes).toEqual(["192x192", "512x512"]);
    for (const icon of icons) {
      expect(icon.type).toBe("image/png");
      const response = await get(icon.src);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(pngSize(await response.arrayBuffer())).toBe(icon.sizes);
    }
  });

  test("painel continua exigindo sessão", async () => {
    for (const pathname of ["/", "/relatorio"]) {
      const response = await get(pathname);
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location") ?? "", BASE).pathname).toBe("/login");
    }
  });

  test("html anuncia manifest e ícone da apple", async () => {
    const html = await (await get("/login")).text();
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest"');
    expect(html).toMatch(
      /<link rel="apple-touch-icon" href="\/apple-icon\.png[^"]*"[^>]*sizes="180x180"/,
    );
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Ponto"/>');
    const icon = await get("/apple-icon.png");
    expect(icon.headers.get("content-type")).toBe("image/png");
    expect(pngSize(await icon.arrayBuffer())).toBe("180x180");
  });

  test("botão bater ponto aparece sem rolar", async () => {
    process.env.APP_PASSWORD = PASSWORD;
    const { sessionToken } = await import("../src/lib/auth");
    const chrome =
      process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
    const browser = Bun.spawn(
      [
        chrome,
        "--headless=new",
        "--remote-debugging-port=9333",
        `--user-data-dir=${path.join(tmp, "chrome")}`,
        "about:blank",
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
    try {
      const bottom = await withPage(async (send) => {
        await send("Emulation.setDeviceMetricsOverride", {
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          mobile: true,
        });
        await send("Network.setCookie", {
          name: "ponto_session",
          value: sessionToken(),
          url: BASE,
        });
        await send("Page.navigate", { url: `${BASE}/` });
        for (let i = 0; i < 50; i++) {
          const { result } = await send("Runtime.evaluate", {
            expression: `(() => {
                const b = [...document.querySelectorAll("button")]
                  .find((el) => el.textContent.includes("Bater ponto"));
                return b ? b.getBoundingClientRect().bottom : null;
              })()`,
            returnByValue: true,
          });
          if (typeof result.value === "number") return result.value as number;
          await Bun.sleep(200);
        }
        return null;
      });
      expect(bottom).not.toBeNull();
      expect(bottom as number).toBeLessThanOrEqual(844);
    } finally {
      browser.kill();
      await browser.exited;
    }
  }, 30_000);

  test("gráfico do saldo cabe em 360px", async () => {
    process.env.APP_PASSWORD = PASSWORD;
    const { sessionToken } = await import("../src/lib/auth");
    // Banco de 10 dias: uma requisição autenticada cria as tabelas, depois o teste grava o início.
    await fetch(`${BASE}/`, { headers: { cookie: `ponto_session=${sessionToken()}` } });
    const start = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
    );
    const client = createClient({ url: `file:${path.join(tmp, "e2e.db")}` });
    await client.execute({
      sql: "INSERT INTO settings (key, value) VALUES ('start_date', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      args: [start],
    });
    client.close();

    const chrome =
      process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
    const browser = Bun.spawn(
      [
        chrome,
        "--headless=new",
        "--remote-debugging-port=9333",
        `--user-data-dir=${path.join(tmp, "chrome-grafico")}`,
        "about:blank",
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
    try {
      const chart = await withPage(async (send) => {
        await send("Emulation.setDeviceMetricsOverride", {
          width: 360,
          height: 800,
          deviceScaleFactor: 3,
          mobile: true,
        });
        await send("Network.setCookie", {
          name: "ponto_session",
          value: sessionToken(),
          url: BASE,
        });
        await send("Page.navigate", { url: `${BASE}/` });
        for (let i = 0; i < 50; i++) {
          const { result } = await send("Runtime.evaluate", {
            expression: `(() => {
                const title = [...document.querySelectorAll("[data-slot=card-title]")]
                  .find((el) => el.textContent === "Saldo nas últimas 8 semanas");
                const card = title?.closest("[data-slot=card]");
                const svg = card?.querySelector("svg[role=img]");
                if (!svg) return null;
                return {
                  label: svg.getAttribute("aria-label"),
                  svgWidth: svg.getBoundingClientRect().width,
                  cardWidth: card.getBoundingClientRect().width,
                  scrollWidth: document.documentElement.scrollWidth,
                };
              })()`,
            returnByValue: true,
          });
          if (result.value) {
            return result.value as {
              label: string;
              svgWidth: number;
              cardWidth: number;
              scrollWidth: number;
            };
          }
          await Bun.sleep(200);
        }
        return null;
      });
      expect(chart).not.toBeNull();
      expect(chart?.label).toMatch(/^(Subiu|Caiu|Igual)/);
      expect(chart?.scrollWidth).toBeLessThanOrEqual(360);
      expect(chart?.svgWidth).toBeLessThanOrEqual(chart?.cardWidth ?? 0);
    } finally {
      browser.kill();
      await browser.exited;
    }
  }, 30_000);
});

type Send = (method: string, params?: object) => Promise<{ result: { value: unknown } }>;

/** Conecta no primeiro alvo de página do Chrome via DevTools Protocol. */
async function withPage<T>(run: (send: Send) => Promise<T>): Promise<T> {
  let targets: { type: string; webSocketDebuggerUrl: string }[] = [];
  for (let i = 0; i < 50 && !targets.some((t) => t.type === "page"); i++) {
    targets = await fetch("http://127.0.0.1:9333/json/list")
      .then((r) => r.json())
      .catch(() => []);
    if (!targets.some((t) => t.type === "page")) await Bun.sleep(200);
  }
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("Chrome headless não abriu uma página");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map<number, (value: unknown) => void>();
  ws.onmessage = (event) => {
    const message = JSON.parse(String(event.data));
    pending.get(message.id)?.(message.result);
  };
  const send: Send = (method, params = {}) =>
    new Promise((resolve) => {
      pending.set(++id, resolve as (value: unknown) => void);
      ws.send(JSON.stringify({ id, method, params }));
    });
  try {
    return await run(send);
  } finally {
    ws.close();
  }
}
