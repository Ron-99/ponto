# Abono parcial checks

Profile: light
Plan: `.specs/features/abono-parcial/plan.md`

21 checks in 4 slices · 2 one-way doors · 0 open

Todos os proofs rodam com `bun test --conditions react-server` (o script `test` do `package.json`),
para que `server-only` resolva para o módulo vazio fora do Next.

## Checks

### S1 - Meta reduzida no cálculo · 2 files · 22 KB · ~6k

- [x] **C1** - Dia útil com `minutes` = 120 e jornada 480 tem `target` = 360 (AC 1)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "abono parcial reduz a meta"`

- [x] **C2** - Com jornada 120 e `minutes` 120, ou jornada 60 e `minutes` 120, `target` = 0 (AC 2)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "abono parcial nunca deixa meta negativa"`

- [x] **C3** - Dia útil passado com abono parcial de 120 e sem batidas: status `falta`, `bankDelta` = −360 (AC 3)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "abono parcial sem batidas é falta"`

- [x] **C4** - Dia com abono parcial e pares fechados tem status `ok` (AC 4)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "abono parcial com pares fechados é ok"`

- [x] **C5** - Abono com `minutes` NULL mantém `target` = 0 e status `abonado`, com e sem batidas (AC 5)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "abono de dia inteiro mantém meta zero"`

- [x] **C6** - Hoje, com abono parcial de 120, entrada aberta às 08:00, jornada 480 e agora 09:00: meta 06:00 e saída para fechar às `14:00` (AC 6)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "saída para fechar usa meta reduzida"`

### S2 - Registrar e remover · 3 files · 18 KB · ~5k

- [x] **C7** - `setDayOverride(<dia útil>, "atestado", "02:00")` grava `minutes` = 120 e responde "Atestado de 02:00 registrado." (AC 7)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "registra abono parcial"`

- [x] **C8** - Com horas vazias grava `minutes` NULL e responde "Dia marcado como atestado." (AC 8)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "horas vazias abonam o dia inteiro"`

- [x] **C9** - `"2:0"`, `"abc"` e `"00:00"` são recusados com "Horas abonadas devem estar no formato HH:MM." e nada é gravado (AC 9)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa horas abonadas inválidas"`

- [x] **C10** - Com jornada 480, `"08:00"` e `"09:00"` são recusados com "Abono parcial deve ser menor que a jornada de 08:00. Para o dia todo, deixe as horas em branco." e nada é gravado (AC 10)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa abono parcial maior ou igual à jornada"`

- [x] **C11** - Num sábado, `"02:00"` é recusado com "Fim de semana já tem meta de 0h." e nada é gravado (AC 11)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "recusa abono parcial no fim de semana"`

- [x] **C12** - Abono parcial seguido de abono de dia inteiro na mesma data deixa uma linha com `minutes` NULL (AC 12)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "parcial vira dia inteiro"`

- [x] **C13** - "Dia normal" (`kind` null) num dia com abono parcial remove a linha (AC 13)
Proof: `bun test --conditions react-server src/app/actions.test.ts -t "dia normal remove abono parcial"`

### S3 - Exibição · 4 files · 26 KB · ~7k

- [x] **C14** - A descrição do card Hoje para meta 360 com atestado de 120 é "Meta de 06:00 (atestado de 02:00)", e para abono de dia inteiro continua "Meta de 00:00 (dia abonado)" (AC 14)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "descrição da meta do dia"`

- [x] **C15** - O valor inicial de "Horas abonadas" é `"02:00"` para `minutes` 120 e `""` para NULL ou sem abono (AC 15)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "valor inicial das horas abonadas"`

- [x] **C16** - O badge extra do relatório é "Atestado 02:00" para abono parcial e não existe (null) para abono de dia inteiro ou sem abono (AC 16)
Proof: `bun test --conditions react-server src/lib/hours.test.ts -t "badge do abono parcial"`

### S4 - Migração · 2 files · 12 KB · ~3k

- [x] **C17** - Num banco com o esquema antigo e sem `schema_version`, a primeira consulta deixa `day_overrides.minutes` existindo e `schema_version` = `1` (AC 17)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migra banco sem versão"`

- [x] **C18** - Depois da migração, os abonos existentes voltam com `minutes` NULL e `buildReport` dá o mesmo acumulado de antes (AC 18)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração preserva abonos e saldo"`

- [x] **C19** - Se outra instância aplica a migração entre a leitura da versão e o batch, o batch falha e a conexão segue normalmente (AC 19)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração concorrente segue"`

- [x] **C20** - Se o batch falha e `schema_version` continua < 1, o erro é propagado (AC 20)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "falha de migração propaga"`

- [x] **C21** - Um banco já em `schema_version` 1 não roda o `ALTER TABLE` de novo ao conectar (AC 17, idempotência)
Proof: `bun test --conditions react-server src/lib/db.test.ts -t "migração não roda duas vezes"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| fórmula da meta (4) | minutos < jornada C1 · minutos = jornada C2 · minutos > jornada C2 · minutos NULL C5 | - |
| status com abono parcial (3) | sem batidas `falta` C3 · pares fechados `ok` C4 · hoje em andamento C6 | - |
| entrada "Horas abonadas" (5) | válida C7 · vazia C8 · formato inválido C9 · `00:00` C9 · ≥ jornada C10 | - |
| tipo de dia (2) | útil C7 · fim de semana C11 | - |
| transições do abono (4) | nenhum→parcial C7 · nenhum→inteiro C8 · parcial→inteiro C12 · parcial→nenhum C13 | - |
| estados da migração (4) | sem versão C17 · já em 1 C21 · corrida C19 · falha real C20 | - |
| doors do plano (2) | mecanismo `MIGRATIONS` C17, C19, C20, C21 · coluna `minutes` C17, C18 | - |
| lugares que mostram o abono parcial (3) | card Hoje C14 · `DayDialog` C15 · relatório C16 | - |

- Nenhuma check afirma status HTTP nem rota: o plano não tem `Surface`.
- C14, C15 e C16 provam o texto no helper puro que cada tela usa, e não a renderização. No perfil `light` isso é uma lacuna de nível aceita: o JSX só interpola o helper.

## Swept

- validation: C9, C10, C11
- failure modes: C20
- idempotency: C21
- authorization: existing - `setDayOverride` começa com `if (!(await authorized())) return UNAUTHORIZED` em `src/app/actions.ts`
- concurrency: C19
- data lifecycle: C18
- dependency failure: n/a - a feature não chama nada externo além do banco, cuja falha é C20
- state transitions: C12, C13
- observability: n/a - o app não tem logs. Uma migração com falha chega ao `error.tsx` pelo erro propagado em C20.

## Handoff

- S1-S4 ≈ 21k tokens (≈ 78 KB nos arquivos tocados ÷ 4), abaixo do budget de 150k - one builder
