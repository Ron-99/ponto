import "server-only";
import { saveHolidays, syncedHolidayYears } from "./db";

/** Feriados nacionais da BrasilAPI: https://brasilapi.com.br/docs#tag/Feriados-Nacionais */
const API = "https://brasilapi.com.br/api/feriados/v1";
const TIMEOUT_MS = 3_000;
const RETRY_AFTER_MS = 60 * 60 * 1000;

// Ano -> momento da última falha, para não esperar o timeout em toda requisição com a API fora.
const globalForHolidays = globalThis as unknown as { pontoHolidayFailures?: Map<number, number> };
globalForHolidays.pontoHolidayFailures ??= new Map();
const failures = globalForHolidays.pontoHolidayFailures;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Holiday = { date: string; name: string };

async function fetchYear(year: number): Promise<Holiday[]> {
  let response: Response;
  try {
    response = await fetch(`${API}/${year}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const name = (error as Error)?.name;
    throw new Error(name === "TimeoutError" || name === "AbortError" ? "timeout" : String(error));
  }
  if (response.status !== 200) throw new Error(`status ${response.status}`);
  const body: unknown = await response.json().catch(() => null);
  const valid =
    Array.isArray(body) &&
    body.length > 0 &&
    body.every((h) => typeof h?.date === "string" && typeof h?.name === "string");
  if (!valid) throw new Error("resposta inválida");
  return (body as Holiday[]).filter((h) => DATE_RE.test(h.date) && h.date.startsWith(`${year}-`));
}

/**
 * Importa uma única vez os feriados nacionais de cada ano entre `startDate` e `today`
 * como abonos "feriado". Abonos já existentes prevalecem, e um feriado removido pelo
 * usuário não volta porque o ano fica marcado como sincronizado.
 */
export async function syncNationalHolidays(startDate: string, today: string) {
  if (startDate > today) return;
  const done = new Set(await syncedHolidayYears());
  const now = Date.now();
  const years: number[] = [];
  for (let y = Number(startDate.slice(0, 4)); y <= Number(today.slice(0, 4)); y++) {
    const failedAt = failures.get(y);
    if (!done.has(y) && (failedAt === undefined || now - failedAt >= RETRY_AFTER_MS)) years.push(y);
  }
  await Promise.all(
    years.map(async (year) => {
      try {
        await saveHolidays(year, await fetchYear(year));
        failures.delete(year);
      } catch (error) {
        failures.set(year, Date.now());
        console.error(`[feriados] falha ao importar ${year}: ${(error as Error).message}`);
      }
    }),
  );
}
