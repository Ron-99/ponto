import { describe, expect, test } from "bun:test";
import {
  type BankCycle,
  balanceChart,
  balanceSeries,
  balanceTone,
  bankLabel,
  buildReport,
  closedCycles,
  closeTime,
  cltAlerts,
  cycleFor,
  cycleFormDefaults,
  cycleRows,
  type DayOverride,
  dueNotice,
  formatDuration,
  groupByWeek,
  nextPunchType,
  overrideHoursValue,
  overrideTitle,
  type Punch,
  partialOverrideLabel,
  remainingWeekTarget,
  SINCE_START,
  scheduleFormDefaults,
  scheduleRows,
  statusLabel,
  summarizeDay,
  targetDescription,
  targetFor,
  validateSequence,
  type WorkSchedule,
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
// Jornada padrão: 08:00 de segunda a sexta, desde o início.
const STANDARD: WorkSchedule[] = [
  { validFrom: SINCE_START, minutes: [0, 480, 480, 480, 480, 480, 0] },
];

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
    const d = summarizeDay(SAT, punches(SAT, "09:00", "11:00"), null, 0, past);
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
      schedules: STANDARD,
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
        schedules: STANDARD,
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

describe("alertas da CLT", () => {
  const BREAK = "A CLT pede pelo menos 1h acima de 6h.";
  const EXTRA = "A CLT permite até 2h por dia.";
  const REST = "A CLT pede pelo menos 11h.";
  const endOf = (date: string) => ({ date, minutes: 23 * 60 + 59 });
  const alertsOn = (
    today: string,
    startDate: string,
    list: Punch[],
    now: { date: string; minutes: number } = endOf(today),
  ) =>
    cltAlerts(
      buildReport({ startDate, punches: list, overrides: [], schedules: STANDARD, now }),
      today,
    );
  const typed = (date: string, ...items: [string, "in" | "out"][]): Punch[] =>
    items.map(([time, type]) => ({ id: nextId++, date, time, type, note: null }));

  test("alerta de intervalo curto", () => {
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "12:00", "12:30", "16:00"))).toEqual([
      `Intervalo de 00:30 numa jornada de 07:30. ${BREAK}`,
    ]);
    expect(
      alertsOn(TUE, TUE, punches(TUE, "08:00", "11:00", "11:20", "13:00", "13:40", "16:00")),
    ).toEqual([`Intervalo de 00:40 numa jornada de 07:00. ${BREAK}`]);
  });

  test("alerta sem intervalo", () => {
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "14:20"))).toEqual([
      `Sem intervalo numa jornada de 06:20. ${BREAK}`,
    ]);
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00"), { date: TUE, minutes: 14 * 60 + 30 })).toEqual(
      [`Sem intervalo numa jornada de 06:30. ${BREAK}`],
    );
  });

  test("intervalo de 1h não alerta", () => {
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "12:00", "13:00", "17:00"))).toEqual([]);
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "12:00", "12:59", "17:00"))).toEqual([
      `Intervalo de 00:59 numa jornada de 08:01. ${BREAK}`,
    ]);
  });

  test("jornada de até 6h não pede intervalo", () => {
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "11:00", "11:30", "14:30"))).toEqual([]);
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "11:00", "11:30", "14:31"))).toEqual([
      `Intervalo de 00:30 numa jornada de 06:01. ${BREAK}`,
    ]);
  });

  test("alerta de horas extras", () => {
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "12:00", "13:00", "19:30"))).toEqual([
      `02:30 de horas extras hoje. ${EXTRA}`,
    ]);
    expect(alertsOn(SAT, SAT, punches(SAT, "08:00", "10:31"))).toEqual([
      `02:31 de horas extras hoje. ${EXTRA}`,
    ]);
  });

  test("2h extras não alerta", () => {
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "12:00", "13:00", "19:00"))).toEqual([]);
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "12:00", "13:00", "19:01"))).toEqual([
      `02:01 de horas extras hoje. ${EXTRA}`,
    ]);
  });

  test("horas extras com entrada aberta", () => {
    const extras = (minutes: number) =>
      alertsOn(TUE, TUE, punches(TUE, "07:00"), { date: TUE, minutes }).filter((a) =>
        a.includes("horas extras"),
      );
    expect(extras(17 * 60)).toEqual([]);
    expect(extras(17 * 60 + 1)).toEqual([`02:01 de horas extras hoje. ${EXTRA}`]);
  });

  test("alerta de descanso curto", () => {
    const list = [...punches(MON, "13:00", "22:00"), ...punches(TUE, "07:30", "11:30")];
    expect(alertsOn(TUE, MON, list)).toEqual([
      `Descanso de 09:30 desde a saída de ontem às 22:00. ${REST}`,
    ]);
  });

  test("11h de descanso não alerta", () => {
    const at = (entry: string, exit: string) =>
      alertsOn(TUE, MON, [...punches(MON, "13:00", "22:00"), ...punches(TUE, entry, exit)]);
    expect(at("09:00", "13:00")).toEqual([]);
    expect(at("08:59", "12:59")).toEqual([
      `Descanso de 10:59 desde a saída de ontem às 22:00. ${REST}`,
    ]);
  });

  test("descanso sem saída válida ontem", () => {
    const today = punches(TUE, "06:00", "10:00");
    // Banco começou hoje: ontem não está nos dias.
    expect(alertsOn(TUE, TUE, [...punches(MON, "13:00", "22:00"), ...today])).toEqual([]);
    // Ontem sem batidas.
    expect(alertsOn(TUE, MON, today)).toEqual([]);
    // Ontem termina numa entrada (incompleto).
    expect(alertsOn(TUE, MON, [...punches(MON, "13:00", "22:00", "23:00"), ...today])).toEqual([]);
    // Ontem inconsistente, terminando numa saída.
    const bad = typed(MON, ["13:00", "in"], ["18:00", "out"], ["22:00", "out"]);
    expect(alertsOn(TUE, MON, [...bad, ...today])).toEqual([]);
  });

  test("descanso compara com ontem, não com o último dia com batidas", () => {
    const list = [...punches(MON, "15:00", "23:00"), ...punches(WED, "07:00", "11:00")];
    expect(alertsOn(WED, MON, list)).toEqual([]);
  });

  test("alertas em ordem", () => {
    const list = [
      ...punches(MON, "15:00", "23:00"),
      ...punches(TUE, "07:00", "12:00", "12:20", "18:00"),
    ];
    expect(alertsOn(TUE, MON, list)).toEqual([
      `Intervalo de 00:20 numa jornada de 10:40. ${BREAK}`,
      `02:40 de horas extras hoje. ${EXTRA}`,
      `Descanso de 08:00 desde a saída de ontem às 23:00. ${REST}`,
    ]);
  });

  test("dia inconsistente não alerta intervalo nem extras", () => {
    expect(alertsOn(TUE, TUE, typed(TUE, ["07:00", "in"], ["15:00", "in"]))).toEqual([]);
  });

  test("alertas não mudam o dia", () => {
    const list = [
      ...punches(MON, "15:00", "23:00"),
      ...punches(TUE, "07:00", "12:00", "12:20", "18:00"),
    ];
    const days = buildReport({
      startDate: MON,
      punches: list,
      overrides: [],
      schedules: STANDARD,
      now: endOf(TUE),
    });
    const copy = structuredClone(days);
    expect(cltAlerts(days, TUE)).toHaveLength(3);
    expect(days).toEqual(copy);
    expect(alertsOn(TUE, TUE, punches(TUE, "08:00", "12:00", "13:00", "17:00"))).toEqual([]);
  });
});

