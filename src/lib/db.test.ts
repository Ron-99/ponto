import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Client, createClient } from "@libsql/client";
import { buildReport, type DayOverride } from "./hours";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ponto-db-"));
process.env.PONTO_DB = path.join(dir, "unused.db");
const db = await import("./db");

const globalForDb = globalThis as unknown as { pontoDb?: Promise<Client> };

// Esquema anterior à migração 1, como está nos bancos já em uso.
const OLD_SCHEMA = [
  `CREATE TABLE punches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, time TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('clock', 'manual')),
    note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE day_overrides (date TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('feriado', 'folga', 'atestado')), note TEXT)`,
  "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
];

let count = 0;
async function oldDatabase() {
  const file = path.join(dir, `old-${count++}.db`);
  const client = createClient({ url: `file:${file}` });
  await client.batch(OLD_SCHEMA, "write");
  return { file, client };
}

const useDatabase = (file: string) => {
  process.env.PONTO_DB = file;
  globalForDb.pontoDb = undefined;
};

const columns = async (client: Client) =>
  (await client.execute("PRAGMA table_info(day_overrides)")).rows.map((r) => r.name);
const version = async (client: Client) =>
  (await client.execute("SELECT value FROM settings WHERE key = 'schema_version'")).rows[0]?.value;

afterEach(() => {
  globalForDb.pontoDb = undefined;
});

describe("migrações", () => {
  test("migra banco sem versão", async () => {
    const { file, client } = await oldDatabase();
    useDatabase(file);
    await db.listOverrides();
    expect(await columns(client)).toContain("minutes");
    expect(await version(client)).toBe("1");
  });

  test("migração preserva abonos e saldo", async () => {
    const { file, client } = await oldDatabase();
    await client.batch(
      [
        "INSERT INTO day_overrides (date, kind, note) VALUES ('2026-10-12', 'feriado', 'Aparecida')",
        "INSERT INTO day_overrides (date, kind, note) VALUES ('2026-10-14', 'folga', NULL)",
      ],
      "write",
    );
    const before: DayOverride[] = (
      await client.execute("SELECT date, kind, note FROM day_overrides ORDER BY date")
    ).rows.map((r) => ({
      date: String(r.date),
      kind: r.kind as DayOverride["kind"],
      note: (r.note as string | null) ?? null,
    }));
    useDatabase(file);
    const after = await db.listOverrides();
    expect(after.map((o) => o.minutes)).toEqual([null, null]);
    const accumulated = (overrides: DayOverride[]) =>
      buildReport({
        startDate: "2026-10-12",
        punches: [],
        overrides,
        dailyMinutes: 480,
        now: { date: "2026-10-16", minutes: 0 },
      }).at(-1)?.accumulated;
    expect(accumulated(after)).toBe(accumulated(before));
    // Seg e qua abonadas, ter e qui faltas, sex é hoje e não penaliza.
    expect(accumulated(after)).toBe(-2 * 480);
  });

  test("migração concorrente segue", async () => {
    const { file, client } = await oldDatabase();
    const other = createClient({ url: `file:${file}` });
    // Outra instância aplica a migração 1 logo antes do nosso batch.
    const racing = new Proxy(client, {
      get(target, prop) {
        if (prop === "batch") {
          return async (...args: Parameters<Client["batch"]>) => {
            await db.applyMigrations(other);
            return target.batch(...args);
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await db.applyMigrations(racing);
    expect(await columns(client)).toContain("minutes");
    expect(await version(client)).toBe("1");
  });

  test("falha de migração propaga", async () => {
    const { client } = await oldDatabase();
    // Coluna já existe mas a versão não: o ALTER falha e ninguém gravou a versão.
    await client.execute("ALTER TABLE day_overrides ADD COLUMN minutes INTEGER");
    await expect(db.applyMigrations(client)).rejects.toThrow();
    expect(await version(client)).toBeUndefined();
  });

  test("migração não roda duas vezes", async () => {
    const { file, client } = await oldDatabase();
    useDatabase(file);
    await db.listOverrides();
    globalForDb.pontoDb = undefined;
    // Uma segunda conexão a um banco em versão 1 não pode tentar o ALTER de novo.
    await expect(db.listOverrides()).resolves.toEqual([]);
    expect(await version(client)).toBe("1");

    // O erro de um ALTER repetido seria engolido pela releitura da versão, então
    // conta os batches: num banco já migrado, nenhum pode ser enviado.
    const batches: unknown[] = [];
    const counting = new Proxy(client, {
      get(target, prop) {
        if (prop === "batch") {
          return (...args: Parameters<Client["batch"]>) => {
            batches.push(args[0]);
            return target.batch(...args);
          };
        }
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await db.applyMigrations(counting);
    expect(batches).toHaveLength(0);
  });
});
