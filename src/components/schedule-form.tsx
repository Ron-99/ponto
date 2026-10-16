"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { removeSchedule, saveSchedule } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/components/use-action";
import { FORM_DAYS, SINCE_START } from "@/lib/hours";

const SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Row = { validFrom: string; label: string; days: string[]; total: string };

/** Jornadas cadastradas, da mais recente para a mais antiga. */
export function ScheduleList({ rows }: { rows: Row[] }) {
  const { pending, run } = useAction();
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.validFrom} className="grid gap-2 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.label}</span>
            <span className="text-sm text-muted-foreground">· {row.total} por semana</span>
            {row.validFrom !== SINCE_START && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label={`Remover ${row.label.toLowerCase()}`}
                disabled={pending}
                onClick={() => run(() => removeSchedule(row.validFrom))}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
          <dl className="grid grid-cols-7 gap-1 text-center text-xs">
            {FORM_DAYS.map((day, i) => (
              <div key={day}>
                <dt className="text-muted-foreground">{SHORT[day]}</dt>
                <dd className="font-mono tabular-nums">{row.days[i]}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/** Formulário de uma jornada nova: 7 durações e a data a partir da qual vale. */
export function ScheduleForm(props: { validFrom: string; hours: string[] }) {
  const [validFrom, setValidFrom] = useState(props.validFrom);
  const [hours, setHours] = useState(props.hours);
  const { pending, run } = useAction();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveSchedule({ validFrom, hours }));
      }}
    >
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {FORM_DAYS.map((day) => (
          <div key={day} className="grid gap-1.5">
            <Label htmlFor={`day-${day}`}>{SHORT[day]}</Label>
            <Input
              id={`day-${day}`}
              required
              inputMode="numeric"
              pattern="\d{1,2}:[0-5]\d"
              value={hours[day]}
              onChange={(e) => setHours(hours.map((h, i) => (i === day ? e.target.value : h)))}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="valid-from">Vale a partir de</Label>
        <Input
          id="valid-from"
          type="date"
          className="w-44"
          value={validFrom}
          onChange={(e) => setValidFrom(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Os dias antes desta data mantêm a jornada que valia para eles. Em branco, substitui a
          jornada desde o início.
        </p>
      </div>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar jornada"}
      </Button>
    </form>
  );
}
