# Exportar CSV checks

Profile: light
Plan: `.specs/features/exportar-csv/plan.md`

18 checks in 2 slices · 4 one-way doors · 0 open

Os proofs unitários rodam com `bun test --conditions react-server` (o script `test`). Os proofs
`e2e/pwa.e2e.ts` precisam do build antes (`bun run build`, como em `test:e2e`). Eles sobem
`next start` com `APP_PASSWORD` e entram com o cookie de `sessionToken()`, como o teste do botão
"Bater ponto" já faz.

## Checks

### S1 - Baixar o período em CSV · 6 files · 30 KB · ~8k

- [ ] **C1** - O link do relatório para `periodo=mes` e `ref=2026-10-05` é `/relatorio/csv?periodo=mes&ref=2026-10-05`, e o texto do link é "Exportar CSV" (AC 1)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "link de exportação usa o período da tela"`

- [ ] **C2** - Com sessão, `GET /relatorio/csv?periodo=mes&ref=2026-10-05` responde `200`, `content-type` `text/csv; charset=utf-8`, `content-disposition` `attachment; filename="ponto-2026-10.csv"`, e o corpo começa com `﻿Data;Dia;Batidas;Trabalhado;Meta;Saldo;Acumulado;Status;Abono;Horas abonadas;Observações\r\n` (AC 2, AC 4)
Proof: `bun test ./e2e/pwa.e2e.ts -t "csv é baixado com sessão"`

- [ ] **C3** - O nome do arquivo é `ponto-2026-10.csv` para (`mes`, 2026-10-05), `ponto-semana-2026-10-12.csv` para (`semana`, 2026-10-15) e `ponto-ate-2026-10-16.csv` para (`tudo`, hoje 2026-10-16) (AC 2, AC 3)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "nome do arquivo por período"`

- [ ] **C4** - O texto gerado começa com o BOM e a linha de cabeçalho literal, e cada linha, inclusive a última, termina em `\r\n` (AC 4)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "cabeçalho, BOM e fim de linha"`

- [ ] **C5** - Para o `buildReport` de 2026-10-12 a 2026-10-14 (+60, −30, folga), o CSV tem 3 linhas de dados em ordem crescente, com `Trabalhado`, `Meta`, `Saldo` e `Acumulado` iguais aos de cada `ReportDay` (`Acumulado` `01:00`, `00:30`, `00:30`) (AC 5)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "uma linha por dia com os números do relatório"`

- [ ] **C6** - O intervalo usado pela página e pela rota é o mesmo: `semana` com 2026-10-15 vai de 2026-10-12 a 2026-10-18, `mes` com 2026-10-15 vai de 2026-10-01 a 2026-10-31, e `tudo` vai de `0000-00-00` a `9999-12-31`. A página e a rota importam a mesma função. (AC 5)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "intervalo do período"`
Proof: `git grep -n "rangeFor" -- src/app/relatorio/page.tsx src/app/relatorio/csv/route.ts` mostra um import nos dois arquivos e nenhuma definição local

- [ ] **C7** - `periodo` = `ano` vira `mes`, `ref` = `15/10/2026` ou ausente vira a data de hoje, e um `periodo` repetido na URL (array) vira `mes` (AC 6)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "parâmetros inválidos caem no padrão"`

- [ ] **C8** - Sem dias no período, o texto é só BOM, cabeçalho e `\r\n`. A rota responde `200` com esse corpo para `periodo=mes&ref=2099-01-01`. (AC 7)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "período vazio só tem cabeçalho"`
Proof: `bun test ./e2e/pwa.e2e.ts -t "csv de mês futuro só tem cabeçalho"`

- [ ] **C9** - Com `APP_PASSWORD` definida e sem cookie, `GET /relatorio/csv?periodo=mes&ref=2026-10-05` responde `307` para `/login` com `next` = `/relatorio/csv?periodo=mes&ref=2026-10-05`, e o corpo não é CSV (AC 8)
Proof: `bun test --conditions react-server src/proxy.test.ts -t "exportação exige sessão"`
Proof: `bun test ./e2e/pwa.e2e.ts -t "csv exige sessão"`

### S2 - Conteúdo de cada linha · 3 files · 20 KB · ~5k

- [ ] **C10** - 2026-10-12 sai como `12/10/2026;Seg`, e 2026-10-17 como `17/10/2026;Sáb` (AC 9)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "data e dia da semana"`

- [ ] **C11** - `Batidas` é `08:00 12:00 13:00 17:30` para essas quatro batidas inseridas fora de ordem, e vazio num dia sem batidas (AC 10)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "batidas em ordem separadas por espaço"`

- [ ] **C12** - As durações −90, 45 e 0 saem como `-01:30`, `00:45` e `00:00`, sem `+` e sem o sinal `−` (U+2212) (AC 11)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "durações em HH:MM com hífen"`

