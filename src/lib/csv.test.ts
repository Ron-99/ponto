import { describe, expect, test } from "bun:test";
import { csvFilename, exportHref, parseReportParams, rangeFor, reportCsv } from "./csv";
import { buildReport, type DayOverride, type DayStatus, type Punch, type ReportDay } from "./hours";

const HEADER =
  "Data;Dia;Batidas;Trabalhado;Meta;Saldo;Acumulado;Status;Abono;Horas abonadas;Observações";
const BOM = "﻿";

// 2026-10-12 é segunda-feira.
const MON = "2026-10-12";
const TUE = "2026-10-13";
const WED = "2026-10-14";
const SAT = "2026-10-17";
const past = { date: "2099-01-01", minutes: 0 };

let nextId = 1;
const punch = (date: string, time: string, type: "in" | "out", note: string | null = null) => ({
  id: nextId++,
  date,
  time,
  type,
  note,
});
const punches = (date: string, ...times: string[]): Punch[] =>
  times.map((t, i) => punch(date, t, i % 2 === 0 ? "in" : "out"));

const report = (startDate: string, list: Punch[], overrides: DayOverride[] = [], now = past) =>
  buildReport({ startDate, punches: list, overrides, dailyMinutes: 480, now });

/** Um dia de `MON` (passado) com batidas e abono opcionais. */
const dayOf = (list: Punch[], override: DayOverride | null = null, date = MON) =>
  report(date, list, override ? [override] : [], { date, minutes: 23 * 60 + 59 })
    .filter((d) => d.date === date)
    .map((d) => ({ ...d, isToday: false }))[0];

/** Divide as linhas e os campos respeitando aspas. */
function parse(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const body = csv.replace(/^﻿/, "");
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\r" && body[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  return rows;
}

const rowOf = (day: ReportDay) => parse(reportCsv([day]))[1];
const lineOf = (day: ReportDay) => reportCsv([day]).split("\r\n")[1];

