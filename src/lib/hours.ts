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
  /** Minutos abonados (abono parcial); vazio = dia inteiro. */
  minutes?: number | null;
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

const STATUS_LABELS: Record<DayStatus, string> = {
  ok: "OK",
  "em-andamento": "Em andamento",
  incompleto: "Batida ímpar",
  inconsistente: "Inconsistente",
  falta: "Sem batidas",
  abonado: "Abonado",
  "folga-semanal": "Fim de semana",
  pendente: "Sem batidas",
};

/** Rótulo do status do dia; num dia abonado, o tipo do abono. */
export const statusLabel = (day: DaySummary) =>
  day.status === "abonado" && day.override
    ? OVERRIDE_LABELS[day.override.kind]
    : STATUS_LABELS[day.status];

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

export function targetFor(date: string, override: DayOverride | null, dailyMinutes: number) {
  if (isWeekend(parseISO(date))) return 0;
  if (override?.minutes) return Math.max(0, dailyMinutes - override.minutes);
  return override ? 0 : dailyMinutes;
}

const isFullDay = (override: DayOverride | null) => !!override && !override.minutes;

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
  else if (isFullDay(override)) status = "abonado";
  else if (target === 0) status = "folga-semanal";
  else status = isToday ? "pendente" : "falta";

  if (isFullDay(override) && sorted.length > 0 && status === "ok") status = "abonado";

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

/** Horário em que, mantendo a entrada aberta desde agora, o dia atinge a meta. */
export const closeTime = (day: DaySummary, nowMinutes: number) =>
  toTime(nowMinutes + Math.max(0, day.target - day.worked));

/** "Meta de 06:00 (atestado de 02:00)", "Meta de 00:00 (dia abonado)" ou "Meta de 08:00". */
export function targetDescription(day: DaySummary) {
  const text = `Meta de ${formatDuration(day.target)}`;
  const override = day.override;
  if (!override) return text;
  if (!override.minutes) return `${text} (dia abonado)`;
  return `${text} (${OVERRIDE_LABELS[override.kind].toLowerCase()} de ${formatDuration(override.minutes)})`;
}

/** Título da seção de abono do DayDialog, com o nome do feriado (ou a observação) se houver. */
export const overrideTitle = (override: DayOverride | null) =>
  override?.note ? `Abono do dia · ${override.note}` : "Abono do dia";

/** Valor do campo "Horas abonadas": HH:MM no abono parcial, vazio caso contrário. */
export const overrideHoursValue = (override: DayOverride | null) =>
  override?.minutes ? formatDuration(override.minutes) : "";

/** Rótulo do badge do abono parcial ("Atestado 02:00"); null para dia inteiro ou sem abono. */
export const partialOverrideLabel = (override: DayOverride | null) =>
  override?.minutes
    ? `${OVERRIDE_LABELS[override.kind]} ${formatDuration(override.minutes)}`
    : null;

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

const BREAK_RULE = "A CLT pede pelo menos 1h acima de 6h.";

/**
 * Avisos da CLT para hoje: intervalo de 1h acima de 6h trabalhadas (art. 71), até 2h extras
 * (art. 59) e 11h de descanso desde a saída de ontem (art. 66). Só lê os dias.
 */
