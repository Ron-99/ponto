# Prazo de compensação do banco verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 78b3f53..e7a8237
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

Nenhuma: o plano não marca nenhuma fonte como binding (`Sources` traz `ROADMAP.md`, as respostas do usuário e AD-003 em `.specs/STATE.md`). O passo 1 não roda no perfil light.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none | - | - | - |

## Checks

Todos os proofs `bun test` de C1-C32 rodaram numa invocação só, em e7a8237:

`bun test --conditions react-server src/lib/hours.test.ts src/lib/csv.test.ts src/app/actions.test.ts src/lib/db.test.ts -t "<alternação dos 31 nomes>" --reporter=junit` → exit 0, 31 pass, 103 filtered out, 0 fail. O JUnit lista 31 casos executados (não `skipped`), um por nome do filtro, cada um no arquivo e na linha esperados (`hours.test.ts:688-858`, `csv.test.ts:264`, `actions.test.ts:254-311`, `db.test.ts:144` e `:277-346`). Nenhum nome deixou de bater e nenhum bateu em dois testes. Pontos de substring conferidos: "migra banco sem versão até a 3" (C28) não pega o antigo "migra banco sem versão" (`db.test.ts:74`, ficou `skipped`); "mesma data substitui o prazo" (C20) não pega "mesma data substitui" (`actions.test.ts:132`); "migração 3 concorrente segue" e "falha da migração 3 propaga" (C30) não pegam os homônimos das migrações 1 e 2. "migração não roda duas vezes" (C31) é um teste que existia antes; o diff mudou sua asserção de versão para "3" (`db.test.ts:151`).