describe("exportação CSV", () => {
  test("link de exportação usa o período da tela", () => {
    expect(exportHref("mes", "2026-10-05")).toBe("/relatorio/csv?periodo=mes&ref=2026-10-05");
  });

  test("nome do arquivo por período", () => {
    expect(csvFilename("mes", "2026-10-05", "2026-10-16")).toBe("ponto-2026-10.csv");
    expect(csvFilename("semana", "2026-10-15", "2026-10-16")).toBe("ponto-semana-2026-10-12.csv");
    expect(csvFilename("tudo", "2026-10-16", "2026-10-16")).toBe("ponto-ate-2026-10-16.csv");
  });

  test("cabeçalho, BOM e fim de linha", () => {
    const csv = reportCsv(
      report(MON, punches(MON, "08:00", "17:00"), [], { date: TUE, minutes: 0 }),
    );
    expect(csv.startsWith(`${BOM}${HEADER}\r\n`)).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines.at(-1)).toBe("");
    expect(lines).toHaveLength(4);
    expect(csv.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  test("uma linha por dia com os números do relatório", () => {
    const days = buildReport({
      startDate: MON,
      punches: [
        ...punches(MON, "08:00", "12:00", "13:00", "18:00"),
        ...punches(TUE, "08:00", "12:00", "13:00", "16:30"),
      ],
      overrides: [{ date: WED, kind: "folga", note: null }],
      dailyMinutes: 480,
      now: { date: WED, minutes: 10 * 60 },
    });
    const rows = parse(reportCsv(days)).slice(1);
    expect(rows.map((r) => r[0])).toEqual(["12/10/2026", "13/10/2026", "14/10/2026"]);
    expect(rows.map((r) => r.slice(3, 7))).toEqual([
      ["09:00", "08:00", "01:00", "01:00"],
      ["07:30", "08:00", "-00:30", "00:30"],
      ["00:00", "00:00", "00:00", "00:30"],
    ]);
  });

  test("intervalo do período", () => {
    expect(rangeFor("semana", "2026-10-15")).toMatchObject({
      from: "2026-10-12",
      to: "2026-10-18",
    });
    expect(rangeFor("mes", "2026-10-15")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeFor("tudo", "2026-10-15")).toMatchObject({
      from: "0000-00-00",
      to: "9999-12-31",
    });
  });

  test("parâmetros inválidos caem no padrão", () => {
    const today = "2026-10-16";
    expect(parseReportParams({ periodo: "ano", ref: "2026-10-05" }, today)).toEqual({
      period: "mes",
      ref: "2026-10-05",
    });
    expect(parseReportParams({ periodo: "semana", ref: "15/10/2026" }, today)).toEqual({
      period: "semana",
      ref: today,
    });
    expect(parseReportParams({ periodo: "tudo" }, today)).toEqual({ period: "tudo", ref: today });
    expect(parseReportParams({ periodo: ["semana", "tudo"], ref: "2026-10-05" }, today)).toEqual({
      period: "mes",
      ref: "2026-10-05",
    });
  });

  test("período vazio só tem cabeçalho", () => {
    expect(reportCsv([])).toBe(`${BOM}${HEADER}\r\n`);
  });

  test("data e dia da semana", () => {
    expect(rowOf(dayOf([])).slice(0, 2)).toEqual(["12/10/2026", "Segunda"]);
    expect(rowOf(dayOf([], null, SAT)).slice(0, 2)).toEqual(["17/10/2026", "Sábado"]);
  });

  test("batidas em ordem separadas por espaço", () => {
    const shuffled = [
      punch(MON, "13:00", "in"),
      punch(MON, "08:00", "in"),
      punch(MON, "17:30", "out"),
      punch(MON, "12:00", "out"),
    ];
    expect(rowOf(dayOf(shuffled))[2]).toBe("08:00 12:00 13:00 17:30");
    expect(rowOf(dayOf([]))[2]).toBe("");
  });

  test("durações em HH:MM com hífen", () => {
    // −90: trabalhou 06:30 numa meta de 08:00; 45: 08:45; 0: 08:00.
    const saldo = (end: string) => rowOf(dayOf(punches(MON, "08:00", end)))[5];
    expect(saldo("14:30")).toBe("-01:30");
    expect(saldo("16:45")).toBe("00:45");
    expect(saldo("16:00")).toBe("00:00");
    expect(lineOf(dayOf(punches(MON, "08:00", "14:30")))).not.toMatch(/[+−]/);
  });

  test("saldo de hoje usa só o excedente", () => {
    const today = report(MON, punches(MON, "08:00"), [], { date: MON, minutes: 14 * 60 });
    expect(today[0].balance).toBe(-120);
    expect(today[0].bankDelta).toBe(0);
    expect(rowOf(today[0])[5]).toBe("00:00");
    expect(rowOf(dayOf(punches(MON, "08:00", "14:00")))[5]).toBe("-02:00");
  });

  test("status igual ao badge", () => {
    const labels: Record<DayStatus, string> = {
      ok: "OK",
      "em-andamento": "Em andamento",
      incompleto: "Batida ímpar",
      inconsistente: "Inconsistente",
      falta: "Sem batidas",
      abonado: "Abonado",
      "folga-semanal": "Fim de semana",
      pendente: "Sem batidas",
    };
    const base = dayOf([]);
    for (const [status, label] of Object.entries(labels) as [DayStatus, string][]) {
      expect(rowOf({ ...base, status })[7]).toBe(label);
    }
    for (const [kind, label] of [
      ["feriado", "Feriado"],
      ["folga", "Folga"],
      ["atestado", "Atestado"],
    ] as const) {
      const override: DayOverride = { date: MON, kind, note: null };
      expect(rowOf({ ...base, status: "abonado", override })[7]).toBe(label);
    }
  });

  test("colunas do abono", () => {
    const feriado = dayOf([], { date: MON, kind: "feriado", note: null });
    expect(rowOf(feriado).slice(8, 10)).toEqual(["Feriado", ""]);
    const parcial = dayOf([], { date: MON, kind: "atestado", note: null, minutes: 120 });
    expect(rowOf(parcial).slice(8, 10)).toEqual(["Atestado", "02:00"]);
    expect(rowOf(dayOf([])).slice(8, 10)).toEqual(["", ""]);
  });

  test("observações do abono e das batidas", () => {
    const day = dayOf(
      [
        punch(MON, "08:00", "in"),
        punch(MON, "12:00", "out", "almoço longo"),
        punch(MON, "14:00", "in"),
        punch(MON, "16:00", "out"),
      ],
      { date: MON, kind: "atestado", note: "consulta", minutes: 120 },
    );
    expect(lineOf(day).endsWith(";Atestado;02:00;consulta | 12:00 almoço longo")).toBe(true);
  });

  test("escapa separador, aspas e quebra de linha", () => {
    const withNote = (note: string) =>
      dayOf([punch(MON, "08:00", "in"), punch(MON, "12:00", "out", note)]);
    expect(lineOf(withNote("a;b")).endsWith(';"12:00 a;b"')).toBe(true);
    expect(lineOf(withNote('diz "oi"')).endsWith(';"12:00 diz ""oi"""')).toBe(true);
    const csv = reportCsv([withNote("linha1\nlinha2")]);
    expect(csv).toContain(';"12:00 linha1\nlinha2"\r\n');
    for (const note of ["a;b", 'diz "oi"', "linha1\nlinha2"]) {
      const rows = parse(reportCsv([withNote(note)]));
      expect(rows).toHaveLength(2);
      expect(rows[1]).toHaveLength(11);
      expect(rows[1][10]).toBe(`12:00 ${note}`);
    }
  });

  test("observação não vira fórmula", () => {
    for (const note of ["=SOMA(A1)", "+1", "-1", "@x"]) {
      const day = dayOf([], { date: MON, kind: "folga", note });
      expect(rowOf(day)[10]).toBe(`'${note}`);
    }
    expect(rowOf(dayOf(punches(MON, "08:00", "14:30")))[5]).toBe("-01:30");
  });
});