- [ ] **C13** - Para hoje em andamento com `balance` −120 e `bankDelta` 0, `Saldo` é `00:00`. Para um dia passado com `balance` −120, é `-02:00`. (AC 12)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "saldo de hoje usa só o excedente"`

- [ ] **C14** - `Status` usa o mesmo rótulo do badge para os 8 status (`OK`, `Em andamento`, `Batida ímpar`, `Inconsistente`, `Sem batidas` em `falta` e em `pendente`, `Fim de semana`) e, em `abonado`, o tipo (`Feriado`, `Folga`, `Atestado`). O badge e o CSV usam a mesma função. (AC 13)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "status igual ao badge"`

- [ ] **C15** - `Abono;Horas abonadas` é `Feriado;` para feriado de dia inteiro, `Atestado;02:00` para atestado parcial de 120 e `;` sem abono (AC 14)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "colunas do abono"`

- [ ] **C16** - Um dia com atestado parcial de 120, observação "consulta" e batida das 12:00 com observação "almoço longo" termina em `Atestado;02:00;consulta | 12:00 almoço longo` (AC 15)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "observações do abono e das batidas"`

- [ ] **C17** - Os campos `a;b`, `diz "oi"` e `linha1\nlinha2` saem como `"a;b"`, `"diz ""oi"""` e `"linha1\nlinha2"`, e a linha continua com 11 colunas (AC 16)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "escapa separador, aspas e quebra de linha"`

- [ ] **C18** - Uma observação que começa com `=`, `+`, `-` ou `@` ganha `'` na frente (`=SOMA(A1)` vira `'=SOMA(A1)`), e as colunas de duração continuam sem o prefixo (`-01:30`) (AC 17)
Proof: `bun test --conditions react-server src/lib/csv.test.ts -t "observação não vira fórmula"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /relatorio/csv` statuses (2) | 200 C2, C8 · 307 C9 | - |
| período (3) | `semana` C3, C6 · `mes` C2, C3, C6 · `tudo` C3, C6 | - |
| parâmetro inválido (3) | `periodo` desconhecido C7 · `periodo` em array C7 · `ref` fora do formato ou ausente C7 | - |
| status do dia (8) | C14, table-driven sobre os 8 de `DayStatus`, mais os 3 tipos em `abonado` | - |
| abono (3) | nenhum C15 · dia inteiro C15 · parcial C15 | - |
| caracteres que pedem aspas (3) | `;` C17 · `"` C17 · quebra de linha C17 | - |
| início de fórmula (4) | `=` C18 · `+` C18 · `-` C18 · `@` C18 | - |
| colunas (11) | `Data` C10 · `Dia` C10 · `Batidas` C11 · `Trabalhado` C5, C12 · `Meta` C5 · `Saldo` C5, C13 · `Acumulado` C5 · `Status` C14 · `Abono` C15 · `Horas abonadas` C15 · `Observações` C16 | - |
| doors do plano (4) | route handler C2, C9 · cabeçalho literal C4 · formato do arquivo C4, C10, C12 · nome do arquivo C3 | - |

- C2, C8 e C9 cruzam a fronteira HTTP no build de produção. O conteúdo das colunas é provado na função pura que a rota chama (C4-C18), porque a rota só repassa os dias filtrados.
- C1 prova o `href` no helper que o relatório usa, não a renderização. No perfil `light` essa lacuna de nível é aceita: o JSX só interpola o helper.

## Swept

- validation: C7, C17, C18
- failure modes: n/a - a rota só lê. Uma falha do banco vira exceção e cai no `500` padrão do Next, igual às páginas.
- idempotency: n/a - `GET` sem efeito colateral. O mesmo pedido gera o mesmo arquivo enquanto os dados não mudam.
- authorization: C9 - o `proxy` existente protege a rota, como as páginas
- concurrency: n/a - leitura de um usuário só, sem estado compartilhado
- data lifecycle: n/a - nada é gravado nem apagado
- dependency failure: existing - `loadBank` chama `syncNationalHolidays`, que registra a falha da BrasilAPI em `console.error` e segue sem lançar (`src/lib/holidays.ts`)
- state transitions: n/a - não há estado
- observability: n/a - o app não tem logs além da falha de feriados, que já existe

## Handoff

- S1-S2 ≈ 13k tokens (≈ 50 KB: `relatorio/page.tsx` 10 KB, `hours.ts` 9 KB, `format.tsx` 3 KB, `proxy.test.ts` 2 KB, `e2e/pwa.e2e.ts` 7 KB, `README.md` 4 KB, mais ≈ 15 KB novos em `csv.ts`, `csv.test.ts` e `route.ts`, ÷ 4), abaixo do budget de 150k - one builder
