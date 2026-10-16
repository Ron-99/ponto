# Alertas da CLT verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 3311983..9ce7b34
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Binding sources

Nenhuma. O plano não marca nenhuma fonte como binding (`Sources` cita só o `ROADMAP.md` como
origem dos três limites), e o passo 1 só roda no perfil `ui`.

## Checks

Todos os proofs rodaram em `HEAD` (9ce7b34) numa única invocação:
`bun test --conditions react-server src/lib/hours.test.ts -t "<alternância dos 14 nomes>"`, exit 0,
`14 pass · 28 filtered out · 0 fail · 27 expect() calls`. Rodei de novo com
`--reporter=junit` para mostrar cada teste individualmente: os 14 `testcase` da suíte
`alertas da CLT` aparecem sem `<skipped>` nem `<failure>` (linhas 292-399, assertions
2,2,2,2,2,2,2,1,2,4,1,1,1,3 = 27). Nenhum filtro casou vazio. Os 14 testes são novos neste diff
(`src/lib/hours.test.ts`, bloco `describe("alertas da CLT")` adicionado em 9ce7b34). O diff de
`checks.md` no intervalo só marca as caixas `[x]`, sem mudar nenhuma claim.

As constantes do sufixo são lidas no próprio teste: `BREAK = "A CLT pede pelo menos 1h acima de 6h."`
(`hours.test.ts:275`), `EXTRA = "A CLT permite até 2h por dia."` (`:276`),
`REST = "A CLT pede pelo menos 11h."` (`:277`). Todas as asserções comparam a lista inteira com
`toEqual`, então o texto é exato e a ausência de outros alertas também fica provada.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | intervalo curto 00:30 em 07:30; fracionado usa o maior (00:40 em 07:00) | `-t "alerta de intervalo curto"` exit 0, testcase linha 292 | `src/lib/hours.test.ts:293` - `toEqual([`Intervalo de 00:30 numa jornada de 07:30. ${BREAK}`])`; `:298` - `toEqual([`Intervalo de 00:40 numa jornada de 07:00. ${BREAK}`])` | PASS |
| C2 | sem intervalo 06:20 (par fechado) e 06:30 (entrada aberta, agora 14:30) | `-t "alerta sem intervalo"` exit 0, linha 301 | `hours.test.ts:302` - `toEqual([`Sem intervalo numa jornada de 06:20. ${BREAK}`])`; `:305-306` - `toEqual([`Sem intervalo numa jornada de 06:30. ${BREAK}`])` | PASS |
| C3 | intervalo de 01:00 não alerta; 00:59 alerta | `-t "intervalo de 1h não alerta"` exit 0, linha 310 | `hours.test.ts:311` - `toEqual([])`; `:312-313` - `toEqual([`Intervalo de 00:59 numa jornada de 08:01. ${BREAK}`])` | PASS |
| C4 | `worked` 06:00 não alerta; 06:01 alerta | `-t "jornada de até 6h não pede intervalo"` exit 0, linha 317 | `hours.test.ts:318` - `toEqual([])`; `:319-320` - `toEqual([`Intervalo de 00:30 numa jornada de 06:01. ${BREAK}`])` | PASS |
| C5 | 02:30 extras com meta 480; 02:31 no sábado sem meta | `-t "alerta de horas extras"` exit 0, linha 324 | `hours.test.ts:325-326` - `toEqual([`02:30 de horas extras hoje. ${EXTRA}`])`; `:328-329` - `toEqual([`02:31 de horas extras hoje. ${EXTRA}`])` | PASS |
| C6 | +02:00 não alerta; +02:01 alerta | `-t "2h extras não alerta"` exit 0, linha 333 | `hours.test.ts:334` - `toEqual([])`; `:335-336` - `toEqual([`02:01 de horas extras hoje. ${EXTRA}`])` | PASS |
| C7 | entrada aberta 07:00: agora 17:00 não alerta extras, 17:01 alerta | `-t "horas extras com entrada aberta"` exit 0, linha 340 | `hours.test.ts:345` - `expect(extras(17 * 60)).toEqual([])`; `:346` - `expect(extras(17 * 60 + 1)).toEqual([`02:01 de horas extras hoje. ${EXTRA}`])` (filtrado por `includes("horas extras")`, `:341-343`) | PASS |
| C8 | descanso 09:30 desde a saída de ontem às 22:00 | `-t "alerta de descanso curto"` exit 0, linha 349 | `hours.test.ts:351-352` - `toEqual([`Descanso de 09:30 desde a saída de ontem às 22:00. ${REST}`])` | PASS |
| C9 | 11:00 não alerta; 10:59 alerta | `-t "11h de descanso não alerta"` exit 0, linha 356 | `hours.test.ts:359` - `expect(at("09:00", "13:00")).toEqual([])`; `:360-361` - `toEqual([`Descanso de 10:59 desde a saída de ontem às 22:00. ${REST}`])` | PASS |
| C10 | sem descanso quando ontem fora do banco, sem batidas, `incompleto` ou `inconsistente`, hoje 06:00 | `-t "descanso sem saída válida ontem"` exit 0, linha 365 | `hours.test.ts:368` (fora do banco) `:370` (sem batidas) `:372` (termina em entrada) `:375` (inconsistente terminando em saída) - cada um `toEqual([])` | PASS |
| C11 | compara com o dia de calendário de ontem, não com o último dia com batidas | `-t "descanso compara com ontem, não com o último dia com batidas"` exit 0, linha 378 | `hours.test.ts:380` - `expect(alertsOn(WED, MON, list)).toEqual([])` com MON=2026-10-12 (saída 23:00), TUE=2026-10-13 sem batidas, WED=2026-10-14 entrada 07:00 (`:31-33`, `:379`) | PASS |
| C12 | três alertas na ordem intervalo, extras, descanso, textos exatos | `-t "alertas em ordem"` exit 0, linha 383 | `hours.test.ts:388-391` - `toEqual([`Intervalo de 00:20 numa jornada de 10:40. ${BREAK}`, `02:40 de horas extras hoje. ${EXTRA}`, `Descanso de 08:00 desde a saída de ontem às 23:00. ${REST}`])` | PASS |
| C13 | hoje `inconsistente` (duas entradas) não alerta intervalo nem extras | `-t "dia inconsistente não alerta intervalo nem extras"` exit 0, linha 395 | `hours.test.ts:396` - `expect(alertsOn(TUE, TUE, typed(TUE, ["07:00", "in"], ["15:00", "in"]))).toEqual([])` | PASS |
| C14 | calcular não muda os dias; sem limite a lista é vazia | `-t "alertas não mudam o dia"` exit 0, linha 399 | `hours.test.ts:413` - `expect(days).toEqual(copy)` (cópia `structuredClone` em `:411`, depois de `cltAlerts` com `toHaveLength(3)` em `:412`); `:414` - `toEqual([])` para 08:00-12:00, 13:00-17:00 | PASS |

