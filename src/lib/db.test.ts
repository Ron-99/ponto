import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Client, createClient } from "@libsql/client";
import { buildReport, type DayOverride, SINCE_START, type WorkSchedule } from "./hours";

const STANDARD: WorkSchedule[] = [
  { validFrom: SINCE_START, minutes: [0, 480, 480, 480, 480, 480, 0] },
];

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
const schedules = async (client: Client) =>
  (await client.execute("SELECT * FROM work_schedules ORDER BY valid_from")).rows.map((r) => [
    r.valid_from,
    ...[0, 1, 2, 3, 4, 5, 6].map((d) => Number(r[`d${d}`])),
  ]);

// Banco já na versão 1 (abono parcial), com a jornada única de antes.
async function versionOneDatabase(dailyMinutes?: number) {
  const old = await oldDatabase();
  await old.client.batch(
    [
      "ALTER TABLE day_overrides ADD COLUMN minutes INTEGER CHECK (minutes IS NULL OR minutes > 0)",
      "INSERT INTO settings (key, value) VALUES ('schema_version', '1')",
      ...(dailyMinutes === undefined
        ? []
        : [`INSERT INTO settings (key, value) VALUES ('daily_minutes', '${dailyMinutes}')`]),
    ],
    "write",
  );
  return old;
}

afterEach(() => {
  globalForDb.pontoDb = undefined;
});

