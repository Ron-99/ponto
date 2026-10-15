"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { addPunch } from "@/app/actions";
import { TypeToggle } from "@/components/type-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "@/components/use-action";
import type { PunchType } from "@/lib/hours";

export function ManualPunchDialog({
  defaultDate,
  defaultType,
}: {
  defaultDate: string;
  defaultType: PunchType;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [type, setType] = useState<PunchType>(defaultType);
  const [note, setNote] = useState("");
  const { pending, run } = useAction();

  const onOpenChange = (next: boolean) => {
    if (next) {
      setDate(defaultDate);
      setTime("");
      setType(defaultType);
      setNote("");
    }
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="lg" className="h-12 w-full px-5 sm:w-auto" />}
      >
        <PlusIcon />
        Batida avulsa
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addPunch({ date, time, type, note }),
              () => setOpen(false),
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>Batida avulsa</DialogTitle>
            <DialogDescription>
              Registre um horário esquecido. As batidas do dia precisam alternar entrada e saída.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="mp-date">Data</Label>
              <Input
                id="mp-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mp-time">Horário</Label>
              <Input
                id="mp-time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <TypeToggle value={type} onChange={setType} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="mp-note">Observação (opcional)</Label>
            <Input
              id="mp-note"
              value={note}
              placeholder="Ex.: esqueci de bater na volta do almoço"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
