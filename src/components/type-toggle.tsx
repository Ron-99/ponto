"use client";

import { Button } from "@/components/ui/button";
import type { PunchType } from "@/lib/hours";

export function TypeToggle({
  value,
  onChange,
}: {
  value: PunchType;
  onChange: (value: PunchType) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5" role="radiogroup">
      {(["in", "out"] as const).map((t) => (
        <Button
          key={t}
          type="button"
          size="sm"
          role="radio"
          aria-checked={value === t}
          variant={value === t ? "default" : "ghost"}
          onClick={() => onChange(t)}
        >
          {t === "in" ? "Entrada" : "Saída"}
        </Button>
      ))}
    </div>
  );
}
