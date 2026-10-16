# Jornada por dia da semana verification

**Verdict**: PASS
**Profile**: light
**Diff range**: f834082..84a0157
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

Nenhuma: o plano não marca nenhuma fonte como binding (`Sources` traz só `ROADMAP.md` e as respostas do usuário). O passo 1 não roda no perfil light.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none | - | - | - |

## Checks

Todos os proofs C1-C27 rodaram numa invocação só, em 84a0157:

`bun test --conditions react-server src/lib/hours.test.ts src/app/actions.test.ts src/lib/db.test.ts -t "<alternação dos 28 nomes de C1-C27>" --reporter=junit` → exit 0, 28 pass, 60 filtered out, 0 fail. O JUnit lista individualmente os 28 casos executados (não `skipped`), um por nome do filtro. Nenhum nome deixou de bater. Nomes que já existiam antes: "recusa abono parcial no fim de semana" (C19, `actions.test.ts:70`), "migra banco sem versão" (C25, `db.test.ts:74`) e "migração não roda duas vezes" (C27, `db.test.ts:144`). Cada um bate em um teste só. "migração 2 concorrente segue" e "falha da migração 2 propaga" são testes novos, diferentes dos antigos "migração concorrente segue" e "falha de migração propaga", que o filtro não pegou. O padrão "dia sem jornada" (C3) é substring de "recusa abono parcial em dia sem jornada" em `actions.test.ts`, mas o comando de C3 roda só em `hours.test.ts`, onde bate em um teste só.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | meta 540 na segunda, 240 na sexta | multi-file run, "meta pela jornada do dia da semana" pass | `src/lib/hours.test.ts:567` - `expect(dayIn(week(LONG), "2026-10-12").target).toBe(540)`; `:568` - `...("2026-10-16").target).toBe(240)` | PASS |
| C2 | sábado 240 sem batidas: target 240, `falta`, −240 | idem, "sábado com jornada sem batidas é falta" pass | `src/lib/hours.test.ts:573-575` - `expect(d.target).toBe(240)`, `expect(d.status).toBe("falta")`, `expect(d.bankDelta).toBe(-240)` | PASS |
| C3 | jornada 0 → `folga-semanal`; "Fim de semana" sáb/dom, "Sem jornada" na quarta; badge usa a mesma função | idem, "dia sem jornada" pass | `src/lib/hours.test.ts:583` - `expect(d.status).toBe("folga-semanal")` para sat, sun, wed; `:584-586` - `statusLabel(sat/sun)).toBe("Fim de semana")`, `statusLabel(wed)).toBe("Sem jornada")`. O badge lido no código: `src/components/format.tsx:41` `const label = statusLabel(day)` (lacuna de nível aceita) | PASS |
| C4 | vigência 2026-10-19: 480 em 16/10, 240 em 23/10 | idem, "vigência não muda os dias anteriores" pass | `src/lib/hours.test.ts:598` - `expect(target("2026-10-16")).toBe(480)`; `:599` - `expect(target("2026-10-23")).toBe(240)` | PASS |
| C5 | maior `valid_from` ≤ data, com a entrada fora de ordem | idem, "jornada em vigor na data" pass | `src/lib/hours.test.ts:615-618` - `at("2026-10-18")).toBe(1)`, `at("2026-10-19")).toBe(2)`, `at("2026-11-01")).toBe(2)`, `at("2026-11-02")).toBe(3)` sobre `[c, a, b]` | PASS |
| C6 | dias que faltam desde a quarta: 780; com sexta 0 a partir de 16/10: 540 | idem, "meta dos dias que faltam na semana" pass | `src/lib/hours.test.ts:622` - `expect(remainingWeekTarget("2026-10-14", week(LONG))).toBe(780)`; `:627` - `...fridayOff)).toBe(540)`. Uso na tela: `src/app/page.tsx:52` (lacuna de nível aceita) | PASS |
| C7 | sexta 240: abono inteiro 0, parcial 60 → 180 | idem, "abono usa a jornada do dia" pass | `src/lib/hours.test.ts:632` - `...kind: "folga"...}]).target).toBe(0)`; `:633-635` - `...kind: "atestado", ..., minutes: 60 }]).target).toBe(180)` | PASS |
| C8 | lista: 19/10 antes de "Desde o início", 7 dias seg-dom em HH:MM, total 40:00 | idem, "lista de jornadas" pass | `src/lib/hours.test.ts:639` - `expect(scheduleRows(twoSchedules)).toEqual([{ validFrom: "2026-10-19", label: "A partir de 19/10/2026", days: ["09:00",×4,"04:00","00:00","00:00"], total: "40:00" }, { validFrom: SINCE_START, label: "Desde o início", days: ["08:00",×5,"00:00","00:00"], total: "40:00" }])` | PASS |
| C9 | grava 2026-10-19 e responde "Jornada salva a partir de 19/10/2026." | idem, "salva jornada com data de início" pass | `src/app/actions.test.ts:110` - `toEqual({ ok: true, message: "Jornada salva a partir de 19/10/2026." })`; `:114` - `expect(await minutesOf("2026-10-19")).toEqual([0, 540, 540, 540, 540, 240, 0])` | PASS |
| C10 | data vazia substitui `0000-01-01`, nenhuma linha nova, "Jornada desde o início salva." | idem, "data vazia substitui desde o início" pass | `src/app/actions.test.ts:118` - `toEqual({ ok: true, message: "Jornada desde o início salva." })`; `:123` - `expect(schedules).toHaveLength(1)`; `:124` - `toEqual({ validFrom: SINCE_START, minutes: [0, 540, 540, 540, 540, 240, 0] })` | PASS |
| C11 | mesma data duas vezes: uma linha, valores da segunda | idem, "mesma data substitui" pass | `src/app/actions.test.ts:135` - `expect(rows).toHaveLength(1)`; `:136` - `expect(rows[0].minutes).toEqual([0, 420, 420, 420, 420, 420, 0])` | PASS |
| C12 | `9:0` seg e `24:01` sáb recusados com a mensagem do dia; `24:00` aceito; `2026-13-01` → "Data inválida."; nada gravado | idem, "recusa jornada inválida" pass | `src/app/actions.test.ts:141` - `error: "Jornada de segunda deve estar no formato HH:MM, até 24:00."`; `:145` - `error: "Jornada de sábado deve estar no formato HH:MM, até 24:00."`; `:149` - `error: "Data inválida."`; `:153-154` - `minutesOf(...)).toBeUndefined()`; `:155` `.ok).toBe(true)` e `:158` `?.[6]).toBe(1440)` | PASS |
| C13 | 7 × `00:00` → "Informe a jornada de pelo menos um dia.", nada gravado | idem, "recusa semana sem jornada" pass | `src/app/actions.test.ts:162` - `toEqual({ ok: false, error: "Informe a jornada de pelo menos um dia." })`; `:166` - `minutesOf("2026-10-19")).toBeUndefined()` | PASS |
| C14 | remover 19/10: linha some, "Jornada de 19/10/2026 removida.", sexta 23/10 volta a 480 | idem, "remove jornada" pass | `src/app/actions.test.ts:172` - `toEqual({ ok: true, message: "Jornada de 19/10/2026 removida." })`; `:176` - `toBeUndefined()`; `:177` - `expect(await targetOn("2026-10-23")).toBe(480)` (com `:171` `toBe(240)` antes) | PASS |
| C15 | remover `0000-01-01` recusado, linha continua | idem, "não remove desde o início" pass | `src/app/actions.test.ts:181` - `toEqual({ ok: false, error: "A jornada desde o início não pode ser removida." })`; `:185` - `expect(await minutesOf(SINCE_START)).toEqual(STANDARD)` | PASS |
| C16 | formulário com a jornada padrão em vigor em 16/10 e data 2026-10-16 | idem, "formulário começa com a jornada em vigor hoje" pass | `src/lib/hours.test.ts:656` - `expect(scheduleFormDefaults(twoSchedules, "2026-10-16")).toEqual({ validFrom: "2026-10-16", hours: ["00:00", "08:00", "08:00", "08:00", "08:00", "08:00", "00:00"] })` (índices de `getDay()`, domingo primeiro). Uso na tela: `src/app/config/page.tsx:25` (lacuna de nível aceita) | PASS |
| C17 | sem sessão, as duas actions dão `UNAUTHORIZED` e não gravam | idem, "jornada exige sessão" pass | `src/app/actions.test.ts:191` e `:195` - `toEqual({ ok: false, error: "Sessão expirada. Recarregue a página e entre de novo." })`; `:202` - `expect(await db.listSchedules()).toEqual([{ validFrom: SINCE_START, minutes: STANDARD }])` | PASS |
| C18 | sexta 240, abono "04:00" recusado com a jornada de 04:00 | idem, "abono parcial usa a jornada do dia" pass | `src/app/actions.test.ts:207` - `toEqual({ ok: false, error: "Abono parcial deve ser menor que a jornada de 04:00. Para o dia todo, deixe as horas em branco." })` | PASS |
| C19 | sábado com jornada 0, "02:00" → "Fim de semana já tem meta de 0h." | idem, "recusa abono parcial no fim de semana" pass (teste existente, não mudou) | `src/app/actions.test.ts:71` - `toEqual({ ok: false, error: "Fim de semana já tem meta de 0h." })`. O `beforeEach` (`:31`) agora grava a semana padrão, então o teste passa pelo caminho novo (`jornadaFor` = 0 → `isWeekend`, `src/app/actions.ts:132-138`) | PASS |
| C20 | quarta com jornada 0, "02:00" → "Este dia não tem jornada, a meta já é 0h.", nada gravado | idem, "recusa abono parcial em dia sem jornada" pass | `src/app/actions.test.ts:220` - `toEqual({ ok: false, error: "Este dia não tem jornada, a meta já é 0h." })`; `:224` - `expect(await overrideOn(WED)).toBeUndefined()` | PASS |
| C21 | sábado 240, "01:00" grava 60, meta 180 | idem, "abono parcial no sábado com jornada" pass | `src/app/actions.test.ts:233` - `expect((await overrideOn(SAT))?.minutes).toBe(60)`; `:234` - `expect(await targetOn(SAT)).toBe(180)` | PASS |
| C22 | v1 com 450 → uma linha `0000-01-01` = `0,450×5,0`, versão 2 | idem, "migração 2 copia a jornada atual" pass | `src/lib/db.test.ts:178` - `expect(await schedules(client)).toEqual([[SINCE_START, 0, 450, 450, 450, 450, 450, 0]])`; `:179` - `expect(await version(client)).toBe("2")` | PASS |
| C23 | sem `daily_minutes` → 480 de segunda a sexta | idem, "migração 2 sem jornada usa 8h" pass | `src/lib/db.test.ts:186` - `toEqual([[SINCE_START, 0, 480, 480, 480, 480, 480, 0]])` | PASS |
| C24 | acumulado igual antes e depois da migração | idem, "migração 2 preserva o saldo" pass | `src/lib/db.test.ts:218` - `expect(accumulated(migrated)).toBe(accumulated(before))`; `:220` - `toBe(90 - 3 * 450 + 120 - 450)` | PASS |
| C25 | sem versão: migrações 1 e 2 na mesma conexão | idem, "migra banco sem versão" pass | `src/lib/db.test.ts:78` - `expect(await columns(client)).toContain("minutes")`; `:79` - `expect(await version(client)).toBe("2")`; `:80` - `toEqual([[SINCE_START, 0, 480, 480, 480, 480, 480, 0]])` | PASS |
| C26 | corrida: segue com uma linha; falha real: propaga, versão 1, 0 linhas | idem, "migração 2 concorrente segue" e "falha da migração 2 propaga" pass | `src/lib/db.test.ts:239` - `expect(await version(client)).toBe("2")`; `:240` - `expect(await schedules(client)).toHaveLength(1)` (o `await db.applyMigrations(racing)` em `:238` resolve); `:247` - `await expect(db.applyMigrations(client)).rejects.toThrow()`; `:248` - `toBe("1")`; `:250` - `expect(Number(rows[0].n)).toBe(0)` | PASS |
| C27 | banco em v2: nenhum batch | idem, "migração não roda duas vezes" pass | `src/lib/db.test.ts:151` - `expect(await version(client)).toBe("2")`; `:169` - `expect(batches).toHaveLength(0)` | PASS |
| C28 | nenhuma asserção removida ou enfraquecida | os dois comandos de `checks.md`, exatamente como escritos | o primeiro imprime `0` e o segundo imprime `3`. Varredura extra fora do comando: `git diff f834082..84a0157 -- '*.test.ts' '*.e2e.ts' \| grep -E '^-[^-].*expect\('` traz só as três `toBe("1")` e `src/lib/csv.test.ts` (antiga `expect(rowOf({ ...base, status })[7]).toBe(label)`, hoje `:206` `expect(rowOf({ ...day, status })[7]).toBe(label)`, a troca de `folga-semanal` para sábado autorizada no Handoff, com o valor esperado "Fim de semana" sem mudança, `:198`). Nenhum `test(` ou `describe(` removido | PASS |

