import "server-only";
import { format } from "date-fns";
import { connection } from "next/server";
import { firstPunchDate, getSettings, listOverrides, listPunches } from "./db";
import { buildReport } from "./hours";

export const currentNow = () => {
  const d = new Date();
  return {
    date: format(d, "yyyy-MM-dd"),
    minutes: d.getHours() * 60 + d.getMinutes(),
  };
};

/** Carrega todos os dias do banco de horas, do início até hoje. */
export async function loadBank() {
  await connection();
  const now = currentNow();
  const settings = getSettings();
  const startDate = settings.startDate ?? firstPunchDate() ?? now.date;
  const days = buildReport({
    startDate,
    punches: listPunches(startDate),
    overrides: listOverrides(),
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
