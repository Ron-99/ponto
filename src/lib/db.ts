import "server-only";
import fs from "node:fs";
import path from "node:path";
import { type Client, createClient, type InArgs } from "@libsql/client";
import type { DayOverride, OverrideKind, Punch, PunchType } from "./hours";

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
const MIGRATIONS: string[][] = [
  // 1: abono parcial (minutos abonados; NULL = dia inteiro)
  ["ALTER TABLE day_overrides ADD COLUMN minutes INTEGER CHECK (minutes IS NULL OR minutes > 0)"],
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

export type Settings = {
  dailyMinutes: number;
  /** Data de início do banco; se vazia, usa a primeira batida. */
  startDate: string | null;
};

export async function getSettings(): Promise<Settings> {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    dailyMinutes: Number(map.get("daily_minutes") ?? 480),
    startDate: map.get("start_date") || null,
  };
}

export async function saveSettings(s: Settings) {
  await (await db()).batch(
    [
      { sql: UPSERT_SETTING, args: ["daily_minutes", String(s.dailyMinutes)] },
      { sql: UPSERT_SETTING, args: ["start_date", s.startDate ?? ""] },
    ],
    "write",
  );
}

export async function firstPunchDate(): Promise<string | null> {
  const [row] = await all<{ d: string | null }>("SELECT min(date) AS d FROM punches");
  return row?.d ?? null;
}