### Precision and level gaps

- **Lacuna de nível (aceita no perfil light, declarada em checks.md):** C3 (badge), C6 (meta da semana), C8 (lista) e C16 (valores iniciais) são provados nos helpers puros. A ligação com a tela eu li no código e não testei: `src/components/format.tsx:41` (`statusLabel`), `src/app/page.tsx:40,52` (`jornadaFor` e `remainingWeekTarget`), `src/app/config/page.tsx:25,37` (`scheduleFormDefaults(schedules, currentNow().date)`, `scheduleRows(schedules)`), `src/components/schedule-form.tsx` (os campos usam `hours[day]` com `day` de `FORM_DAYS`, e a lista usa `row.days[i]` com `SHORT[day]`, no mesmo índice que os helpers). A leitura bate com AC 6, 8 e 16.
- **Precisão (menor):** a primeira metade de C26 diz "o batch falha", mas nenhuma asserção mostra a falha. O teste só prova que `applyMigrations` resolve e prova o estado final (versão 2, uma linha). Uma implementação que pulasse o batch passaria. É o mesmo padrão do teste antigo "migração concorrente segue".
- **Precisão (menor):** os helpers usam duas ordens. `scheduleRows().days` vai de segunda a domingo (C8). `scheduleFormDefaults().hours` e a entrada de `saveSchedule` vão de domingo a sábado (C16, C9-C12). Cada check fixa a sua ordem, e quem consome cada helper indexa certo. Fica só como observação.
- **C19** usa um teste que existia antes e que o diff não mudou. Ele continua valendo como prova, porque o `beforeEach` mudado faz o teste passar pela lógica nova.

