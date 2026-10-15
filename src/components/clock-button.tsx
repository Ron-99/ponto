"use client";

import { LogInIcon, LogOutIcon } from "lucide-react";
import { clockPunch } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import type { PunchType } from "@/lib/hours";

export function ClockButton({ next }: { next: PunchType }) {
  const { pending, run } = useAction();
  const Icon = next === "in" ? LogInIcon : LogOutIcon;
  return (
    <Button
      size="lg"
      className="h-12 w-full px-6 text-base sm:w-auto"
      disabled={pending}
      onClick={() => run(clockPunch)}
    >
      <Icon className="size-5" />
      {pending ? "Registrando…" : `Bater ponto · ${next === "in" ? "Entrada" : "Saída"}`}
    </Button>
  );
}