describe("migrações", () => {
  test("migra banco sem versão", async () => {
    const { file, client } = await oldDatabase();
    useDatabase(file);
    await db.listOverrides();
    expect(await columns(client)).toContain("minutes");
    expect(await version(client)).toBe("3");
    expect(await schedules(client)).toEqual([[SINCE_START, 0, 480, 480, 480, 480, 480, 0]]);
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
        schedules: STANDARD,
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
    expect(await version(client)).toBe("3");
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
    // Uma segunda conexão a um banco já migrado não pode tentar as migrações de novo.
    await expect(db.listOverrides()).resolves.toEqual([]);
    expect(await version(client)).toBe("3");

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

describe("migração 2: jornada por dia da semana", () => {
  test("migração 2 copia a jornada atual", async () => {
    const { file, client } = await versionOneDatabase(450);
    useDatabase(file);
    await db.listOverrides();
    expect(await schedules(client)).toEqual([[SINCE_START, 0, 450, 450, 450, 450, 450, 0]]);
    expect(await version(client)).toBe("3");
  });

  test("migração 2 sem jornada usa 8h", async () => {
    const { file, client } = await versionOneDatabase();
    useDatabase(file);
    await db.listOverrides();
    expect(await schedules(client)).toEqual([[SINCE_START, 0, 480, 480, 480, 480, 480, 0]]);
  });

  test("migração 2 preserva o saldo", async () => {
    const { file, client } = await oldDatabase();
    await client.batch(
      [
        "INSERT INTO settings (key, value) VALUES ('daily_minutes', '450')",
        "INSERT INTO day_overrides (date, kind, note) VALUES ('2026-10-12', 'feriado', 'Aparecida')",
        "INSERT INTO punches (date, time, type) VALUES ('2026-10-13', '08:00', 'in')",
        "INSERT INTO punches (date, time, type) VALUES ('2026-10-13', '17:00', 'out')",
        "INSERT INTO punches (date, time, type) VALUES ('2026-10-17', '09:00', 'in')",
        "INSERT INTO punches (date, time, type) VALUES ('2026-10-17', '11:00', 'out')",
      ],
      "write",
    );
    useDatabase(file);
    const [overrides, punches, migrated] = await Promise.all([
      db.listOverrides(),
      db.listPunches(),
      db.listSchedules(),
    ]);
    const accumulated = (list: WorkSchedule[]) =>
      buildReport({
        startDate: "2026-10-12",
        punches,
        overrides,
        schedules: list,
        now: { date: "2026-10-20", minutes: 0 },
      }).at(-1)?.accumulated;
    // A jornada única de antes: 07:30 de segunda a sexta, 0 no fim de semana.
    const before = [{ validFrom: SINCE_START, minutes: [0, 450, 450, 450, 450, 450, 0] }];
    expect(accumulated(migrated)).toBe(accumulated(before));
    // Seg feriado, ter +90, qua a sex −450 cada, sáb +120, seg 19 −450, ter 20 é hoje.
    expect(accumulated(migrated)).toBe(90 - 3 * 450 + 120 - 450);
  });

  test("migração 2 concorrente segue", async () => {
    const { file, client } = await versionOneDatabase(480);
    const other = createClient({ url: `file:${file}` });
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
    expect(await version(client)).toBe("3");
    expect(await schedules(client)).toHaveLength(1);
  });

  test("falha da migração 2 propaga", async () => {
    const { client } = await versionOneDatabase(480);
    // A tabela já existe mas a versão não: o CREATE falha e ninguém gravou a versão 2.
    await client.execute("CREATE TABLE work_schedules (valid_from TEXT PRIMARY KEY)");
    await expect(db.applyMigrations(client)).rejects.toThrow();
    expect(await version(client)).toBe("1");
    const { rows } = await client.execute("SELECT count(*) AS n FROM work_schedules");
    expect(Number(rows[0].n)).toBe(0);
  });
});

const cycles = async (client: Client) =>
  (await client.execute("SELECT * FROM bank_cycles ORDER BY valid_from")).rows.map((r) => [
    r.valid_from,
    Number(r.months),
  ]);

// Banco já na versão 2 (jornada por dia da semana), como sai da migração 2.
async function versionTwoDatabase() {
  const old = await versionOneDatabase(480);
  await old.client.batch(
    [
      `CREATE TABLE work_schedules (valid_from TEXT PRIMARY KEY,
        d0 INTEGER NOT NULL, d1 INTEGER NOT NULL, d2 INTEGER NOT NULL, d3 INTEGER NOT NULL,
        d4 INTEGER NOT NULL, d5 INTEGER NOT NULL, d6 INTEGER NOT NULL)`,
      "INSERT INTO work_schedules VALUES ('0000-01-01', 0, 480, 480, 480, 480, 480, 0)",
      "UPDATE settings SET value = '2' WHERE key = 'schema_version'",
    ],
    "write",
  );
  return old;
}

describe("migração 3: prazo de compensação", () => {
  test("migração 3 cria o prazo desde o início", async () => {
    const { file, client } = await versionTwoDatabase();
    useDatabase(file);
    await db.listOverrides();
    expect(await cycles(client)).toEqual([[SINCE_START, 0]]);
    expect(await version(client)).toBe("3");
  });

  test("migra banco sem versão até a 3", async () => {
    const { file, client } = await oldDatabase();
    useDatabase(file);
    await db.listOverrides();
    expect(await cycles(client)).toEqual([[SINCE_START, 0]]);
    expect(await schedules(client)).toHaveLength(1);
    expect(await version(client)).toBe("3");
  });

  test("migração 3 preserva o saldo", async () => {
    const { file, client } = await versionTwoDatabase();
    await client.batch(
      [
        "INSERT INTO day_overrides (date, kind, note) VALUES ('2026-10-12', 'feriado', 'Aparecida')",
        "INSERT INTO punches (date, time, type) VALUES ('2026-10-13', '08:00', 'in')",
        "INSERT INTO punches (date, time, type) VALUES ('2026-10-13', '18:00', 'out')",
        "INSERT INTO punches (date, time, type) VALUES ('2026-10-17', '09:00', 'in')",
        "INSERT INTO punches (date, time, type) VALUES ('2026-10-17', '11:00', 'out')",
      ],
      "write",
    );
    useDatabase(file);
    const [overrides, punches, list, migrated] = await Promise.all([
      db.listOverrides(),
      db.listPunches(),
      db.listSchedules(),
      db.listCycles(),
    ]);
    const input = {
      startDate: "2026-10-12",
      punches,
      overrides,
      schedules: list,
      now: { date: "2026-10-20", minutes: 0 },
    };
    const withCycles = buildReport({ ...input, cycles: migrated }).map((d) => d.accumulated);
    expect(withCycles).toEqual(buildReport(input).map((d) => d.accumulated));
    // Seg feriado, ter +120, qua a sex −480 cada, sáb +120, seg 19 −480, ter 20 é hoje.
    expect(withCycles.at(-1)).toBe(120 - 3 * 480 + 120 - 480);
  });

  test("migração 3 concorrente segue", async () => {
    const { file, client } = await versionTwoDatabase();
    const other = createClient({ url: `file:${file}` });
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
    expect(await version(client)).toBe("3");
    expect(await cycles(client)).toHaveLength(1);
  });

  test("falha da migração 3 propaga", async () => {
    const { client } = await versionTwoDatabase();
    // A tabela já existe mas a versão não: o CREATE falha e ninguém gravou a versão 3.
    await client.execute("CREATE TABLE bank_cycles (valid_from TEXT PRIMARY KEY)");
    await expect(db.applyMigrations(client)).rejects.toThrow();
    expect(await version(client)).toBe("2");
    const { rows } = await client.execute("SELECT count(*) AS n FROM bank_cycles");
    expect(Number(rows[0].n)).toBe(0);
  });
});
