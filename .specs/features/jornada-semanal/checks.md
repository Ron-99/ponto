# Jornada por dia da semana checks

Profile: light
Plan: `.specs/features/jornada-semanal/plan.md`

28 checks in 4 slices · 2 one-way doors · 0 open

Todos os proofs rodam com `bun test --conditions react-server`. Nos exemplos, "padrão" é a semana
`[0, 480, 480, 480, 480, 480, 0]` (domingo a sábado), que é o que a migração 2 cria a partir da
jornada única de 08:00.

## Testes existentes que esta feature reescreve

O plano muda a origem da jornada (Flow, passos 3 e 4): `buildReport` escolhe a jornada daquele
dia e a passa a `summarizeDay` (exists), que continua recebendo um número, e `targetFor` deixa de
olhar `isWeekend`. Nenhuma linha `expect(` de `hours.test.ts` muda, porque todas as chamadas com
`480` são em dia de semana. Mudam só entradas fora de asserções:

- em "trabalho no fim de semana é todo extra", o `480` do sábado vira `0`, a jornada que a semana padrão dá ao sábado. A regra "sábado padrão vale 0" passa a ser provada por C22 e C3.
- `dailyMinutes: 480` em `buildReport` (`hours.test.ts` e `db.test.ts`) vira a lista com a jornada padrão.
- `saveSettings({ dailyMinutes: 480, ... })` no `beforeEach` de `actions.test.ts` vira a gravação da jornada padrão.

A migração 2 também muda o estado final de qualquer banco ao conectar, de `schema_version` 1 para
2. Por isso, exatamente três asserções aprovadas em `abono-parcial` (C17, C19, C21) trocam
`toBe("1")` por `toBe("2")` em `src/lib/db.test.ts`. São os testes "migra banco sem versão",
"migração concorrente segue" e "migração não roda duas vezes". O resto dessas checks continua
afirmado sem mudança: a coluna `minutes` existe, a corrida segue, e um banco já migrado não
recebe nenhum batch. C28 prende essa regra.

## Checks

### S1 - Meta do dia pela jornada em vigor · 4 files · 30 KB · ~8k

- [ ] **C1** - Com a semana `[0, 540, 540, 540, 540, 240, 0]`, a meta é 540 na segunda 2026-10-12 e 240 na sexta 2026-10-16 (AC 1)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "meta pela jornada do dia da semana"`

- [ ] **C2** - Com 240 no sábado, o sábado passado 2026-10-10 sem batidas tem `target` 240, status `falta` e `bankDelta` −240 (AC 2)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "sábado com jornada sem batidas é falta"`

- [ ] **C3** - Num dia com jornada 0 e sem batidas, o status é `folga-semanal`. O rótulo do badge é "Fim de semana" no sábado e no domingo, e "Sem jornada" numa quarta com jornada 0. `StatusBadge` usa a mesma função de rótulo. (AC 3)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "dia sem jornada"`

- [ ] **C4** - Com as jornadas `0000-01-01` padrão e `2026-10-19` `[0, 540, 540, 540, 540, 240, 0]`, `buildReport` de 2026-10-12 a 2026-10-23 dá `target` 480 em 2026-10-16 e 240 em 2026-10-23 (AC 4)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "vigência não muda os dias anteriores"`

- [ ] **C5** - Com jornadas em `0000-01-01`, `2026-10-19` e `2026-11-02`, recebidas fora de ordem, a jornada escolhida é a de `0000-01-01` em 2026-10-18, a de `2026-10-19` em 2026-10-19 e em 2026-11-01, e a de `2026-11-02` em 2026-11-02 (AC 5)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "jornada em vigor na data"`

- [ ] **C6** - Numa quarta, 2026-10-14, com 540 na quinta e 240 na sexta, os dias que faltam somam 780 na meta da "Semana atual". Se uma jornada nova com 0 na sexta começa em 2026-10-16, a soma é 540. (AC 6)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "meta dos dias que faltam na semana"`

- [ ] **C7** - Numa sexta com jornada 240, abono de dia inteiro dá meta 0, e abono parcial de 60 dá meta 180 (AC 7)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "abono usa a jornada do dia"`

### S2 - Cadastrar e remover jornadas · 5 files · 22 KB · ~6k

- [ ] **C8** - A lista de Configurações para as jornadas `0000-01-01` e `2026-10-19` vem nesta ordem: `2026-10-19` com rótulo "A partir de 19/10/2026" e total `40:00`, depois "Desde o início" com total `40:00`. Cada uma traz os 7 dias em `HH:MM`, de segunda a domingo. (AC 8)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "lista de jornadas"`

