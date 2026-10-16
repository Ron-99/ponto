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

const { removeSchedule, saveSchedule, setDayOverride } = await import("./actions");
const db = await import("@/lib/db");
const { buildReport, SINCE_START } = await import("@/lib/hours");

const STANDARD = [0, 480, 480, 480, 480, 480, 0];

// 2026-10-12 é segunda-feira; 2026-10-17 é sábado.
const MON = "2026-10-12";
const SAT = "2026-10-17";

const overrideOn = async (date: string) => (await db.listOverrides()).find((o) => o.date === date);

beforeEach(async () => {
  await db.setOverride(MON, null);
  await db.setOverride(SAT, null);
  await db.saveSettings({ startDate: null });
  for (const s of await db.listSchedules()) await db.deleteSchedule(s.validFrom);
  await db.saveSchedule({ validFrom: SINCE_START, minutes: STANDARD });
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

describe("jornada por dia da semana", () => {
  const WED = "2026-10-14";
  const FRI = "2026-10-16";
  // Índices de getDay(): domingo primeiro.
  const LONG = ["00:00", "09:00", "09:00", "09:00", "09:00", "04:00", "00:00"];
  const minutesOf = async (validFrom: string) =>
    (await db.listSchedules()).find((s) => s.validFrom === validFrom)?.minutes;
  const targetOn = async (date: string) =>
    buildReport({
      startDate: date,
      punches: [],
      overrides: await db.listOverrides(),
      schedules: await db.listSchedules(),
      now: { date, minutes: 0 },
    })[0].target;

  test("salva jornada com data de início", async () => {
    expect(await saveSchedule({ validFrom: "2026-10-19", hours: LONG })).toEqual({
      ok: true,
      message: "Jornada salva a partir de 19/10/2026.",
    });
    expect(await minutesOf("2026-10-19")).toEqual([0, 540, 540, 540, 540, 240, 0]);
  });

  test("data vazia substitui desde o início", async () => {
    expect(await saveSchedule({ validFrom: "", hours: LONG })).toEqual({
      ok: true,
      message: "Jornada desde o início salva.",
    });
    const schedules = await db.listSchedules();
    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toEqual({
      validFrom: SINCE_START,
      minutes: [0, 540, 540, 540, 540, 240, 0],
    });
  });

  test("mesma data substitui", async () => {
    await saveSchedule({ validFrom: "2026-10-19", hours: LONG });
    const other = ["00:00", "07:00", "07:00", "07:00", "07:00", "07:00", "00:00"];
    await saveSchedule({ validFrom: "2026-10-19", hours: other });
    const rows = (await db.listSchedules()).filter((s) => s.validFrom === "2026-10-19");
    expect(rows).toHaveLength(1);
    expect(rows[0].minutes).toEqual([0, 420, 420, 420, 420, 420, 0]);
  });

  test("recusa jornada inválida", async () => {
    const withDay = (day: number, value: string) => LONG.map((h, i) => (i === day ? value : h));
    expect(await saveSchedule({ validFrom: "2026-10-19", hours: withDay(1, "9:0") })).toEqual({
      ok: false,
      error: "Jornada de segunda deve estar no formato HH:MM, até 24:00.",
    });
    expect(await saveSchedule({ validFrom: "2026-10-19", hours: withDay(6, "24:01") })).toEqual({
      ok: false,
      error: "Jornada de sábado deve estar no formato HH:MM, até 24:00.",
    });
    expect(await saveSchedule({ validFrom: "2026-13-01", hours: LONG })).toEqual({
      ok: false,
      error: "Data inválida.",
    });
    expect(await minutesOf("2026-10-19")).toBeUndefined();
    expect(await minutesOf("2026-13-01")).toBeUndefined();
    expect((await saveSchedule({ validFrom: "2026-10-19", hours: withDay(6, "24:00") })).ok).toBe(
      true,
    );
    expect((await minutesOf("2026-10-19"))?.[6]).toBe(1440);
  });

  test("recusa semana sem jornada", async () => {
    expect(await saveSchedule({ validFrom: "2026-10-19", hours: Array(7).fill("00:00") })).toEqual({
      ok: false,
      error: "Informe a jornada de pelo menos um dia.",
    });
    expect(await minutesOf("2026-10-19")).toBeUndefined();
  });

  test("remove jornada", async () => {
    await saveSchedule({ validFrom: "2026-10-19", hours: LONG });
    expect(await targetOn("2026-10-23")).toBe(240);
    expect(await removeSchedule("2026-10-19")).toEqual({
      ok: true,
      message: "Jornada de 19/10/2026 removida.",
    });
    expect(await minutesOf("2026-10-19")).toBeUndefined();
    expect(await targetOn("2026-10-23")).toBe(480);
  });

  test("não remove desde o início", async () => {
    expect(await removeSchedule(SINCE_START)).toEqual({
      ok: false,
      error: "A jornada desde o início não pode ser removida.",
    });
    expect(await minutesOf(SINCE_START)).toEqual(STANDARD);
  });

  test("jornada exige sessão", async () => {
    process.env.APP_PASSWORD = "segredo";
    try {
      expect(await saveSchedule({ validFrom: "2026-10-19", hours: LONG })).toEqual({
        ok: false,
        error: "Sessão expirada. Recarregue a página e entre de novo.",
      });
      expect(await removeSchedule(SINCE_START)).toEqual({
        ok: false,
        error: "Sessão expirada. Recarregue a página e entre de novo.",
      });
    } finally {
      delete process.env.APP_PASSWORD;
    }
    expect(await db.listSchedules()).toEqual([{ validFrom: SINCE_START, minutes: STANDARD }]);
  });

  test("abono parcial usa a jornada do dia", async () => {
    await saveSchedule({ validFrom: "", hours: LONG });
    expect(await setDayOverride(FRI, "folga", "04:00")).toEqual({
      ok: false,
      error:
        "Abono parcial deve ser menor que a jornada de 04:00. Para o dia todo, deixe as horas em branco.",
    });
    expect(await overrideOn(FRI)).toBeUndefined();
  });

  test("recusa abono parcial em dia sem jornada", async () => {
    await saveSchedule({
      validFrom: "",
      hours: ["00:00", "08:00", "08:00", "00:00", "08:00", "08:00", "00:00"],
    });
    expect(await setDayOverride(WED, "folga", "02:00")).toEqual({
      ok: false,
      error: "Este dia não tem jornada, a meta já é 0h.",
    });
    expect(await overrideOn(WED)).toBeUndefined();
  });

  test("abono parcial no sábado com jornada", async () => {
    await saveSchedule({
      validFrom: "",
      hours: ["00:00", "08:00", "08:00", "08:00", "08:00", "08:00", "04:00"],
    });
    expect((await setDayOverride(SAT, "folga", "01:00")).ok).toBe(true);
    expect((await overrideOn(SAT))?.minutes).toBe(60);
    expect(await targetOn(SAT)).toBe(180);
  });
});
