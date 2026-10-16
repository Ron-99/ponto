# Lessons

Mantido à mão (caminho degradado: sem Python no ambiente, `lessons.py` não roda). Mesmas regras:
só entradas ancoradas num relatório de verificação, e `candidate` vira `confirmed` depois de
aparecer em duas features diferentes.

## Candidate

| ID | Signal | Lesson | Source | Scope | Features |
| --- | --- | --- | --- | --- | --- |
| L-001 | surviving_mutant | Quando um caminho de erro é engolido por uma regra de recuperação, prove que a ação não aconteceu contando as chamadas, não pelo resultado final | `abono-parcial/verification.md` round 1 - C21, `src/lib/db.test.ts:124`, mutação `let version = 1;` em `src/lib/db.ts:62` | migrations | abono-parcial |
| L-002 | precision_gap | Um guard cujo efeito já é garantido por uma etapa anterior não é provado pela saída final: afirme a pré-condição no teste e diga na check qual barreira está sendo provada | `alertas-clt/verification.md` round 1 - C13, `src/lib/hours.test.ts:396`, guard `status !== "inconsistente"` em `src/lib/hours.ts:279` redundante com `worked = 0` de `summarizeDay` | tests | alertas-clt |