- [ ] **C9** - `saveSchedule` com data `2026-10-19` e os 7 campos grava a linha `2026-10-19` com esses minutos e responde "Jornada salva a partir de 19/10/2026." (AC 9)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "salva jornada com data de início"`

- [ ] **C10** - Com a data vazia, a linha `0000-01-01` recebe os minutos novos, nenhuma linha é criada, e a resposta é "Jornada desde o início salva." (AC 10)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "data vazia substitui desde o início"`

- [ ] **C11** - Salvar duas vezes com a data `2026-10-19` deixa uma linha só, com os valores da segunda vez (AC 11)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "mesma data substitui"`

- [ ] **C12** - `9:0` na segunda é recusado com "Jornada de segunda deve estar no formato HH:MM, até 24:00.", e `24:01` no sábado com "Jornada de sábado deve estar no formato HH:MM, até 24:00.". `24:00` é aceito. A data `2026-13-01` é recusada com "Data inválida.". Nada é gravado nos casos recusados. (AC 12)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa jornada inválida"`

- [ ] **C13** - Os 7 campos em `00:00` são recusados com "Informe a jornada de pelo menos um dia." e nada é gravado (AC 13)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa semana sem jornada"`

- [ ] **C14** - Remover `2026-10-19` apaga a linha e responde "Jornada de 19/10/2026 removida.", e a sexta 2026-10-23 volta a ter meta 480 (AC 14)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "remove jornada"`

- [ ] **C15** - Remover `0000-01-01` é recusado com "A jornada desde o início não pode ser removida.", e a linha continua no banco (AC 15)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "não remove desde o início"`

- [ ] **C16** - Com hoje 2026-10-16 e as jornadas `0000-01-01` padrão e `2026-10-19`, os valores iniciais do formulário são os da padrão (`08:00` de segunda a sexta, `00:00` no sábado e no domingo), e a data é `2026-10-16` (AC 16)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "formulário começa com a jornada em vigor hoje"`

- [ ] **C17** - Sem sessão (com `APP_PASSWORD` definida), `saveSchedule` e `removeSchedule` respondem `UNAUTHORIZED` e não gravam nada (Observable: unauthorised)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "jornada exige sessão"`

### S3 - Abono parcial com a jornada do dia · 2 files · 9 KB · ~3k

- [ ] **C18** - Com 240 na sexta, `setDayOverride(<sexta>, "folga", "04:00")` é recusado com "Abono parcial deve ser menor que a jornada de 04:00. Para o dia todo, deixe as horas em branco." (AC 17)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "abono parcial usa a jornada do dia"`

- [ ] **C19** - Num sábado com jornada 0, `"02:00"` continua recusado com "Fim de semana já tem meta de 0h." (AC 18)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa abono parcial no fim de semana"`

- [ ] **C20** - Numa quarta com jornada 0, `"02:00"` é recusado com "Este dia não tem jornada, a meta já é 0h." e nada é gravado (AC 19)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa abono parcial em dia sem jornada"`

- [ ] **C21** - Num sábado com jornada 240, `"01:00"` grava `minutes` 60, e a meta do dia no `buildReport` é 180 (AC 20)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "abono parcial no sábado com jornada"`

### S4 - Migração do banco existente · 2 files · 13 KB · ~3k

- [ ] **C22** - Num banco em `schema_version` 1 com `daily_minutes` = 450, a primeira consulta cria `work_schedules` com uma linha só, `0000-01-01`, e `d0..d6` = `0, 450, 450, 450, 450, 450, 0`, e grava `schema_version` = 2 (AC 21)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração 2 copia a jornada atual"`

- [ ] **C23** - Sem `daily_minutes` em `settings`, a linha `0000-01-01` sai com 480 de segunda a sexta (AC 22)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração 2 sem jornada usa 8h"`

- [ ] **C24** - Num banco antigo com abonos, batidas e `daily_minutes` = 450, o acumulado de `buildReport` com a jornada única de antes é igual ao acumulado com as jornadas lidas depois da migração (AC 23)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração 2 preserva o saldo"`

- [ ] **C25** - Um banco sem `schema_version` aplica as migrações 1 e 2 na mesma conexão: a coluna `minutes` existe, `work_schedules` tem a linha `0000-01-01`, e `schema_version` = 2 (AC 21, encadeamento)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migra banco sem versão"`

