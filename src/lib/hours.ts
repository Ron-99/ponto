import { addDays, eachDayOfInterval, format, isWeekend, parseISO, startOfWeek } from "date-fns";

export type PunchType = "in" | "out";
export type OverrideKind = "feriado" | "folga" | "atestado";

export type Punch = {
  id: number;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  type: PunchType;
  note: string | null;
};

export type DayOverride = {
  date: string;
  kind: OverrideKind;
  note: string | null;
};

export type DayStatus =
  | "ok" // pares fechados, sequência correta
  | "em-andamento" // hoje, com entrada aberta
  | "incompleto" // dia passado com número ímpar de batidas
  | "inconsistente" // sequência não alterna entrada/saída
  | "falta" // dia útil passado sem batidas
  | "abonado"
  | "folga-semanal" // fim de semana sem batidas
  | "pendente"; // hoje, ainda sem batidas

export type DaySummary = {
  date: string;
  weekday: number; // 0 = domingo
  punches: Punch[];
  override: DayOverride | null;
  worked: number; // minutos
  target: number; // minutos
  balance: number; // minutos (worked - target)
  bankDelta: number; // quanto este dia contribui para o banco
  status: DayStatus;
  isToday: boolean;
};

export const OVERRIDE_LABELS: Record<OverrideKind, string> = {
  feriado: "Feriado",
  folga: "Folga",
  atestado: "Atestado",
};

export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const toTime = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** Formata minutos como HH:MM; com `signed`, prefixa + ou −. */
export const formatDuration = (minutes: number, signed = false) => {
  const abs = Math.abs(Math.round(minutes));
  const text = `${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  if (!signed) return minutes < 0 ? `-${text}` : text;
  if (abs === 0) return text;
  return `${minutes > 0 ? "+" : "−"}${text}`;
};

export const sortPunches = (punches: Punch[]) =>
  [...punches].sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id);

/** Retorna uma mensagem de erro se as batidas do dia não alternam entrada/saída. */
export function validateSequence(punches: Pick<Punch, "time" | "type">[]): string | null {
  const sorted = [...punches].sort((a, b) => a.time.localeCompare(b.time));
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const prev = sorted[i - 1];
    if (prev && prev.time === p.time) {
      return `Já existe uma batida às ${p.time}.`;
    }
    const expected: PunchType = i % 2 === 0 ? "in" : "out";
    if (p.type !== expected) {
      if (i === 0) return `O dia precisa começar com uma entrada (${p.time} é saída).`;
      const label = p.type === "in" ? "entradas" : "saídas";
      return `Duas ${label} seguidas: ${prev.time} e ${p.time}.`;
    }
  }
  return null;
}

/** Tipo da próxima batida com base na última do dia. */
export const nextPunchType = (punches: Punch[]): PunchType => {
  const last = sortPunches(punches).at(-1);
  return last?.type === "in" ? "out" : "in";
};

export const targetFor = (date: string, override: DayOverride | null, dailyMinutes: number) =>
  override || isWeekend(parseISO(date)) ? 0 : dailyMinutes;

type Now = { date: string; minutes: number };

export function summarizeDay(
  date: string,
  punches: Punch[],
  override: DayOverride | null,
  dailyMinutes: number,
  now: Now,
): DaySummary {
  const sorted = sortPunches(punches);
  const isToday = date === now.date;
  const target = targetFor(date, override, dailyMinutes);
  const invalid = validateSequence(sorted) !== null;

  let worked = 0;
  let openSince: number | null = null;
  if (!invalid) {
    for (let i = 0; i < sorted.length; i += 2) {
      const start = toMinutes(sorted[i].time);
      const end = sorted[i + 1];
      if (end) worked += toMinutes(end.time) - start;
      else openSince = start;
    }
    if (openSince !== null && isToday) {
      worked += Math.max(0, now.minutes - openSince);
    }
  }

  let status: DayStatus;
  if (invalid) status = "inconsistente";
  else if (openSince !== null) status = isToday ? "em-andamento" : "incompleto";
  else if (sorted.length > 0) status = "ok";
  else if (override) status = "abonado";
  else if (target === 0) status = "folga-semanal";
  else status = isToday ? "pendente" : "falta";

  if (override && sorted.length > 0 && status === "ok") status = "abonado";

  const balance = worked - target;
  // Hoje só entra no banco o excedente, para não "devermos" horas no meio do expediente.
  const bankDelta = isToday ? Math.max(0, balance) : balance;

  return {
    date,
    weekday: parseISO(date).getDay(),
    punches: sorted,
    override,
    worked,
    target,
    balance,
    bankDelta,
    status,
    isToday,
  };
}

export type ReportInput = {
  startDate: string;
  punches: Punch[];
  overrides: DayOverride[];
  dailyMinutes: number;
  now: Now;
};

export type ReportDay = DaySummary & { accumulated: number };

/** Gera o resumo de todos os dias de `startDate` até hoje, com saldo acumulado. */
export function buildReport({
  startDate,
  punches,
  overrides,
  dailyMinutes,
  now,
}: ReportInput): ReportDay[] {
  if (startDate > now.date) return [];

  const byDate = new Map<string, Punch[]>();
  for (const p of punches) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }
  const overrideByDate = new Map(overrides.map((o) => [o.date, o]));

  let accumulated = 0;
  return eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(now.date),
  }).map((d) => {
    const date = format(d, "yyyy-MM-dd");
    const day = summarizeDay(
      date,
      byDate.get(date) ?? [],
      overrideByDate.get(date) ?? null,
      dailyMinutes,
      now,
    );
    accumulated += day.bankDelta;
    return { ...day, accumulated };
  });
}

export const weekKey = (date: string) =>
  format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd");

export const weekEnd = (date: string) => format(addDays(parseISO(weekKey(date)), 6), "yyyy-MM-dd");

export type WeekGroup = {
  weekStart: string;
  weekEnd: string;
  days: ReportDay[];
  worked: number;
  target: number;
  balance: number;
};

export function groupByWeek(days: ReportDay[]): WeekGroup[] {
  const groups = new Map<string, ReportDay[]>();
  for (const day of days) {
    const key = weekKey(day.date);
    const list = groups.get(key) ?? [];
    list.push(day);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([weekStart, list]) => ({
    weekStart,
    weekEnd: weekEnd(weekStart),
    days: list,
    worked: list.reduce((s, d) => s + d.worked, 0),
    target: list.reduce((s, d) => s + d.target, 0),
    balance: list.reduce((s, d) => s + d.bankDelta, 0),
  }));
}

export const needsAttention = (status: DayStatus) =>
  status === "incompleto" || status === "inconsistente";