describe("gráfico do saldo", () => {
  const TODAY = "2026-10-16";
  const bank = (startDate: string, list: Punch[] = [], minutes = 23 * 60 + 59) =>
    buildReport({
      startDate,
      punches: list,
      overrides: [],
      schedules: STANDARD,
      now: { date: TODAY, minutes },
    });
  const at = (date: string, value: number) => ({ date, value });

  test("série das últimas 8 semanas", () => {
    const days = bank("2026-07-01");
    const { points } = balanceSeries(days);
    expect(points).toHaveLength(56);
    expect(points[0].date).toBe("2026-08-22");
    expect(points.at(-1)?.date).toBe(TODAY);
    const byDate = new Map(days.map((d) => [d.date, d.accumulated]));
    for (const p of points) expect(p.value).toBe(byDate.get(p.date) as number);
  });

  test("série começa no início do banco", () => {
    const { points } = balanceSeries(bank("2026-10-07"));
    expect(points).toHaveLength(10);
    expect(points[0].date).toBe("2026-10-07");
  });

  test("último ponto é o saldo do topo", () => {
    // Quinta +90; hoje (sexta) com entrada aberta às 08:00 e agora 10:00: balance −360, só o excedente conta.
    const days = bank(
      "2026-10-15",
      [...punches("2026-10-15", "08:00", "12:00", "13:00", "18:30"), ...punches(TODAY, "08:00")],
      10 * 60,
    );
    const today = days.at(-1);
    expect(today?.balance).toBeLessThan(0);
    const { points } = balanceSeries(days);
    expect(points.at(-1)?.value).toBe(90);
    expect(points.at(-1)?.value).toBe(days.at(-1)?.accumulated as number);
  });

  test("frase da variação", () => {
    const trend = (delta: number) =>
      balanceSeries([
        { ...bank(TODAY)[0], date: "2026-08-22", accumulated: 100 },
        { ...bank(TODAY)[0], date: TODAY, accumulated: 100 + delta },
      ]).trend;
    expect(trend(270)).toBe("Subiu 04:30 desde 22/08.");
    expect(trend(-135)).toBe("Caiu 02:15 desde 22/08.");
    expect(trend(0)).toBe("Igual a 22/08.");
  });

  test("gráfico sempre mostra o zero", () => {
    const chart = (...values: number[]) => {
      const c = balanceChart(values.map((v, i) => at(`2026-10-${String(10 + i)}`, v)));
      if (c.kind !== "chart") throw new Error("esperava gráfico");
      return c;
    };
    const positive = chart(30, 150, 270);
    expect(positive.zeroY).toBe(positive.height);
    const negative = chart(-30, -150, -270);
    expect(negative.zeroY).toBe(0);
    const crossing = chart(-60, 120, 270);
    expect(crossing.zeroY).toBeGreaterThan(0);
    expect(crossing.zeroY).toBeLessThan(crossing.height);
    expect(crossing.zeroY).toBeCloseTo((270 / 330) * crossing.height, 6);
  });

  test("rótulos dos eixos", () => {
    const c = balanceChart([at("2026-08-22", -60), at("2026-09-01", 0), at(TODAY, 270)]);
    if (c.kind !== "chart") throw new Error("esperava gráfico");
    expect(c.labels).toEqual({ top: "+04:30", bottom: "−01:00", start: "22/08", end: "hoje" });
    const positive = balanceChart([at("2026-08-22", 30), at(TODAY, 270)]);
    if (positive.kind !== "chart") throw new Error("esperava gráfico");
    expect(positive.labels).toMatchObject({ top: "+04:30", bottom: "00:00" });
  });

  test("trechos acima e abaixo do zero", () => {
    expect(balanceTone(30)).toBe("text-emerald-600 dark:text-emerald-400");
    expect(balanceTone(-30)).toBe("text-red-600 dark:text-red-400");
    const c = balanceChart([at("2026-10-12", 60), at("2026-10-13", -60), at("2026-10-14", 30)]);
    if (c.kind !== "chart") throw new Error("esperava gráfico");
    expect(c.segments.map((s) => s.tone)).toEqual([
      balanceTone(1),
      balanceTone(-1),
      balanceTone(1),
    ]);
    // Cada cruzamento termina um trecho e começa o seguinte exatamente no zero.
    for (let i = 0; i + 1 < c.segments.length; i++) {
      const end = c.segments[i].points.at(-1);
      const start = c.segments[i + 1].points[0];
      expect(end?.[1]).toBeCloseTo(c.zeroY, 6);
      expect(start).toEqual(end as [number, number]);
    }
  });

  test("gráfico precisa de dois dias", () => {
    expect(balanceChart([at(TODAY, 30)])).toEqual({
      kind: "empty",
      message: "O gráfico aparece a partir do segundo dia do banco.",
    });
  });

  test("descrição acessível do gráfico", () => {
    const base = bank(TODAY)[0];
    const series = balanceSeries([
      { ...base, date: "2026-08-22", accumulated: -180 },
      { ...base, date: TODAY, accumulated: 90 },
    ]);
    expect(series.label).toBe("Subiu 04:30 desde 22/08. Saldo de hoje: +01:30.");
  });
});

