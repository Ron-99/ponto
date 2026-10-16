import { connection } from "next/server";
import { Suspense } from "react";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { firstPunchDate, getSettings } from "@/lib/db";
import { toTime } from "@/lib/hours";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Carregando…</p>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await connection();
  const [settings, firstPunch] = await Promise.all([getSettings(), firstPunchDate()]);
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Configurações</CardTitle>
        <CardDescription>
          A meta semanal é a jornada diária × dias úteis (segunda a sexta), descontando dias
          abonados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SettingsForm
          dailyHours={toTime(settings.dailyMinutes)}
          startDate={settings.startDate ?? ""}
          firstPunch={firstPunch}
        />
      </CardContent>
    </Card>
  );
}
