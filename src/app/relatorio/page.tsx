import { cn } from "cn";
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DayDialog } from "@/components/day-dialog";
import { Balance, formatDate, PunchChips, StatusBadge } from "@/components/format";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportHref, PERIODS, type Period, parseReportParams, rangeFor } from "@/lib/csv";
import { loadBank } from "@/lib/data";
import {
  bankLabel,
  closedCycles,
  cycleFor,
  formatDuration,
  groupByWeek,
  weekEnd,
  weekKey,
} from "@/lib/hours";

export default function Page({ searchParams }: PageProps<"/relatorio">) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Carregando…</p>}>
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

function titleFor(period: Period, ref: string) {
  if (period === "semana") {
    return `Semana de ${formatDate(weekKey(ref), "dd/MM")} a ${formatDate(weekEnd(ref), "dd/MM/yyyy")}`;
  }
  if (period === "mes") return formatDate(ref, "MMMM 'de' yyyy");
  return "Todo o período";
}

async function Report({ searchParams }: Pick<PageProps<"/relatorio">, "searchParams">) {
  const params = await searchParams;
  const { now, days, total, startDate, cycles } = await loadBank();

  const { period, ref } = parseReportParams(params, now.date);
  const range = { ...rangeFor(period, ref), title: titleFor(period, ref) };
  const visible = days.filter((d) => d.date >= range.from && d.date <= range.to);
  const weeks = groupByWeek(visible).reverse();

  const worked = visible.reduce((s, d) => s + d.worked, 0);
  const target = visible.reduce((s, d) => s + d.target, 0);
  const balance = visible.reduce((s, d) => s + d.bankDelta, 0);
  // Os ciclos fechados vêm do banco todo, não só do período em tela.
  const closed = closedCycles(days, cycles);

  const href = (p: Period, r: string) => `/relatorio?periodo=${p}&ref=${r}`;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-[3px]">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={href(p.value, ref)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium text-foreground/60 hover:text-foreground",
                period === p.value && "bg-background text-foreground shadow-sm",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {range.prev && (
            <Link
              href={href(period, range.prev)}
              aria-label="Período anterior"
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ChevronLeftIcon />
            </Link>
          )}
          <span className="flex-1 text-center font-medium sm:min-w-48">{range.title}</span>
          {range.next && (
            <Link
              href={href(period, range.next)}
              aria-label="Próximo período"
              className={buttonVariants({ variant: "outline", size: "icon" })}
            >
              <ChevronRightIcon />
            </Link>
          )}
        </div>
        <a
          href={exportHref(period, ref)}
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <DownloadIcon />
          Exportar CSV
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Summary label="Trabalhado no período" value={formatDuration(worked)} />
        <Summary label="Meta do período" value={formatDuration(target)} />
        <Summary label="Saldo do período" value={<Balance minutes={balance} />} />
        <Summary
          label={bankLabel(startDate, cycleFor(now.date, cycles).start)}
          value={<Balance minutes={total} />}
        />
      </div>

      {closed.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Ciclos fechados</CardTitle>
            <CardDescription>O saldo com que cada ciclo fechou e voltou a 00:00.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {closed.map((c) => (
                <li key={c.start} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{c.label}</span>
                  <Balance minutes={c.closing} className="font-medium" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {weeks.length === 0 && (
        <p className="text-muted-foreground">Nenhum dia registrado neste período.</p>
      )}

      {weeks.map((w) => (
        <Card key={w.weekStart} className="py-0">
          <CardHeader className="border-b bg-muted/40 py-3">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                Semana {formatDate(w.weekStart, "dd/MM")} – {formatDate(w.weekEnd, "dd/MM")}
              </span>
              <span className="flex gap-4 font-normal">
                <span>
                  {formatDuration(w.worked)}
                  <span className="text-muted-foreground"> / {formatDuration(w.target)}</span>
                </span>
                <Balance minutes={w.balance} className="font-medium" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {/* Celular: lista em cartões; a tabela só aparece a partir de md. */}
            <ul className="divide-y md:hidden">
              {[...w.days].reverse().map((d) => (
                <li
                  key={d.date}
                  className={cn("grid gap-2 px-4 py-3", d.target === 0 && "text-muted-foreground")}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatDate(d.date, "dd/MM")}</span>
                    <span className="text-muted-foreground">{formatDate(d.date, "EEE")}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <StatusBadge day={d} />
                      <DayDialog day={d} />
                    </span>
                  </div>
                  <PunchChips day={d} />
                  <dl className="grid grid-cols-4 gap-2 text-xs">
                    <MobileStat label="Trabalhado" value={formatDuration(d.worked)} />
                    <MobileStat label="Meta" value={formatDuration(d.target)} />
                    <MobileStat
                      label="Saldo"
                      value={<Balance minutes={d.isToday ? d.bankDelta : d.balance} />}
                    />
                    <MobileStat label="Acumulado" value={<Balance minutes={d.accumulated} />} />
                  </dl>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Dia</TableHead>
                    <TableHead>Batidas</TableHead>
                    <TableHead className="text-right">Trabalhado</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Acumulado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...w.days].reverse().map((d) => (
                    <TableRow
                      key={d.date}
                      className={cn(d.target === 0 && "text-muted-foreground")}
                    >
                      <TableCell className="pl-4 whitespace-nowrap">
                        <span className="font-medium">{formatDate(d.date, "dd/MM")}</span>{" "}
                        <span className="text-muted-foreground">{formatDate(d.date, "EEE")}</span>
                      </TableCell>
                      <TableCell>
                        <PunchChips day={d} />
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatDuration(d.worked)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatDuration(d.target)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Balance minutes={d.isToday ? d.bankDelta : d.balance} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Balance minutes={d.accumulated} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge day={d} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <DayDialog day={d} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-mono text-xl tabular-nums sm:text-2xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
