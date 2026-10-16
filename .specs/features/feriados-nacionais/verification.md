# Feriados nacionais automáticos - verification

**Verdict**: PASS
**Profile**: light
**Diff range**: a7349d9..7f53a9a
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Proofs ran in an isolated worktree at `7f53a9a` (`bun install --frozen-lockfile`, then one
invocation). Each named test was confirmed individually as passed via the junit reporter
(`<testcase name=...>` entries, 0 `<failure>`, 0 `<skipped>`). All 13 named tests were added by
this diff (`src/lib/holidays.test.ts` is new; the C7 test is new in `src/lib/hours.test.ts`).

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | loadBank fetches 2025 and 2026; 2026-04-21 is `feriado`/"Tiradentes", balance 0 | `carregar o banco importa os feriados dos anos do banco` passed | `src/lib/holidays.test.ts:74` - `expect(calls.sort()).toEqual([`${API}/2025`, `${API}/2026`])`; `:76` - `expect(day?.override).toMatchObject({ kind: "feriado", note: "Tiradentes" })`; `:77` - `expect(day?.balance).toBe(0)` | PASS |
| C2 | `holidays_synced:2026` set; a mid-batch failure persists neither rows nor key | `linhas e marca do ano gravam juntas` passed | `src/lib/holidays.test.ts:83` - `expect(await synced(2026)).toBe(true)`; `:95` - `expect(await overrideOn("2025-04-21")).toBeUndefined()`; `:96` - `expect(await synced(2025)).toBe(false)` | PASS |
| C3 | synced year makes 0 fetch calls | `ano sincronizado não chama a API` passed | `src/lib/holidays.test.ts:104` - `expect(calls).toHaveLength(0)` | PASS |
| C4 | existing `folga`/"ponte" survives import | `abono existente prevalece` passed | `src/lib/holidays.test.ts:111` - `expect(await overrideOn("2026-04-21")).toMatchObject({ kind: "folga", note: "ponte" })` | PASS |
| C5 | "Dia normal" on an imported holiday is not recreated | `feriado removido não volta` passed | `src/lib/holidays.test.ts:119` - `expect(await overrideOn("2026-04-21")).toBeUndefined()` | PASS |
| C6 | malformed / other-year dates dropped, valid one saved | `ignora datas inválidas ou de outro ano` passed | `src/lib/holidays.test.ts:133` - `expect(dates).toEqual(["2026-04-21"])` | PASS |
| C7 | DayDialog title "Abono do dia · Tiradentes" with note, "Abono do dia" otherwise | `título do abono mostra a observação` passed | `src/lib/hours.test.ts:266` - `expect(overrideTitle({ ..., note: "Tiradentes" })).toBe("Abono do dia · Tiradentes")`; `:269` - `...note: null })).toBe("Abono do dia")`; `:270` - `expect(overrideTitle(null)).toBe("Abono do dia")` | PASS |
| C8 | two concurrent imports leave each date once and the key = 1 | `importações simultâneas não duplicam` passed | `src/lib/holidays.test.ts:143` - `expect(dates).toEqual(["2026-04-21", "2026-12-25"])`; `:144` - `expect(await synced(2026)).toBe(true)` | PASS |
| C9 | 500, `{}`, `[]`, item without `name` resolve, save nothing | `resposta ruim não grava nada` passed | `src/lib/holidays.test.ts:164` - `await expect(syncNationalHolidays(...)).resolves.toBeUndefined()`; `:150` - `expect(await db.listOverrides()).toEqual([])`; `:151` - `expect(await synced(2026)).toBe(false)` (looped over all 4 replies, `:155-161`) | PASS |
| C10 | hanging API abandoned between 2.9s and 4s, nothing saved | `timeout de 3s` passed (3.05s) | `src/lib/holidays.test.ts:183` - `expect(elapsed).toBeGreaterThan(2900)`; `:184` - `expect(elapsed).toBeLessThan(4000)`; `:185` - `await nothingSaved()` | PASS |
| C11 | after failure: 0 calls at +59min, 1 call at +61min | `espera 1h depois de uma falha` passed | `src/lib/holidays.test.ts:198` - `expect(calls).toHaveLength(0)` (15:59); `:203` - `expect(calls).toHaveLength(1)` (16:01) | PASS |
| C12 | each failure logs one `console.error` with year and reason | `falha registra ano e motivo` passed | `src/lib/holidays.test.ts:219` - `expect(logged).toHaveBeenCalledTimes(1)`; `:221` - `expect(message).toContain("2026")`; `:222` - `expect(message).toContain(reason)` over `timeout`, `status 500`, `resposta inválida` (`:210-212`) | PASS |
| C13 | loadBank still returns days with existing overrides when the API fails | `carregar o banco funciona com a API fora` passed | `src/lib/holidays.test.ts:236` - `expect(days.map((d) => d.date)).toEqual(["2026-10-12", ..., "2026-10-16"])`; `:243` - `expect(days[0].override).toMatchObject({ kind: "feriado", note: "Aparecida" })` | PASS |