describe("jornada por dia da semana", () => {
  const LONG: WorkSchedule["minutes"] = [0, 540, 540, 540, 540, 240, 0];
  const week = (minutes: number[]): WorkSchedule[] => [{ validFrom: SINCE_START, minutes }];
  const dayIn = (
    schedules: WorkSchedule[],
    date: string,
    list: Punch[] = [],
    overrides: DayOverride[] = [],
  ) =>
    buildReport({
      startDate: date,
      punches: list,
      overrides,
      schedules,
      now: { date: "2026-10-31", minutes: 0 },
    })[0];
  const twoSchedules: WorkSchedule[] = [
    { validFrom: SINCE_START, minutes: [0, 480, 480, 480, 480, 480, 0] },
    { validFrom: "2026-10-19", minutes: LONG },
  ];

  test("meta pela jornada do dia da semana", () => {
    expect(dayIn(week(LONG), "2026-10-12").target).toBe(540);
    expect(dayIn(week(LONG), "2026-10-16").target).toBe(240);
  });

  test("sábado com jornada sem batidas é falta", () => {
    const d = dayIn(week([0, 480, 480, 480, 480, 480, 240]), "2026-10-10");
    expect(d.target).toBe(240);
    expect(d.status).toBe("falta");
    expect(d.bankDelta).toBe(-240);
  });

  test("dia sem jornada", () => {
    const noWednesday = week([0, 480, 480, 0, 480, 480, 0]);
    const sat = dayIn(noWednesday, "2026-10-17");
    const sun = dayIn(noWednesday, "2026-10-18");
    const wed = dayIn(noWednesday, "2026-10-14");
    for (const d of [sat, sun, wed]) expect(d.status).toBe("folga-semanal");
    expect(statusLabel(sat)).toBe("Fim de semana");
    expect(statusLabel(sun)).toBe("Fim de semana");
    expect(statusLabel(wed)).toBe("Sem jornada");
  });

  test("vigência não muda os dias anteriores", () => {
    const days = buildReport({
      startDate: "2026-10-12",
      punches: [],
      overrides: [],
      schedules: twoSchedules,
      now: { date: "2026-10-23", minutes: 0 },
    });
    const target = (date: string) => days.find((d) => d.date === date)?.target;
    expect(target("2026-10-16")).toBe(480);
    expect(target("2026-10-23")).toBe(240);
  });

  test("jornada em vigor na data", () => {
    const a = { validFrom: SINCE_START, minutes: [1, 1, 1, 1, 1, 1, 1] };
    const b = { validFrom: "2026-10-19", minutes: [2, 2, 2, 2, 2, 2, 2] };
    const c = { validFrom: "2026-11-02", minutes: [3, 3, 3, 3, 3, 3, 3] };
    const unordered = [c, a, b];
    const at = (date: string) =>
      buildReport({
        startDate: date,
        punches: [],
        overrides: [],
        schedules: unordered,
        now: { date, minutes: 0 },
      })[0].target;
    expect(at("2026-10-18")).toBe(1);
    expect(at("2026-10-19")).toBe(2);
    expect(at("2026-11-01")).toBe(2);
    expect(at("2026-11-02")).toBe(3);
  });

  test("meta dos dias que faltam na semana", () => {
    expect(remainingWeekTarget("2026-10-14", week(LONG))).toBe(780);
    const fridayOff = [
      ...week(LONG),
      { validFrom: "2026-10-16", minutes: [0, 540, 540, 540, 540, 0, 0] },
    ];
    expect(remainingWeekTarget("2026-10-14", fridayOff)).toBe(540);
  });

  test("abono usa a jornada do dia", () => {
    const fri = "2026-10-16";
    expect(dayIn(week(LONG), fri, [], [{ date: fri, kind: "folga", note: null }]).target).toBe(0);
    expect(
      dayIn(week(LONG), fri, [], [{ date: fri, kind: "atestado", note: null, minutes: 60 }]).target,
    ).toBe(180);
  });

  test("lista de jornadas", () => {
    expect(scheduleRows(twoSchedules)).toEqual([
      {
        validFrom: "2026-10-19",
        label: "A partir de 19/10/2026",
        days: ["09:00", "09:00", "09:00", "09:00", "04:00", "00:00", "00:00"],
        total: "40:00",
      },
      {
        validFrom: SINCE_START,
        label: "Desde o início",
        days: ["08:00", "08:00", "08:00", "08:00", "08:00", "00:00", "00:00"],
        total: "40:00",
      },
    ]);
  });

  test("formulário começa com a jornada em vigor hoje", () => {
    expect(scheduleFormDefaults(twoSchedules, "2026-10-16")).toEqual({
      validFrom: "2026-10-16",
      hours: ["00:00", "08:00", "08:00", "08:00", "08:00", "08:00", "00:00"],
    });
  });
});

