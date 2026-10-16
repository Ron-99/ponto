import { beforeEach, describe, expect, mock, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

mock.module("next/cache", () => ({ refresh: () => {} }));
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

process.env.PONTO_DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ponto-")), "actions.db");
delete process.env.APP_PASSWORD;

const { setDayOverride } = await import("./actions");
const db = await import("@/lib/db");

// 2026-10-12 é segunda-feira; 2026-10-17 é sábado.
const MON = "2026-10-12";
const SAT = "2026-10-17";

const overrideOn = async (date: string) => (await db.listOverrides()).find((o) => o.date === date);

beforeEach(async () => {
  await db.setOverride(MON, null);
  await db.setOverride(SAT, null);
  await db.saveSettings({ dailyMinutes: 480, startDate: null });
});

describe("setDayOverride com horas abonadas", () => {
  test("registra abono parcial", async () => {
    const result = await setDayOverride(MON, "atestado", "02:00");
    expect(result).toEqual({ ok: true, message: "Atestado de 02:00 registrado." });
    expect((await overrideOn(MON))?.minutes).toBe(120);
  });

  test("horas vazias abonam o dia inteiro", async () => {
    const result = await setDayOverride(MON, "atestado", "");
    expect(result).toEqual({ ok: true, message: "Dia marcado como atestado." });
    const row = await overrideOn(MON);
    expect(row?.kind).toBe("atestado");
    expect(row?.minutes).toBeNull();
  });

  test("recusa horas abonadas inválidas", async () => {
    for (const hours of ["2:0", "abc", "00:00"]) {
      expect(await setDayOverride(MON, "atestado", hours)).toEqual({
        ok: false,
        error: "Horas abonadas devem estar no formato HH:MM.",
      });
    }
    expect(await overrideOn(MON)).toBeUndefined();
  });

  test("recusa abono parcial maior ou igual à jornada", async () => {
    for (const hours of ["08:00", "09:00"]) {
      expect(await setDayOverride(MON, "folga", hours)).toEqual({
        ok: false,
        error:
          "Abono parcial deve ser menor que a jornada de 08:00. Para o dia todo, deixe as horas em branco.",
      });
    }
    expect(await overrideOn(MON)).toBeUndefined();
  });

  test("recusa abono parcial no fim de semana", async () => {
    expect(await setDayOverride(SAT, "folga", "02:00")).toEqual({
      ok: false,
      error: "Fim de semana já tem meta de 0h.",
    });
    expect(await overrideOn(SAT)).toBeUndefined();
  });

  test("parcial vira dia inteiro", async () => {
    await setDayOverride(MON, "atestado", "02:00");
    await setDayOverride(MON, "atestado", "");
    const rows = (await db.listOverrides()).filter((o) => o.date === MON);
    expect(rows).toHaveLength(1);
    expect(rows[0].minutes).toBeNull();
  });

  test("dia normal remove abono parcial", async () => {
    await setDayOverride(MON, "atestado", "02:00");
    await setDayOverride(MON, null);
    expect(await overrideOn(MON)).toBeUndefined();
  });
});
