# Prazo de compensação do banco checks

Profile: light
Plan: `.specs/features/prazo-compensacao/plan.md`

32 checks in 5 slices · 2 one-way doors · 0 open

Todos os proofs rodam com `bun test --conditions react-server`. Nos exemplos, "padrão" é a semana
`[0, 480, 480, 480, 480, 480, 0]` (domingo a sábado), e "sem jornada" é `[0, 0, 0, 0, 0, 0, 0]`,
que deixa todo minuto trabalhado como extra e torna o acumulado fácil de conferir. "Base" é a
regra de ciclo (`0000-01-01`, 0).

## Testes existentes que esta feature reescreve

A migração 3 muda o estado final de qualquer banco ao conectar, de `schema_version` 2 para 3.
Por isso, exatamente cinco asserções aprovadas em `abono-parcial` e `jornada-semanal` trocam
`toBe("2")` por `toBe("3")` em `src/lib/db.test.ts`. São os testes "migra banco sem versão",
"migração concorrente segue", "migração não roda duas vezes", "migração 2 copia a jornada atual"
e "migração 2 concorrente segue". O resto dessas checks continua afirmado sem mudança. C32 prende
essa regra.

`buildReport` recebe as regras de ciclo como entrada opcional: sem ela, vale só a base. Nenhuma
chamada existente muda.

## Checks

### S1 - Ciclos e zeramento no cálculo do saldo · 4 files · 40 KB · ~10k

- [x] **C1** - Com a base e uma regra sem prazo a partir de `2026-09-01`, o ciclo de `2026-08-31` vai de `0000-01-01` a `2026-08-31`, e o de `2026-09-01` começa em `2026-09-01` e não tem fim (AC 1, AC 4)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "ciclo começa na data da regra"`

- [x] **C2** - Com a regra de 4 meses a partir de `2026-01-31`, os ciclos são `2026-01-31` a `2026-05-30`, `2026-05-31` a `2026-09-29`, `2026-09-30` a `2027-01-30`, e o seguinte começa em `2027-01-31` (AC 2, AC 3)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "ciclos contados a partir da data da regra"`

- [x] **C3** - Com as regras de 4 meses a partir de `2026-05-01` e de 6 meses a partir de `2026-10-01`, recebidas fora de ordem, o ciclo de `2026-09-15` vai de `2026-09-01` a `2026-09-30`, e o de `2026-10-01` vai de `2026-10-01` a `2027-03-31` (AC 4)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "regra nova fecha o ciclo em andamento"`

- [x] **C4** - Banco desde `2026-05-01`, sem jornada, regra de 4 meses a partir de `2026-05-01`, 180 minutos em `2026-08-31`, 30 em `2026-09-01`, hoje `2026-09-02`: o acumulado é 180 em `2026-08-31` e 30 em `2026-09-01`, e o único ciclo fechado é `2026-05-01` a `2026-08-31` com saldo de fechamento 180 (AC 5, AC 6)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "acumulado zera no início do ciclo"`

- [x] **C5** - Com só a base, ou sem passar regras, o acumulado de cada dia de um relatório com faltas, extras e abono é a soma dos `bankDelta` até ele, e não há ciclo fechado (AC 7)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "sem prazo o acumulado não zera"`

- [x] **C6** - Banco desde `2026-06-15`, regra de 4 meses a partir de `2026-05-01`, hoje `2026-09-02`: o primeiro ciclo fechado vai de `2026-06-15` a `2026-08-31` (AC 8)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "banco começa no meio do ciclo"`

- [x] **C7** - No cenário de C4, a linha de `2026-09-01` do CSV tem `00:30` na coluna Acumulado (AC 9)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "acumulado do csv zera no ciclo"`

### S2 - Painel mostra quanto vence e quando · 2 files · 20 KB · ~5k

- [x] **C8** - Regra de 4 meses a partir de `2026-09-01`, hoje `2026-10-16`: com saldo 330 a linha é "+05:30 vencem em 31/12/2026 (daqui a 76 dias).", com −120 é "−02:00 a compensar até 31/12/2026 (daqui a 76 dias).", e com 0 é "O ciclo fecha em 31/12/2026 (daqui a 76 dias)." (AC 10, AC 11, AC 12)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "linha de vencimento pelo sinal do saldo"`

