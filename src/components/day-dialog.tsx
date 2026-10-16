"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { addPunch, editPunch, removePunch, setDayOverride } from "@/app/actions";
import { Balance, formatDate } from "@/components/format";
import { TypeToggle } from "@/components/type-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAction } from "@/components/use-action";
import {
  type DaySummary,
  formatDuration,
  nextPunchType,
  OVERRIDE_LABELS,
  type OverrideKind,
  overrideHoursValue,
  overrideTitle,
  type Punch,
  type PunchType,
  validateSequence,
} from "@/lib/hours";

function PunchRow({ punch }: { punch: Punch }) {
  const [time, setTime] = useState(punch.time);
  const [type, setType] = useState<PunchType>(punch.type);
  const { pending, run } = useAction();
  const dirty = time !== punch.time || type !== punch.type;

  return (
    <div className="flex items-center gap-2">
      <Input
        type="time"
        className="w-28"
        value={time}
        aria-label="Horário"
        onChange={(e) => setTime(e.target.value)}
      />
      <TypeToggle value={type} onChange={setType} />
      <div className="ml-auto flex gap-1">
        <Button
          size="icon-sm"
          variant={dirty ? "default" : "ghost"}
          disabled={!dirty || pending}
          aria-label="Salvar alteração"
          onClick={() => run(() => editPunch(punch.id, { time, type, note: punch.note ?? "" }))}
        >
          <PencilIcon />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={pending}
          aria-label="Excluir batida"
          onClick={() => run(() => removePunch(punch.id))}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}

function AddRow({ date, next }: { date: string; next: PunchType }) {
  const [time, setTime] = useState("");
  const [type, setType] = useState<PunchType>(next);
  const { pending, run } = useAction();

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addPunch({ date, time, type }),
          () => setTime(""),
        );
      }}
    >
      <Input
        type="time"
        className="w-28"
        required
        value={time}
        aria-label="Novo horário"
        onChange={(e) => setTime(e.target.value)}
      />
      <TypeToggle value={type} onChange={setType} />
      <Button
        type="submit"
        size="icon-sm"
        className="ml-auto"
        disabled={pending}
        aria-label="Adicionar batida"
      >
        <PlusIcon />
      </Button>
    </form>
  );
}

const OVERRIDE_OPTIONS: (OverrideKind | null)[] = [null, "feriado", "folga", "atestado"];

function OverridePicker({ day }: { day: DaySummary }) {
  const { pending, run } = useAction();
  const current = day.override?.kind ?? null;
  const savedHours = overrideHoursValue(day.override);
  const [hours, setHours] = useState(savedHours);
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1">
        {OVERRIDE_OPTIONS.map((kind) => (
          <Button
            key={kind ?? "none"}
            size="sm"
            variant={current === kind ? "default" : "outline"}
            disabled={pending}
            onClick={() =>
              (current !== kind || (kind && hours !== savedHours)) &&
              run(() => setDayOverride(day.date, kind, hours))
            }
          >
            {kind ? OVERRIDE_LABELS[kind] : "Dia normal"}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={`hours-${day.date}`} className="font-normal">
          Horas abonadas
        </Label>
        <Input
          id={`hours-${day.date}`}
          className="w-24"
          placeholder="dia todo"
          pattern="\d{2}:[0-5]\d"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
      </div>
    </div>
  );
}

export function DayDialog({ day }: { day: DaySummary }) {
  const sequenceError = validateSequence(day.punches);
  return (
    <Dialog>
      <DialogTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Editar dia" />}>
        <PencilIcon />
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{formatDate(day.date, "EEEE, dd 'de' MMMM")}</DialogTitle>
          <DialogDescription>
            Trabalhado {formatDuration(day.worked)} de {formatDuration(day.target)} · saldo{" "}
            <Balance minutes={day.balance} />
          </DialogDescription>
        </DialogHeader>

        {sequenceError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">{sequenceError}</p>
        )}
        {!sequenceError && day.punches.length % 2 === 1 && !day.isToday && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
            Número ímpar de batidas: falta registrar uma saída.
          </p>
        )}

        <div className="grid gap-2">
          <Label>Batidas</Label>
          {day.punches.map((p) => (
            // A key inclui os valores para reiniciar o estado local após salvar.
            <PunchRow key={`${p.id}-${p.time}-${p.type}`} punch={p} />
          ))}
          <AddRow key={day.punches.length} date={day.date} next={nextPunchType(day.punches)} />
        </div>

        <Separator />

        <div className="grid gap-2">
          <Label>{overrideTitle(day.override)}</Label>
          {/* A key reinicia o campo de horas depois de salvar. */}
          <OverridePicker key={`${day.override?.kind}-${day.override?.minutes}`} day={day} />
          <p className="text-xs text-muted-foreground">
            Dias abonados têm meta de 0h; horas trabalhadas neles contam como extra. Para abonar só
            parte do dia (ex.: consulta de 2h), preencha as horas (HH:MM) antes de escolher o tipo.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