Os proofs `grep`/`git diff` (C15, C16, C25, C32) rodaram exatamente como escritos.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | regra sem prazo em 2026-09-01: 08-31 em `0000-01-01..2026-08-31`, 09-01 começa e não tem fim | run único, "ciclo começa na data da regra" pass | `src/lib/hours.test.ts:690` - `expect(cycleFor("2026-08-31", cycles)).toEqual({ start: SINCE_START, end: "2026-08-31" })`; `:691` - `...("2026-09-01", cycles)).toEqual({ start: "2026-09-01", end: null })` | PASS |
| C2 | 4 meses desde 2026-01-31: 01-31..05-30, 05-31..09-29, 09-30..2027-01-30, depois 2027-01-31 | idem, "ciclos contados a partir da data da regra" pass | `src/lib/hours.test.ts:696` - `toEqual({ start: "2026-01-31", end: "2026-05-30" })`; `:698` - `toEqual({ start: "2026-05-31", end: "2026-09-29" })`; `:699` - `toEqual({ start: "2026-09-30", end: "2027-01-30" })`; `:700` - `cycleFor("2027-01-31", cycles).start).toBe("2027-01-31")` | PASS |
| C3 | regras fora de ordem: 09-15 em 09-01..09-30, 10-01 em 10-01..2027-03-31 | idem, "regra nova fecha o ciclo em andamento" pass | `src/lib/hours.test.ts:709` - `expect(cycleFor("2026-09-15", cycles)).toEqual({ start: "2026-09-01", end: "2026-09-30" })`; `:710` - `...("2026-10-01", cycles)).toEqual({ start: "2026-10-01", end: "2027-03-31" })` (entrada `[6m 10-01, BASE, 4m 05-01]`, `:704-708`) | PASS |
| C4 | acumulado 180 em 08-31, 30 em 09-01, um ciclo fechado 05-01..08-31 com 180 | idem, "acumulado zera no início do ciclo" pass | `src/lib/hours.test.ts:721` - `expect(accumulatedOn(days, "2026-08-31")).toBe(180)`; `:722` - `...("2026-09-01")).toBe(30)`; `:723-725` - `expect(closedCycles(days, cycles)).toEqual([{ start: "2026-05-01", end: "2026-08-31", label: "01/05/2026 a 31/08/2026", closing: 180 }])` | PASS |
| C5 | só a base, ou sem regras: acumulado = soma de `bankDelta`, nenhum ciclo fechado | idem, "sem prazo o acumulado não zera" pass | `src/lib/hours.test.ts:746` - `expect(d.accumulated).toBe(sum)` em cada dia, para `buildReport(input)` e `buildReport({ ...input, cycles: [BASE] })` (`:742`); `:748` - `expect(closedCycles(days, [BASE])).toEqual([])` | PASS |
| C6 | banco desde 06-15, regra 4m desde 05-01: primeiro fechado 06-15..08-31 | idem, "banco começa no meio do ciclo" pass | `src/lib/hours.test.ts:756-761` - `expect(closedCycles(days, cycles).at(-1)).toEqual({ start: "2026-06-15", end: "2026-08-31", label: "15/06/2026 a 31/08/2026", closing: 45 })` (`.at(-1)` = o mais antigo, já que a lista vem do mais recente) | PASS |
| C7 | CSV: linha de 01/09/2026 com `00:30` em Acumulado | idem, "acumulado do csv zera no ciclo" pass | `src/lib/csv.test.ts:282` - `expect(lines.find((l) => l.startsWith("01/09/2026"))?.split(";")[column]).toBe("00:30")`, com `column = HEADER.split(";").indexOf("Acumulado")` (`:280`); `:281` - `03:00` em 31/08 | PASS |
| C8 | três frases pelo sinal do saldo, 76 dias até 31/12/2026 | idem, "linha de vencimento pelo sinal do saldo" pass | `src/lib/hours.test.ts:766-768` - `dueNotice("2026-10-16", 330, cycles)).toBe("+05:30 vencem em 31/12/2026 (daqui a 76 dias).")`; `:769-771` - `(..., -120, ...)).toBe("−02:00 a compensar até 31/12/2026 (daqui a 76 dias).")`; `:772-774` - `(..., 0, ...)).toBe("O ciclo fecha em 31/12/2026 (daqui a 76 dias).")` | PASS |
| C9 | "(amanhã)" em 12-30, "(hoje)" em 12-31 | idem, "vencimento amanhã e hoje" pass | `src/lib/hours.test.ts:779` - `expect(dueNotice("2026-12-30", 330, cycles)).toBe("+05:30 vencem em 31/12/2026 (amanhã).")`; `:780` - `...("2026-12-31", ...)).toBe("+05:30 vencem em 31/12/2026 (hoje).")` | PASS |
| C10 | `null` só com a base e com base + sem prazo desde 09-01 | idem, "sem prazo não mostra vencimento" pass | `src/lib/hours.test.ts:784` - `expect(dueNotice("2026-10-16", 330, [BASE])).toBeNull()`; `:785` - `...[BASE, { validFrom: "2026-09-01", months: 0 }])).toBeNull()` | PASS |
| C11 | regra futura em 11-01 antecipa para 31/10/2026, com e sem a regra de 4m | idem, "regra futura antecipa o vencimento" pass | `src/lib/hours.test.ts:791-793` - `dueNotice("2026-10-16", 330, cycles)).toBe("+05:30 vencem em 31/10/2026 (daqui a 15 dias).")`; `:794-796` - `dueNotice("2026-10-16", 330, [BASE, future])).toBe(` a mesma frase | PASS |
| C12 | "Subiu 01:00 desde 01/09." passando o início do ciclo | idem, "tendência desde o início do ciclo" pass | `src/lib/hours.test.ts:811` - `expect(balanceSeries(days, "2026-09-01").trend).toBe("Subiu 01:00 desde 01/09.")`. Uso na tela: `src/app/page.tsx:58` `balanceSeries(days, cycleFor(now.date, cycles).start)` (lacuna de nível aceita) | PASS |
| C13 | "Banco do ciclo (desde 01/09/2026)" / "Banco total (desde 01/05/2026)" para ciclo em 05-01 e em `0000-01-01` | idem, "rótulo do banco no relatório" pass | `src/lib/hours.test.ts:815` - `expect(bankLabel("2026-05-01", "2026-09-01")).toBe("Banco do ciclo (desde 01/09/2026)")`; `:816` - `...("2026-05-01", "2026-05-01")).toBe("Banco total (desde 01/05/2026)")`; `:817` - `...("2026-05-01", SINCE_START)).toBe("Banco total (desde 01/05/2026)")`. Uso: `src/app/relatorio/page.tsx:115` | PASS |
| C14 | 2m desde 05-01, hoje 09-15: dois fechados, do mais recente, com o acumulado do último dia; ciclo de hoje fora | idem, "ciclos fechados do mais recente" pass | `src/lib/hours.test.ts:833-836` - `expect(closedCycles(days, cycles)).toEqual([{ start: "2026-07-01", end: "2026-08-31", label: "01/07/2026 a 31/08/2026", closing: 150 }, { start: "2026-05-01", end: "2026-06-30", label: "01/05/2026 a 30/06/2026", closing: 60 }])` (igualdade exata: o ciclo 09-01..10-31 não entra) | PASS |
| C15 | ciclo terminando hoje: lista vazia; card só com itens | idem, "ciclo que fecha hoje não está fechado" pass; `grep -c "closed.length > 0 &&" src/app/relatorio/page.tsx` → `1` | `src/lib/hours.test.ts:842` - `expect(closedCycles(days, cycles)).toEqual([])`; `src/app/relatorio/page.tsx:120` - `{closed.length > 0 && (` envolve o card "Ciclos fechados" | PASS |
| C16 | ciclos fechados de todos os dias do banco, não do período | `grep -c "closedCycles(days, " src/app/relatorio/page.tsx` → `1` | `src/app/relatorio/page.tsx:58` - `const closed = closedCycles(days, cycles);`, com `days` vindo direto de `loadBank()` (`:47`), enquanto o período usa `visible = days.filter(...)` (`:51`) | PASS |
| C17 | ordem 11-01 (1 mês), 09-01 (4 meses), "Desde o início" (Sem prazo) | idem, "lista de prazos" pass | `src/lib/hours.test.ts:851-855` - `expect(rows).toEqual([{ validFrom: "2026-11-01", label: "A partir de 01/11/2026", rule: "Ciclos de 1 mês" }, { validFrom: "2026-09-01", label: "A partir de 01/09/2026", rule: "Ciclos de 4 meses" }, { validFrom: SINCE_START, label: "Desde o início", rule: "Sem prazo" }])` (entrada em outra ordem, `:846-850`) | PASS |
| C18 | grava (09-01, 4) e "Prazo salvo: ciclos de 4 meses a partir de 01/09/2026." | idem, "salva prazo de compensação" pass | `src/app/actions.test.ts:255-258` - `toEqual({ ok: true, message: "Prazo salvo: ciclos de 4 meses a partir de 01/09/2026." })`; `:259` - `expect(await db.listCycles()).toEqual([BASE, { validFrom: "2026-09-01", months: 4 }])` | PASS |
| C19 | grava (09-01, 0) e "Prazo salvo: sem prazo a partir de 01/09/2026." | idem, "salva sem prazo com data" pass | `src/app/actions.test.ts:263-266` - `toEqual({ ok: true, message: "Prazo salvo: sem prazo a partir de 01/09/2026." })`; `:267` - `toEqual([BASE, { validFrom: "2026-09-01", months: 0 }])` | PASS |
| C20 | 4 e depois 6 na mesma data: uma linha, 6 | idem, "mesma data substitui o prazo" pass | `src/app/actions.test.ts:273` - `expect(await db.listCycles()).toEqual([BASE, { validFrom: "2026-09-01", months: 6 }])` | PASS |
| C21 | `""`, `2026-13-01`, `01/09/2026`, `0000-01-01` recusadas; só a base | idem, "recusa data do ciclo inválida" pass | `src/app/actions.test.ts:278` - `expect(await saveCycle({ validFrom, months: 4 })).toEqual(INVALID_DATE)` para as quatro (`:277`), com `INVALID_DATE.error = "Informe a data de início do ciclo."` (`:242`); `:280` - `toEqual([BASE])` | PASS |
| C22 | −1, 13, 2.5, NaN recusados sem gravar; 12 aceito | idem, "recusa prazo fora de 0 a 12" pass | `src/app/actions.test.ts:285` - `toEqual(INVALID_MONTHS)` para os quatro (`:284`), com a mensagem em `:245`; `:287` - `toEqual([BASE])`; `:288` - `(await saveCycle({ ..., months: 12 })).ok).toBe(true)`; `:289` - `toEqual([BASE, { validFrom: "2026-09-01", months: 12 }])` | PASS |
| C23 | remove 09-01, "Regra de 01/09/2026 removida.", 10-16 volta a `0000-01-01` sem fim | idem, "remove regra de prazo" pass | `src/app/actions.test.ts:294-297` - `toEqual({ ok: true, message: "Regra de 01/09/2026 removida." })`; `:299` - `expect(cycles).toEqual([BASE])`; `:300` - `expect(cycleFor("2026-10-16", cycles)).toEqual({ start: SINCE_START, end: null })` | PASS |
| C24 | remover `0000-01-01` recusado, linha continua | idem, "não remove o prazo desde o início" pass | `src/app/actions.test.ts:304-307` - `toEqual({ ok: false, error: "A regra desde o início não pode ser removida." })`; `:308` - `expect(await db.listCycles()).toEqual([BASE])` | PASS |
| C25 | botão de remover só fora da base | `grep -c "row.validFrom !== SINCE_START &&" src/components/cycle-form.tsx` → `1` | `src/components/cycle-form.tsx:38` - `{row.validFrom !== SINCE_START && (` envolve o `Button` que chama `removeCycle(row.validFrom)` (`:45`) | PASS |
| C26 | valores iniciais: 4 / 10-01 com a base; 6 / 10-01 com a regra de 6m | idem, "formulário de prazo começa com a regra em vigor" pass | `src/lib/hours.test.ts:859-862` - `expect(cycleFormDefaults([BASE], "2026-10-16")).toEqual({ validFrom: "2026-10-01", months: 4 })`; `:863-865` - `...([BASE, { validFrom: "2026-09-01", months: 6 }], "2026-10-16")).toEqual({ validFrom: "2026-10-01", months: 6 })`. Uso: `src/app/config/page.tsx:29` | PASS |
| C27 | sem sessão, `saveCycle` e `removeCycle` dão `UNAUTHORIZED` e não gravam | idem, "prazo exige sessão" pass | `src/app/actions.test.ts:314-317` e `:318-321` - `toEqual({ ok: false, error: "Sessão expirada. Recarregue a página e entre de novo." })`; `:325` - `expect(await db.listCycles()).toEqual([BASE])` | PASS |
| C28 | v2 → `bank_cycles` = [(`0000-01-01`, 0)] e versão 3; sem versão chega ao mesmo estado | idem, "migração 3 cria o prazo desde o início" e "migra banco sem versão até a 3" pass | `src/lib/db.test.ts:281` - `expect(await cycles(client)).toEqual([[SINCE_START, 0]])`; `:282` - `expect(await version(client)).toBe("3")`; `:289` - `toEqual([[SINCE_START, 0]])`; `:290` - `schedules(client)).toHaveLength(1)`; `:291` - `toBe("3")` | PASS |
| C29 | v2 com batidas e abonos: acumulado com as regras migradas = sem regras | idem, "migração 3 preserva o saldo" pass | `src/lib/db.test.ts:321` - `expect(withCycles).toEqual(buildReport(input).map((d) => d.accumulated))` (todos os dias), `withCycles` com `cycles: migrated` de `db.listCycles()` (`:311`, `:320`); `:323` - `expect(withCycles.at(-1)).toBe(120 - 3 * 480 + 120 - 480)` | PASS |
| C30 | corrida: segue com uma linha; falha real: propaga, versão 2, 0 linhas | idem, "migração 3 concorrente segue" e "falha da migração 3 propaga" pass | `src/lib/db.test.ts:342` - `expect(await version(client)).toBe("3")`; `:343` - `expect(await cycles(client)).toHaveLength(1)` (o `await db.applyMigrations(racing)` em `:341` resolve); `:350` - `await expect(db.applyMigrations(client)).rejects.toThrow()`; `:351` - `toBe("2")`; `:353` - `expect(Number(rows[0].n)).toBe(0)` | PASS |
| C31 | banco em v3: nenhum batch | idem, "migração não roda duas vezes" pass | `src/lib/db.test.ts:151` - `expect(await version(client)).toBe("3")`; `:169` - `expect(batches).toHaveLength(0)` | PASS |
| C32 | nenhuma asserção removida ou enfraquecida; só as cinco `toBe("2")` → `toBe("3")` | os dois comandos de `checks.md`, exatamente como escritos | o primeiro imprime `0` e o segundo imprime `5`. As cinco trocas estão em `src/lib/db.test.ts:79`, `:133`, `:151`, `:179`, `:239` (`expect(await version(client)).toBe("3")`), nos testes "migra banco sem versão", "migração concorrente segue", "migração não roda duas vezes", "migração 2 copia a jornada atual" e "migração 2 concorrente segue", como checks.md lista. Varredura extra: as linhas `-` de `git diff 78b3f53 -- '*.test.ts'` filtradas por `^-[^-]` trazem só essas cinco linhas e dois `import` de `actions.test.ts` reescritos para incluir `removeCycle`, `saveCycle` e `cycleFor`. Nenhum `test(` ou `describe(` removido | PASS |