export function cltAlerts(days: DaySummary[], today: string): string[] {
  const day = days.find((d) => d.date === today);
  if (!day) return [];
  const alerts: string[] = [];
  const { punches } = day;

  if (day.status !== "inconsistente") {
    if (day.worked > 6 * 60) {
      const breaks: number[] = [];
      for (let i = 1; i + 1 < punches.length; i += 2) {
        breaks.push(toMinutes(punches[i + 1].time) - toMinutes(punches[i].time));
      }
      const longest = Math.max(...breaks);
      const worked = formatDuration(day.worked);
      if (breaks.length === 0)
        alerts.push(`Sem intervalo numa jornada de ${worked}. ${BREAK_RULE}`);
      else if (longest < 60) {
        alerts.push(
          `Intervalo de ${formatDuration(longest)} numa jornada de ${worked}. ${BREAK_RULE}`,
        );
      }
    }
    const extra = day.worked - day.target;
    if (extra > 120) {
      alerts.push(`${formatDuration(extra)} de horas extras hoje. A CLT permite até 2h por dia.`);
    }
  }

  const yesterday = format(addDays(parseISO(today), -1), "yyyy-MM-dd");
  const previous = days.find((d) => d.date === yesterday);
  const lastOut = previous?.status === "inconsistente" ? undefined : previous?.punches.at(-1);
  const firstIn = punches[0];
  if (lastOut?.type === "out" && firstIn?.type === "in") {
    const rest = 24 * 60 - toMinutes(lastOut.time) + toMinutes(firstIn.time);
    if (rest < 11 * 60) {
      alerts.push(
        `Descanso de ${formatDuration(rest)} desde a saída de ontem às ${lastOut.time}. A CLT pede pelo menos 11h.`,
      );
    }
  }
  return alerts;
}

export const needsAttention = (status: DayStatus) =>
  status === "incompleto" || status === "inconsistente";

/** Cor do saldo: verde positivo, vermelho negativo, apagado no zero. */
export const balanceTone = (minutes: number) =>
  minutes > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : minutes < 0
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

export type BalancePoint = { date: string; value: number };

const CHART_DAYS = 56;
const shortDate = (date: string) => format(parseISO(date), "dd/MM");

/** Acumulado dos últimos 56 dias (ou desde o início do banco) e a frase da variação. */
export function balanceSeries(days: ReportDay[]) {
  const points = days.slice(-CHART_DAYS).map((d) => ({ date: d.date, value: d.accumulated }));
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || points.length < 2) return { points, trend: null, label: null };
  const delta = last.value - first.value;
  const since = shortDate(first.date);
  const trend =
    delta > 0
      ? `Subiu ${formatDuration(delta)} desde ${since}.`
      : delta < 0
        ? `Caiu ${formatDuration(delta).slice(1)} desde ${since}.`
        : `Igual a ${since}.`;
  return { points, trend, label: `${trend} Saldo de hoje: ${formatDuration(last.value, true)}.` };
}

type Segment = { tone: string; points: [number, number][] };

export type BalanceChart =
  | { kind: "empty"; message: string }
  | {
      kind: "chart";
      width: number;
      height: number;
      zeroY: number;
      segments: Segment[];
      labels: { top: string; bottom: string; start: string; end: string };
    };

/** Geometria do gráfico num viewBox fixo; a escala vertical sempre inclui o zero. */
export function balanceChart(points: BalancePoint[], width = 320, height = 120): BalanceChart {
  if (points.length < 2) {
    return { kind: "empty", message: "O gráfico aparece a partir do segundo dia do banco." };
  }
  const values = points.map((p) => p.value);
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const range = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => ((max - v) / range) * height;
  const zeroY = y(0);

  const segments: Segment[] = [];
  let sign = Math.sign(values.find((v) => v !== 0) ?? 1);
  let current: [number, number][] = [[x(0), y(values[0])]];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    const v = values[i];
    if (v !== 0 && Math.sign(v) !== sign) {
      // Cruza o zero entre os dois pontos: fecha o trecho no cruzamento.
      const cross: [number, number] = [x(i - 1) + ((x(i) - x(i - 1)) * prev) / (prev - v), zeroY];
      if (prev !== 0) current.push(cross);
      segments.push({ tone: balanceTone(sign), points: current });
      current = [prev !== 0 ? cross : [x(i - 1), zeroY]];
      sign = Math.sign(v);
    }
    current.push([x(i), y(v)]);
  }
  segments.push({ tone: balanceTone(sign), points: current });

  return {
    kind: "chart",
    width,
    height,
    zeroY,
    segments,
    labels: {
      top: formatDuration(max, true),
      bottom: formatDuration(min, true),
      start: shortDate(points[0].date),
      end: "hoje",
    },
  };
}