- [x] **C9** - Na mesma regra, com saldo 330, hoje `2026-12-30` dá "+05:30 vencem em 31/12/2026 (amanhã)." e hoje `2026-12-31` dá "+05:30 vencem em 31/12/2026 (hoje)." (AC 13)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "vencimento amanhã e hoje"`

- [x] **C10** - Sem linha de vencimento (`null`) com só a base, e com a base mais uma regra sem prazo a partir de `2026-09-01`, hoje `2026-10-16` (AC 14)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "sem prazo não mostra vencimento"`

- [x] **C11** - Com a regra de 4 meses a partir de `2026-09-01` e uma sem prazo a partir de `2026-11-01`, hoje `2026-10-16`, saldo 330: "+05:30 vencem em 31/10/2026 (daqui a 15 dias)." Com só a base e a regra de `2026-11-01`, a linha também usa 31/10/2026. (AC 15)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "regra futura antecipa o vencimento"`

- [x] **C12** - Num relatório sem jornada com 30 minutos em `2026-09-01` e 60 em `2026-09-02`, hoje `2026-09-03`, ciclo começando em `2026-09-01` e banco desde `2026-08-25` com 120 minutos em `2026-08-26`: a frase do gráfico, passando o início do ciclo, é "Subiu 01:00 desde 01/09." (AC 16)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "tendência desde o início do ciclo"`

### S3 - Relatório guarda os ciclos fechados · 2 files · 22 KB · ~6k

- [x] **C13** - O rótulo do card do saldo é "Banco do ciclo (desde 01/09/2026)" com banco desde `2026-05-01` e ciclo desde `2026-09-01`, e "Banco total (desde 01/05/2026)" com ciclo desde `2026-05-01` ou desde `0000-01-01` (AC 17, AC 18)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "rótulo do banco no relatório"`

- [x] **C14** - Com a regra de 2 meses a partir de `2026-05-01`, banco desde `2026-05-01`, hoje `2026-09-15`, os ciclos fechados vêm do mais recente para o mais antigo, com os rótulos "01/07/2026 a 31/08/2026" e "01/05/2026 a 30/06/2026" e o acumulado do último dia de cada um como saldo de fechamento. O ciclo de hoje não entra. (AC 19)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "ciclos fechados do mais recente"`

- [x] **C15** - Com o ciclo em vigor terminando hoje e nenhum outro dentro do banco, a lista de ciclos fechados é vazia, e a página só desenha o card quando ela tem itens (AC 20)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "ciclo que fecha hoje não está fechado"`
Proof: `grep -c "closed.length > 0 &&" src/app/relatorio/page.tsx` imprime `1`

- [x] **C16** - O relatório calcula os ciclos fechados de todos os dias do banco, não dos dias do período em tela (AC 21)
Proof: `grep -c "closedCycles(days, " src/app/relatorio/page.tsx` imprime `1`

### S4 - Cadastrar e remover regras em Configurações · 5 files · 25 KB · ~7k

- [x] **C17** - A lista das regras base, `2026-09-01` de 4 meses e `2026-11-01` de 1 mês vem nesta ordem: "A partir de 01/11/2026" · "Ciclos de 1 mês", "A partir de 01/09/2026" · "Ciclos de 4 meses", "Desde o início" · "Sem prazo" (AC 22)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "lista de prazos"`

- [x] **C18** - `saveCycle({ validFrom: "2026-09-01", months: 4 })` grava a linha (`2026-09-01`, 4) e responde "Prazo salvo: ciclos de 4 meses a partir de 01/09/2026." (AC 23)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "salva prazo de compensação"`

- [x] **C19** - `saveCycle({ validFrom: "2026-09-01", months: 0 })` grava (`2026-09-01`, 0) e responde "Prazo salvo: sem prazo a partir de 01/09/2026." (AC 24)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "salva sem prazo com data"`

