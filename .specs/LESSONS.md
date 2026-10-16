# Lessons

Mantido à mão (caminho degradado: sem Python no ambiente, `lessons.py` não roda). Mesmas regras:
só entradas ancoradas num relatório de verificação, e `candidate` vira `confirmed` depois de
aparecer em duas features diferentes.

## Confirmed

| ID | Signal | Lesson | Source | Scope | Features |
| --- | --- | --- | --- | --- | --- |
| L-001 | surviving_mutant | Quando um caminho de erro é engolido por uma regra de recuperação, prove que a ação não aconteceu contando as chamadas, não pelo resultado final | `abono-parcial/verification.md` round 1 - C21, `src/lib/db.test.ts:124`, mutação `let version = 1;` em `src/lib/db.ts:62` ; `jornada-semanal/verification.md` round 1 - C26, `src/lib/db.test.ts` "migração 2 concorrente segue" não afirma que o batch falhou | migrations | abono-parcial, jornada-semanal |

## Candidate

| ID | Signal | Lesson | Source | Scope | Features |
| --- | --- | --- | --- | --- | --- |
| L-002 | precision_gap | Um guard cujo efeito já é garantido por uma etapa anterior não é provado pela saída final: afirme a pré-condição no teste e diga na check qual barreira está sendo provada | `alertas-clt/verification.md` round 1 - C13, `src/lib/hours.test.ts:396`, guard `status !== "inconsistente"` em `src/lib/hours.ts:279` redundante com `worked = 0` de `summarizeDay` | tests | alertas-clt |
| L-003 | precision_gap | Quando o exemplo de uma check cumpre duas leituras do critério ao mesmo tempo (ex.: série que cruza o zero), acrescente um caso que só uma delas satisfaz | `grafico-saldo/verification.md` round 1 - C6, `src/lib/hours.ts:368-369`, rótulos do eixo como limites da escala e não como mínimo e máximo da série | tests | grafico-saldo |
