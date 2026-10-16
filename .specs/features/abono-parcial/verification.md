# Abono parcial verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: b16ab8a..a7349d9
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

None are marked binding. The plan's only source is `ROADMAP.md`, item "Abono parcial" (examples
plus the rule "reduz a meta daquele dia"), and the brief said nothing beyond it binds. Step 1 is
`ui`-only and did not run under `light`.

## Checks

All proofs ran in one invocation at `a7349d9`, in an isolated worktree:
`bun test --conditions react-server --reporter=junit src/lib/hours.test.ts src/lib/db.test.ts src/app/actions.test.ts`
gave exit 0, with 39 passed, 0 failed and 0 skipped. Each of the 21 names below appears as its own
`<testcase>` in the junit output with no `<failure>`. All 21 tests were added in this diff
(`git diff b16ab8a..a7349d9 --stat -- '*.test.ts'`: +84 actions, +127 db, +86 hours).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | parcial 120, jornada 480 -> target 360 | `-t "abono parcial reduz a meta"` passed | `src/lib/hours.test.ts:198` - `expect(targetFor(MON, partial(MON, 120), 480)).toBe(360)`; `:199` same via `summarizeDay(...).target` | PASS |
| C2 | jornada <= minutos -> target 0 | `-t "abono parcial nunca deixa meta negativa"` passed | `src/lib/hours.test.ts:203` - `expect(targetFor(MON, partial(MON, 120), 120)).toBe(0)`; `:204` - `...(MON, partial(MON, 120), 60)).toBe(0)` | PASS |
| C3 | passado sem batidas: `falta`, bankDelta -360 | `-t "abono parcial sem batidas é falta"` passed | `src/lib/hours.test.ts:209` - `expect(d.status).toBe("falta")`; `:210` - `expect(d.bankDelta).toBe(-360)` | PASS |
| C4 | pares fechados -> `ok` | `-t "abono parcial com pares fechados é ok"` passed | `src/lib/hours.test.ts:221` - `expect(d.status).toBe("ok")` (`:222` balance 0, the plan's independent test) | PASS |
| C5 | minutes NULL -> target 0 and `abonado`, with and without punches | `-t "abono de dia inteiro mantém meta zero"` passed | `src/lib/hours.test.ts:227-228` - `empty.target).toBe(0)`, `empty.status).toBe("abonado")`; `:230-231` the same for `worked` | PASS |
| C6 | hoje, parcial 120, entry 08:00, now 09:00 -> meta 06:00, close 14:00 | `-t "saída para fechar usa meta reduzida"` passed | `src/lib/hours.test.ts:237` - `expect(formatDuration(d.target)).toBe("06:00")`; `:238` - `expect(closeTime(d, now.minutes)).toBe("14:00")` | PASS |
| C7 | "02:00" stores 120 and returns "Atestado de 02:00 registrado." | `-t "registra abono parcial"` passed | `src/app/actions.test.ts:30` - `toEqual({ ok: true, message: "Atestado de 02:00 registrado." })`; `:31` - `minutes).toBe(120)` | PASS |
| C8 | empty hours -> NULL and "Dia marcado como atestado." | `-t "horas vazias abonam o dia inteiro"` passed | `src/app/actions.test.ts:36` - `toEqual({ ok: true, message: "Dia marcado como atestado." })`; `:39` - `row?.minutes).toBeNull()` | PASS |
| C9 | "2:0", "abc", "00:00" refused, nothing stored | `-t "recusa horas abonadas inválidas"` passed | `src/app/actions.test.ts:44-47` - loop over all 3 inputs, `toEqual({ ok: false, error: "Horas abonadas devem estar no formato HH:MM." })`; `:49` - `overrideOn(MON)).toBeUndefined()` | PASS |
| C10 | "08:00", "09:00" refused with the jornada message | `-t "recusa abono parcial maior ou igual à jornada"` passed | `src/app/actions.test.ts:54-58` - `error: "Abono parcial deve ser menor que a jornada de 08:00. Para o dia todo, deixe as horas em branco."`; `:60` - `toBeUndefined()` | PASS |
| C11 | Saturday "02:00" refused | `-t "recusa abono parcial no fim de semana"` passed | `src/app/actions.test.ts:64-67` - `error: "Fim de semana já tem meta de 0h."`; `:68` - `overrideOn(SAT)).toBeUndefined()` | PASS |
| C12 | parcial -> inteiro leaves one row with NULL | `-t "parcial vira dia inteiro"` passed | `src/app/actions.test.ts:75` - `expect(rows).toHaveLength(1)`; `:76` - `rows[0].minutes).toBeNull()` | PASS |
| C13 | "Dia normal" removes the row | `-t "dia normal remove abono parcial"` passed | `src/app/actions.test.ts:82` - `expect(await overrideOn(MON)).toBeUndefined()` | PASS |
| C14 | card text, parcial and full-day | `-t "descrição da meta do dia"` passed | `src/lib/hours.test.ts:242-243` - `.toBe("Meta de 06:00 (atestado de 02:00)")`; `:245-246` - `.toBe("Meta de 00:00 (dia abonado)")` | PASS |
| C15 | initial hours "02:00" / "" | `-t "valor inicial das horas abonadas"` passed | `src/lib/hours.test.ts:252` - `overrideHoursValue(partial(MON, 120))).toBe("02:00")`; `:253-254` - `.toBe("")` for full and null | PASS |
| C16 | badge "Atestado 02:00" / null | `-t "badge do abono parcial"` passed | `src/lib/hours.test.ts:258` - `.toBe("Atestado 02:00")`; `:259-260` - `.toBeNull()` for full and null | PASS |
| C17 | old DB with no version -> `minutes` column and version "1" | `-t "migra banco sem versão"` passed | `src/lib/db.test.ts:53` - `expect(await columns(client)).toContain("minutes")`; `:54` - `expect(await version(client)).toBe("1")` | PASS |
| C18 | existing overrides keep NULL, same accumulated | `-t "migração preserva abonos e saldo"` passed | `src/lib/db.test.ts:75` - `after.map((o) => o.minutes)).toEqual([null, null])`; `:84` - `accumulated(after)).toBe(accumulated(before))` | PASS |
| C19 | concurrent migration -> batch fails, connection proceeds | `-t "migração concorrente segue"` passed | `src/lib/db.test.ts:105` - `await db.applyMigrations(racing)` with no rejection (the proxy at `:93-99` applies migration 1 first, so our ALTER must fail); `:107` - `version(client)).toBe("1")` | PASS |
| C20 | failure with version still < 1 propagates | `-t "falha de migração propaga"` passed | `src/lib/db.test.ts:114` - `await expect(db.applyMigrations(client)).rejects.toThrow()`; `:115` - `version(client)).toBeUndefined()` | PASS |
| C21 | DB already at version 1 does not run the ALTER again | `-t "migração não roda duas vezes"` passed | `src/lib/db.test.ts:124` - `await expect(db.listOverrides()).resolves.toEqual([])`; `:125` - `version(client)).toBe("1")`. **The assertion does not target the claim.** If the ALTER re-runs, it fails with "duplicate column", and the catch at `src/lib/db.ts:71-74` re-reads `schema_version` = 1 >= 1 and swallows the error, so the test passes either way. I confirmed this in the worktree: changing `src/lib/db.ts:62` to `let version = 1;` (always re-run) left this test green (0 fail). Reverted. | FAIL |

## Level and sampling judgment

- C14, C15 and C16 prove pure helpers, not rendering. That gap is declared and accepted under `light`.
  The diff confirms the JSX only interpolates them: `src/app/page.tsx` renders
  `{targetDescription(today)}` and `closeTime(today, now.minutes)`, `src/components/format.tsx`
  renders `partialOverrideLabel`, and `day-dialog.tsx` uses `useState(overrideHoursValue(...))`
  keyed on kind and minutes. Accepted.
- C6 also proves the helper rather than the card. The label `Saída para fechar ${formatDuration(today.target)}`
  and the guard `remaining > 0` (`src/app/page.tsx:37`, `:128`) both read the reduced `today.target`. Accepted under `light`.
- C20 tests `applyMigrations` directly, not `db()`. The retry half of AC 20 ("a próxima requisição
  tente de novo") rests on the pre-existing `.catch` that resets `globalForDb.pontoDb` inside `db()`,
  which no proof exercises. This is a minor level note and not a failure: the plan calls it current
  behaviour.
- C19 settles "segue normalmente" through the absence of a rejection at `:105`, not an explicit
  `resolves`. That is acceptable, because bun fails the test on an unhandled rejection.
- C7 samples only `atestado`. The `folga` -> "registrada" branch (`src/app/actions.ts:143`) has no
  proof. That branch is beyond what the checks claim, so it is noted but is not a gap.
- `README.md` was updated as the plan's Impact table requires.

## Swept existing

| Row | Cited constraint | In code |
| --- | --- | --- |
| authorization | `setDayOverride` starts with `if (!(await authorized())) return UNAUTHORIZED` | yes, `src/app/actions.ts:119` |

The `n/a` rows (dependency failure, observability) are approved policy, so there was nothing to re-read.

## Gate

`bun test --conditions react-server src/lib/hours.test.ts src/lib/db.test.ts src/app/actions.test.ts`: 39 passed, 0 failed (exit 0).

`validate_verification.py` was **not run**. The environment is Git Bash on Windows with no Python
interpreter, so the completion gate has not checked this report mechanically.

## Ranked gaps

1. C21: the proof cannot fail under the behaviour it rules out. A re-run ALTER is swallowed by the
   concurrency catch (`src/lib/db.ts:71-74`), so `src/lib/db.test.ts:124-125` stays green when
   `src/lib/db.ts:62` ignores `schema_version` (confirmed by mutation). A fix needs an assertion
   that observes the ALTER not running, for example a proxied client that records `batch` calls
   and expects none on the second connection.

## Isolation

Proofs and the single mutation ran in a temporary worktree at `a7349d9`, and the mutation was
reverted with `git checkout`. The main tree's porcelain changed during the run because of another
agent's concurrent work on feriados-nacionais (`src/lib/holidays.ts` and others). This verifier
wrote only this file in the main tree.