- [x] **C20** - Salvar `2026-09-01` com 4 e depois com 6 deixa uma linha só para essa data, com 6 (AC 25)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "mesma data substitui o prazo"`

- [x] **C21** - As datas `""`, `"2026-13-01"`, `"01/09/2026"` e `"0000-01-01"` são recusadas com "Informe a data de início do ciclo.", e a base continua sendo a única linha (AC 26)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa data do ciclo inválida"`

- [x] **C22** - Os prazos −1, 13, 2.5 e `NaN` são recusados com "Escolha um prazo de 1 a 12 meses, ou sem prazo." sem gravar nada, e 12 é aceito (AC 27)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa prazo fora de 0 a 12"`

- [x] **C23** - Remover `2026-09-01` apaga a linha e responde "Regra de 01/09/2026 removida.", e o ciclo de `2026-10-16` volta a começar em `0000-01-01` sem fim (AC 28)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "remove regra de prazo"`

- [x] **C24** - Remover `0000-01-01` é recusado com "A regra desde o início não pode ser removida.", e a linha continua no banco (AC 29)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "não remove o prazo desde o início"`

- [x] **C25** - A lista de Configurações só desenha o botão de remover numa linha que não é a base (AC 30)
Proof: `grep -c "row.validFrom !== SINCE_START &&" src/components/cycle-form.tsx` imprime `1`

- [x] **C26** - Hoje `2026-10-16`: só com a base, os valores iniciais são prazo 4 e data `2026-10-01`. Com a regra de 6 meses a partir de `2026-09-01`, prazo 6 e data `2026-10-01`. (AC 31)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "formulário de prazo começa com a regra em vigor"`

- [x] **C27** - Sem sessão (com `APP_PASSWORD` definida), `saveCycle` e `removeCycle` respondem `UNAUTHORIZED` e não gravam nada (Observable: unauthorised)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "prazo exige sessão"`

### S5 - Migração do banco existente · 2 files · 15 KB · ~4k

- [x] **C28** - Num banco em `schema_version` 2, a primeira consulta cria `bank_cycles` com uma linha só, (`0000-01-01`, 0), e grava `schema_version` = 3. Um banco sem versão chega ao mesmo estado na mesma conexão. (AC 32)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração 3 cria o prazo desde o início"`
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migra banco sem versão até a 3"`

- [x] **C29** - Num banco em versão 2 com batidas e abonos, o acumulado de `buildReport` com as regras lidas depois da migração é igual ao acumulado sem regras (AC 33)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração 3 preserva o saldo"`

- [x] **C30** - Se outra instância aplica a migração 3 entre a leitura da versão e o batch, a conexão segue e `bank_cycles` tem uma linha só. Se o batch da migração 3 falha e `schema_version` continua 2, o erro é propagado e `bank_cycles` fica sem linhas. (AC 34)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração 3 concorrente segue"`
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "falha da migração 3 propaga"`

- [x] **C31** - Num banco já em `schema_version` 3, uma conexão nova não envia nenhum batch (AC 32, idempotência)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração não roda duas vezes"`