describe("prazo de compensação", () => {
  const BASE: BankCycle = { validFrom: SINCE_START, months: 0 };
  // Sem jornada: todo minuto trabalhado é extra, e o acumulado é a soma dos minutos.
  const NO_SCHEDULE: WorkSchedule[] = [{ validFrom: SINCE_START, minutes: [0, 0, 0, 0, 0, 0, 0] }];
  const minutesOn = (date: string, minutes: number) =>
    punches(date, "08:00", formatDuration(8 * 60 + minutes));
  const bank = (startDate: string, list: Punch[], cycles: BankCycle[], today: string) =>
    buildReport({
      startDate,
      punches: list,
      overrides: [],
      schedules: NO_SCHEDULE,
      cycles,
      now: { date: today, minutes: 0 },
    });
  const accumulatedOn = (days: { date: string; accumulated: number }[], date: string) =>
    days.find((d) => d.date === date)?.accumulated;

  test("ciclo começa na data da regra", () => {
    const cycles = [BASE, { validFrom: "2026-09-01", months: 0 }];
    expect(cycleFor("2026-08-31", cycles)).toEqual({ start: SINCE_START, end: "2026-08-31" });
    expect(cycleFor("2026-09-01", cycles)).toEqual({ start: "2026-09-01", end: null });
  });

  test("ciclos contados a partir da data da regra", () => {
    const cycles = [BASE, { validFrom: "2026-01-31", months: 4 }];
    expect(cycleFor("2026-01-31", cycles)).toEqual({ start: "2026-01-31", end: "2026-05-30" });
    expect(cycleFor("2026-05-30", cycles)).toEqual({ start: "2026-01-31", end: "2026-05-30" });
    expect(cycleFor("2026-05-31", cycles)).toEqual({ start: "2026-05-31", end: "2026-09-29" });
    expect(cycleFor("2026-12-01", cycles)).toEqual({ start: "2026-09-30", end: "2027-01-30" });
    expect(cycleFor("2027-01-31", cycles).start).toBe("2027-01-31");
  });

  test("regra nova fecha o ciclo em andamento", () => {
    const cycles = [
      { validFrom: "2026-10-01", months: 6 },
      BASE,
      { validFrom: "2026-05-01", months: 4 },
    ];
    expect(cycleFor("2026-09-15", cycles)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(cycleFor("2026-10-01", cycles)).toEqual({ start: "2026-10-01", end: "2027-03-31" });
  });

  test("acumulado zera no início do ciclo", () => {
    const cycles = [BASE, { validFrom: "2026-05-01", months: 4 }];
    const days = bank(
      "2026-05-01",
      [...minutesOn("2026-08-31", 180), ...minutesOn("2026-09-01", 30)],
      cycles,
      "2026-09-02",
    );
    expect(accumulatedOn(days, "2026-08-31")).toBe(180);
    expect(accumulatedOn(days, "2026-09-01")).toBe(30);
    expect(closedCycles(days, cycles)).toEqual([
      { start: "2026-05-01", end: "2026-08-31", label: "01/05/2026 a 31/08/2026", closing: 180 },
    ]);
  });

  test("sem prazo o acumulado não zera", () => {
    const list = [
      ...punches(MON, "08:00", "18:00"),
      ...punches(WED, "08:00", "12:00"),
      ...punches(SAT, "09:00", "11:00"),
    ];
    const overrides: DayOverride[] = [{ date: TUE, kind: "folga", note: null }];
    const input = {
      startDate: "2026-10-05",
      punches: list,
      overrides,
      schedules: STANDARD,
      now: past,
    };
    for (const days of [buildReport(input), buildReport({ ...input, cycles: [BASE] })]) {
      let sum = 0;
      for (const d of days) {
        sum += d.bankDelta;
        expect(d.accumulated).toBe(sum);
      }
      expect(closedCycles(days, [BASE])).toEqual([]);
    }
  });

  test("banco começa no meio do ciclo", () => {
    const cycles = [BASE, { validFrom: "2026-05-01", months: 4 }];
    const days = bank("2026-06-15", minutesOn("2026-06-15", 45), cycles, "2026-09-02");
    expect(accumulatedOn(days, "2026-06-15")).toBe(45);
    expect(closedCycles(days, cycles).at(-1)).toEqual({
      start: "2026-06-15",
      end: "2026-08-31",
      label: "15/06/2026 a 31/08/2026",
      closing: 45,
    });
  });

  test("linha de vencimento pelo sinal do saldo", () => {
    const cycles = [BASE, { validFrom: "2026-09-01", months: 4 }];
    expect(dueNotice("2026-10-16", 330, cycles)).toBe(
      "+05:30 vencem em 31/12/2026 (daqui a 76 dias).",
    );
    expect(dueNotice("2026-10-16", -120, cycles)).toBe(
      "−02:00 a compensar até 31/12/2026 (daqui a 76 dias).",
    );
    expect(dueNotice("2026-10-16", 0, cycles)).toBe(
      "O ciclo fecha em 31/12/2026 (daqui a 76 dias).",
    );
  });

  test("vencimento amanhã e hoje", () => {
    const cycles = [BASE, { validFrom: "2026-09-01", months: 4 }];
    expect(dueNotice("2026-12-30", 330, cycles)).toBe("+05:30 vencem em 31/12/2026 (amanhã).");
    expect(dueNotice("2026-12-31", 330, cycles)).toBe("+05:30 vencem em 31/12/2026 (hoje).");
  });

  test("sem prazo não mostra vencimento", () => {
    expect(dueNotice("2026-10-16", 330, [BASE])).toBeNull();
    expect(dueNotice("2026-10-16", 330, [BASE, { validFrom: "2026-09-01", months: 0 }])).toBeNull();
  });

  test("regra futura antecipa o vencimento", () => {
    const future = { validFrom: "2026-11-01", months: 0 };
    const cycles = [BASE, { validFrom: "2026-09-01", months: 4 }, future];
    expect(dueNotice("2026-10-16", 330, cycles)).toBe(
      "+05:30 vencem em 31/10/2026 (daqui a 15 dias).",
    );
    expect(dueNotice("2026-10-16", 330, [BASE, future])).toBe(
      "+05:30 vencem em 31/10/2026 (daqui a 15 dias).",
    );
  });

  test("tendência desde o início do ciclo", () => {
    const cycles = [BASE, { validFrom: "2026-09-01", months: 0 }];
    const days = bank(
      "2026-08-25",
      [
        ...minutesOn("2026-08-26", 120),
        ...minutesOn("2026-09-01", 30),
        ...minutesOn("2026-09-02", 60),
      ],
      cycles,
      "2026-09-03",
    );
    expect(balanceSeries(days, "2026-09-01").trend).toBe("Subiu 01:00 desde 01/09.");
  });

  test("rótulo do banco no relatório", () => {
    expect(bankLabel("2026-05-01", "2026-09-01")).toBe("Banco do ciclo (desde 01/09/2026)");
    expect(bankLabel("2026-05-01", "2026-05-01")).toBe("Banco total (desde 01/05/2026)");
    expect(bankLabel("2026-05-01", SINCE_START)).toBe("Banco total (desde 01/05/2026)");
  });

  test("ciclos fechados do mais recente", () => {
    const cycles = [BASE, { validFrom: "2026-05-01", months: 2 }];
    const days = bank(
      "2026-05-01",
      [
        ...minutesOn("2026-06-30", 60),
        ...minutesOn("2026-07-01", 30),
        ...minutesOn("2026-08-31", 120),
        ...minutesOn("2026-09-14", 15),
      ],
      cycles,
      "2026-09-15",
    );
    expect(closedCycles(days, cycles)).toEqual([
      { start: "2026-07-01", end: "2026-08-31", label: "01/07/2026 a 31/08/2026", closing: 150 },
      { start: "2026-05-01", end: "2026-06-30", label: "01/05/2026 a 30/06/2026", closing: 60 },
    ]);
  });

  test("ciclo que fecha hoje não está fechado", () => {
    const cycles = [BASE, { validFrom: "2026-09-01", months: 1 }];
    const days = bank("2026-09-10", minutesOn("2026-09-15", 30), cycles, "2026-09-30");
    expect(closedCycles(days, cycles)).toEqual([]);
  });

  test("lista de prazos", () => {
    const rows = cycleRows([
      BASE,
      { validFrom: "2026-09-01", months: 4 },
      { validFrom: "2026-11-01", months: 1 },
    ]);
    expect(rows).toEqual([
      { validFrom: "2026-11-01", label: "A partir de 01/11/2026", rule: "Ciclos de 1 mês" },
      { validFrom: "2026-09-01", label: "A partir de 01/09/2026", rule: "Ciclos de 4 meses" },
      { validFrom: SINCE_START, label: "Desde o início", rule: "Sem prazo" },
    ]);
  });

  test("formulário de prazo começa com a regra em vigor", () => {
    expect(cycleFormDefaults([BASE], "2026-10-16")).toEqual({
      validFrom: "2026-10-01",
      months: 4,
    });
    expect(cycleFormDefaults([BASE, { validFrom: "2026-09-01", months: 6 }], "2026-10-16")).toEqual(
      { validFrom: "2026-10-01", months: 6 },
    );
  });
});
