# Abono parcial verification

**Verdict**: PASS
**Profile**: light
**Diff range**: b16ab8a..afcc38a
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

## Scope of this round

Round 1 (at `a7349d9`) found one FAIL, C21. The C21 fix is `afcc38a` and changes only
`src/lib/db.test.ts`. The range `a7349d9..afcc38a` also contains `7f53a9a`, the feriados-nacionais
feature. That commit touches `src/lib/db.ts`, `src/lib/hours.ts`, `src/lib/hours.test.ts`,
`src/lib/data.ts` and `src/components/day-dialog.tsx`, so this round is scoped by that diff as
well as by the fix:

- `db.ts`: adds `syncedHolidayYears` and `saveHolidays` after `setOverride`. `applyMigrations`
  (`:62`, `:71-74`), `MIGRATIONS` and `setOverride` are unchanged. `saveHolidays` inserts
  `feriado` rows with `ON CONFLICT (date) DO NOTHING`, so it cannot overwrite an existing abono
  parcial, and the new rows have `minutes` NULL (dia inteiro).
- `hours.ts`: appends `overrideTitle`. `targetFor`, `summarizeDay`, `closeTime`,
  `targetDescription`, `overrideHoursValue` and `partialOverrideLabel` are unchanged.
- `hours.test.ts`: one import line was added, so every abono citation moved +1. They are
  refreshed below.
- `day-dialog.tsx`: only the label text changes (`overrideTitle`). `OverridePicker` and its key
  are unchanged.
- `data.ts`: `loadBank` now syncs holidays before reading overrides. It does not change how
  `minutes` reaches `buildReport`.

## Binding sources

None are marked binding, so step 1 (`ui`-only) did not run under `light`. Carried from a7349d9.

## Checks

All proofs re-ran in full at `afcc38a`, in one invocation, in an isolated worktree:
`bun test --conditions react-server --reporter=junit src/lib/hours.test.ts src/lib/db.test.ts src/app/actions.test.ts`
gave exit 0, with 40 passed, 0 failed and 0 skipped. I grepped the junit output for each of the
21 names below and found each as its own `<testcase>` with no `<failure>`. The C21 result was
verified at afcc38a. The other citations were re-checked at afcc38a: `hours.test.ts` lines moved
+1, while `actions.test.ts` and `db.test.ts` lines 1-126 are unchanged. The verdicts on C1-C20
are carried from a7349d9.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | parcial 120, jornada 480 -> target 360 | `-t "abono parcial reduz a meta"` passed | `src/lib/hours.test.ts:199` - `expect(targetFor(MON, partial(MON, 120), 480)).toBe(360)`; `:200` same via `summarizeDay(...).target` | PASS |
| C2 | jornada <= minutos -> target 0 | `-t "abono parcial nunca deixa meta negativa"` passed | `src/lib/hours.test.ts:204` - `expect(targetFor(MON, partial(MON, 120), 120)).toBe(0)`; `:205` - `...(MON, partial(MON, 120), 60)).toBe(0)` | PASS |
| C3 | passado sem batidas: `falta`, bankDelta -360 | `-t "abono parcial sem batidas é falta"` passed | `src/lib/hours.test.ts:210` - `expect(d.status).toBe("falta")`; `:211` - `expect(d.bankDelta).toBe(-360)` | PASS |
| C4 | pares fechados -> `ok` | `-t "abono parcial com pares fechados é ok"` passed | `src/lib/hours.test.ts:222` - `expect(d.status).toBe("ok")` (`:223` balance 0) | PASS |
| C5 | minutes NULL -> target 0 and `abonado`, with and without punches | `-t "abono de dia inteiro mantém meta zero"` passed | `src/lib/hours.test.ts:228-229` - `empty.target).toBe(0)`, `empty.status).toBe("abonado")`; `:231-232` the same for `worked` | PASS |
| C6 | hoje, parcial 120, entry 08:00, now 09:00 -> meta 06:00, close 14:00 | `-t "saída para fechar usa meta reduzida"` passed | `src/lib/hours.test.ts:238` - `expect(formatDuration(d.target)).toBe("06:00")`; `:239` - `expect(closeTime(d, now.minutes)).toBe("14:00")` | PASS |
| C7 | "02:00" stores 120 and returns "Atestado de 02:00 registrado." | `-t "registra abono parcial"` passed | `src/app/actions.test.ts:30` - `toEqual({ ok: true, message: "Atestado de 02:00 registrado." })`; `:31` - `minutes).toBe(120)` | PASS |
| C8 | empty hours -> NULL and "Dia marcado como atestado." | `-t "horas vazias abonam o dia inteiro"` passed | `src/app/actions.test.ts:36` - `toEqual({ ok: true, message: "Dia marcado como atestado." })`; `:39` - `row?.minutes).toBeNull()` | PASS |
| C9 | "2:0", "abc", "00:00" refused, nothing stored | `-t "recusa horas abonadas inválidas"` passed | `src/app/actions.test.ts:44-47` - loop over all 3 inputs, `toEqual({ ok: false, error: "Horas abonadas devem estar no formato HH:MM." })`; `:49` - `overrideOn(MON)).toBeUndefined()` | PASS |
| C10 | "08:00", "09:00" refused with the jornada message | `-t "recusa abono parcial maior ou igual à jornada"` passed | `src/app/actions.test.ts:54-58` - `error: "Abono parcial deve ser menor que a jornada de 08:00. Para o dia todo, deixe as horas em branco."`; `:60` - `toBeUndefined()` | PASS |
| C11 | Saturday "02:00" refused | `-t "recusa abono parcial no fim de semana"` passed | `src/app/actions.test.ts:64-67` - `error: "Fim de semana já tem meta de 0h."`; `:68` - `overrideOn(SAT)).toBeUndefined()` | PASS |
| C12 | parcial -> inteiro leaves one row with NULL | `-t "parcial vira dia inteiro"` passed | `src/app/actions.test.ts:75` - `expect(rows).toHaveLength(1)`; `:76` - `rows[0].minutes).toBeNull()` | PASS |
| C13 | "Dia normal" removes the row | `-t "dia normal remove abono parcial"` passed | `src/app/actions.test.ts:82` - `expect(await overrideOn(MON)).toBeUndefined()` | PASS |
| C14 | card text, parcial and full-day | `-t "descrição da meta do dia"` passed | `src/lib/hours.test.ts:243-244` - `.toBe("Meta de 06:00 (atestado de 02:00)")`; `:246-247` - `.toBe("Meta de 00:00 (dia abonado)")` | PASS |
| C15 | initial hours "02:00" / "" | `-t "valor inicial das horas abonadas"` passed | `src/lib/hours.test.ts:253` - `overrideHoursValue(partial(MON, 120))).toBe("02:00")`; `:254-255` - `.toBe("")` for full and null | PASS |
| C16 | badge "Atestado 02:00" / null | `-t "badge do abono parcial"` passed | `src/lib/hours.test.ts:259` - `.toBe("Atestado 02:00")`; `:260-261` - `.toBeNull()` for full and null | PASS |
| C17 | old DB with no version -> `minutes` column and version "1" | `-t "migra banco sem versão"` passed | `src/lib/db.test.ts:53` - `expect(await columns(client)).toContain("minutes")`; `:54` - `expect(await version(client)).toBe("1")` | PASS |
| C18 | existing overrides keep NULL, same accumulated | `-t "migração preserva abonos e saldo"` passed | `src/lib/db.test.ts:75` - `after.map((o) => o.minutes)).toEqual([null, null])`; `:84` - `accumulated(after)).toBe(accumulated(before))` | PASS |
| C19 | concurrent migration -> batch fails, connection proceeds | `-t "migração concorrente segue"` passed | `src/lib/db.test.ts:105` - `await db.applyMigrations(racing)` with no rejection (the proxy at `:93-99` applies migration 1 first); `:107` - `version(client)).toBe("1")` | PASS |
| C20 | failure with version still < 1 propagates | `-t "falha de migração propaga"` passed | `src/lib/db.test.ts:114` - `await expect(db.applyMigrations(client)).rejects.toThrow()`; `:115` - `version(client)).toBeUndefined()` | PASS |
| C21 | DB already at version 1 does not run the ALTER again | `-t "migração não roda duas vezes"` passed (verified at afcc38a) | `src/lib/db.test.ts:143` - `expect(batches).toHaveLength(0)`, where the `counting` proxy at `:129-140` records every `batch` call made by `db.applyMigrations(counting)` (`:142`) on a version-1 DB. Mutation re-check: changing `src/lib/db.ts:62` to `let version = 1;` now fails the test with `Expected length: 0, Received length: 1`. Reverted. | PASS |