- [x] **C32** - Nenhuma asserção existente é removida ou enfraquecida. Em `git diff 78b3f53 -- src/lib/hours.test.ts src/lib/csv.test.ts src/app/actions.test.ts src/lib/db.test.ts`, as únicas linhas `-` com `expect(` são as cinco `toBe("2")` de `db.test.ts`, cada uma trocada por `toBe("3")` (regra 3)
Proof: `git diff 78b3f53 -- src/lib/hours.test.ts src/lib/csv.test.ts src/app/actions.test.ts src/lib/db.test.ts | grep -E '^-[^-].*expect\(' | grep -vc 'toBe("2")'` imprime `0`, e `git diff 78b3f53 -- src/lib/db.test.ts | grep -c '^-.*toBe("2")'` imprime `5`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| início de ciclo (3) | `valid_from` de regra sem prazo C1 · `valid_from` de regra com prazo C2, C3 · `addMonths` k × N C2 | - |
| fim de ciclo (3) | próximo ciclo da regra C2 · `valid_from` da regra seguinte C1, C3 · sem fim C1, C10 | - |
| dia do mês no `addMonths` (2) | dia que existe em todo mês C3, C4 · dia 31 C2 | - |
| acumulado (3) | dia comum C4, C5 · primeiro dia de ciclo C4 · primeiro dia do banco no meio de um ciclo C6 | - |
| quem lê `accumulated` (4) | painel e relatório pelo `total` = último `accumulated` C4 · gráfico C12 · CSV C7 · ciclos fechados C4, C14 | - |
| linha de vencimento (6) | saldo positivo C8 · negativo C8 · zero C8 · amanhã C9 · hoje C9 · sem fim C10 | - |
| fim do ciclo em vigor (2) | pelo prazo C8 · pela regra futura C11 | - |
| rótulo do card do saldo (3) | ciclo depois do início do banco C13 · ciclo no início do banco C13 · base C13 | - |
| lista de ciclos fechados (3) | vários, ordenados C14 · nenhum C15 · independente do período em tela C16 | - |
| rótulo do prazo (3) | sem prazo C17 · 1 mês C17 · N meses C17 | - |
| entrada de `saveCycle` (5) | válida com prazo C18 · válida sem prazo C19 · data repetida C20 · data inválida C21 · prazo inválido C22 | - |
| bordas do prazo (5) | −1 C22 · 0 C19 · 12 C22 · 13 C22 · não inteiro C22 | - |
| `removeCycle` (2) | regra comum C23 · base C24 | - |
| estados da migração (5) | sem versão C28 · versão 2 C28 · já em 3 C31 · corrida C30 · falha real C30 | - |
| doors do plano (2) | tabela `bank_cycles` C28, C30 · linha `0000-01-01` C21, C24, C28 | - |

- Nenhuma check afirma rota nem status HTTP: o plano não tem `Surface`.
- C8 a C14, C17 e C26 provam o texto, o rótulo, a lista e os valores iniciais nos helpers puros que o painel, o relatório e Configurações interpolam, não a renderização. C15, C16 e C25 provam por `grep` só a condição que desenha. No perfil `light` essa lacuna de nível é aceita.

## Swept

- validation: C21, C22
- failure modes: C30 - um batch com falha não deixa `bank_cycles` pela metade
- idempotency: C20, C31
- authorization: C27 - as Server Actions novas começam com `authorized()`, como as atuais
- concurrency: C30 - migração concorrente. Duas gravações com a mesma data se resolvem pelo upsert: a última vence, e continua uma linha só (C20).
- data lifecycle: C28, C29 - backfill da linha base sem mudar o saldo
- dependency failure: n/a - a feature não chama nada externo além do banco, cuja falha é C30
- state transitions: C1, C3, C23, C24 - criar, substituir e remover regra, e a base nunca sai
- observability: n/a - o app não tem logs. Uma migração com falha chega ao `error.tsx` pelo erro propagado em C30.

## Handoff

- S1-S5 ≈ 32k tokens (≈ 125 KB: `hours.ts` 16 KB, `hours.test.ts` 22 KB, `db.ts` 9 KB, `db.test.ts` 10 KB, `data.ts` 2 KB, `actions.ts` 8 KB, `actions.test.ts` 8 KB, `csv.test.ts` 9 KB, `page.tsx` 8 KB, `relatorio/page.tsx` 9 KB, `config/page.tsx` 2 KB, `README.md` 5 KB, mais ≈ 17 KB de código e testes novos, ÷ 4), abaixo do budget de 150k - one builder

- **Boundary:** C1-C32 closed no commit desta feature
- **Settled mid-build:** nada além do plano. `cycleFor`, `closedCycles`, `dueNotice`, `bankLabel`, `cycleRows` e `cycleFormDefaults` ficam em `hours.ts`, ao lado dos helpers da jornada. O `Select` de `src/components/ui/select.tsx` é usado pela primeira vez, em `cycle-form.tsx`.
- **Abandoned:** nada