### Observações (não bloqueiam)

1. **Lacuna de nível aceita, C12 e C14 (AC 11).** A ordem, a lista e "lista vazia" são provadas na
   função pura; a renderização no card, o ícone por linha e "o painel não mostra o bloco" não têm
   asserção. `checks.md` aceita essa lacuna no perfil `light`. Conferi o JSX à mão:
   `src/app/page.tsx:52` chama `cltAlerts(days, now.date)`; `:112` só renderiza o `<ul>` com
   `alerts.length > 0`; `:113-118` faz `alerts.map` preservando a ordem, com um
   `<AlertTriangleIcon>` dentro de cada `<li>` (`:116`), dentro do `CardContent` do card cujo
   título é "Hoje" (`:107`). Cor `text-amber-700`, coerente com a premissa "sem vermelho de erro".
   Bate com o AC 11.
2. **C13 não distingue a guarda de status.** Em `summarizeDay` o `worked` é 0 quando a sequência é
   inválida (`src/lib/hours.ts:120-132`), então o teste de `:396` passaria mesmo sem o
   `if (day.status !== "inconsistente")` de `hours.ts:279`. O comportamento do AC 12 está provado;
   o que falta é sensibilidade a essa linha específica. Seria um mutante sobrevivente num perfil
   `standard`. No `light` não há injeção de falhas, então fica registrado sem mudar o resultado.
3. **C13, precondição não afirmada.** O teste não confere que o dia é `inconsistente`; ele depende
   de `validateSequence` rejeitar duas entradas seguidas, já coberto por
   `"rejeita duas entradas seguidas"` na mesma suíte.

### Swept `existing`, relidos no código

- **authorization: existing** - confirmado. `src/proxy.ts` exporta `proxy` com
  `matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]`, que pega `/`; sem sessão válida
  (`isValidSession`), um GET é redirecionado para `/login` e outros métodos recebem 401. O painel
  em `/` fica protegido, e os alertas saem no mesmo render.
- **state transitions: C7 + AutoRefresh (60 s, existing)** - confirmado.
  `src/components/auto-refresh.tsx` define `intervalMs = 60_000` e chama `router.refresh()` num
  `setInterval`; `src/app/page.tsx:56` renderiza `<AutoRefresh />` sem sobrescrever o intervalo.

## Coverage

Não recalculado no perfil `light`. Li a tabela do autor em `checks.md` (6 conjuntos, nenhum membro
sem proof) e não encontrei contradição com as asserções citadas acima.

## Faults injected

Não roda no perfil `light`. Nenhuma falha foi injetada.

## Gate

`bun run test` - 70 passed, 0 failed (184 expect() calls, 7 files). As linhas `[feriados] falha ao
importar 2026: timeout / status 503` são logs esperados dos testes de falha de importação de
feriados, não falhas.

`validate_verification.py` não rodou: Python não está disponível neste ambiente.
