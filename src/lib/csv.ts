import { addMonths, addWeeks, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  formatDuration,
  OVERRIDE_LABELS,
  type ReportDay,
  statusLabel,
  weekEnd,
  weekKey,
} from "./hours";

export type Period = "semana" | "mes" | "tudo";
export const PERIODS: { value: Period; label: string }[] = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
  { value: "tudo", label: "Tudo" },
];

type Param = string | string[] | undefined;

/** Período e data de referência da URL; valores inválidos caem em "mes" e hoje. */
export function parseReportParams(params: { periodo?: Param; ref?: Param }, today: string) {
  const { periodo, ref } = params;
  const period: Period = PERIODS.some((p) => p.value === periodo) ? (periodo as Period) : "mes";
  return {
    period,
    ref: typeof ref === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ref) ? ref : today,
  };
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

/** Intervalo de datas do período, usado pelo relatório e pela exportação. */
export function rangeFor(period: Period, ref: string) {
  const d = parseISO(ref);
  if (period === "semana") {
    return {
      from: weekKey(ref),
      to: weekEnd(ref),
      prev: ymd(addWeeks(d, -1)),
      next: ymd(addWeeks(d, 1)),
    };
  }
  if (period === "mes") {
    return {
      from: ymd(startOfMonth(d)),
      to: ymd(endOfMonth(d)),
      prev: ymd(addMonths(d, -1)),
      next: ymd(addMonths(d, 1)),
    };
  }
  return { from: "0000-00-00", to: "9999-12-31", prev: null, next: null };
}

export const exportHref = (period: Period, ref: string) =>
  `/relatorio/csv?periodo=${period}&ref=${ref}`;

export function csvFilename(period: Period, ref: string, today: string) {
  if (period === "semana") return `ponto-semana-${weekKey(ref)}.csv`;
  if (period === "tudo") return `ponto-ate-${today}.csv`;
  return `ponto-${ref.slice(0, 7)}.csv`;
}

const HEADER = [
  "Data",
  "Dia",
  "Batidas",
  "Trabalhado",
  "Meta",
  "Saldo",
  "Acumulado",
  "Status",
  "Abono",
  "Horas abonadas",
  "Observações",
];

/** Aspas quando o campo tem separador, aspas ou quebra de linha (RFC 4180). */
const quote = (value: string) =>
  /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Texto livre que começa como fórmula ganha `'`, para a planilha não executá-lo. */
const text = (value: string) => quote(/^[=+\-@]/.test(value) ? `'${value}` : value);

const weekday = (date: string) => {
  const name = format(parseISO(date), "EEE", { locale: ptBR });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** CSV do relatório, um dia por linha, em UTF-8 com BOM, `;` e `\r\n` (Excel em pt-BR). */
export function reportCsv(days: ReportDay[]) {
  const rows = days.map((d) => {
    const notes = [
      d.override?.note,
      ...d.punches.filter((p) => p.note).map((p) => `${p.time} ${p.note}`),
    ].filter(Boolean);
    return [
      format(parseISO(d.date), "dd/MM/yyyy"),
      weekday(d.date),
      d.punches.map((p) => p.time).join(" "),
      formatDuration(d.worked),
      formatDuration(d.target),
      formatDuration(d.isToday ? d.bankDelta : d.balance),
      formatDuration(d.accumulated),
      statusLabel(d),
      d.override ? OVERRIDE_LABELS[d.override.kind] : "",
      d.override?.minutes ? formatDuration(d.override.minutes) : "",
      text(notes.join(" | ")),
    ].join(";");
  });
  return `﻿${[HEADER.join(";"), ...rows].map((line) => `${line}\r\n`).join("")}`;
}
