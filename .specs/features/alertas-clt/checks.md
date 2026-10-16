# Alertas da CLT checks

Profile: light
Plan: `.specs/features/alertas-clt/plan.md`

14 checks in 4 slices · 0 one-way doors · 0 open

Todos os proofs rodam com `bun test --conditions react-server`. Os alertas saem de uma função
pura que recebe os dias do relatório e a data de hoje. Assim ela mesma escolhe o dia anterior, e
essa escolha também fica provada.

## Checks

### S1 - Intervalo de almoço · 2 files · 18 KB · ~5k

- [x] **C1** - Hoje com 08:00, 12:00, 12:30, 16:00 dá "Intervalo de 00:30 numa jornada de 07:30. A CLT pede pelo menos 1h acima de 6h.". Com 08:00, 11:00, 11:20, 13:00, 13:40, 16:00 (intervalos de 20 e 40 min), o texto usa o maior: "Intervalo de 00:40 numa jornada de 07:00. ..." (AC 1)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "alerta de intervalo curto"`

- [x] **C2** - Hoje com um par só, 08:00-14:20, dá "Sem intervalo numa jornada de 06:20. A CLT pede pelo menos 1h acima de 6h.". Com entrada aberta às 08:00 e agora 14:30, dá "Sem intervalo numa jornada de 06:30. ..." (AC 2)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "alerta sem intervalo"`

- [x] **C3** - Um intervalo de exatamente 01:00 (08:00-12:00, 13:00-17:00) não gera alerta de intervalo. Um de 00:59 (08:00-12:00, 12:59-17:00) gera "Intervalo de 00:59 ..." (AC 3)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "intervalo de 1h não alerta"`

- [x] **C4** - Com intervalo de 30 min, `worked` = 06:00 (08:00-11:00, 11:30-14:30) não gera alerta de intervalo, e `worked` = 06:01 (08:00-11:00, 11:30-14:31) gera (AC 4)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "jornada de até 6h não pede intervalo"`

### S2 - Horas extras · 1 file · 9 KB · ~2k

- [x] **C5** - Com meta 480 e `worked` 630 hoje, dá "02:30 de horas extras hoje. A CLT permite até 2h por dia.". Num sábado com meta 0 e 08:00-10:31, dá "02:31 de horas extras hoje. ..." (AC 5)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "alerta de horas extras"`

- [x] **C6** - Com meta 480, `worked` 600 (exatamente +02:00) não gera alerta de horas extras, e `worked` 601 gera "02:01 ..." (AC 6)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "2h extras não alerta"`

- [x] **C7** - Hoje com meta 480 e entrada aberta às 07:00, agora 17:00 não gera alerta de horas extras, e agora 17:01 gera "02:01 de horas extras hoje. ..." (AC 7)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "horas extras com entrada aberta"`

### S3 - Descanso entre jornadas · 1 file · 9 KB · ~2k

- [x] **C8** - Ontem com saída às 22:00 e hoje com entrada às 07:30 dá "Descanso de 09:30 desde a saída de ontem às 22:00. A CLT pede pelo menos 11h." (AC 8)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "alerta de descanso curto"`

- [x] **C9** - Saída às 22:00 e entrada às 09:00 (exatamente 11:00) não gera alerta de descanso, e entrada às 08:59 gera "Descanso de 10:59 ..." (AC 9)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "11h de descanso não alerta"`

- [x] **C10** - Não há alerta de descanso quando ontem não está nos dias (banco começou hoje), não tem batidas, termina numa entrada (`incompleto`) ou está `inconsistente`, mesmo com a entrada de hoje às 06:00 (AC 10)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "descanso sem saída válida ontem"`

- [x] **C11** - O dia anterior é sempre o dia de calendário de ontem. Com dias 2026-10-12 (saída 23:00), 2026-10-13 (sem batidas) e hoje 2026-10-14 com entrada às 07:00, não há alerta de descanso, porque a saída de 2026-10-12 não é de ontem. (AC 8, AC 10)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "descanso compara com ontem, não com o último dia com batidas"`

### S4 - Exibição no painel · 2 files · 17 KB · ~4k

- [x] **C12** - Ontem com saída às 23:00, hoje 07:00-12:00 e 12:20-18:00, meta 480, dá exatamente três alertas na ordem intervalo ("Intervalo de 00:20 numa jornada de 10:40. ..."), horas extras ("02:40 de horas extras hoje. ...") e descanso ("Descanso de 08:00 desde a saída de ontem às 23:00. ...") (AC 11)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "alertas em ordem"`

- [x] **C13** - Hoje `inconsistente` (duas entradas, 07:00 e 15:00) não gera alerta de intervalo nem de horas extras (AC 12)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "dia inconsistente não alerta intervalo nem extras"`

- [x] **C14** - Calcular os alertas não muda os dias recebidos: `worked`, `target`, `balance`, `bankDelta`, `status` e `accumulated` ficam iguais (`toEqual` com uma cópia feita antes). Sem nenhum limite passado, a lista é vazia e o painel não mostra o bloco. (AC 13, AC 11)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "alertas não mudam o dia"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| tipos de alerta (3) | intervalo C1, C2 · horas extras C5 · descanso C8 | - |
| forma do intervalo (3) | curto C1 · fracionado (maior conta) C1 · ausente C2 | - |
| bordas (4 × 2) | intervalo 00:59 C3 · 01:00 C3 · `worked` 06:00 C4 · 06:01 C4 · extras 02:00 C6 · 02:01 C6 · descanso 10:59 C9 · 11:00 C9 | - |
| estado de hoje (3) | fechado C1 · em andamento C2, C7 · `inconsistente` C13 | - |
| meta de hoje (2) | com jornada C5 · sem meta (sábado) C5 | - |
| dia anterior (6) | saída válida C8 · fora do banco C10 · sem batidas C10 · `incompleto` C10 · `inconsistente` C10 · lacuna de calendário C11 | - |

- Nenhuma check afirma rota nem status HTTP: o plano não tem `Surface`.
- C12 e C14 provam a lista e a ordem na função pura que o card "Hoje" percorre, não a renderização nem o ícone. No perfil `light` essa lacuna de nível é aceita: o JSX só itera a lista.

## Swept

- validation: n/a - não há entrada do usuário. Os alertas leem batidas que `validateSequence` já validou.
- failure modes: n/a - função pura sem I/O
- idempotency: n/a - nada é gravado. Chamar de novo dá a mesma lista (C14).
- authorization: existing - o painel é protegido pelo `proxy` (`src/proxy.ts`)
- concurrency: n/a - cálculo por requisição, sem estado compartilhado
- data lifecycle: n/a - os alertas não são gravados
- dependency failure: n/a - não chama nada externo
- state transitions: C7 - o dia em andamento cruza o limite de 2h, e o alerta aparece na atualização seguinte do `AutoRefresh` (60 s, existing)
- observability: n/a - aviso visual, sem log

## Handoff

- S1-S4 ≈ 7k tokens (≈ 25 KB: `hours.ts` 9 KB, `hours.test.ts` 9 KB, `page.tsx` 8 KB, ÷ 4), abaixo do budget de 150k - one builder