### Precision and level gaps

- **Lacuna de nível (aceita no perfil light, declarada em checks.md):** C8-C14, C17 e C26 são provados nos helpers puros, e C15, C16 e C25 só pela condição no JSX. Li a ligação com a tela e não testei: `src/app/page.tsx:58-59` (`balanceSeries(days, cycleFor(now.date, cycles).start)`, `dueNotice(now.date, total, cycles)`) e `:75` (`{due && <p ...>{due}</p>}` abaixo do saldo); `src/app/relatorio/page.tsx:115` (`bankLabel(startDate, cycleFor(now.date, cycles).start)`) e `:120-137` (card "Ciclos fechados" com `c.label` e `<Balance minutes={c.closing} />`); `src/app/config/page.tsx:29,54-55` (`cycleFormDefaults(cycles, today)`, `CycleList rows={cycleRows(cycles)}`). AC 9 para o painel e o relatório depende de `total = days.at(-1)?.accumulated` (`src/lib/data.ts`), que já existia, e do zeramento em `src/lib/hours.ts:287` (`if (date !== startDate && cycleFor(date, cycles).start === date) accumulated = 0;`), provado por C4. A leitura bate com AC 9-31.
- **Precisão (menor):** em C27, `removeCycle` sem sessão só é chamado com `SINCE_START` (`actions.test.ts:318`), uma linha que a action recusaria mesmo com sessão. A metade "não grava" de `removeCycle` fica então provada só pela resposta `UNAUTHORIZED`, que vem antes da recusa da base (`src/app/actions.ts:246`). Uma action que apagasse antes de checar a sessão numa regra comum não seria pega por `:325`. Não muda o resultado: a ordem no código está certa.
- **Precisão (menor):** como na feature anterior, a primeira metade de C30 ("outra instância aplica a migração 3 entre a leitura e o batch") não tem asserção que mostre o batch falhando. O teste prova que `applyMigrations` resolve e o estado final (versão 3, uma linha).
- **C31** usa um teste que já existia; o diff mudou a asserção de versão (`db.test.ts:151`) e o contador de batches (`:169`) segue valendo para a versão 3.

