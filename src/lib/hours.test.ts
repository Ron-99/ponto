import { describe, expect, test } from "bun:test";
import {
  buildReport,
  closeTime,
  type DayOverride,
  formatDuration,
  groupByWeek,
  nextPunchType,
  overrideHoursValue,
  overrideTitle,
  type Punch,
  partialOverrideLabel,
  summarizeDay,
  targetDescription,
  targetFor,
  validateSequence,
} from "./hours";

let nextId = 1;
const punches = (date: string, ...items: string[]): Punch[] =>
  items.map((item, i) => ({
    id: nextId++,
    date,
    time: item,
    type: i % 2 === 0 ? "in" : "out",
    note: null,
  }));

// 2026-10-12 é segunda-feira.
const MON = "2026-10-12";
const TUE = "2026-10-13";
const WED = "2026-10-14";
const SAT = "2026-10-17";
// "Agora" num dia futuro: todos os dias testados já estão encerrados.
const past = { date: "2099-01-01", minutes: 0 };

describe("validateSequence", () => {
  test("aceita alternância começando por entrada", () => {
    expect(validateSequence(punches(MON, "08:00", "12:00", "13:00", "17:00"))).toBeNull();
  });
  test("rejeita duas entradas seguidas", () => {
    expect(
      validateSequence([
        { time: "08:00", type: "in" },
        { time: "09:00", type: "in" },
      ]),
    ).toContain("Duas entradas seguidas");
  });
  test("rejeita dia começando por saída", () => {
    expect(validateSequence([{ time: "08:00", type: "out" }])).toContain("começar com uma entrada");
  });
  test("rejeita horário duplicado", () => {
    expect(
      validateSequence([
        { time: "08:00", type: "in" },
        { time: "08:00", type: "out" },
      ]),
    ).toContain("Já existe");
  });
  test("valida pela ordem cronológica, não de inserção", () => {
    expect(
      validateSequence([
        { time: "12:00", type: "out" },
        { time: "08:00", type: "in" },
      ]),
    ).toBeNull();
  });
});

describe("nextPunchType", () => {
  test("sem batidas é entrada; depois alterna", () => {
    expect(nextPunchType([])).toBe("in");
    expect(nextPunchType(punches(MON, "08:00"))).toBe("out");
    expect(nextPunchType(punches(MON, "08:00", "12:00"))).toBe("in");
  });
});

describe("summarizeDay", () => {
  test("dia completo de 8h tem saldo zero", () => {
    const d = summarizeDay(MON, punches(MON, "08:00", "12:00", "13:00", "17:00"), null, 480, past);
    expect(d.worked).toBe(480);
    expect(d.balance).toBe(0);
    expect(d.status).toBe("ok");
  });

  test("hora extra e horas devidas", () => {
    expect(
      summarizeDay(MON, punches(MON, "08:00", "12:00", "13:00", "18:30"), null, 480, past).balance,
    ).toBe(90);
    expect(summarizeDay(MON, punches(MON, "09:00", "16:00"), null, 480, past).balance).toBe(-60);
  });

  test("dia passado com batida ímpar é incompleto e conta só pares", () => {
    const d = summarizeDay(MON, punches(MON, "08:00", "12:00", "13:00"), null, 480, past);
    expect(d.status).toBe("incompleto");
    expect(d.worked).toBe(240);
  });

  test("hoje com entrada aberta conta até agora", () => {
    const now = { date: MON, minutes: 15 * 60 };
    const d = summarizeDay(MON, punches(MON, "08:00", "12:00", "13:00"), null, 480, now);
    expect(d.status).toBe("em-andamento");
    expect(d.worked).toBe(240 + 120);
    expect(d.balance).toBe(-120);
    expect(d.bankDelta).toBe(0); // não penaliza o banco no meio do dia
  });

  test("hoje com excedente entra no banco", () => {
    const now = { date: MON, minutes: 19 * 60 };
    const d = summarizeDay(MON, punches(MON, "08:00", "12:00", "13:00"), null, 480, now);
    expect(d.bankDelta).toBe(120); // 4h + 6h = 10h
  });

  test("dia útil passado sem batidas é falta", () => {
    const d = summarizeDay(MON, [], null, 480, past);
    expect(d.status).toBe("falta");
    expect(d.balance).toBe(-480);
  });

  test("dia abonado tem meta zero", () => {
    const override: DayOverride = { date: MON, kind: "feriado", note: null };
    const d = summarizeDay(MON, [], override, 480, past);
    expect(d.target).toBe(0);
    expect(d.balance).toBe(0);
    expect(d.status).toBe("abonado");
  });

  test("trabalho no fim de semana é todo extra", () => {
    const d = summarizeDay(SAT, punches(SAT, "09:00", "11:00"), null, 480, past);
    expect(d.target).toBe(0);
    expect(d.balance).toBe(120);
  });

  test("sequência inválida não soma horas", () => {
    const bad: Punch[] = [
      { id: 1, date: MON, time: "08:00", type: "in", note: null },
      { id: 2, date: MON, time: "09:00", type: "in", note: null },
    ];
    const d = summarizeDay(MON, bad, null, 480, past);
    expect(d.status).toBe("inconsistente");
    expect(d.worked).toBe(0);
  });
});

