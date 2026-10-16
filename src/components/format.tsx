import { cn } from "cn";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  balanceTone,
  type DayStatus,
  type DaySummary,
  formatDuration,
  partialOverrideLabel,
  statusLabel,
} from "@/lib/hours";

/** Formata em pt-BR com a primeira letra maiúscula ("Quinta-feira, 15 de outubro"). */
export const formatDate = (date: string, pattern = "dd/MM/yyyy") => {
  const text = format(parseISO(date), pattern, { locale: ptBR });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function Balance({ minutes, className }: { minutes: number; className?: string }) {
  return (
    <span className={cn("font-mono tabular-nums", balanceTone(minutes), className)}>
      {formatDuration(minutes, true)}
    </span>
  );
}

const VARIANT: Record<DayStatus, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "secondary",
  "em-andamento": "default",
  incompleto: "destructive",
  inconsistente: "destructive",
  falta: "destructive",
  abonado: "outline",
  "folga-semanal": "outline",
  pendente: "outline",
};

export function StatusBadge({ day }: { day: DaySummary }) {
  const variant = VARIANT[day.status];
  const label = statusLabel(day);
  const partial = partialOverrideLabel(day.override);
  if (!partial) return <Badge variant={variant}>{label}</Badge>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge variant={variant}>{label}</Badge>
      <Badge variant="outline">{partial}</Badge>
    </span>
  );
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