## Level and sampling judgment

- No check claims a route, status code or response shape (plan `Surface` is `None`), so there is no
  boundary level gap. C1 and C13 go through `loadBank`, the real entry point the pages call
  (`src/app/page.tsx:32`, `src/app/relatorio/page.tsx:63`).
- C7 is proven on the helper, not on the rendered `DayDialog`. `checks.md` accepts this as a level
  gap under `light`. The wiring is visible in the code: `src/components/day-dialog.tsx:191` -
  `<Label>{overrideTitle(day.override)}</Label>`.
- Sampling matches the claims: C9 claims 4 bad replies and loops over 4. C12 claims 3 reasons and
  loops over 3. C6 claims 3 rejected shapes and has 3 plus the valid one.
- C2 atomicity is proven by a real trigger aborting the second insert inside the `write` batch
  (`src/lib/holidays.test.ts:87-94`), not by a mock. Code: `src/lib/db.ts` `saveHolidays` runs a
  single `batch([...inserts, UPSERT_SETTING], "write")`.

## Swept (existing) re-read

| Row | Cited constraint | Present in code |
| --- | --- | --- |
| authorization | `src/proxy.ts` requires a session before any page that calls `loadBank` | yes - `src/proxy.ts:6` lets a request through only for `/login` or `isValidSession(...)`. Otherwise `:15` redirects (GET) or `:11` returns 401. Matcher `:19` covers every path except static assets, including `/` and `/relatorio`. |

Landing door 2 relies on `ON CONFLICT (date)`. The constraint exists: `day_overrides.date TEXT PRIMARY
KEY` (`src/lib/db.ts:34`). Door 1 relies on the `settings.key` primary key (`src/lib/db.ts:39`) and
`UPSERT_SETTING` (`src/lib/db.ts:44-45`).

## Binding sources

Step 1 does not run under `light`. `ROADMAP.md` item "Feriados nacionais automáticos" was opened
(`ROADMAP.md:7-9`: national holidays come from BrasilAPI, municipal holidays and bridge days stay
manual). That scope matches the plan and the checks. The BrasilAPI endpoint was not called live.
Its shape `[{date, name, type}]` comes from the brief and the plan's `Sources`, and the code reads
only `date` and `name`.

## Observations (non-failing)

1. Precision drift in C6: `checks.md` names `"2026-4-21"`, but the test uses `"2026-4-22"`
   (`src/lib/holidays.test.ts:126`). This is the same class (missing zero padding) and is still
   rejected, so the claim holds.
2. A failure mode outside AC 8 is unenumerated. A network error that is not a timeout (DNS failure,
   connection refused) is caught and logged with `String(error)` (`src/lib/holidays.ts:24`), not
   with one of the three AC 10 reasons. The page still renders. AC 8 and AC 10 do not name this
   case, so it is a gap in the plan, not in the checks.

## Gate

`bun test --conditions react-server src/lib/holidays.test.ts src/lib/hours.test.ts` - 40 passed, 0 failed (110 expect() calls)

`validate_verification.py` was not run: Python is not available in this environment (Git Bash on
Windows).
