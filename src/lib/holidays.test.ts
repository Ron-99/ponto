import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Client, createClient } from "@libsql/client";

const realServer = await import("next/server");
mock.module("next/server", () => ({ ...realServer, connection: async () => {} }));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ponto-feriados-"));
process.env.PONTO_DB = path.join(dir, "unused.db");

const db = await import("./db");
const { syncNationalHolidays } = await import("./holidays");
const { loadBank } = await import("./data");

const globalForDb = globalThis as unknown as {
  pontoDb?: Promise<Client>;
  pontoHolidayFailures?: Map<number, number>;
};

const API = "https://brasilapi.com.br/api/feriados/v1";
const TIRADENTES = { date: "2026-04-21", name: "Tiradentes", type: "national" };
const NATAL = { date: "2026-12-25", name: "Natal", type: "national" };

type Reply = unknown | ((url: string, init?: RequestInit) => Promise<Response>);
let calls: string[] = [];
const realFetch = globalThis.fetch;

/** Substitui o fetch: cada ano devolve o JSON indicado (ou uma função que responde). */
function fakeApi(byYear: Record<string, Reply>) {
  calls = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const reply = byYear[url.split("/").at(-1) ?? ""] ?? [];
    if (typeof reply === "function") return reply(url, init);
    return new Response(JSON.stringify(reply), { status: 200 });
  }) as typeof fetch;
}

let count = 0;
beforeEach(() => {
  process.env.PONTO_DB = path.join(dir, `test-${count++}.db`);
  globalForDb.pontoDb = undefined;
  globalForDb.pontoHolidayFailures?.clear();
  setSystemTime(new Date("2026-10-16T15:00:00Z"));
});

afterEach(() => {
  globalThis.fetch = realFetch;
  setSystemTime();
});

const overrideOn = async (date: string) => (await db.listOverrides()).find((o) => o.date === date);
const synced = async (year: number) => (await db.syncedHolidayYears()).includes(year);

describe("importação de feriados", () => {
  test("carregar o banco importa os feriados dos anos do banco", async () => {
    await db.saveSettings({ dailyMinutes: 480, startDate: "2025-06-01" });
    fakeApi({
      "2025": [{ date: "2025-12-25", name: "Natal", type: "national" }],
      "2026": [TIRADENTES],
    });
    const { days } = await loadBank();
    expect(calls.sort()).toEqual([`${API}/2025`, `${API}/2026`]);
    const day = days.find((d) => d.date === "2026-04-21");
    expect(day?.override).toMatchObject({ kind: "feriado", note: "Tiradentes" });
    expect(day?.balance).toBe(0);
  });

  test("linhas e marca do ano gravam juntas", async () => {
    fakeApi({ "2026": [TIRADENTES] });
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    expect(await synced(2026)).toBe(true);

    // Um trigger aborta o segundo insert: o primeiro e a marca do ano precisam ser desfeitos.
    const raw = createClient({ url: `file:${process.env.PONTO_DB}` });
    await raw.execute(`CREATE TRIGGER quebra BEFORE INSERT ON day_overrides
      WHEN NEW.date = '2025-05-01' BEGIN SELECT RAISE(ABORT, 'quebrado'); END`);
    await expect(
      db.saveHolidays(2025, [
        { date: "2025-04-21", name: "Tiradentes" },
        { date: "2025-05-01", name: "Dia do trabalho" },
      ]),
    ).rejects.toThrow();
    expect(await overrideOn("2025-04-21")).toBeUndefined();
    expect(await synced(2025)).toBe(false);
  });

  test("ano sincronizado não chama a API", async () => {
    fakeApi({ "2026": [TIRADENTES] });
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    fakeApi({ "2026": [TIRADENTES] });
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    expect(calls).toHaveLength(0);
  });

  test("abono existente prevalece", async () => {
    await db.setOverride("2026-04-21", "folga", "ponte");
    fakeApi({ "2026": [TIRADENTES] });
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    expect(await overrideOn("2026-04-21")).toMatchObject({ kind: "folga", note: "ponte" });
  });

  test("feriado removido não volta", async () => {
    fakeApi({ "2026": [TIRADENTES] });
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    await db.setOverride("2026-04-21", null);
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    expect(await overrideOn("2026-04-21")).toBeUndefined();
  });

  test("ignora datas inválidas ou de outro ano", async () => {
    fakeApi({
      "2026": [
        TIRADENTES,
        { date: "2026-4-21", name: "sem zero" },
        { date: "21/04/2026", name: "formato br" },
        { date: "2025-12-25", name: "ano anterior" },
      ],
    });
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    const dates = (await db.listOverrides()).map((o) => o.date);
    expect(dates).toEqual(["2026-04-21"]);
  });

  test("importações simultâneas não duplicam", async () => {
    fakeApi({ "2026": [TIRADENTES, NATAL] });
    await Promise.all([
      syncNationalHolidays("2026-01-01", "2026-10-16"),
      syncNationalHolidays("2026-01-01", "2026-10-16"),
    ]);
    const dates = (await db.listOverrides()).map((o) => o.date);
    expect(dates).toEqual(["2026-04-21", "2026-12-25"]);
    expect(await synced(2026)).toBe(true);
  });
});

