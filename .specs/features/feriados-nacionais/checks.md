# Feriados nacionais automáticos checks

Profile: light
Plan: `.specs/features/feriados-nacionais/plan.md`

13 checks in 2 slices · 3 one-way doors · 0 open

Todos os proofs rodam com `bun test --conditions react-server` (o script `test` do `package.json`).
A BrasilAPI nunca é chamada de verdade nos testes: `globalThis.fetch` é substituído em cada um.

## Checks

### S1 - Feriados importados viram abono · 4 files · 30 KB · ~8k

- [x] **C1** - Com `start_date` 2025-06-01 e hoje em 2026, `loadBank` busca `https://brasilapi.com.br/api/feriados/v1/2025` e `.../2026`, e 2026-04-21 volta como abono `feriado` com `note` "Tiradentes" e saldo do dia 0 (AC 1)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "carregar o banco importa os feriados dos anos do banco"`

- [x] **C2** - Depois da importação, `holidays_synced:2026` = `1`. Se o batch falha no meio, nem as linhas nem a chave persistem (AC 2)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "linhas e marca do ano gravam juntas"`

- [x] **C3** - Uma segunda importação para um ano com `holidays_synced:<ano>` faz 0 chamadas de `fetch` (AC 3)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "ano sincronizado não chama a API"`

- [x] **C4** - Uma data que já tinha abono `folga` com `note` "ponte" continua `folga` / "ponte" depois da importação (AC 4)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "abono existente prevalece"`

- [x] **C5** - Depois de "Dia normal" (`setOverride(<data>, null)`) num feriado importado, uma nova importação não recria o abono (AC 5)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "feriado removido não volta"`

- [x] **C6** - Os itens com `date` "2026-4-21", "21/04/2026" ou "2025-12-25" na resposta do ano 2026 não são gravados, e os válidos são (AC 6)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "ignora datas inválidas ou de outro ano"`

- [x] **C7** - O título do abono no `DayDialog` é "Abono do dia · Tiradentes" quando há `note`, e "Abono do dia" sem `note` ou sem abono (AC 7)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "título do abono mostra a observação"`

- [x] **C8** - Duas importações simultâneas do mesmo ano deixam cada data uma única vez e `holidays_synced:2026` = `1` (Landing door 1)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "importações simultâneas não duplicam"`

### S2 - Falha da BrasilAPI · 2 files · 14 KB · ~4k

- [x] **C9** - Status `500`, corpo `{}`, lista vazia `[]` e itens sem `name` resolvem sem lançar erro, não gravam linhas nem `holidays_synced:2026` (AC 8)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "resposta ruim não grava nada"`

- [x] **C10** - Uma API que não responde é abandonada em 3s (entre 2,9s e 4s) sem gravar nada (AC 8)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "timeout de 3s"`

- [x] **C11** - Depois de uma falha no ano 2026, uma nova importação 59 minutos depois faz 0 chamadas, e 61 minutos depois faz 1 (AC 9)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "espera 1h depois de uma falha"`

- [x] **C12** - Cada falha registra um `console.error` com o ano e o motivo: `timeout`, `status 500` ou `resposta inválida` (AC 10)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "falha registra ano e motivo"`

- [x] **C13** - Com a API falhando, `loadBank` ainda devolve os dias com os abonos existentes (AC 8)
Proof: `bun test --conditions react-server src/lib/holidays.test.ts -t "carregar o banco funciona com a API fora"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| estado do ano (3) | não sincronizado C1 · sincronizado C3 · falhou há menos de 1h C11 | - |
| conteúdo da data antes da importação (3) | vazia C1 · com abono C4 · removida pelo usuário C5 | - |
| item da resposta (4) | válido C6 · formato `yyyy-M-d` C6 · formato `dd/MM/yyyy` C6 · outro ano C6 | - |
| tipos de falha (5) | timeout C10 · status ≠ 200 C9 · não é lista C9 · lista vazia C9 · item sem `name` C9 | - |
| motivos registrados (3) | `timeout` C12 · `status 500` C12 · `resposta inválida` C12 | - |
| doors do plano (3) | chave por ano C2, C8 · abono comum sem origem C1, C4 · BrasilAPI via `fetch` C1, C9 | - |

- Nenhuma check afirma rota própria: o plano não tem `Surface`.
- C7 prova o texto no helper que o `DayDialog` interpola, não a renderização (lacuna de nível aceita no `light`).

## Swept

- validation: C6, C9
- failure modes: C2, C13
- idempotency: C3, C5
- authorization: existing - `src/proxy.ts` exige sessão antes de qualquer página que chama `loadBank`
- concurrency: C8
- data lifecycle: C5
- dependency failure: C9, C10, C11
- state transitions: C3, C11
- observability: C12

## Handoff

- S1-S2 ≈ 12k tokens (≈ 44 KB nos arquivos tocados ÷ 4), abaixo do budget de 150k - one builder