## Mutation re-check (scoped to the fix)

Under `light`, step 4 (fault injection) does not run. This one mutation re-checks the fix to C21.

| Mutation | Location | Killed |
| --- | --- | --- |
| `applyMigrations` always starts at version 1 (ignores `schema_version`) | `src/lib/db.ts:62` | yes - C21 fails at `src/lib/db.test.ts:143` |

## Level and sampling judgment

Re-checked at afcc38a: `page.tsx` is unchanged and still only renders the helpers
(`{targetDescription(today)}` `:107`, `closeTime(today, now.minutes)` `:131`, `remaining` from
`today.target` `:37`). The rest is carried from a7349d9:

- C14, C15, C16 and C6 prove pure helpers, not rendering. That level gap is declared and accepted
  under `light`.
- C20 tests `applyMigrations` directly. The "next request retries" half of AC 20 relies on the
  pre-existing `.catch` in `db()`, which no proof exercises. Minor note, not a failure.
- C7 samples only `atestado`. The `folga` -> "registrada" branch (`src/app/actions.ts:142`) has no
  proof, and no check claims it. Round 1 cited this as `:143`, and the line is corrected here.

## Swept existing

| Row | Cited constraint | In code |
| --- | --- | --- |
| authorization | `setDayOverride` starts with `if (!(await authorized())) return UNAUTHORIZED` | yes, `src/app/actions.ts:119` (re-read at afcc38a, unchanged) |

The `n/a` rows (dependency failure, observability) are approved policy, so there was nothing to
re-read. Carried from a7349d9.

## Gate

`bun test --conditions react-server src/lib/hours.test.ts src/lib/db.test.ts src/app/actions.test.ts`
at afcc38a: 40 passed, 0 failed (exit 0). The extra test compared with round 1 is the feriados
test "título do abono mostra a observação".

`validate_verification.py` was **not run**. The environment is Git Bash on Windows with no Python
interpreter, so the completion gate has not checked this report mechanically.

## Ranked gaps

None. The round 1 C21 gap is closed by `afcc38a`, and the mutation confirms the new assertion
catches the regression.

## Isolation

Proofs and the mutation ran in a temporary worktree at `afcc38a`, and the mutation was reverted
(`git status --porcelain` empty afterwards). This verifier wrote only this file in the main tree
and made no commit.
