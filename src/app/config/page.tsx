import { connection } from "next/server";
import { Suspense } from "react";
import { ScheduleForm, ScheduleList } from "@/components/schedule-form";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentNow } from "@/lib/data";
import { firstPunchDate, getSettings, listSchedules } from "@/lib/db";
import { scheduleFormDefaults, scheduleRows } from "@/lib/hours";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Carregando…</p>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await connection();
  const [settings, firstPunch, schedules] = await Promise.all([
    getSettings(),
    firstPunchDate(),
    listSchedules(),
  ]);
  const defaults = scheduleFormDefaults(schedules, currentNow().date);
  return (
    <div className="grid max-w-2xl gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Jornada</CardTitle>
          <CardDescription>
            A meta de cada dia é a jornada daquele dia da semana, descontando abonos. Um dia com
            00:00 não tem meta, e o que for trabalhado nele conta como extra.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <ScheduleList rows={scheduleRows(schedules)} />
          <ScheduleForm validFrom={defaults.validFrom} hours={defaults.hours} />
        </CardContent>
      </Card>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm startDate={settings.startDate ?? ""} firstPunch={firstPunch} />
        </CardContent>
      </Card>
    </div>
  );
}