### Testes existentes reescritos (julgamento da regra "nunca enfraquecer")

Li cada linha `-` do diff nos testes:

- `src/lib/hours.test.ts:143`: em "trabalho no fim de semana é todo extra", o `480` do sábado passou a `0`. A troca é autorizada, e as asserções `:144-145` (`target` 0, `balance` 120) não mudaram. O teste deixa de provar que "sábado ignora a jornada", mas essa regra mudou de propósito no AC 3, e o sábado padrão com 0 está provado em C22/C3.
- `dailyMinutes: 480` → `schedules: STANDARD` em `buildReport` (hours, db e csv) e no `beforeEach` de `actions.test.ts`: são entradas, autorizadas. Nenhum `expect` mudou.
- `src/lib/db.test.ts:79,133,151`: as três `toBe("1")` → `toBe("2")` autorizadas. Nos três testes as outras asserções continuam (`toContain("minutes")` em `:78` e `:132`, `batches` com tamanho 0 em `:169`), e `:80` ganhou uma asserção nova.
- `src/lib/csv.test.ts:205-206`: troca autorizada no Handoff. A asserção é a mesma e roda em todos os status, e só o dia do caso `folga-semanal` passou a ser sábado.
- `src/lib/holidays.test.ts:69,233`: `saveSettings({ dailyMinutes: 480, startDate })` → `saveSettings({ startDate })`. É só entrada, e o tipo obriga a mudança porque `Settings` perdeu `dailyMinutes`. Nenhuma asserção mudou. O texto de checks.md não cita essa edição, mas ela não enfraquece nada.
- Nenhum teste de `updateSettings` sobre a jornada existia antes, então a validação removida de `updateSettings` não apagou nenhuma asserção.

