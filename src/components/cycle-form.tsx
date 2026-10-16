"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { removeCycle, saveCycle } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAction } from "@/components/use-action";
import { SINCE_START } from "@/lib/hours";

const OPTIONS = [
  { value: 0, label: "Sem prazo" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: i === 0 ? "1 mês" : `${i + 1} meses`,
  })),
];

type Row = { validFrom: string; label: string; rule: string };

/** Prazos cadastrados, do mais recente para o mais antigo. */
export function CycleList({ rows }: { rows: Row[] }) {
  const { pending, run } = useAction();
  return (
    <ul className="grid gap-2">
      {rows.map((row) => (
        <li key={row.validFrom} className="flex items-center gap-2 rounded-lg border p-3">
          <span className="font-medium">{row.label}</span>
          <span className="text-sm text-muted-foreground">· {row.rule}</span>
          {row.validFrom !== SINCE_START && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              aria-label={`Remover regra ${row.label.toLowerCase()}`}
              disabled={pending}
              onClick={() => run(() => removeCycle(row.validFrom))}
            >
              <Trash2Icon />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Formulário de um prazo novo: a duração do ciclo e a data em que o primeiro começa. */
export function CycleForm(props: { validFrom: string; months: number }) {
  const [validFrom, setValidFrom] = useState(props.validFrom);
  const [months, setMonths] = useState(props.months);
  const { pending, run } = useAction();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCycle({ validFrom, months }));
      }}
    >
      <div className="flex flex-wrap gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="cycle-months">Ciclo de</Label>
          <Select items={OPTIONS} value={months} onValueChange={(value) => setMonths(value ?? 0)}>
            <SelectTrigger id="cycle-months" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cycle-from">A partir de</Label>
          <Input
            id="cycle-from"
            type="date"
            required
            className="w-44"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        O primeiro ciclo começa nesta data, e os seguintes a cada tantos meses. No primeiro dia de
        cada ciclo o saldo volta a 00:00, e o relatório guarda o saldo com que o ciclo fechou.
      </p>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar prazo"}
      </Button>
    </form>
  );
}
