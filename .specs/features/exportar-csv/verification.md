# Exportar CSV verification

**Verdict**: PASS
**Profile**: light
**Diff range**: a1d5576..5b96442
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

Nenhuma fonte binding: o plano lista só o `ROADMAP.md` em `Sources`, sem marcá-lo como binding, e o passo 1 não roda no perfil `light`.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none | n/a | none | - |

## Checks

Proofs unitários rodados numa invocação só no `HEAD` (5b96442): `bun test --conditions react-server src/lib/csv.test.ts src/proxy.test.ts -t "<alternância dos 17 nomes>" --reporter=junit` terminou com exit 0, 17 pass, 0 fail, 2 filtered out (os dois testes antigos do `proxy.test.ts`, que ficaram com `assertions="0"`/skipped). O junit lista cada um dos 17 nomes com `assertions` > 0, então nenhum filtro casou com nada. Os e2e rodaram depois de `bun run build` (exit 0, `/relatorio/csv` aparece como `ƒ`): `bun test ./e2e/pwa.e2e.ts -t "csv é baixado com sessão|csv de mês futuro só tem cabeçalho|csv exige sessão" --reporter=junit` terminou com exit 0, 3 pass, 0 fail, e cada nome aparece no junit (linhas 252, 270 e 276, com 6, 2 e 5 assertions). Todos os testes citados entraram neste diff.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | link `/relatorio/csv?periodo=mes&ref=2026-10-05` com texto "Exportar CSV" | unit "link de exportação usa o período da tela" exit 0 | `src/lib/csv.test.ts:71` - `expect(exportHref("mes", "2026-10-05")).toBe("/relatorio/csv?periodo=mes&ref=2026-10-05")`; o texto e a renderização também estão em `e2e/pwa.e2e.ts:265` - `expect(html).toMatch(/<a href="\/relatorio\/csv\?periodo=mes&amp;ref=2026-10-05"[^>]*>[\s\S]*?Exportar CSV<\/a>/)` (no teste C2), o que fecha a lacuna de nível que o `checks.md` tinha aceitado | PASS |
| C2 | `200`, `text/csv; charset=utf-8`, `attachment; filename="ponto-2026-10.csv"`, corpo começa com BOM + cabeçalho + `\r\n` | e2e "csv é baixado com sessão" exit 0 | `e2e/pwa.e2e.ts:254` - `expect(response.status).toBe(200)`; `:255` - `toBe("text/csv; charset=utf-8")`; `:256` - `toBe('attachment; filename="ponto-2026-10.csv"')`; `:260` - `expect([...body.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])`; `:261` - `expect(decode(body).startsWith(`﻿${HEADER}`)).toBe(true)` (o `HEADER` tem o literal com `\r\n`, em `:237`) | PASS |
| C3 | `ponto-2026-10.csv`, `ponto-semana-2026-10-12.csv`, `ponto-ate-2026-10-16.csv` | unit "nome do arquivo por período" exit 0 | `src/lib/csv.test.ts:75` - `toBe("ponto-2026-10.csv")`; `:76` - `toBe("ponto-semana-2026-10-12.csv")`; `:77` - `toBe("ponto-ate-2026-10-16.csv")` | PASS |
| C4 | BOM + cabeçalho literal, toda linha termina em `\r\n` | unit "cabeçalho, BOM e fim de linha" exit 0 | `src/lib/csv.test.ts:84` - `expect(csv.startsWith(`${BOM}${HEADER}\r\n`)).toBe(true)`; `:85` - `expect(csv.endsWith("\r\n")).toBe(true)`; `:89` - `expect(csv.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/)` | PASS |
| C5 | 3 linhas em ordem crescente, números do `ReportDay`, acumulado `01:00`, `00:30`, `00:30` | unit "uma linha por dia com os números do relatório" exit 0 | `src/lib/csv.test.ts:104` - `toEqual(["12/10/2026", "13/10/2026", "14/10/2026"])`; `:105` - `expect(rows.map((r) => r.slice(3, 7))).toEqual([["09:00","08:00","01:00","01:00"],["07:30","08:00","-00:30","00:30"],["00:00","00:00","00:00","00:30"]])` | PASS |
| C6 | intervalos semana/mes/tudo; página e rota importam a mesma função | unit "intervalo do período" exit 0; `git grep -n "rangeFor" -- src/app/relatorio/page.tsx src/app/relatorio/csv/route.ts` | `src/lib/csv.test.ts:113` - `toMatchObject({ from: "2026-10-12", to: "2026-10-18" })`; `:117` - `toMatchObject({ from: "2026-10-01", to: "2026-10-31" })`; `:118` - `toMatchObject({ from: "0000-00-00", to: "9999-12-31" })`. git grep: `route.ts:2` e `page.tsx:17` são imports de `@/lib/csv`; `route.ts:18` e `page.tsx:42` são chamadas; nenhuma definição local | PASS |
| C7 | `ano` vira `mes`; `ref` `15/10/2026` ou ausente vira hoje; `periodo` em array vira `mes` | unit "parâmetros inválidos caem no padrão" exit 0 | `src/lib/csv.test.ts:126` - `toEqual({ period: "mes", ref: "2026-10-05" })`; `:130` - `toEqual({ period: "semana", ref: today })`; `:134` - `toEqual({ period: "tudo", ref: today })`; `:135` - `parseReportParams({ periodo: ["semana", "tudo"], ... })` `toEqual({ period: "mes", ref: "2026-10-05" })`. Lacuna de nível: veja o gap 1 | PASS |
| C8 | período vazio = BOM + cabeçalho + `\r\n`; a rota responde `200` com esse corpo para `2099-01-01` | unit "período vazio só tem cabeçalho" exit 0; e2e "csv de mês futuro só tem cabeçalho" exit 0 | `src/lib/csv.test.ts:142` - `expect(reportCsv([])).toBe(`${BOM}${HEADER}\r\n`)`; `e2e/pwa.e2e.ts:272` - `expect(response.status).toBe(200)`; `:273` - `expect(decode(await bytes(response))).toBe(`﻿${HEADER}`)` | PASS |
| C9 | sem cookie: `307` para `/login`, `next` = URL do CSV, corpo não é CSV | unit "exportação exige sessão" exit 0; e2e "csv exige sessão" exit 0 | `src/proxy.test.ts:38` - `toBe(307)`; `:40` - `toBe("/login")`; `:41` - `toBe("/relatorio/csv?periodo=mes&ref=2026-10-05")`; `e2e/pwa.e2e.ts:278` - `toBe(307)`; `:280` - `toBe("/login")`; `:281` - `searchParams.get("next")` `toBe("/relatorio/csv?periodo=mes&ref=2026-10-05")`; `:282` - `not.toContain("text/csv")`; `:283` - `not.toContain("Data;Dia;Batidas")` | PASS |
| C10 | `12/10/2026;Segunda` e `17/10/2026;Sábado` | unit "data e dia da semana" exit 0 | `src/lib/csv.test.ts:146` - `toEqual(["12/10/2026", "Segunda"])`; `:147` - `toEqual(["17/10/2026", "Sábado"])`. Plano (AC 9), check e teste concordam no nome inteiro, e o relatório usa o mesmo `EEE` (`src/app/relatorio/page.tsx:140`, `:181`), como registra o Handoff | PASS |
| C11 | `08:00 12:00 13:00 17:30` a partir de batidas fora de ordem; vazio sem batidas | unit "batidas em ordem separadas por espaço" exit 0 | `src/lib/csv.test.ts:157` - `expect(rowOf(dayOf(shuffled))[2]).toBe("08:00 12:00 13:00 17:30")`; `:158` - `toBe("")` | PASS |
| C12 | −90, 45, 0 viram `-01:30`, `00:45`, `00:00`, sem `+` e sem `−` | unit "durações em HH:MM com hífen" exit 0 | `src/lib/csv.test.ts:164` - `toBe("-01:30")`; `:165` - `toBe("00:45")`; `:166` - `toBe("00:00")`; `:167` - `not.toMatch(/[+−]/)` | PASS |
| C13 | hoje com `balance` −120 e `bankDelta` 0 dá `00:00`; dia passado com −120 dá `-02:00` | unit "saldo de hoje usa só o excedente" exit 0 | `src/lib/csv.test.ts:172` - `toBe(-120)`; `:173` - `toBe(0)`; `:174` - `expect(rowOf(today[0])[5]).toBe("00:00")`; `:175` - `toBe("-02:00")` | PASS |
| C14 | rótulos do badge para os 8 status e o tipo em `abonado`; badge e CSV usam a mesma função | unit "status igual ao badge" exit 0 | `src/lib/csv.test.ts:191` - `expect(rowOf({ ...base, status })[7]).toBe(label)` sobre a tabela literal dos 8 status (`:179-188`); `:199` - `toBe(label)` para `Feriado`/`Folga`/`Atestado`. A mesma função só foi provada lendo o código (`src/components/format.tsx` `const label = statusLabel(day)`, `src/lib/csv.ts` `statusLabel(d)`), veja o gap 3 | PASS |
| C15 | `Feriado;`, `Atestado;02:00`, `;` | unit "colunas do abono" exit 0 | `src/lib/csv.test.ts:205` - `toEqual(["Feriado", ""])`; `:207` - `toEqual(["Atestado", "02:00"])`; `:208` - `toEqual(["", ""])` | PASS |
| C16 | termina em `Atestado;02:00;consulta \| 12:00 almoço longo` | unit "observações do abono e das batidas" exit 0 | `src/lib/csv.test.ts:221` - `expect(lineOf(day).endsWith(";Atestado;02:00;consulta \| 12:00 almoço longo")).toBe(true)` | PASS |
| C17 | `;`, `"` e quebra de linha vão entre aspas, aspas duplicadas, 11 colunas | unit "escapa separador, aspas e quebra de linha" exit 0 | `src/lib/csv.test.ts:227` - `endsWith(';"12:00 a;b"')`; `:228` - `endsWith(';"12:00 diz ""oi"""')`; `:230` - `toContain(';"12:00 linha1\nlinha2"\r\n')`; `:234` - `expect(rows[1]).toHaveLength(11)`. O campo testado é `12:00 <nota>` (observação de batida), não `a;b` puro; a regra de aspas é a mesma | PASS |
| C18 | `=`, `+`, `-`, `@` ganham `'`; duração `-01:30` sem prefixo | unit "observação não vira fórmula" exit 0 | `src/lib/csv.test.ts:242` - `expect(rowOf(day)[10]).toBe(`'${note}`)` para `=SOMA(A1)`, `+1`, `-1`, `@x`; `:244` - `toBe("-01:30")` | PASS |

