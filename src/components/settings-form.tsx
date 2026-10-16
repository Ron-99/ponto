"use client";

import { useState } from "react";
import { updateSettings } from "@/app/actions";
import { formatDate } from "@/components/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/components/use-action";

export function SettingsForm(props: { startDate: string; firstPunch: string | null }) {
  const [startDate, setStartDate] = useState(props.startDate);
  const { pending, run } = useAction();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateSettings({ startDate }));
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="start">Início do banco de horas</Label>
        <Input
          id="start"
          type="date"
          className="w-44"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Dias úteis a partir desta data sem batidas contam como falta. Em branco, usa a data da
          primeira batida
          {props.firstPunch ? ` (${formatDate(props.firstPunch)})` : ""}.
        </p>
      </div>
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