### Swept existing (relido no código)

- authorization: `src/app/actions.ts:231` (`saveCycle`) e `:246` (`removeCycle`) começam com `if (!(await authorized())) return UNAUTHORIZED;`, como as outras actions (`:40`, `:78`, `:93`, `:108`, `:123`, `:163`, `:182`, `:214`). Confirmado.
- concurrency e idempotência pelo upsert: `src/lib/db.ts:256-257` `INSERT INTO bank_cycles (valid_from, months) VALUES (?, ?) ON CONFLICT (valid_from) DO UPDATE SET months = excluded.months`. Confirmado.
- failure modes (migração): `src/lib/db.ts:85-94` envia `[...MIGRATIONS[version - 1], UPSERT schema_version]` num batch `"write"` só e relança o erro se `schemaVersion(client) < version`. Confirmado.
- loading state (Observable, existing): `src/components/cycle-form.tsx:102-103` - `disabled={pending}` e `{pending ? "Salvando…" : "Salvar prazo"}`; o botão de remover também usa `disabled={pending}` (`:44`). Confirmado.
- docs (Impact): `README.md:62` traz o item "Prazo de compensação" nas Regras. Confirmado.

### Doors and AD-001 / AD-003 / AD-004

- Door 1: `src/lib/db.ts:69-72` `CREATE TABLE bank_cycles (valid_from TEXT PRIMARY KEY, months INTEGER NOT NULL CHECK (months BETWEEN 0 AND 12))`. Bate com o literal do plano.
- Door 2: `src/lib/db.ts:73` `INSERT INTO bank_cycles (valid_from, months) VALUES ('0000-01-01', 0)`, no mesmo item de `MIGRATIONS`. As actions recusam salvar com essa data (`src/app/actions.ts:233`) e removê-la (`:247`). Bate com o plano.
- AD-001: a mudança entrou como terceiro item de `MIGRATIONS`. `bank_cycles` não foi adicionada ao `SCHEMA`.
- AD-004: registrada em `.specs/STATE.md` pelo diff, com o texto que o plano previa em Landing.

## Coverage

O join de Coverage não foi recalculado: no perfil light ele não roda. A tabela de `checks.md` não foi auditada.

## Faults injected

Não rodou no perfil light, então não houve injeção de faltas.

## Gate

`bun run test` - 151 passed, 0 failed (53246 `expect()`, 8 arquivos). A linha `[feriados] falha ao importar 2026: status 503` no log vem de um teste de feriados que simula a falha da API e não é um erro. `bun run lint` (`biome check .`) - 61 files, sem erros. O working tree segue igual ao do início (só os diretórios não versionados `.agents/`, `.claude/`, `.cursor/`, `.windsurf/`, além deste relatório).