### Gaps (precisão e nível)

1. **Nível, C7.** A conversão de parâmetro repetido para lista existe só em `src/app/relatorio/csv/route.ts:10-13` (`search.getAll(name)` e depois `values.length === 1 ? values[0] : ...`). Nenhum proof passa por ela: o teste unitário chama `parseReportParams` já com uma lista, e nenhum e2e pede `?periodo=semana&periodo=tudo`. Uma rota com `search.get("periodo")` pegaria `semana`, divergiria da página e ainda passaria em todos os proofs.
2. **Nível, C5/C6 na rota.** O filtro `days.filter((d) => d.date >= from && d.date <= to)` (`route.ts:19`) não é asserido pela fronteira HTTP: o C2 confere só o prefixo do cabeçalho, e o C8 usa um mês sem dias. Que o filtro usa o `rangeFor` compartilhado está provado pelo git grep, não por um teste. O `checks.md` aceita isso de forma explícita ("a rota só repassa os dias filtrados").
3. **Precisão, C14.** "O badge e o CSV usam a mesma função" não tem asserção: foi conferido lendo `src/components/format.tsx` (`statusLabel(day)`). A tabela de rótulos do teste (`csv.test.ts:179-188`) repete a do `STATUS_LABELS` em vez de ler o badge renderizado.
4. **Precisão, C17.** A claim cita os campos `a;b` etc., mas o teste só os exercita como observação de batida (`12:00 a;b`). Uma observação de abono com `;` não é testada, embora passe pelo mesmo `text()`/`quote()`.