- [ ] **C26** - Se outra instância aplica a migração 2 entre a leitura da versão e o batch, o batch falha, a conexão segue, e `work_schedules` tem uma linha só. Se o batch da migração 2 falha e `schema_version` continua 1, o erro é propagado e nenhuma linha fica em `work_schedules`. (AC 24)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração 2 concorrente segue"`
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "falha da migração 2 propaga"`

- [ ] **C27** - Num banco já em `schema_version` 2, uma conexão nova não envia nenhum batch (contado por proxy, lição L-001) (AC 21, idempotência)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração não roda duas vezes"`

- [ ] **C28** - Nenhuma asserção existente é removida ou enfraquecida. Em `git diff 821eac4 -- src/lib/hours.test.ts src/app/actions.test.ts src/lib/db.test.ts`, as únicas linhas `-` com `expect(` são as três `expect(await version(client)).toBe("1");` de `db.test.ts`, cada uma trocada por `toBe("2")` (regra 3)
Proof: `git diff 821eac4 -- src/lib/hours.test.ts src/app/actions.test.ts src/lib/db.test.ts | grep -E '^-[^-].*expect\(' | grep -vc 'toBe("1")'` imprime `0`, e `git diff 821eac4 -- src/lib/db.test.ts | grep -c '^-.*toBe("1")'` imprime `3`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| dias da semana (7) | domingo C3 · segunda C1 · terça-quinta C6 · sexta C1, C7 · sábado C2, C3 · quarta sem jornada C3, C20 | - |
| escolha da vigência (4) | antes da segunda linha C5 · no dia exato C5 · entre duas C5 · na última C5 | - |
| meta (4) | jornada > 0 sem abono C1 · jornada 0 C3 · abono inteiro C7 · abono parcial C7, C21 | - |
| rótulo de dia sem jornada (2) | sábado ou domingo "Fim de semana" C3 · outro dia "Sem jornada" C3 | - |
| entrada de `saveSchedule` (6) | válida C9 · data vazia C10 · data repetida C11 · campo fora do formato C12 · campo > 24:00 C12 · todos 00:00 C13 | - |
| bordas de um campo (3) | `00:00` C13 · `24:00` aceito C12 · `24:01` recusado C12 | - |
| `removeSchedule` (2) | vigência comum C14 · desde o início C15 | - |
| abono parcial × jornada do dia (4) | minutos ≥ jornada C18 · fim de semana sem jornada C19 · dia de semana sem jornada C20 · sábado com jornada C21 | - |
| estados da migração (5) | sem versão C25 · versão 1 C22, C23 · já em 2 C27 · corrida C26 · falha real C26 | - |
| doors do plano (2) | tabela `work_schedules` C22, C26 · linha `0000-01-01` C10, C15, C22, C23 | - |
| quem lia a jornada única (6) | `targetFor` C1 · `buildReport` C4 · `setDayOverride` C18 · meta da semana em `page.tsx` C6 · `SettingsForm` C16 · `getSettings` C22, C24 | - |

- Nenhuma check afirma rota nem status HTTP: o plano não tem `Surface`.
- C3, C6, C8 e C16 provam o rótulo, a soma da semana, a lista e os valores iniciais nos helpers puros que o painel e Configurações interpolam, não a renderização. No perfil `light` essa lacuna de nível é aceita.

## Swept

- validation: C12, C13
- failure modes: C26 - um batch com falha não deixa `work_schedules` pela metade
- idempotency: C11, C27
- authorization: C17 - as Server Actions novas começam com `authorized()`, como as atuais
- concurrency: C26 - migração concorrente. Duas gravações com a mesma data se resolvem pelo upsert: a última vence, e continua uma linha só (C11).
- data lifecycle: C22, C24 - backfill da jornada atual sem mudar o saldo
- dependency failure: n/a - a feature não chama nada externo além do banco, cuja falha é C26
- state transitions: C10, C14, C15 - criar, substituir e remover vigência, e a linha "desde o início" nunca sai
- observability: n/a - o app não tem logs. Uma migração com falha chega ao `error.tsx` pelo erro propagado em C26.

## Handoff

- S1-S4 ≈ 19k tokens (≈ 75 KB: `hours.ts` 9 KB, `hours.test.ts` 9 KB, `db.ts` 7 KB, `db.test.ts` 6 KB, `data.ts` 2 KB, `actions.ts` 6 KB, `actions.test.ts` 3 KB, `page.tsx` 8 KB, `config/page.tsx` 1 KB, `settings-form.tsx` 2 KB, `format.tsx` 3 KB, `README.md` 4 KB, mais ≈ 15 KB de código e testes novos, ÷ 4), abaixo do budget de 150k - one builder
