import "server-only";
import fs from "node:fs";
import path from "node:path";
import { type Client, createClient, type InArgs } from "@libsql/client";
import type { BankCycle, DayOverride, OverrideKind, Punch, PunchType, WorkSchedule } from "./hours";

/**
 * Em produção (Vercel) usa o Turso via TURSO_DATABASE_URL/TURSO_AUTH_TOKEN.
 * Localmente usa um arquivo SQLite em data/ponto.db (ou PONTO_DB).
 */
function connect(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  if (process.env.VERCEL) {
    throw new Error("Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nas variáveis da Vercel.");
  }
  const file = process.env.PONTO_DB ?? path.join(process.cwd(), "data", "ponto.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return createClient({ url: `file:${file}` });
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS punches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('clock', 'manual')),
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  "CREATE INDEX IF NOT EXISTS punches_date ON punches (date, time)",
  `CREATE TABLE IF NOT EXISTS day_overrides (
    date TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('feriado', 'folga', 'atestado')),
    note TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
];

const UPSERT_SETTING =
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value";

/**
 * Migrações em ordem; a posição + 1 é a versão. Cada uma roda num batch junto com a
 * gravação de `schema_version`, então ou as duas coisas persistem ou nenhuma.
 */
const DAYS = ["d0", "d1", "d2", "d3", "d4", "d5", "d6"];

const MIGRATIONS: string[][] = [
  // 1: abono parcial (minutos abonados; NULL = dia inteiro)
  ["ALTER TABLE day_overrides ADD COLUMN minutes INTEGER CHECK (minutes IS NULL OR minutes > 0)"],
  // 2: jornada por dia da semana com vigência (d0 = domingo). A linha 0000-01-01 vale desde o
  // início e recebe a jornada única de antes, de segunda a sexta.
  [
    `CREATE TABLE work_schedules (
      valid_from TEXT PRIMARY KEY,
      ${DAYS.map((d) => `${d} INTEGER NOT NULL CHECK (${d} BETWEEN 0 AND 1440)`).join(",\n      ")}
    )`,
    `INSERT INTO work_schedules SELECT '0000-01-01', 0, m, m, m, m, m, 0
     FROM (SELECT coalesce((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'daily_minutes'), 480) AS m)`,
  ],
  // 3: prazo de compensação por vigência (0 = sem prazo). A linha 0000-01-01 vale desde o
  // início e não tem prazo, então nenhum saldo muda.
  [
    `CREATE TABLE bank_cycles (
      valid_from TEXT PRIMARY KEY,
      months INTEGER NOT NULL CHECK (months BETWEEN 0 AND 12)
    )`,
    "INSERT INTO bank_cycles (valid_from, months) VALUES ('0000-01-01', 0)",
  ],
];

async function schemaVersion(client: Client) {
  const { rows } = await client.execute("SELECT value FROM settings WHERE key = 'schema_version'");
  return Number(rows[0]?.value ?? 0);
}

export async function applyMigrations(client: Client) {
  for (let version = (await schemaVersion(client)) + 1; version <= MIGRATIONS.length; version++) {
    try {
      await client.batch(
        [
          ...MIGRATIONS[version - 1],
          { sql: UPSERT_SETTING, args: ["schema_version", String(version)] },
        ],
        "write",
      );
    } catch (error) {
      // Outra instância pode ter aplicado a mesma migração ao mesmo tempo.
      if ((await schemaVersion(client)) < version) throw error;
    }
  }
}

// Reaproveita a conexão (e a migração) entre requisições e recarregamentos do dev server.
const globalForDb = globalThis as unknown as { pontoDb?: Promise<Client> };

function db(): Promise<Client> {
  globalForDb.pontoDb ??= (async () => {
    const client = connect();
    await client.batch(SCHEMA, "write");
    await applyMigrations(client);
    return client;
  })().catch((error) => {
    globalForDb.pontoDb = undefined; // permite tentar de novo na próxima requisição
    throw error;
  });
  return globalForDb.pontoDb;
}

/** Executa uma consulta e devolve as linhas como objetos simples (serializáveis). */
async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  const result = await (await db()).execute({ sql, args });
  return result.rows.map((row) => Object.fromEntries(result.columns.map((c) => [c, row[c]])) as T);
}

async function run(sql: string, args: InArgs = []) {
  await (await db()).execute({ sql, args });
}

const PUNCH_COLUMNS = "id, date, time, type, note";

export const listPunches = (from?: string, to?: string) =>
  all<Punch>(
    `SELECT ${PUNCH_COLUMNS} FROM punches
     WHERE date >= coalesce(?, '0000-00-00') AND date <= coalesce(?, '9999-99-99')
     ORDER BY date, time, id`,
    [from ?? null, to ?? null],
  );

export const punchesOn = (date: string) => listPunches(date, date);

export const getPunch = async (id: number) =>
  (await all<Punch>(`SELECT ${PUNCH_COLUMNS} FROM punches WHERE id = ?`, [id]))[0];

export const insertPunch = (p: {
  date: string;
  time: string;
  type: PunchType;
  source: "clock" | "manual";
  note?: string | null;
}) =>
  run("INSERT INTO punches (date, time, type, source, note) VALUES (?, ?, ?, ?, ?)", [
    p.date,
    p.time,
    p.type,
    p.source,
    p.note || null,
  ]);

export const updatePunch = (
  id: number,
  p: { time: string; type: PunchType; note?: string | null },
) =>
  run("UPDATE punches SET time = ?, type = ?, note = ? WHERE id = ?", [
    p.time,
    p.type,
    p.note || null,
    id,
  ]);

export const deletePunch = (id: number) => run("DELETE FROM punches WHERE id = ?", [id]);

export const listOverrides = () =>
  all<DayOverride>("SELECT date, kind, note, minutes FROM day_overrides ORDER BY date");

/** `minutes` vazio abona o dia inteiro; preenchido, reduz a meta do dia. */
export const setOverride = (
  date: string,
  kind: OverrideKind | null,
  note?: string | null,
  minutes?: number | null,
) =>
  kind
    ? run(
        `INSERT INTO day_overrides (date, kind, note, minutes) VALUES (?, ?, ?, ?)
         ON CONFLICT (date) DO UPDATE
         SET kind = excluded.kind, note = excluded.note, minutes = excluded.minutes`,
        [date, kind, note || null, minutes || null],
      )
    : run("DELETE FROM day_overrides WHERE date = ?", [date]);

const HOLIDAYS_SYNCED = "holidays_synced:";

/** Anos cujos feriados nacionais já foram importados. */
export async function syncedHolidayYears(): Promise<number[]> {
  const rows = await all<{ key: string }>("SELECT key FROM settings WHERE key LIKE ?", [
    `${HOLIDAYS_SYNCED}%`,
  ]);
  return rows.map((r) => Number(r.key.slice(HOLIDAYS_SYNCED.length)));
}

/** Grava os feriados de um ano sem sobrescrever abonos e marca o ano, tudo num batch. */
export async function saveHolidays(year: number, holidays: { date: string; name: string }[]) {
  await (await db()).batch(
    [
      ...holidays.map((h) => ({
        sql: `INSERT INTO day_overrides (date, kind, note) VALUES (?, 'feriado', ?)
              ON CONFLICT (date) DO NOTHING`,
        args: [h.date, h.name],
      })),
      { sql: UPSERT_SETTING, args: [`${HOLIDAYS_SYNCED}${year}`, "1"] },
    ],
    "write",
  );
}

export type Settings = {
  /** Data de início do banco; se vazia, usa a primeira batida. */
  startDate: string | null;
};

// `daily_minutes` (jornada única de antes da migração 2) fica no banco e não é mais lido.
export async function getSettings(): Promise<Settings> {
  const rows = await all<{ value: string }>("SELECT value FROM settings WHERE key = 'start_date'");
  return { startDate: rows[0]?.value || null };
}

export const saveSettings = (s: Settings) => run(UPSERT_SETTING, ["start_date", s.startDate ?? ""]);

export async function listSchedules(): Promise<WorkSchedule[]> {
  const rows = await all<Record<string, string | number>>(
    `SELECT valid_from, ${DAYS.join(", ")} FROM work_schedules ORDER BY valid_from`,
  );
  return rows.map((r) => ({
    validFrom: String(r.valid_from),
    minutes: DAYS.map((d) => Number(r[d])),
  }));
}

/** Grava a jornada que vale a partir de `validFrom`; a mesma data substitui a anterior. */
export const saveSchedule = (s: WorkSchedule) =>
  run(
    `INSERT INTO work_schedules (valid_from, ${DAYS.join(", ")}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (valid_from) DO UPDATE SET ${DAYS.map((d) => `${d} = excluded.${d}`).join(", ")}`,
    [s.validFrom, ...s.minutes],
  );

export const deleteSchedule = (validFrom: string) =>
  run("DELETE FROM work_schedules WHERE valid_from = ?", [validFrom]);

export async function listCycles(): Promise<BankCycle[]> {
  const rows = await all<{ valid_from: string; months: number }>(
    "SELECT valid_from, months FROM bank_cycles ORDER BY valid_from",
  );
  return rows.map((r) => ({ validFrom: String(r.valid_from), months: Number(r.months) }));
}

/** Grava o prazo que vale a partir de `validFrom`; a mesma data substitui o anterior. */
export const saveCycle = (c: BankCycle) =>
  run(
    `INSERT INTO bank_cycles (valid_from, months) VALUES (?, ?)
     ON CONFLICT (valid_from) DO UPDATE SET months = excluded.months`,
    [c.validFrom, c.months],
  );

export const deleteCycle = (validFrom: string) =>
  run("DELETE FROM bank_cycles WHERE valid_from = ?", [validFrom]);

export async function firstPunchDate(): Promise<string | null> {
  const [row] = await all<{ d: string | null }>("SELECT min(date) AS d FROM punches");
  return row?.d ?? null;
}