describe("falhas da BrasilAPI", () => {
  const nothingSaved = async () => {
    expect(await db.listOverrides()).toEqual([]);
    expect(await synced(2026)).toBe(false);
  };

  test("resposta ruim não grava nada", async () => {
    const replies: Reply[] = [
      async () => new Response("erro", { status: 500 }),
      {},
      [],
      [{ date: "2026-04-21" }],
    ];
    for (const reply of replies) {
      globalForDb.pontoHolidayFailures?.clear();
      fakeApi({ "2026": reply });
      await expect(syncNationalHolidays("2026-01-01", "2026-10-16")).resolves.toBeUndefined();
      expect(calls).toHaveLength(1);
      await nothingSaved();
    }
  });

  test(
    "timeout de 3s",
    async () => {
      setSystemTime();
      fakeApi({
        "2026": (_url: string, init?: RequestInit) =>
          new Promise<Response>((_, reject) =>
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
          ),
      });
      const started = performance.now();
      await syncNationalHolidays("2026-01-01", "2026-10-16");
      const elapsed = performance.now() - started;
      expect(elapsed).toBeGreaterThan(2900);
      expect(elapsed).toBeLessThan(4000);
      await nothingSaved();
    },
    { timeout: 10_000 },
  );

  test("espera 1h depois de uma falha", async () => {
    const down = async () => new Response("erro", { status: 503 });
    fakeApi({ "2026": down });
    await syncNationalHolidays("2026-01-01", "2026-10-16");

    setSystemTime(new Date("2026-10-16T15:59:00Z"));
    fakeApi({ "2026": down });
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    expect(calls).toHaveLength(0);

    setSystemTime(new Date("2026-10-16T16:01:00Z"));
    fakeApi({ "2026": down });
    await syncNationalHolidays("2026-01-01", "2026-10-16");
    expect(calls).toHaveLength(1);
  });

  test("falha registra ano e motivo", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      const cases: [Reply, string][] = [
        [async () => Promise.reject(new DOMException("t", "TimeoutError")), "timeout"],
        [async () => new Response("erro", { status: 500 }), "status 500"],
        [{ nada: true }, "resposta inválida"],
      ];
      for (const [reply, reason] of cases) {
        globalForDb.pontoHolidayFailures?.clear();
        logged.mockClear();
        fakeApi({ "2026": reply });
        await syncNationalHolidays("2026-01-01", "2026-10-16");
        expect(logged).toHaveBeenCalledTimes(1);
        const message = logged.mock.calls[0].join(" ");
        expect(message).toContain("2026");
        expect(message).toContain(reason);
      }
    } finally {
      logged.mockRestore();
    }
  });

  test("carregar o banco funciona com a API fora", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => {});
    try {
      await db.saveSettings({ dailyMinutes: 480, startDate: "2026-10-12" });
      await db.setOverride("2026-10-12", "feriado", "Aparecida");
      fakeApi({ "2026": async () => new Response("erro", { status: 500 }) });
      const { days } = await loadBank();
      expect(days.map((d) => d.date)).toEqual([
        "2026-10-12",
        "2026-10-13",
        "2026-10-14",
        "2026-10-15",
        "2026-10-16",
      ]);
      expect(days[0].override).toMatchObject({ kind: "feriado", note: "Aparecida" });
    } finally {
      logged.mockRestore();
    }
  });
});
