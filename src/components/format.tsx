import { cn } from "cn";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { type DayStatus, type DaySummary, formatDuration, OVERRIDE_LABELS } from "@/lib/hours";

/** Formata em pt-BR com a primeira letra maiúscula ("Quinta-feira, 15 de outubro"). */
export const formatDate = (date: string, pattern = "dd/MM/yyyy") => {
  const text = format(parseISO(date), pattern, { locale: ptBR });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function Balance({ minutes, className }: { minutes: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        minutes > 0 && "text-emerald-600 dark:text-emerald-400",
        minutes < 0 && "text-red-600 dark:text-red-400",
        minutes === 0 && "text-muted-foreground",
        className,
      )}
    >
      {formatDuration(minutes, true)}
    </span>
  );
}

const STATUS: Record<
  DayStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ok: { label: "OK", variant: "secondary" },
  "em-andamento": { label: "Em andamento", variant: "default" },
  incompleto: { label: "Batida ímpar", variant: "destructive" },
  inconsistente: { label: "Inconsistente", variant: "destructive" },
  falta: { label: "Sem batidas", variant: "destructive" },
  abonado: { label: "Abonado", variant: "outline" },
  "folga-semanal": { label: "Fim de semana", variant: "outline" },
  pendente: { label: "Sem batidas", variant: "outline" },
};

export function StatusBadge({ day }: { day: DaySummary }) {
  const s = STATUS[day.status];
  const label =
    day.status === "abonado" && day.override ? OVERRIDE_LABELS[day.override.kind] : s.label;
  return <Badge variant={s.variant}>{label}</Badge>;
}

export function PunchChips({ day }: { day: DaySummary }) {
  if (day.punches.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {day.punches.map((p) => (
        <span
          key={p.id}
          title={p.note ?? undefined}
          className={cn(
            "rounded-md px-1.5 py-0.5 font-mono text-xs tabular-nums",
            p.type === "in"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-orange-500/10 text-orange-700 dark:text-orange-300",
          )}
        >
          {p.type === "in" ? "↓" : "↑"} {p.time}
        </span>
      ))}
    </div>
  );
}