Nenhum gap tem uma asserção que contradiga o valor do check. São lacunas de alcance, e nenhuma está na lista de "What fails the feature".

### Swept existing

- **dependency failure**: está no código. `src/lib/holidays.ts:52-58` envolve cada ano em `try/catch`, chama `console.error(`[feriados] falha ao importar ${year}: ...`)` e não relança. `src/lib/data.ts:37` chama `await syncNationalHolidays(startDate, now.date)` dentro do `loadBank`. O Gate mostrou esses logs (`timeout`, `status 503`) com a suíte verde.
- **authorization (C9)**: está no código. O matcher de `src/proxy.ts` (`/((?!_next/static|_next/image|favicon.ico).*)`) cobre `/relatorio/csv`. Um GET sem sessão válida vai para `NextResponse.redirect` em `/login` com `next = pathname + search`, e a rota não faz checagem própria, como pede a door 1.

### Leitura de sanidade (AC 1, 2, 5, 6)

- AC 1: `src/app/relatorio/page.tsx` renderiza `<a href={exportHref(period, ref)} download ...>` com o texto "Exportar CSV", usando o `period`/`ref` já resolvidos por `parseReportParams`.
- AC 2: `route.ts` exporta `async function GET(request: NextRequest)` e responde com `Content-Type: text/csv; charset=utf-8` e `Content-Disposition: attachment; filename="${csvFilename(...)}"`. É a forma literal da door 1.
- AC 5: a rota usa o mesmo `loadBank` e o mesmo `rangeFor` que a página e filtra `days` pelo mesmo predicado da página (`page.tsx`: `d.date >= range.from && d.date <= range.to`).
- AC 6: a página e a rota usam `parseReportParams` com `now.date` como padrão.

## Coverage

Não recalculado: o perfil é `light`, e o passo de recálculo da `Coverage` roda só em `standard` e `ui`.

## Faults injected

Não rodou no perfil light, nenhuma falha foi injetada.

## Gate

`bun run test` (`bun test --conditions react-server`): 96 passed, 0 failed, 333 expect() calls, 8 files, exit 0. E2E da feature: 3 passed, 0 failed depois de `bun run build`.