### Swept existing (relido no código)

- authorization: `src/app/actions.ts:182` (`saveSchedule`) e `:214` (`removeSchedule`) começam com `if (!(await authorized())) return UNAUTHORIZED;`, como as outras actions (`:40`, `:78`, `:93`, `:108`, `:123`, `:163`). Confirmado.
- loading state (Observable, existing): `src/components/schedule-form.tsx:97` - `{pending ? "Salvando…" : "Salvar jornada"}`, com `disabled={pending}`. Confirmado.
- concurrency e idempotência pelo upsert: `src/lib/db.ts` `saveSchedule` usa `ON CONFLICT (valid_from) DO UPDATE SET d0 = excluded.d0, ...`. Confirmado.

### Doors and AD-001 / AD-003

- Door 1: `src/lib/db.ts:59` `CREATE TABLE work_schedules (valid_from TEXT PRIMARY KEY, d0..d6 INTEGER NOT NULL CHECK (dN BETWEEN 0 AND 1440))`, gerado a partir de `DAYS`, com `d0` = domingo. Bate com o literal do plano.
- Door 2: `src/lib/db.ts:63-64` `INSERT INTO work_schedules SELECT '0000-01-01', 0, m, m, m, m, m, 0 FROM (SELECT coalesce((SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'daily_minutes'), 480) AS m)`. Bate com o literal do plano.
- AD-001: a mudança entrou como segundo item de `MIGRATIONS`, e `applyMigrations` envia `[...MIGRATIONS[version - 1], UPSERT schema_version]` num batch `"write"` só (`src/lib/db.ts:76-81`). `work_schedules` não foi adicionada ao `SCHEMA`.
- AD-003: `scheduleFor` escolhe o maior `validFrom` ≤ data (`src/lib/hours.ts`), e `removeSchedule` recusa `SINCE_START`. Confirmado.

## Coverage

O join de Coverage não foi recalculado: no perfil light ele não roda. A tabela de `checks.md` não foi auditada.

## Faults injected

Não rodou no perfil light, então não houve injeção de faltas.

## Gate

`bun run test` - 121 passed, 0 failed (399 `expect()`, 8 arquivos). `bun run lint` (`biome check .`) - 60 files, sem erros. O working tree segue igual ao do início (só os diretórios não versionados `.agents/`, `.claude/`, `.cursor/`, `.windsurf/`).
