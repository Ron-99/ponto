import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DayOverride, OverrideKind, Punch, PunchType } from "./hours";

const DB_PATH = process.env.PONTO_DB ?? path.join(process.cwd(), "data", "ponto.db");

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS punches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('in', 'out')),
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('clock', 'manual')),
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS punches_date ON punches (date, time);
    CREATE TABLE IF NOT EXISTS day_overrides (
      date TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('feriado', 'folga', 'atestado')),
      note TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  return db;
}

// Reaproveita a conexão entre recarregamentos do dev server.
const globalForDb = globalThis as unknown as { pontoDb?: Database.Database };
const db = globalForDb.pontoDb ?? open();
globalForDb.pontoDb = db;

const PUNCH_COLUMNS = "id, date, time, type, note";

export function listPunches(from?: string, to?: string): Punch[] {
  return db
    .prepare(
      `SELECT ${PUNCH_COLUMNS} FROM punches
       WHERE date >= coalesce(?, '0000-00-00') AND date <= coalesce(?, '9999-99-99')
       ORDER BY date, time, id`,
    )
    .all(from ?? null, to ?? null) as Punch[];
}

export const punchesOn = (date: string) => listPunches(date, date);

export const getPunch = (id: number) =>
  db.prepare(`SELECT ${PUNCH_COLUMNS} FROM punches WHERE id = ?`).get(id) as Punch | undefined;

export function insertPunch(p: {
  date: string;
  time: string;
  type: PunchType;
  source: "clock" | "manual";
  note?: string | null;
}) {
  db.prepare("INSERT INTO punches (date, time, type, source, note) VALUES (?, ?, ?, ?, ?)").run(
    p.date,
    p.time,
    p.type,
    p.source,
    p.note || null,
  );
}

export function updatePunch(
  id: number,
  p: { time: string; type: PunchType; note?: string | null },
) {
  db.prepare("UPDATE punches SET time = ?, type = ?, note = ? WHERE id = ?").run(
    p.time,
    p.type,
    p.note || null,
    id,
  );
}

export function deletePunch(id: number) {
  db.prepare("DELETE FROM punches WHERE id = ?").run(id);
}

export function listOverrides(): DayOverride[] {
  return db
    .prepare("SELECT date, kind, note FROM day_overrides ORDER BY date")
    .all() as DayOverride[];
}

export function setOverride(date: string, kind: OverrideKind | null, note?: string | null) {
  if (kind) {
    db.prepare(
      `INSERT INTO day_overrides (date, kind, note) VALUES (?, ?, ?)
       ON CONFLICT (date) DO UPDATE SET kind = excluded.kind, note = excluded.note`,
    ).run(date, kind, note || null);
  } else {
    db.prepare("DELETE FROM day_overrides WHERE date = ?").run(date);
  }
}

export type Settings = {
  dailyMinutes: number;
  /** Data de início do banco; se vazia, usa a primeira batida. */
  startDate: string | null;
};

export function getSettings(): Settings {
  const rows = db.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    dailyMinutes: Number(map.get("daily_minutes") ?? 480),
    startDate: map.get("start_date") || null,
  };
}

export function saveSettings(s: Settings) {
  const upsert = db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
  );
  db.transaction(() => {
    upsert.run("daily_minutes", String(s.dailyMinutes));
    upsert.run("start_date", s.startDate ?? "");
  })();
}

export function firstPunchDate(): string | null {
  const row = db.prepare("SELECT min(date) AS d FROM punches").get() as {
    d: string | null;
  };
  return row.d;
}