describe("buildReport", () => {
  test("acumula saldo dia a dia e agrupa por semana", () => {
    const days = buildReport({
      startDate: MON,
      punches: [
        ...punches(MON, "08:00", "12:00", "13:00", "18:00"), // +60
        ...punches(TUE, "08:00", "12:00", "13:00", "16:30"), // -30
      ],
      overrides: [{ date: WED, kind: "folga", note: null }],
      dailyMinutes: 480,
      now: { date: WED, minutes: 10 * 60 },
    });
    expect(days.map((d) => d.accumulated)).toEqual([60, 30, 30]);
    const [week] = groupByWeek(days);
    expect(week.weekStart).toBe(MON);
    expect(week.worked).toBe(540 + 450);
    expect(week.balance).toBe(30);
  });

  test("início no futuro gera relatório vazio", () => {
    expect(
      buildReport({
        startDate: "2030-01-01",
        punches: [],
        overrides: [],
        dailyMinutes: 480,
        now: { date: MON, minutes: 0 },
      }),
    ).toEqual([]);
  });
});

test("formatDuration", () => {
  expect(formatDuration(90)).toBe("01:30");
  expect(formatDuration(90, true)).toBe("+01:30");
  expect(formatDuration(-485, true)).toBe("−08:05");
  expect(formatDuration(0, true)).toBe("00:00");
});

describe("abono parcial", () => {
  const partial = (date: string, minutes: number): DayOverride => ({
    date,
    kind: "atestado",
    note: null,
    minutes,
  });
  const full = (date: string): DayOverride => ({
    date,
    kind: "atestado",
    note: null,
    minutes: null,
  });

  test("abono parcial reduz a meta", () => {
    expect(targetFor(MON, partial(MON, 120), 480)).toBe(360);
    expect(summarizeDay(MON, [], partial(MON, 120), 480, past).target).toBe(360);
  });

  test("abono parcial nunca deixa meta negativa", () => {
    expect(targetFor(MON, partial(MON, 120), 120)).toBe(0);
    expect(targetFor(MON, partial(MON, 120), 60)).toBe(0);
  });

  test("abono parcial sem batidas é falta", () => {
    const d = summarizeDay(MON, [], partial(MON, 120), 480, past);
    expect(d.status).toBe("falta");
    expect(d.bankDelta).toBe(-360);
  });

  test("abono parcial com pares fechados é ok", () => {
    const d = summarizeDay(
      MON,
      punches(MON, "08:00", "12:00", "13:00", "15:00"),
      partial(MON, 120),
      480,
      past,
    );
    expect(d.status).toBe("ok");
    expect(d.balance).toBe(0);
  });

  test("abono de dia inteiro mantém meta zero", () => {
    const empty = summarizeDay(MON, [], full(MON), 480, past);
    expect(empty.target).toBe(0);
    expect(empty.status).toBe("abonado");
    const worked = summarizeDay(MON, punches(MON, "08:00", "10:00"), full(MON), 480, past);
    expect(worked.target).toBe(0);
    expect(worked.status).toBe("abonado");
  });

  test("saída para fechar usa meta reduzida", () => {
    const now = { date: MON, minutes: 9 * 60 };
    const d = summarizeDay(MON, punches(MON, "08:00"), partial(MON, 120), 480, now);
    expect(formatDuration(d.target)).toBe("06:00");
    expect(closeTime(d, now.minutes)).toBe("14:00");
  });

  test("descrição da meta do dia", () => {
    expect(targetDescription(summarizeDay(MON, [], partial(MON, 120), 480, past))).toBe(
      "Meta de 06:00 (atestado de 02:00)",
    );
    expect(targetDescription(summarizeDay(MON, [], full(MON), 480, past))).toBe(
      "Meta de 00:00 (dia abonado)",
    );
    expect(targetDescription(summarizeDay(MON, [], null, 480, past))).toBe("Meta de 08:00");
  });

  test("valor inicial das horas abonadas", () => {
    expect(overrideHoursValue(partial(MON, 120))).toBe("02:00");
    expect(overrideHoursValue(full(MON))).toBe("");
    expect(overrideHoursValue(null)).toBe("");
  });

  test("badge do abono parcial", () => {
    expect(partialOverrideLabel(partial(MON, 120))).toBe("Atestado 02:00");
    expect(partialOverrideLabel(full(MON))).toBeNull();
    expect(partialOverrideLabel(null)).toBeNull();
  });
});

test("título do abono mostra a observação", () => {
  expect(overrideTitle({ date: MON, kind: "feriado", note: "Tiradentes" })).toBe(
    "Abono do dia · Tiradentes",
  );
  expect(overrideTitle({ date: MON, kind: "folga", note: null })).toBe("Abono do dia");
  expect(overrideTitle(null)).toBe("Abono do dia");
});
