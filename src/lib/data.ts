import "server-only";
import { connection } from "next/server";
import { firstPunchDate, getSettings, listOverrides, listPunches } from "./db";
import { buildReport } from "./hours";

// O servidor da Vercel roda em UTC; o ponto precisa do horário local de quem trabalha.
const TIME_ZONE = process.env.APP_TIMEZONE ?? "America/Sao_Paulo";

const nowFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Data (yyyy-MM-dd) e minutos desde a meia-noite no fuso configurado. */
export const currentNow = () => {
  const parts = Object.fromEntries(
    nowFormatter.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

/** Carrega todos os dias do banco de horas, do início até hoje. */
export async function loadBank() {
  await connection();
  const now = currentNow();
  const [settings, firstPunch, overrides] = await Promise.all([
    getSettings(),
    firstPunchDate(),
    listOverrides(),
  ]);
  const startDate = settings.startDate ?? firstPunch ?? now.date;
  const days = buildReport({
    startDate,
    punches: await listPunches(startDate),
    overrides,
    dailyMinutes: settings.dailyMinutes,
    now,
  });
  return {
    now,
    settings,
    startDate,
    days,
    total: days.at(-1)?.accumulated ?? 0,
  };
}
