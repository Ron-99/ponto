import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { BalanceChart } from "@/components/balance-chart";
import { ClockButton } from "@/components/clock-button";
import { DayDialog } from "@/components/day-dialog";
import { Balance, formatDate, PunchChips, StatusBadge } from "@/components/format";
import { ManualPunchDialog } from "@/components/manual-punch-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadBank } from "@/lib/data";
import {
  balanceSeries,
  closeTime,
  cltAlerts,
  formatDuration,
  jornadaFor,
  needsAttention,
  nextPunchType,
  remainingWeekTarget,
  summarizeDay,
  targetDescription,
  toTime,
  weekEnd,
  weekKey,
} from "@/lib/hours";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Carregando…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const { now, days, total, schedules } = await loadBank();
  const today =
    days.find((d) => d.date === now.date) ??
    summarizeDay(now.date, [], null, jornadaFor(now.date, schedules), now);

  const remaining = Math.max(0, today.target - today.worked);
  const open = today.status === "em-andamento";
  // Banco sem o dia de hoje: quanto preciso trabalhar hoje para zerá-lo.
  const bankBeforeToday = total - today.bankDelta;
  const toZeroBank = Math.max(0, today.target - bankBeforeToday - today.worked);

  const week = days.filter((d) => weekKey(d.date) === weekKey(now.date));
  const weekWorked = week.reduce((s, d) => s + d.worked, 0);
  // A jornada dos dias ainda por vir nesta semana também entra na meta semanal.
  const weekTarget =
    week.reduce((s, d) => s + d.target, 0) + remainingWeekTarget(now.date, schedules);
  const weekBalance = week.reduce((s, d) => s + d.bankDelta, 0);
  const attention = days.filter((d) => !d.isToday && needsAttention(d.status));
  const alerts = cltAlerts(days, now.date);
  const series = balanceSeries(days);

  return (
    <div className="grid gap-6">
      <AutoRefresh />

      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {formatDate(now.date, "EEEE, dd 'de' MMMM")} · {toTime(now.minutes)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Saldo do banco de horas</p>
          <Balance minutes={total} className="text-5xl font-semibold tracking-tight" />
          <p className="mt-1 text-sm text-muted-foreground">
            {total > 0 ? "horas a mais acumuladas" : total < 0 ? "horas devendo" : "banco zerado"}
          </p>
        </div>
        <div className="grid gap-2 sm:flex">
          <ClockButton next={nextPunchType(today.punches)} />
          <ManualPunchDialog defaultDate={now.date} defaultType={nextPunchType(today.punches)} />
        </div>
      </section>

      {attention.length > 0 && (
        <Card className="ring-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="size-4" />
              {attention.length === 1
                ? "1 dia com batidas pendentes"
                : `${attention.length} dias com batidas pendentes`}
            </CardTitle>
            <CardDescription>
              Esses dias têm número ímpar de batidas ou sequência inválida, e só os pares fechados
              entram no saldo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {attention.slice(-5).map((d) => (
              <div key={d.date} className="flex items-center gap-3">
                <span className="w-24 font-medium">{formatDate(d.date)}</span>
                <PunchChips day={d} />
                <span className="ml-auto">
                  <DayDialog day={d} />
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Hoje <StatusBadge day={today} />
            </CardTitle>
            <CardDescription>{targetDescription(today)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {alerts.length > 0 && (
              <ul className="grid gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                {alerts.map((a) => (
                  <li key={a} className="flex gap-2">
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <PunchChips day={today} />
              <span className="ml-auto">
                <DayDialog day={today} />
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Trabalhado" value={formatDuration(today.worked)} />
              <Stat
                label={remaining > 0 ? "Faltam" : "Excedente"}
                value={
                  remaining > 0 ? (
                    formatDuration(remaining)
                  ) : (
                    <Balance minutes={today.worked - today.target} />
                  )
                }
              />
              {open && remaining > 0 && (
                <Stat
                  label={`Saída para fechar ${formatDuration(today.target)}`}
                  value={closeTime(today, now.minutes)}
                />
              )}
              {open && (
                <Stat
                  label="Saída para zerar o banco"
                  value={toZeroBank > 0 ? toTime(now.minutes + toZeroBank) : "já pode sair"}
                />
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Semana atual</CardTitle>
            <CardDescription>
              {formatDate(weekKey(now.date), "dd/MM")} a {formatDate(weekEnd(now.date), "dd/MM")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>
                  {formatDuration(weekWorked)} de {formatDuration(weekTarget)}
                </span>
                <span className="text-muted-foreground">
                  {weekTarget > 0
                    ? Math.min(100, Math.round((weekWorked / weekTarget) * 100))
                    : 100}
                  %
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${weekTarget > 0 ? Math.min(100, (weekWorked / weekTarget) * 100) : 100}%`,
                  }}
                />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Stat label="Saldo da semana" value={<Balance minutes={weekBalance} />} />
              <Stat
                label="Faltam na semana"
                value={formatDuration(Math.max(0, weekTarget - weekWorked))}
              />
            </dl>
            <Link href="/relatorio" className="text-sm underline underline-offset-4">
              Ver relatório completo
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saldo nas últimas 8 semanas</CardTitle>
          {series.trend && <CardDescription>{series.trend}</CardDescription>}
        </CardHeader>
        <CardContent>
          <BalanceChart points={series.points} label={series.label} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xl tabular-nums">{value}</dd>
    </div>
  );
}
